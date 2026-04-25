from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, json, re, bcrypt, jwt, uuid, shutil
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@envol.com').lower()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin2026')

PLANS = {
    "Bronze": {"price": 49.00, "currency": "eur", "features": ["formations_base", "checklist", "chat", "ai"]},
    "Silver": {"price": 99.00, "currency": "eur", "features": ["formations_base", "formations_advanced", "checklist", "chat", "ai", "experts_basic", "visios_groupe"]},
    "Gold": {"price": 199.00, "currency": "eur", "features": ["formations_base", "formations_advanced", "checklist", "chat", "ai", "experts_basic", "experts_premium", "visios_groupe", "visios_privee", "mentorat", "priority"]},
}

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ===== Models =====
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class OnboardingIn(BaseModel):
    answers: Dict[str, Any]

class ProjectIn(BaseModel):
    name: Optional[str] = ""
    secteur: Optional[str] = ""
    probleme: Optional[str] = ""
    solution: Optional[str] = ""
    stade: Optional[str] = ""
    montant: Optional[str] = ""
    lien: Optional[str] = ""
    pitch: Optional[str] = ""
    objectifs: Optional[List[str]] = None
    roadmap: Optional[List[Dict[str, str]]] = None
    statut: Optional[str] = "Idée"  # Idée | Développement | Lancement | Croissance

class ProfileIn(BaseModel):
    name: Optional[str] = None
    nom: Optional[str] = None
    ville: Optional[str] = None
    age: Optional[str] = None
    linkedin: Optional[str] = None
    social: Optional[str] = None
    bio: Optional[str] = None

class PostitIn(BaseModel):
    target_user_id: Optional[str] = None  # for admin posts
    text: str
    color: Optional[str] = None  # auto-set: gold (admin), blue (user)

class EventIn(BaseModel):
    title: str
    description: Optional[str] = ""
    date: str  # ISO
    duration: Optional[int] = 60
    link: Optional[str] = ""
    type: Optional[str] = "visio"  # visio | deadline | groupe | privee
    target_users: Optional[List[str]] = None  # null=all
    plan_required: Optional[str] = None  # Bronze | Silver | Gold

class ResourceIn(BaseModel):
    title: str
    description: str
    category: str
    icon: Optional[str] = "📄"
    plan_required: Optional[str] = "Bronze"
    url: Optional[str] = ""

class CheckoutIn(BaseModel):
    plan: str  # Bronze | Silver | Gold
    origin_url: str

class ChatIn(BaseModel):
    message: str

class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str


