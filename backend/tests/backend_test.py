"""Envol backend API tests - Phase 1 + Phase 2 features"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://diagnostic-agile.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@envol.com"
ADMIN_PASSWORD = "admin2026"


# ===== Fixtures =====
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def new_user(session):
    email = f"test_{uuid.uuid4().hex[:8]}@envol.com"
    payload = {"name": "Test User", "email": email, "password": "test123"}
    r = session.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": "test123", "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/admin-login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


# ===== Health =====
def test_root(session):
    r = session.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ===== Auth (Phase 1) =====
def test_register_returns_token_and_user(new_user):
    assert new_user["token"]
    assert new_user["user"]["onboarded"] is False


def test_register_duplicate(session, new_user):
    r = session.post(f"{API}/auth/register", json={"name": "X", "email": new_user["email"], "password": "test123"}, timeout=10)
    assert r.status_code == 400


def test_login_success(session, new_user):
    r = session.post(f"{API}/auth/login", json={"email": new_user["email"], "password": new_user["password"]}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "token" in j and j["user"]["email"] == new_user["email"]


def test_login_invalid(session):
    r = session.post(f"{API}/auth/login", json={"email": "nope_xxx@envol.com", "password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_me(session, new_user):
    r = session.get(f"{API}/auth/me", headers=H(new_user['token']), timeout=10)
    assert r.status_code == 200
    assert r.json()["user"]["email"] == new_user["email"]


def test_protected_no_token(session):
    r = session.get(f"{API}/auth/me", timeout=10)
    assert r.status_code in (401, 403)


# ===== Onboarding (Phase 1) =====
def test_questions(session):
    r = session.get(f"{API}/onboarding/questions", timeout=10)
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert len(qs) == 10


def test_onboarding_submit_and_result(session, new_user):
    answers = {
        "q1": "Une app pour aider les jeunes à monter leur projet",
        "q2": "Les jeunes manquent d'accompagnement",
        "q3": "Étudiants 18-25 ans",
        "q4": "J'ai un prototype/MVP",
        "q5": "J'ai bien étudié le marché",
        "q6": "Abonnement mensuel",
        "q7": "Avec 1 associé(e)",
        "q8": "Entre 500 et 5 000 €",
        "q9": "15 à 30h",
        "q10": "Aider les jeunes",
    }
    r = session.post(f"{API}/onboarding/submit", json={"answers": answers}, headers=H(new_user['token']), timeout=90)
    assert r.status_code == 200, r.text
    a = r.json()["analysis"]
    assert isinstance(a["score"], int) and 0 <= a["score"] <= 100
    for k in ["points_forts", "points_vigilance", "points_negatifs", "ameliorations"]:
        assert k in a and isinstance(a[k], list)
    r2 = session.get(f"{API}/onboarding/result", headers=H(new_user['token']), timeout=10)
    assert r2.status_code == 200


# ===== Project (Phase 2 - new fields) =====
def test_save_project_with_phase2_fields(session, new_user):
    payload = {
        "name": "MyProj", "secteur": "Tech", "probleme": "X", "solution": "Y",
        "stade": "MVP", "montant": "500", "lien": "https://x.com",
        "pitch": "Mon pitch d'une ligne",
        "objectifs": ["Lancer MVP", "10 clients"],
        "roadmap": [{"phase": "Q1 2026", "desc": "MVP"}, {"phase": "Q2 2026", "desc": "Beta"}],
        "statut": "Développement",
    }
    r = session.post(f"{API}/project", json=payload, headers=H(new_user['token']), timeout=10)
    assert r.status_code == 200
    p = r.json()["project"]
    assert p["pitch"] == "Mon pitch d'une ligne"
    assert p["objectifs"] == ["Lancer MVP", "10 clients"]
    assert len(p["roadmap"]) == 2
    assert p["statut"] == "Développement"
    # Verify persistence
    r2 = session.get(f"{API}/auth/me", headers=H(new_user['token']), timeout=10)
    assert r2.json()["project"]["statut"] == "Développement"


# ===== Profile =====
def test_update_profile(session, new_user):
    r = session.post(f"{API}/profile", json={"ville": "Paris", "bio": "hello"}, headers=H(new_user['token']), timeout=10)
    assert r.status_code == 200
    u = r.json()["user"]
    assert u["ville"] == "Paris"


# ===== AI Chat =====
def test_ai_chat(session, new_user):
    r = session.post(f"{API}/ai/chat", json={"message": "Salut en une phrase ?"}, headers=H(new_user['token']), timeout=60)
    assert r.status_code == 200
    assert isinstance(r.json()["reply"], str)


# ===== Admin Auth (Phase 2) =====
def test_admin_login_success(admin_token):
    assert admin_token


def test_admin_login_wrong_password(session):
    r = session.post(f"{API}/auth/admin-login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_admin_login_returns_admin_flag(session):
    r = session.post(f"{API}/auth/admin-login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    assert r.status_code == 200
    assert r.json()["user"]["is_admin"] is True


def test_admin_users(session, admin_token):
    r = session.get(f"{API}/admin/users", headers=H(admin_token), timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "users" in j and isinstance(j["users"], list)
    assert "total" in j


def test_admin_users_forbidden_for_regular_user(session, new_user):
    r = session.get(f"{API}/admin/users", headers=H(new_user['token']), timeout=10)
    assert r.status_code == 403


def test_admin_stats(session, admin_token):
    r = session.get(f"{API}/admin/stats", headers=H(admin_token), timeout=10)
    assert r.status_code == 200
    j = r.json()
    for k in ["total_users", "bronze", "silver", "gold", "mrr"]:
        assert k in j


# ===== Plans (Phase 2) =====
def test_plans(session):
    r = session.get(f"{API}/plans", timeout=10)
    assert r.status_code == 200
    plans = r.json()["plans"]
    names = [p["name"] for p in plans]
    assert "Bronze" in names and "Silver" in names and "Gold" in names


# ===== Postits (Phase 2) =====
def test_user_postit_blue(session, new_user):
    r = session.post(f"{API}/postits", json={"text": "Ma note utilisateur"}, headers=H(new_user['token']), timeout=10)
    assert r.status_code == 200
    p = r.json()["postit"]
    assert p["color"] == "blue"
    assert p["is_admin_post"] is False


def test_user_list_postits(session, new_user):
    r = session.get(f"{API}/postits", headers=H(new_user['token']), timeout=10)
    assert r.status_code == 200
    items = r.json()["postits"]
    assert len(items) >= 1
    assert all(p["color"] in ("blue", "gold") for p in items)


def test_admin_postit_to_user_is_gold(session, admin_token, new_user):
    r = session.post(f"{API}/postits", json={"target_user_id": new_user["user"]["id"], "text": "Note Admin"}, headers=H(admin_token), timeout=10)
    assert r.status_code == 200
    p = r.json()["postit"]
    assert p["color"] == "gold"
    assert p["is_admin_post"] is True
    # User sees it
    r2 = session.get(f"{API}/postits", headers=H(new_user['token']), timeout=10)
    pids = [x["id"] for x in r2.json()["postits"]]
    assert p["id"] in pids


def test_postit_mark_read_and_delete(session, new_user):
    r = session.post(f"{API}/postits", json={"text": "Pour delete"}, headers=H(new_user['token']), timeout=10)
    pid = r.json()["postit"]["id"]
    r2 = session.post(f"{API}/postits/{pid}/read", headers=H(new_user['token']), timeout=10)
    assert r2.status_code == 200
    r3 = session.delete(f"{API}/postits/{pid}", headers=H(new_user['token']), timeout=10)
    assert r3.status_code == 200


# ===== Events (Phase 2) =====
@pytest.fixture(scope="session")
def created_event_id(session, admin_token):
    r = session.post(f"{API}/events", json={
        "title": "TEST_Event Visio",
        "description": "Visio test",
        "date": "2026-03-01T10:00:00Z",
        "type": "visio",
        "plan_required": "Bronze"
    }, headers=H(admin_token), timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["event"]["id"]


def test_event_create_admin(created_event_id):
    assert created_event_id


def test_event_create_forbidden_user(session, new_user):
    r = session.post(f"{API}/events", json={"title": "X", "date": "2026-01-01T00:00:00Z"}, headers=H(new_user['token']), timeout=10)
    assert r.status_code == 403


def test_user_list_events_visible(session, new_user, created_event_id):
    r = session.get(f"{API}/events", headers=H(new_user['token']), timeout=10)
    assert r.status_code == 200
    ids = [e["id"] for e in r.json()["events"]]
    assert created_event_id in ids  # bronze event visible to bronze user


def test_event_plan_filter_silver_hidden_from_bronze(session, admin_token, new_user):
    # Create Silver-only event
    r = session.post(f"{API}/events", json={
        "title": "TEST_Silver event",
        "date": "2026-04-01T10:00:00Z",
        "plan_required": "Silver"
    }, headers=H(admin_token), timeout=10)
    silver_id = r.json()["event"]["id"]
    r2 = session.get(f"{API}/events", headers=H(new_user['token']), timeout=10)
    ids = [e["id"] for e in r2.json()["events"]]
    assert silver_id not in ids


# ===== Resources (Phase 2) =====
def test_resources_seeded(session, new_user):
    r = session.get(f"{API}/resources", headers=H(new_user['token']), timeout=10)
    assert r.status_code == 200
    items = r.json()["resources"]
    assert len(items) >= 6


def test_resource_create_admin(session, admin_token):
    r = session.post(f"{API}/resources", json={
        "title": "TEST_Resource",
        "description": "Test",
        "category": "Test",
        "icon": "📦",
        "plan_required": "Bronze"
    }, headers=H(admin_token), timeout=10)
    assert r.status_code == 200
    assert r.json()["resource"]["title"] == "TEST_Resource"


def test_resource_create_forbidden_user(session, new_user):
    r = session.post(f"{API}/resources", json={"title": "X", "description": "Y", "category": "Z"}, headers=H(new_user['token']), timeout=10)
    assert r.status_code == 403


# ===== Documents (Phase 2) =====
def test_document_upload_list_download_delete(new_user):
    headers = {"Authorization": f"Bearer {new_user['token']}"}
    files = {"file": ("test.txt", io.BytesIO(b"hello envol"), "text/plain")}
    data = {"category": "Juridique"}
    r = requests.post(f"{API}/documents", headers=headers, files=files, data=data, timeout=15)
    assert r.status_code == 200, r.text
    doc = r.json()["document"]
    assert doc["category"] == "Juridique"
    assert doc["filename"] == "test.txt"
    doc_id = doc["id"]

    r2 = requests.get(f"{API}/documents", headers=headers, timeout=10)
    assert r2.status_code == 200
    assert any(d["id"] == doc_id for d in r2.json()["documents"])

    r3 = requests.get(f"{API}/documents/{doc_id}/download", headers=headers, timeout=10)
    assert r3.status_code == 200
    assert r3.content == b"hello envol"

    r4 = requests.delete(f"{API}/documents/{doc_id}", headers=headers, timeout=10)
    assert r4.status_code == 200


# ===== Stripe Checkout (Phase 2) =====
def test_checkout_session_creates_url_and_db_entry(session, new_user):
    payload = {"plan": "Silver", "origin_url": BASE_URL}
    r = session.post(f"{API}/checkout/session", json=payload, headers=H(new_user['token']), timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["url"].startswith("http")
    assert j["session_id"]


def test_checkout_invalid_plan(session, new_user):
    r = session.post(f"{API}/checkout/session", json={"plan": "Platinum", "origin_url": BASE_URL}, headers=H(new_user['token']), timeout=10)
    assert r.status_code == 400


def test_checkout_status_unpaid(session, new_user):
    r = session.post(f"{API}/checkout/session", json={"plan": "Bronze", "origin_url": BASE_URL}, headers=H(new_user['token']), timeout=30)
    sid = r.json()["session_id"]
    r2 = session.get(f"{API}/checkout/status/{sid}", headers=H(new_user['token']), timeout=15)
    assert r2.status_code == 200
    assert r2.json()["payment_status"] in ("unpaid", "paid", "no_payment_required", "pending")


# ===== Phase 3: Second admin =====
def test_second_admin_login(session):
    r = session.post(f"{API}/auth/login", json={"email": "gaspard.boachon@gmail.com", "password": "Stranger747!"}, timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["user"]["is_admin"] is True
    assert j["token"]


# ===== Phase 3: About =====
def test_about_endpoint(session):
    r = session.get(f"{API}/about", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "team" in j and len(j["team"]) == 2
    names = [t["name"] for t in j["team"]]
    assert "Léo" in names and "Gaspard" in names
    assert "mission" in j and isinstance(j["mission"], str) and len(j["mission"]) > 10
    assert "values" in j and len(j["values"]) == 3


# ===== Phase 3: Formations =====
def test_formations_requires_auth(session):
    r = session.get(f"{API}/formations", timeout=10)
    assert r.status_code in (401, 403)


def test_formations_returns_5_modules(session, new_user):
    r = session.get(f"{API}/formations", headers=H(new_user['token']), timeout=10)
    assert r.status_code == 200
    forms = r.json()["formations"]
    assert len(forms) == 5
    for f in forms:
        assert "video_url" in f and f["video_url"].startswith("http")
        assert "lessons" in f and isinstance(f["lessons"], list) and len(f["lessons"]) >= 1
        assert f["plan_required"] in ("Bronze", "Silver", "Gold")


# ===== Phase 3: Password reset =====
def test_request_reset_existing(session, new_user):
    r = session.post(f"{API}/auth/request-reset", json={"email": new_user["email"]}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j.get("token")
    assert j.get("dev_mode") is True


def test_request_reset_non_existing_no_enumeration(session):
    r = session.post(f"{API}/auth/request-reset", json={"email": f"noexist_{uuid.uuid4().hex[:6]}@envol.com"}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j.get("token") is None


def test_reset_password_full_flow(session):
    # Create fresh user
    email = f"reset_{uuid.uuid4().hex[:8]}@envol.com"
    r = session.post(f"{API}/auth/register", json={"name": "Reset", "email": email, "password": "old123"}, timeout=10)
    assert r.status_code == 200
    # Request reset
    r2 = session.post(f"{API}/auth/request-reset", json={"email": email}, timeout=10)
    token = r2.json()["token"]
    assert token
    # Reset password
    r3 = session.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "newPwd99"}, timeout=10)
    assert r3.status_code == 200
    assert r3.json()["ok"] is True
    # Old password should fail
    r4 = session.post(f"{API}/auth/login", json={"email": email, "password": "old123"}, timeout=10)
    assert r4.status_code == 401
    # New password works
    r5 = session.post(f"{API}/auth/login", json={"email": email, "password": "newPwd99"}, timeout=10)
    assert r5.status_code == 200
    # Token re-use rejected
    r6 = session.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "another1"}, timeout=10)
    assert r6.status_code == 400


def test_reset_password_invalid_token(session):
    r = session.post(f"{API}/auth/reset-password", json={"token": "garbage.token", "new_password": "abc123"}, timeout=10)
    assert r.status_code == 400


# ===== Phase 3: Profile photo =====
def test_profile_photo_upload_and_get(new_user):
    # Minimal valid PNG (1x1 red pixel)
    png_bytes = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
        "0000000D4944415478DA63F8CFC0F00F00030301013AF1B5B30000000049454E44AE426082"
    )
    headers = {"Authorization": f"Bearer {new_user['token']}"}
    files = {"file": ("avatar.png", io.BytesIO(png_bytes), "image/png")}
    r = requests.post(f"{API}/profile/photo", headers=headers, files=files, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "photo_url" in j and new_user["user"]["id"] in j["photo_url"]
    # GET photo back
    r2 = requests.get(f"{API}{j['photo_url'].replace('/api', '', 1)}", timeout=10)
    # photo_url is /api/profile/photo/{uid}, BASE_URL+photo_url
    r2 = requests.get(f"{BASE_URL}{j['photo_url']}", timeout=10)
    assert r2.status_code == 200
    assert r2.headers.get("content-type", "").startswith("image/")


def test_profile_photo_invalid_format(new_user):
    headers = {"Authorization": f"Bearer {new_user['token']}"}
    files = {"file": ("bad.txt", io.BytesIO(b"not an image"), "text/plain")}
    r = requests.post(f"{API}/profile/photo", headers=headers, files=files, timeout=10)
    assert r.status_code == 400


def test_profile_photo_get_not_found(session):
    r = session.get(f"{API}/profile/photo/nonexistent-uid-zzz", timeout=10)
    assert r.status_code == 404
