from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

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
    answers: Dict[str, Any]  # question_id -> answer

class ProjectIn(BaseModel):
    name: Optional[str] = ""
    secteur: Optional[str] = ""
    probleme: Optional[str] = ""
    solution: Optional[str] = ""
    stade: Optional[str] = ""
    montant: Optional[str] = ""
    lien: Optional[str] = ""

class ProfileIn(BaseModel):
    name: Optional[str] = None
    nom: Optional[str] = None
    ville: Optional[str] = None
    age: Optional[str] = None
    linkedin: Optional[str] = None
    social: Optional[str] = None
    bio: Optional[str] = None


# ===== Helpers =====
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def make_token(user_id: str) -> str:
    payload = {"uid": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["uid"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")


# ===== Routes =====
@api_router.get("/")
async def root():
    return {"message": "Envol API", "status": "ok"}

@api_router.post("/auth/register")
async def register(data: RegisterIn):
    if len(data.password) < 6:
        raise HTTPException(400, "Mot de passe trop court (min 6)")
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(400, "Email déjà utilisé")
    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid,
        "name": data.name,
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "plan": "Bronze",
        "onboarded": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = make_token(uid)
    return {"token": token, "user": {"id": uid, "name": data.name, "email": data.email.lower(), "plan": "Bronze", "onboarded": False}}

@api_router.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Identifiants incorrects")
    token = make_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "plan": user.get("plan", "Bronze"), "onboarded": user.get("onboarded", False)}}

@api_router.get("/auth/me")
async def me(user = Depends(get_user)):
    onboarding = await db.onboardings.find_one({"user_id": user["id"]}, {"_id": 0})
    project = await db.projects.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"user": user, "onboarding": onboarding, "project": project}


# ===== Onboarding Questions =====
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
    # Build prompt
    qa_text = "\n".join([f"Q{i+1}. {q['label']}\nRéponse: {answers.get(q['id'], '(pas de réponse)')}" for i, q in enumerate(ONBOARDING_QUESTIONS)])

    system_msg = (
        "Tu es un coach expert en entrepreneuriat pour les jeunes (15-25 ans) sur la plateforme Envol. "
        "Tu analyses des projets entrepreneuriaux à partir d'un questionnaire d'onboarding. "
        "Tu dois être bienveillant mais honnête, encourageant mais lucide. "
        "Tu réponds UNIQUEMENT au format JSON valide, rien d'autre, pas de markdown, pas de texte avant/après."
    )

    user_prompt = f"""Voici les réponses d'un jeune entrepreneur à un questionnaire d'onboarding :

{qa_text}

Analyse ce projet et fournis ta réponse SOUS FORME DE JSON STRICT avec cette structure exacte :
{{
  "score": <entier entre 0 et 100>,
  "score_reason": "<une phrase courte qui explique le score>",
  "points_forts": ["<point fort 1>", "<point fort 2>", ...],
  "points_vigilance": ["<point vigilance 1>", "<point vigilance 2>", ...],
  "points_negatifs": ["<point négatif 1>", "<point négatif 2>", ...],
  "ameliorations": ["<amélioration concrète 1>", "<amélioration concrète 2>", ...]
}}

Règles de scoring :
- Pénalise les réponses vagues, contradictoires, ou irréalistes
- Valorise une cible claire, un problème réel, une motivation profonde
- Le score reflète la maturité du projet ET son potentiel
- 0-30: idée très floue / non viable en l'état
- 30-55: bonne intuition mais beaucoup à clarifier
- 55-75: projet solide qui peut avancer
- 75-100: projet très bien structuré

Donne 2-5 points par catégorie. Les améliorations doivent être CONCRÈTES et ACTIONNABLES (verbe d'action). 
Sois direct et utile. Réponds en français. RIEN d'autre que le JSON."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"onboarding-{user['id']}",
            system_message=system_msg,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=user_prompt))
        # Extract JSON
        m = re.search(r'\{.*\}', response, re.DOTALL)
        if not m:
            raise ValueError("No JSON in response")
        analysis = json.loads(m.group(0))
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        # Fallback
        analysis = {
            "score": 50,
            "score_reason": "Analyse automatique indisponible — score par défaut.",
            "points_forts": ["Tu as eu le courage de te lancer dans la démarche"],
            "points_vigilance": ["L'analyse IA n'a pas pu être réalisée"],
            "points_negatifs": [],
            "ameliorations": ["Réessayer l'analyse plus tard", "Compléter ton profil"]
        }

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "answers": answers,
        "analysis": analysis,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.onboardings.replace_one({"user_id": user["id"]}, doc, upsert=True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"onboarded": True}})
    return {"analysis": analysis}


@api_router.get("/onboarding/result")
async def get_result(user = Depends(get_user)):
    doc = await db.onboardings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Pas d'analyse")
    return doc


# ===== Project =====
@api_router.post("/project")
async def save_project(data: ProjectIn, user = Depends(get_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        **data.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.replace_one({"user_id": user["id"]}, doc, upsert=True)
    return {"ok": True, "project": {k: v for k, v in doc.items() if k != "_id"}}


# ===== Profile =====
@api_router.post("/profile")
async def update_profile(data: ProfileIn, user = Depends(get_user)):
    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_fields:
        await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {"user": updated}


# ===== AI Chat (bubble) =====
class ChatIn(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None

@api_router.post("/ai/chat")
async def ai_chat(data: ChatIn, user = Depends(get_user)):
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"chat-{user['id']}",
            system_message=(
                "Tu es l'Assistant IA d'Envol, plateforme d'incubation pour jeunes entrepreneurs (15-25 ans). "
                "Tu réponds en français, tu es chaleureux, concret et bienveillant. "
                "Tu aides sur : validation d'idée, statuts juridiques, premiers clients, marketing, levée de fonds, motivation. "
                "Réponses concises (max 4-6 phrases) sauf demande explicite."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=data.message))
        return {"reply": response}
    except Exception as e:
        logger.error(f"AI chat failed: {e}")
        raise HTTPException(500, "Assistant indisponible pour le moment")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