# ===== Helpers =====
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def make_token(uid: str, is_admin: bool = False) -> str:
    payload = {"uid": uid, "admin": is_admin, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["uid"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(401, "Utilisateur introuvable")
        return user
    except jwt.PyJWTError:
        raise HTTPException(401, "Token invalide")

async def get_admin(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        if not payload.get("admin"):
            raise HTTPException(403, "Accès admin requis")
        user = await db.users.find_one({"id": payload["uid"]}, {"_id": 0, "password": 0})
        if not user or not user.get("is_admin"):
            raise HTTPException(403, "Accès admin requis")
        return user
    except jwt.PyJWTError:
        raise HTTPException(401, "Token invalide")


# ===== Startup: seed admin =====
@app.on_event("startup")
async def seed_admin():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Admin Envol",
            "email": ADMIN_EMAIL,
            "password": hash_password(ADMIN_PASSWORD),
            "plan": "Gold",
            "onboarded": True,
            "is_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    else:
        # Ensure flag set + reset password to env value (idempotent)
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"is_admin": True, "password": hash_password(ADMIN_PASSWORD), "plan": "Gold", "onboarded": True}}
        )

    # Seed default resources if empty
    if await db.resources.count_documents({}) == 0:
        defaults = [
            {"title": "Business Plan", "description": "Structure pour présenter ton projet", "category": "Stratégie", "icon": "📄", "plan_required": "Bronze"},
            {"title": "Guide Statuts", "description": "AE, SAS, SASU — lequel choisir", "category": "Juridique", "icon": "⚖️", "plan_required": "Bronze"},
            {"title": "Pitch Deck", "description": "10 slides pour lever des fonds", "category": "Levée de fonds", "icon": "💰", "plan_required": "Silver"},
            {"title": "Script Validation", "description": "20 questions pour valider", "category": "Stratégie", "icon": "🎯", "plan_required": "Bronze"},
            {"title": "Tableau Financier", "description": "Revenus, dépenses, prévisions", "category": "Finance", "icon": "📊", "plan_required": "Silver"},
            {"title": "Annuaire Envol", "description": "Avocats, comptables, devs", "category": "Réseau", "icon": "🤝", "plan_required": "Silver"},
        ]
        for r in defaults:
            r["id"] = str(uuid.uuid4())
            r["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.resources.insert_many(defaults)


# ===== Auth =====
@api_router.get("/")
async def root():
    return {"message": "Envol API", "status": "ok"}

@api_router.post("/auth/register")
async def register(data: RegisterIn):
    if len(data.password) < 6:
        raise HTTPException(400, "Mot de passe trop court (min 6)")
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(400, "Email déjà utilisé")
    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid, "name": data.name, "email": data.email.lower(),
        "password": hash_password(data.password), "plan": "Bronze",
        "onboarded": False, "is_admin": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = make_token(uid)
    return {"token": token, "user": _public_user(user_doc)}

def _public_user(u):
    return {k: u.get(k) for k in ["id", "name", "email", "plan", "onboarded", "is_admin", "ville", "age", "linkedin", "social", "bio", "nom"]}

@api_router.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Identifiants incorrects")
    token = make_token(user["id"], user.get("is_admin", False))
    return {"token": token, "user": _public_user(user)}

@api_router.post("/auth/admin-login")
async def admin_login(data: AdminLoginIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not user.get("is_admin") or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Accès admin refusé")
    token = make_token(user["id"], True)
    return {"token": token, "user": _public_user(user)}

@api_router.get("/auth/me")
async def me(user = Depends(get_user)):
    onboarding = await db.onboardings.find_one({"user_id": user["id"]}, {"_id": 0})
    project = await db.projects.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"user": user, "onboarding": onboarding, "project": project}


# ===== Onboarding =====
ONBOARDING_QUESTIONS = [
    {"id": "q1", "label": "Comment décrirais-tu ton idée en une phrase simple ?", "type": "textarea", "placeholder": "Ex : Une app pour aider les étudiants à trouver des colocataires fiables"},
    {"id": "q2", "label": "Quel problème concret essaies-tu de résoudre ?", "type": "textarea", "placeholder": "Le vrai problème, vécu par tes utilisateurs"},
    {"id": "q3", "label": "À qui s'adresse ton idée principalement ?", "type": "text", "placeholder": "Ex : Les étudiants de 18-25 ans qui cherchent un logement"},
    {"id": "q4", "label": "À quel stade en es-tu ?", "type": "select", "options": ["J'ai juste l'idée en tête", "J'en ai parlé à des proches", "J'ai commencé à esquisser quelque chose", "J'ai un prototype/MVP", "J'ai déjà des premiers utilisateurs/clients"]},
    {"id": "q5", "label": "Connais-tu déjà des concurrents ou alternatives ?", "type": "select", "options": ["Aucune idée", "J'en ai entendu parler", "J'en ai identifié quelques-uns", "J'ai bien étudié le marché"]},
    {"id": "q6", "label": "Comment penses-tu gagner de l'argent avec ce projet ?", "type": "textarea", "placeholder": "Vente directe, abonnement, commission, pub... même si c'est encore flou"},
    {"id": "q7", "label": "Es-tu seul(e) ou avec une équipe ?", "type": "select", "options": ["Tout(e) seul(e)", "Avec 1 associé(e)", "Avec 2-3 associés", "Plus de 3 personnes"]},
    {"id": "q8", "label": "As-tu un budget pour démarrer ?", "type": "select", "options": ["Aucun budget", "Moins de 500 €", "Entre 500 et 5 000 €", "Entre 5 000 et 20 000 €", "Plus de 20 000 €"]},
    {"id": "q9", "label": "Combien de temps peux-tu y consacrer par semaine ?", "type": "select", "options": ["Moins de 5h", "5 à 15h", "15 à 30h", "Temps plein"]},
    {"id": "q10", "label": "Qu'est-ce qui te motive vraiment dans ce projet ?", "type": "textarea", "placeholder": "Ta motivation profonde — sois honnête !"},
]

@api_router.get("/onboarding/questions")
async def get_questions():
    return {"questions": ONBOARDING_QUESTIONS}

@api_router.post("/onboarding/submit")
async def submit_onboarding(data: OnboardingIn, user = Depends(get_user)):
    answers = data.answers
    qa_text = "\n".join([f"Q{i+1}. {q['label']}\nRéponse: {answers.get(q['id'], '(pas de réponse)')}" for i, q in enumerate(ONBOARDING_QUESTIONS)])
    system_msg = (
        "Tu es un coach expert en entrepreneuriat pour les jeunes (15-25 ans) sur la plateforme Envol. "
        "Tu analyses des projets entrepreneuriaux. Tu es bienveillant mais honnête. "
        "Tu réponds UNIQUEMENT au format JSON valide."
    )
    user_prompt = f"""Voici les réponses d'un jeune entrepreneur :

{qa_text}

Analyse ce projet et fournis ta réponse SOUS FORME DE JSON STRICT :
{{
  "score": <entier 0-100>,
  "score_reason": "<une phrase>",
  "points_forts": ["<2-5 items>"],
  "points_vigilance": ["<2-5 items>"],
  "points_negatifs": ["<0-3 items>"],
  "ameliorations": ["<3-6 actions concrètes avec verbe d'action>"]
}}

0-30: idée très floue · 30-55: bonne intuition à clarifier · 55-75: projet solide · 75-100: très bien structuré.
Réponds en français. RIEN d'autre que le JSON."""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"onboarding-{user['id']}-{uuid.uuid4().hex[:6]}", system_message=system_msg).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=user_prompt))
        m = re.search(r'\{.*\}', response, re.DOTALL)
        analysis = json.loads(m.group(0))
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        analysis = {"score": 50, "score_reason": "Analyse par défaut", "points_forts": ["Tu as franchi la première étape"], "points_vigilance": ["Analyse IA indisponible"], "points_negatifs": [], "ameliorations": ["Compléter ton profil", "Réessayer l'analyse"]}

    # Append to score history
    score_history = []
    existing = await db.onboardings.find_one({"user_id": user["id"]})
    if existing:
        score_history = existing.get("score_history", [])
    score_history.append({"score": analysis["score"], "date": datetime.now(timezone.utc).isoformat()})

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "answers": answers,
        "analysis": analysis,
        "score_history": score_history,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.onboardings.replace_one({"user_id": user["id"]}, doc, upsert=True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"onboarded": True}})
    return {"analysis": analysis, "score_history": score_history}

