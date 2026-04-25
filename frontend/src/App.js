import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "envol_token";
const api = axios.create({ baseURL: API });
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ======================================
// LANDING + AUTH
// ======================================
function Landing({ onAuth }) {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const url = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? { email: form.email, password: form.password } : form;
      const { data } = await api.post(url, payload);
      localStorage.setItem(TOKEN_KEY, data.token);
      onAuth(data.user);
    } catch (e) {
      setErr(e.response?.data?.detail || "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <div className="landing">
      <div className="orb orb1"></div>
      <div className="orb orb2"></div>
      <nav className="nav">
        <div className="logo">ENVOL</div>
        <div className="nav-actions">
          <button data-testid="open-login-btn" className="btn-ghost" onClick={() => { setMode("login"); setShowAuth(true); }}>Connexion</button>
          <button data-testid="open-register-btn" className="btn-gold" onClick={() => { setMode("register"); setShowAuth(true); }}>Créer un compte</button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-tag">L'INCUBATEUR DES 15–25 ANS</div>
        <h1 className="hero-title">Ton idée mérite<br/><em>de prendre son envol.</em></h1>
        <p className="hero-sub">Formations, accompagnement, mentors et outils pour transformer ton idée en projet concret. À ton rythme. Sans jargon.</p>
        <div className="hero-cta">
          <button data-testid="hero-cta-btn" className="btn-gold-lg" onClick={() => { setMode("register"); setShowAuth(true); }}>Commencer gratuitement →</button>
          <button className="btn-ghost-lg" onClick={() => { setMode("login"); setShowAuth(true); }}>J'ai déjà un compte</button>
        </div>
        <div className="hero-stats">
          <div><div className="stat-n">5</div><div className="stat-l">modules</div></div>
          <div><div className="stat-n">100+</div><div className="stat-l">jeunes accompagnés</div></div>
          <div><div className="stat-n">24/7</div><div className="stat-l">assistant IA</div></div>
        </div>
      </section>

      <section className="features">
        <h2>Ce que tu trouves dans Envol</h2>
        <div className="feat-grid">
          {[
            ["Formations", "5 modules pour passer de l'idée à ta première vente"],
            ["Checklist", "Coche chaque étape, ne loupe rien"],
            ["Mon projet", "Un espace pour structurer et déposer ton projet"],
            ["Suivi & Experts", "Avocats, comptables, mentors à portée de clic"],
            ["Ressources", "Templates, guides, modèles prêts à l'emploi"],
            ["Chat & IA", "Une équipe et un assistant IA toujours là"],
          ].map(([t, d]) => (
            <div key={t} className="feat-card"><div className="feat-t">{t}</div><div className="feat-d">{d}</div></div>
          ))}
        </div>
      </section>

      {showAuth && (
        <div className="modal-bg" onClick={(e) => { if (e.target.className === "modal-bg") setShowAuth(false); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowAuth(false)}>×</button>
            <div className="modal-tabs">
              <button data-testid="tab-login" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Connexion</button>
              <button data-testid="tab-register" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Créer un compte</button>
            </div>
            <h3 className="modal-title">{mode === "login" ? "Bienvenue." : "Rejoindre Envol."}</h3>
            <p className="modal-sub">{mode === "login" ? "Connecte-toi à ton espace." : "Crée ton compte gratuitement."}</p>
            <form onSubmit={submit}>
              {mode === "register" && (
                <input data-testid="input-name" className="input" placeholder="Ton prénom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              )}
              <input data-testid="input-email" className="input" type="email" placeholder="ton@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <input data-testid="input-password" className="input" type="password" placeholder="Mot de passe (min. 6)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              {err && <div className="err-msg" data-testid="auth-error">{err}</div>}
              <button data-testid="submit-auth-btn" className="btn-gold w-full" disabled={loading}>{loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================
// ONBOARDING QUESTIONNAIRE
// ======================================
function Onboarding({ onDone }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/onboarding/questions").then((r) => setQuestions(r.data.questions));
  }, []);

  if (questions.length === 0) return <div className="loading-screen">Chargement…</div>;

  const total = questions.length;
  const q = questions[step];
  const value = answers[q.id] || "";
  const canNext = value && value.trim().length > 0;

  const next = async () => {
    if (step < total - 1) { setStep(step + 1); return; }
    setSubmitting(true); setErr("");
    try {
      const { data } = await api.post("/onboarding/submit", { answers });
      onDone(data.analysis);
    } catch (e) {
      setErr(e.response?.data?.detail || "Erreur lors de l'analyse");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="onboard-bg">
      <div className="orb orb1"></div>
      <div className="onboard-card">
        <div className="onboard-progress">
          <div className="onboard-progress-bar" style={{ width: `${((step + 1) / total) * 100}%` }}></div>
        </div>
        <div className="onboard-step">Question {step + 1} / {total}</div>
        <h2 className="onboard-q" data-testid="onboard-question">{q.label}</h2>

        {q.type === "textarea" && (
          <textarea data-testid={`onboard-input-${q.id}`} className="onboard-input" placeholder={q.placeholder} value={value} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} autoFocus />
        )}
        {q.type === "text" && (
          <input data-testid={`onboard-input-${q.id}`} className="onboard-input" placeholder={q.placeholder} value={value} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} autoFocus />
        )}
        {q.type === "select" && (
          <div className="onboard-options">
            {q.options.map((opt) => (
              <button key={opt} data-testid={`onboard-opt-${q.id}-${opt.slice(0, 10)}`} className={`onboard-option ${value === opt ? "selected" : ""}`} onClick={() => setAnswers({ ...answers, [q.id]: opt })}>{opt}</button>
            ))}
          </div>
        )}
        {err && <div className="err-msg">{err}</div>}
        <div className="onboard-nav">
          {step > 0 && <button className="btn-ghost" onClick={() => setStep(step - 1)} disabled={submitting}>← Précédent</button>}
          <button data-testid="onboard-next-btn" className="btn-gold" onClick={next} disabled={!canNext || submitting}>
            {submitting ? "Analyse en cours…" : step < total - 1 ? "Suivant →" : "Analyser mon projet ✨"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================================
// ANALYSIS RESULT
// ======================================
function AnalysisResult({ analysis, onContinue }) {
  const score = analysis.score || 0;
  const scoreColor = score >= 75 ? "#5BC78A" : score >= 55 ? "#C9A84C" : score >= 30 ? "#E89B4C" : "#E05C5C";

  return (
    <div className="onboard-bg">
      <div className="orb orb1"></div>
      <div className="result-card">
        <div className="result-header">
          <div className="score-circle" style={{ "--c": scoreColor }}>
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={scoreColor} strokeWidth="10" strokeDasharray={`${(score / 100) * 314} 314`} strokeLinecap="round" transform="rotate(-90 60 60)" />
            </svg>
            <div className="score-num" data-testid="analysis-score">{score}<span>/100</span></div>
          </div>
          <div>
            <h2 className="result-title">Analyse de ton projet</h2>
            <p className="result-sub">{analysis.score_reason}</p>
          </div>
        </div>

        {analysis.points_forts?.length > 0 && (
          <div className="result-section">
            <div className="result-section-h" style={{ color: "#5BC78A" }}>✓ Points forts</div>
            <ul className="result-list green">
              {analysis.points_forts.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
        {analysis.points_vigilance?.length > 0 && (
          <div className="result-section">
            <div className="result-section-h" style={{ color: "#E89B4C" }}>⚠ Points de vigilance</div>
            <ul className="result-list orange">
              {analysis.points_vigilance.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
        {analysis.points_negatifs?.length > 0 && (
          <div className="result-section">
            <div className="result-section-h" style={{ color: "#E05C5C" }}>× Points négatifs</div>
            <ul className="result-list red">
              {analysis.points_negatifs.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
        {analysis.ameliorations?.length > 0 && (
          <div className="result-section">
            <div className="result-section-h" style={{ color: "#C9A84C" }}>→ Plan d'action concret</div>
            <ol className="result-list-ord">
              {analysis.ameliorations.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          </div>
        )}

        <button data-testid="continue-to-dashboard-btn" className="btn-gold-lg w-full" onClick={onContinue}>Accéder à mon espace →</button>
      </div>
    </div>
  );
}

// ======================================
// AI BUBBLE
// ======================================
function AiBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", text: "👋 Salut ! Je suis ton assistant Envol. Pose-moi tes questions sur ton projet, le juridique, le marketing, la motivation… Je suis là pour t'aider !" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setInput(""); setLoading(true);
    try {
      const { data } = await api.post("/ai/chat", { message: userMsg });
      setMessages((m) => [...m, { role: "ai", text: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Désolé, je suis indisponible. Réessaie dans un instant." }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      <button data-testid="ai-bubble-btn" className={`ai-bubble ${open ? "open" : ""}`} onClick={() => setOpen(!open)} aria-label="Assistant IA">
        {open ? "×" : "✨"}
      </button>
      {open && (
        <div className="ai-panel" data-testid="ai-panel">
          <div className="ai-header">
            <div className="ai-avatar">✨</div>
            <div>
              <div className="ai-name">Envol AI</div>
              <div className="ai-status">En ligne</div>
            </div>
          </div>
          <div className="ai-messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>{m.text}</div>
            ))}
            {loading && <div className="ai-msg ai">…</div>}
            <div ref={endRef}></div>
          </div>
          <div className="ai-input-row">
            <input data-testid="ai-input" className="ai-input" placeholder="Pose ta question…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button data-testid="ai-send-btn" className="btn-gold" onClick={send} disabled={loading}>→</button>
          </div>
        </div>
      )}
    </>
  );
}

// ======================================
// DASHBOARD
// ======================================
const NAV_ITEMS = [
  { id: "overview", label: "Vue d'ensemble", icon: "◐" },
  { id: "formations", label: "Formations", icon: "▤" },
  { id: "checklist", label: "Checklist", icon: "✓" },
  { id: "project", label: "Mon projet", icon: "◆" },
  { id: "experts", label: "Suivi & Experts", icon: "◉" },
  { id: "resources", label: "Ressources", icon: "▦" },
  { id: "chat", label: "Chat", icon: "◯" },
  { id: "profile", label: "Mon profil", icon: "●" },
];

function Dashboard({ user, onLogout, ctx }) {
  const [tab, setTab] = useState("overview");
  const [analysis, setAnalysis] = useState(ctx.onboarding?.analysis || null);

  return (
    <div className="dash">
      <aside className="sidebar">
        <div className="sidebar-logo">ENVOL</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((n) => (
            <button key={n.id} data-testid={`nav-${n.id}`} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <button data-testid="logout-btn" className="btn-ghost logout-btn" onClick={onLogout}>Déconnexion</button>
      </aside>

      <main className="main">
        {tab === "overview" && <Overview user={user} analysis={analysis} setTab={setTab} />}
        {tab === "formations" && <Formations />}
        {tab === "checklist" && <Checklist analysis={analysis} />}
        {tab === "project" && <ProjectTab initial={ctx.project} />}
        {tab === "experts" && <Experts />}
        {tab === "resources" && <Resources />}
        {tab === "chat" && <Chat />}
        {tab === "profile" && <Profile user={user} />}
      </main>

      <AiBubble />
    </div>
  );
}

function Overview({ user, analysis, setTab }) {
  const score = analysis?.score || 0;
  const scoreColor = score >= 75 ? "#5BC78A" : score >= 55 ? "#C9A84C" : score >= 30 ? "#E89B4C" : "#E05C5C";
  return (
    <div className="page-content">
      <h1 className="page-title">Salut {user.name} 👋</h1>
      <p className="page-sub">Voici l'état de ton aventure entrepreneuriale.</p>

      {analysis && (
        <div className="card hero-card">
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div className="score-circle small" style={{ "--c": scoreColor }}>
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={scoreColor} strokeWidth="10" strokeDasharray={`${(score / 100) * 314} 314`} strokeLinecap="round" transform="rotate(-90 60 60)" />
              </svg>
              <div className="score-num"><span data-testid="overview-score">{score}</span><span style={{fontSize: 12}}>/100</span></div>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="card-title">Score Envol</div>
              <p className="card-sub">{analysis.score_reason}</p>
              <button className="btn-ghost" onClick={() => setTab("checklist")}>Voir le plan d'action →</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Progression formation</div>
          <p className="card-sub">2 modules sur 5 complétés</p>
          <div className="progress"><div className="progress-bar" style={{ width: "40%" }}></div></div>
          <button className="btn-ghost" onClick={() => setTab("formations")} style={{marginTop: 12}}>Continuer →</button>
        </div>
        <div className="card">
          <div className="card-title">Mon projet</div>
          <p className="card-sub">Complète et soumets ton projet</p>
          <button className="btn-gold" onClick={() => setTab("project")}>Aller à mon projet →</button>
        </div>
      </div>
    </div>
  );
}

function Formations() {
  const modules = [
    { n: "01", t: "Fondations", d: "Mindset, compétences, marché. On commence par toi.", st: "done", p: 100 },
    { n: "02", t: "L'Idée", d: "Trouver une idée ou valider une idée existante.", st: "done", p: 100 },
    { n: "03", t: "Validation", d: "Parler à 20 personnes, tester sans dépenser.", st: "prog", p: 30 },
    { n: "04", t: "Premier Euro", d: "Vendre avant de construire, premier client.", st: "lock", p: 0 },
    { n: "05", t: "Structurer", d: "Statut, compte pro, facturation, levée.", st: "lock", p: 0 },
  ];
  return (
    <div className="page-content">
      <h1 className="page-title">Formations</h1>
      <p className="page-sub">5 modules · De zéro à ta première vente</p>
      <div className="modules-grid">
        {modules.map((m) => (
          <div key={m.n} className={`module-card ${m.st}`}>
            <div className="module-n">Module {m.n}</div>
            <div className="module-t">{m.t}</div>
            <div className="module-d">{m.d}</div>
            <div className="progress"><div className="progress-bar" style={{ width: `${m.p}%`, background: m.st === "done" ? "#5BC78A" : "" }}></div></div>
            <div className="module-status">{m.st === "done" ? "✓ Complété" : m.st === "prog" ? "En cours" : "🔒 Verrouillé"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Checklist({ analysis }) {
  const ai = analysis?.ameliorations || [];
  const [done, setDone] = useState({});
  const items = [
    ...ai.map((t, i) => ({ id: `ai-${i}`, t, source: "Plan IA" })),
    { id: "g1", t: "Parler à 10 clients potentiels", source: "Validation" },
    { id: "g2", t: "Créer ta landing page", source: "Validation" },
    { id: "g3", t: "Choisir ton statut juridique", source: "Structurer" },
    { id: "g4", t: "Ouvrir un compte pro", source: "Structurer" },
  ];
  return (
    <div className="page-content">
      <h1 className="page-title">Checklist</h1>
      <p className="page-sub">Coche chaque étape pour avancer · {ai.length > 0 && `${ai.length} actions générées par l'IA`}</p>
      <div className="card">
        {items.map((it, i) => (
          <div key={it.id} className="check-item" onClick={() => setDone({ ...done, [it.id]: !done[it.id] })} data-testid={`check-${it.id}`}>
            <div className={`check-box ${done[it.id] ? "checked" : ""}`}>{done[it.id] ? "✓" : i + 1}</div>
            <div style={{ flex: 1 }}>
              <div className={`check-text ${done[it.id] ? "done" : ""}`}>{it.t}</div>
              <div className="check-source">{it.source}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectTab({ initial }) {
  const [p, setP] = useState(initial || { name: "", secteur: "Tech / SaaS", probleme: "", solution: "", stade: "Idée", montant: "", lien: "" });
  const [saved, setSaved] = useState(false);
  const submit = async () => {
    await api.post("/project", p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return (
    <div className="page-content">
      <h1 className="page-title">Mon projet</h1>
      <p className="page-sub">Présente ton projet en détail.</p>
      <div className="card">
        <div className="form-grid">
          <div><label>Nom du projet</label><input data-testid="proj-name" className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Ex : Foodly" /></div>
          <div><label>Secteur</label>
            <select className="input" value={p.secteur} onChange={(e) => setP({ ...p, secteur: e.target.value })}>
              <option>Tech / SaaS</option><option>Commerce</option><option>Éducation</option><option>Santé</option><option>Créatif</option><option>Autre</option>
            </select>
          </div>
        </div>
        <label>Le problème que tu résous</label>
        <textarea className="input" rows={3} value={p.probleme} onChange={(e) => setP({ ...p, probleme: e.target.value })} placeholder="Quel problème concret ?" />
        <label>Ta solution</label>
        <textarea className="input" rows={3} value={p.solution} onChange={(e) => setP({ ...p, solution: e.target.value })} placeholder="Comment tu le résous ?" />
        <div className="form-grid">
          <div><label>Stade actuel</label>
            <select className="input" value={p.stade} onChange={(e) => setP({ ...p, stade: e.target.value })}>
              <option>Idée</option><option>Prototype</option><option>Premiers clients</option><option>Revenus</option>
            </select>
          </div>
          <div><label>Montant recherché</label><input className="input" value={p.montant} onChange={(e) => setP({ ...p, montant: e.target.value })} placeholder="Ex : 50 000 €" /></div>
        </div>
        <label>Lien (site, deck...)</label>
        <input className="input" value={p.lien} onChange={(e) => setP({ ...p, lien: e.target.value })} placeholder="https://..." />
        <button data-testid="proj-save-btn" className="btn-gold" onClick={submit}>{saved ? "✓ Enregistré" : "Sauvegarder →"}</button>
      </div>
    </div>
  );
}

function Experts() {
  const list = [
    { ini: "BB", n: "Bertrand Boachon", r: "Avocat · Droit des affaires" },
    { ini: "VH", n: "Virginie Heidsieck", r: "Avocate · Sociétés" },
    { ini: "GL", n: "Greffe de Lyon", r: "Immatriculation, statuts" },
    { ini: "EC", n: "Expert-comptable partenaire", r: "Compta, fiscalité, conseil" },
    { ini: "BP", n: "Banque partenaire Envol", r: "Compte pro accéléré" },
  ];
  return (
    <div className="page-content">
      <h1 className="page-title">Suivi & Experts</h1>
      <p className="page-sub">Ton réseau d'accompagnement.</p>
      <div className="card">
        {list.map((e) => (
          <div key={e.n} className="expert-row">
            <div className="expert-avatar">{e.ini}</div>
            <div style={{ flex: 1 }}><div className="expert-n">{e.n}</div><div className="expert-r">{e.r}</div></div>
            <button className="btn-ghost">Prendre RDV</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Resources() {
  const list = [
    ["Business Plan", "Structure pour présenter ton projet", "PDF"],
    ["Guide Statuts", "AE, SAS, SASU — lequel choisir", "Guide"],
    ["Pitch Deck", "10 slides pour lever des fonds", "Canva"],
    ["Script Validation", "20 questions pour valider", "Notion"],
    ["Tableau Financier", "Revenus, dépenses, prévisions", "Sheets"],
    ["Annuaire Envol", "Avocats, comptables, devs", "Silver+"],
  ];
  return (
    <div className="page-content">
      <h1 className="page-title">Ressources</h1>
      <p className="page-sub">Templates, guides et outils.</p>
      <div className="grid-3">
        {list.map(([t, d, tag]) => (
          <div key={t} className="card resource-card">
            <div className="card-title">{t}</div>
            <p className="card-sub">{d}</p>
            <span className="tag">{tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chat() {
  const [msgs] = useState([
    { who: "Léo · Fondateur", t: "Bienvenue sur Envol ! Posez vos questions ici, on répond chaque jour." },
    { who: "Gaspard · Fondateur", t: "Pour toute question technique ou design, je suis là." },
  ]);
  const [text, setText] = useState("");
  const [list, setList] = useState(msgs);
  return (
    <div className="page-content">
      <h1 className="page-title">Chat Envol</h1>
      <p className="page-sub">Échange avec l'équipe et la communauté.</p>
      <div className="card chat-box">
        <div className="chat-stream">
          {list.map((m, i) => (
            <div key={i} className="chat-msg-row">
              <div className="chat-avatar">{m.who[0]}</div>
              <div><div className="chat-who">{m.who}</div><div className="chat-bubble">{m.t}</div></div>
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input className="input" placeholder="Écris ton message…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-gold" onClick={() => { if (text.trim()) { setList([...list, { who: "Toi", t: text }]); setText(""); } }}>Envoyer</button>
        </div>
      </div>
    </div>
  );
}

function Profile({ user }) {
  const [p, setP] = useState({ name: user.name || "", nom: user.nom || "", ville: user.ville || "", age: user.age || "", linkedin: user.linkedin || "", social: user.social || "", bio: user.bio || "" });
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await api.post("/profile", p);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="page-content">
      <h1 className="page-title">Mon profil</h1>
      <p className="page-sub">Tes informations personnelles.</p>
      <div className="card">
        <div className="profile-header">
          <div className="profile-avatar">{(p.name || "U")[0].toUpperCase()}</div>
          <div>
            <div className="card-title">{p.name || user.name}</div>
            <div className="card-sub">{user.email} · {user.plan} member</div>
          </div>
        </div>
        <div className="form-grid">
          <div><label>Prénom</label><input data-testid="prof-name" className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
          <div><label>Nom</label><input className="input" value={p.nom} onChange={(e) => setP({ ...p, nom: e.target.value })} /></div>
          <div><label>Ville</label><input className="input" value={p.ville} onChange={(e) => setP({ ...p, ville: e.target.value })} placeholder="Ex : Lyon" /></div>
          <div><label>Âge</label><input className="input" type="number" value={p.age} onChange={(e) => setP({ ...p, age: e.target.value })} /></div>
        </div>
        <label>LinkedIn</label>
        <input className="input" value={p.linkedin} onChange={(e) => setP({ ...p, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
        <label>Instagram / TikTok</label>
        <input className="input" value={p.social} onChange={(e) => setP({ ...p, social: e.target.value })} placeholder="@tonhandle" />
        <label>Ta bio</label>
        <textarea className="input" rows={3} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} placeholder="Qui es-tu ?" />
        <button data-testid="prof-save-btn" className="btn-gold" onClick={save}>{saved ? "✓ Enregistré" : "Sauvegarder →"}</button>
      </div>
    </div>
  );
}

// ======================================
// APP ROOT
// ======================================
function App() {
  const [user, setUser] = useState(null);
  const [stage, setStage] = useState("loading"); // loading | landing | onboarding | result | dashboard
  const [analysis, setAnalysis] = useState(null);
  const [ctx, setCtx] = useState({ onboarding: null, project: null });

  const loadMe = async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) { setStage("landing"); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setCtx({ onboarding: data.onboarding, project: data.project });
      if (!data.user.onboarded) setStage("onboarding");
      else setStage("dashboard");
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setStage("landing");
    }
  };

  useEffect(() => { loadMe(); }, []);

  const handleAuth = (u) => {
    setUser(u);
    if (!u.onboarded) setStage("onboarding");
    else { loadMe(); setStage("dashboard"); }
  };

  const handleOnboardDone = (a) => {
    setAnalysis(a);
    setUser({ ...user, onboarded: true });
    setStage("result");
  };

  const handleContinue = async () => {
    await loadMe();
    setStage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null); setAnalysis(null);
    setStage("landing");
  };

  if (stage === "loading") return <div className="loading-screen">Envol…</div>;
  if (stage === "landing") return <Landing onAuth={handleAuth} />;
  if (stage === "onboarding") return <Onboarding onDone={handleOnboardDone} />;
  if (stage === "result") return <AnalysisResult analysis={analysis} onContinue={handleContinue} />;
  if (stage === "dashboard") return <Dashboard user={user} onLogout={handleLogout} ctx={ctx} />;
  return null;
}

export default App;
