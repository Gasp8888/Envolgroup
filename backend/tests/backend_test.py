"""Envol backend API tests"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://diagnostic-agile.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


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


# ----- Health -----
def test_root(session):
    r = session.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ----- Auth -----
def test_register_returns_token_and_user(new_user):
    assert new_user["token"]
    assert new_user["user"]["onboarded"] is False
    assert new_user["user"]["email"]


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
    r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["user"]["email"] == new_user["email"]


# ----- Onboarding -----
def test_questions(session):
    r = session.get(f"{API}/onboarding/questions", timeout=10)
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert len(qs) == 10
    assert qs[0]["id"] == "q1"


def test_onboarding_submit_and_result(session, new_user):
    answers = {
        "q1": "Une app pour aider les jeunes à monter leur projet",
        "q2": "Les jeunes manquent d'accompagnement structuré pour entreprendre",
        "q3": "Étudiants 18-25 ans qui veulent lancer un projet",
        "q4": "J'ai un prototype/MVP",
        "q5": "J'ai bien étudié le marché",
        "q6": "Abonnement mensuel pour les utilisateurs premium",
        "q7": "Avec 1 associé(e)",
        "q8": "Entre 500 et 5 000 €",
        "q9": "15 à 30h",
        "q10": "Aider les jeunes à transformer leurs idées en réalité",
    }
    headers = {"Authorization": f"Bearer {new_user['token']}"}
    r = session.post(f"{API}/onboarding/submit", json={"answers": answers}, headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    a = r.json()["analysis"]
    assert isinstance(a["score"], int) and 0 <= a["score"] <= 100
    for k in ["points_forts", "points_vigilance", "points_negatifs", "ameliorations"]:
        assert k in a and isinstance(a[k], list)

    # Verify persistence
    r2 = session.get(f"{API}/onboarding/result", headers=headers, timeout=10)
    assert r2.status_code == 200
    assert r2.json()["analysis"]["score"] == a["score"]

    # me should now show onboarded true
    r3 = session.get(f"{API}/auth/me", headers=headers, timeout=10)
    assert r3.json()["user"]["onboarded"] is True


# ----- Project -----
def test_save_project(session, new_user):
    headers = {"Authorization": f"Bearer {new_user['token']}"}
    payload = {"name": "MyProj", "secteur": "Tech", "probleme": "X", "solution": "Y", "stade": "MVP", "montant": "500", "lien": "https://x.com"}
    r = session.post(f"{API}/project", json=payload, headers=headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # verify via /me
    r2 = session.get(f"{API}/auth/me", headers=headers, timeout=10)
    assert r2.json()["project"]["name"] == "MyProj"


# ----- Profile -----
def test_update_profile(session, new_user):
    headers = {"Authorization": f"Bearer {new_user['token']}"}
    r = session.post(f"{API}/profile", json={"ville": "Paris", "bio": "hello"}, headers=headers, timeout=10)
    assert r.status_code == 200
    u = r.json()["user"]
    assert u["ville"] == "Paris"
    assert u["bio"] == "hello"


# ----- AI chat -----
def test_ai_chat(session, new_user):
    headers = {"Authorization": f"Bearer {new_user['token']}"}
    r = session.post(f"{API}/ai/chat", json={"message": "Bonjour, peux-tu me dire en une phrase comment valider une idée ?"}, headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    reply = r.json()["reply"]
    assert isinstance(reply, str) and len(reply) > 0


# ----- Auth required -----
def test_protected_no_token(session):
    r = session.get(f"{API}/auth/me", timeout=10)
    assert r.status_code in (401, 403)