@api_router.get("/onboarding/result")
async def get_result(user = Depends(get_user)):
    doc = await db.onboardings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Pas d'analyse")
    return doc


# ===== Project =====
@api_router.post("/project")
async def save_project(data: ProjectIn, user = Depends(get_user)):
    existing = await db.projects.find_one({"user_id": user["id"]}) or {}
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    doc = {
        "id": existing.get("id", str(uuid.uuid4())),
        "user_id": user["id"],
        **{k: existing.get(k, "") for k in ["name", "secteur", "probleme", "solution", "stade", "montant", "lien", "pitch", "statut"]},
        "objectifs": existing.get("objectifs", []),
        "roadmap": existing.get("roadmap", []),
        **update,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.replace_one({"user_id": user["id"]}, doc, upsert=True)
    doc.pop("_id", None)
    return {"ok": True, "project": doc}


# ===== Profile =====
@api_router.post("/profile")
async def update_profile(data: ProfileIn, user = Depends(get_user)):
    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_fields:
        await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {"user": _public_user(updated)}


# ===== Documents (uploads) =====
@api_router.post("/documents")
async def upload_document(file: UploadFile = File(...), category: str = Form("Divers"), user = Depends(get_user)):
    doc_id = str(uuid.uuid4())
    user_dir = UPLOAD_DIR / user["id"]
    user_dir.mkdir(exist_ok=True)
    safe_name = re.sub(r'[^a-zA-Z0-9._-]', '_', file.filename or "file")
    stored = f"{doc_id}_{safe_name}"
    file_path = user_dir / stored
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size = file_path.stat().st_size
    doc = {
        "id": doc_id,
        "user_id": user["id"],
        "filename": file.filename or "file",
        "stored_name": stored,
        "category": category,
        "size": size,
        "content_type": file.content_type or "application/octet-stream",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return {"document": doc}

@api_router.get("/documents")
async def list_documents(user = Depends(get_user)):
    docs = await db.documents.find({"user_id": user["id"]}, {"_id": 0}).sort("uploaded_at", -1).to_list(200)
    return {"documents": docs}

@api_router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, user = Depends(get_user)):
    doc = await db.documents.find_one({"id": doc_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(404, "Document introuvable")
    file_path = UPLOAD_DIR / user["id"] / doc["stored_name"]
    if not file_path.exists():
        raise HTTPException(404, "Fichier introuvable")
    return FileResponse(str(file_path), filename=doc["filename"], media_type=doc.get("content_type"))

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user = Depends(get_user)):
    doc = await db.documents.find_one({"id": doc_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(404)
    file_path = UPLOAD_DIR / user["id"] / doc["stored_name"]
    if file_path.exists():
        file_path.unlink()
    await db.documents.delete_one({"id": doc_id})
    return {"ok": True}


# ===== Post-its =====
@api_router.post("/postits")
async def create_postit(data: PostitIn, user = Depends(get_user)):
    is_admin = user.get("is_admin", False)
    if is_admin and not data.target_user_id:
        raise HTTPException(400, "target_user_id requis pour admin")
    target_uid = data.target_user_id if is_admin else user["id"]
    postit = {
        "id": str(uuid.uuid4()),
        "user_id": target_uid,
        "author_id": user["id"],
        "author_name": user["name"],
        "is_admin_post": is_admin,
        "color": "gold" if is_admin else "blue",
        "text": data.text,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.postits.insert_one(postit)
    postit.pop("_id", None)
    return {"postit": postit}

@api_router.get("/postits")
async def list_postits(user = Depends(get_user)):
    items = await db.postits.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"postits": items}

@api_router.post("/postits/{pid}/read")
async def mark_postit_read(pid: str, user = Depends(get_user)):
    await db.postits.update_one({"id": pid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api_router.delete("/postits/{pid}")
async def delete_postit(pid: str, user = Depends(get_user)):
    p = await db.postits.find_one({"id": pid})
    if not p:
        raise HTTPException(404)
    if p["author_id"] != user["id"] and not user.get("is_admin"):
        raise HTTPException(403)
    await db.postits.delete_one({"id": pid})
    return {"ok": True}


# ===== Events / Calendar =====
@api_router.get("/events")
async def list_events(user = Depends(get_user)):
    user_plan = user.get("plan", "Bronze")
    plan_rank = {"Bronze": 1, "Silver": 2, "Gold": 3}
    rank = plan_rank.get(user_plan, 1)
    events = await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(200)
    visible = []
    for e in events:
        req = e.get("plan_required")
        if req and plan_rank.get(req, 1) > rank:
            continue
        targets = e.get("target_users")
        if targets and user["id"] not in targets:
            continue
        visible.append(e)
    return {"events": visible}

@api_router.post("/events")
async def create_event(data: EventIn, admin = Depends(get_admin)):
    e = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.events.insert_one(e)
    e.pop("_id", None)
    return {"event": e}

@api_router.delete("/events/{eid}")
async def delete_event(eid: str, admin = Depends(get_admin)):
    await db.events.delete_one({"id": eid})
    return {"ok": True}


# ===== Resources =====
@api_router.get("/resources")
async def list_resources(user = Depends(get_user)):
    items = await db.resources.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"resources": items}

@api_router.post("/resources")
async def create_resource(data: ResourceIn, admin = Depends(get_admin)):
    r = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.resources.insert_one(r)
    r.pop("_id", None)
    return {"resource": r}

@api_router.delete("/resources/{rid}")
async def delete_resource(rid: str, admin = Depends(get_admin)):
    await db.resources.delete_one({"id": rid})
    return {"ok": True}


# ===== Admin =====
@api_router.get("/admin/users")
async def admin_users(admin = Depends(get_admin)):
    users = await db.users.find({"is_admin": {"$ne": True}}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(500)
    # Enrich with stats
    enriched = []
    for u in users:
        ob = await db.onboardings.find_one({"user_id": u["id"]}, {"_id": 0})
        prj = await db.projects.find_one({"user_id": u["id"]}, {"_id": 0})
        enriched.append({**u, "score": ob.get("analysis", {}).get("score") if ob else None, "project_name": prj.get("name") if prj else None, "project_statut": prj.get("statut") if prj else None})
    return {"users": enriched, "total": len(enriched)}

@api_router.get("/admin/stats")
async def admin_stats(admin = Depends(get_admin)):
    total = await db.users.count_documents({"is_admin": {"$ne": True}})
    bronze = await db.users.count_documents({"plan": "Bronze", "is_admin": {"$ne": True}})
    silver = await db.users.count_documents({"plan": "Silver"})
    gold = await db.users.count_documents({"plan": "Gold", "is_admin": {"$ne": True}})
    onboarded = await db.users.count_documents({"onboarded": True, "is_admin": {"$ne": True}})
    mrr = bronze * 49 + silver * 99 + gold * 199
    return {"total_users": total, "bronze": bronze, "silver": silver, "gold": gold, "onboarded": onboarded, "mrr": mrr}


# ===== AI Chat =====
@api_router.post("/ai/chat")
async def ai_chat(data: ChatIn, user = Depends(get_user)):
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"chat-{user['id']}-{uuid.uuid4().hex[:6]}",
            system_message=("Tu es l'Assistant IA d'Envol, plateforme d'incubation pour jeunes entrepreneurs (15-25 ans). "
                            "Tu réponds en français, chaleureux, concret et bienveillant. "
                            "Réponses concises (max 4-6 phrases) sauf demande explicite."),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=data.message))
        return {"reply": response}
    except Exception as e:
        logger.error(f"AI chat failed: {e}")
        raise HTTPException(500, "Assistant indisponible")


# ===== Stripe =====
@api_router.post("/checkout/session")
async def create_checkout(data: CheckoutIn, request: Request, user = Depends(get_user)):
    if data.plan not in PLANS:
        raise HTTPException(400, "Plan invalide")
    plan_info = PLANS[data.plan]
    origin = data.origin_url.rstrip('/')
    success_url = f"{origin}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/?payment=cancel"
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        req = CheckoutSessionRequest(
            amount=plan_info["price"],
            currency=plan_info["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user["id"], "plan": data.plan, "email": user["email"]},
        )
        session = await stripe_checkout.create_checkout_session(req)
    except Exception as e:
        logger.error(f"Stripe checkout failed: {e}")
        raise HTTPException(500, "Paiement indisponible")

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "email": user["email"],
        "plan": data.plan,
        "amount": plan_info["price"],
        "currency": plan_info["currency"],
        "payment_status": "initiated",
        "status": "pending",
        "metadata": {"user_id": user["id"], "plan": data.plan},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, user = Depends(get_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction introuvable")
    # If already paid, return current state
    if tx.get("payment_status") == "paid":
        return {"payment_status": "paid", "status": "complete", "plan": tx["plan"]}

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    try:
        st = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error(f"Stripe status failed: {e}")
        raise HTTPException(500, "Vérification impossible")

    update = {"payment_status": st.payment_status, "status": st.status, "checked_at": datetime.now(timezone.utc).isoformat()}
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update})

    # Upgrade plan if paid AND not yet processed
    if st.payment_status == "paid" and tx.get("payment_status") != "paid":
        await db.users.update_one({"id": tx["user_id"]}, {"$set": {"plan": tx["plan"], "plan_updated_at": datetime.now(timezone.utc).isoformat()}})

    return {"payment_status": st.payment_status, "status": st.status, "plan": tx["plan"], "amount": st.amount_total / 100 if st.amount_total else 0}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    try:
        evt = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.error(f"Webhook failed: {e}")
        raise HTTPException(400, "Webhook invalid")
    if evt.payment_status == "paid":
        tx = await db.payment_transactions.find_one({"session_id": evt.session_id})
        if tx and tx.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {"payment_status": "paid", "status": "complete", "webhook_at": datetime.now(timezone.utc).isoformat()}}
            )
            await db.users.update_one({"id": tx["user_id"]}, {"$set": {"plan": tx["plan"]}})
    return {"received": True}

@api_router.get("/plans")
async def get_plans():
    return {"plans": [{"name": k, "price": v["price"], "currency": v["currency"], "features": v["features"]} for k, v in PLANS.items()]}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
