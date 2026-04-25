import React, { useEffect, useState, useRef } from "react";
import { api, PLAN_RANK, PLAN_PRICES } from "./api";
import { LayoutDashboard, GraduationCap, CheckSquare, Target, Users, FolderArchive, MessageCircle, User, Calendar as CalIcon, Sparkles, Camera, Trash2, Download, Plus } from "lucide-react";
import { CountUp, Logo, Reveal, toast } from "./ui";

const NAV_ITEMS = [
  { id: "overview", label: "Vue d'ensemble", Icon: LayoutDashboard },
  { id: "formations", label: "Formations", Icon: GraduationCap },
  { id: "checklist", label: "Missions", Icon: CheckSquare },
  { id: "project", label: "Mon projet", Icon: Target },
  { id: "experts", label: "Suivi & Experts", Icon: Users },
  { id: "resources", label: "Ressources", Icon: FolderArchive },
  { id: "chat", label: "Chat", Icon: MessageCircle },
  { id: "profile", label: "Mon profil", Icon: User },
];

const STATUTS = ["Idée", "Développement", "Lancement", "Croissance"];

export function Dashboard({ user, setUser, onLogout, ctx, refreshCtx }) {
  const [tab, setTab] = useState("overview");
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Handle stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment");
    const sid = params.get("session_id");
    if (status === "success" && sid) {
      pollStatus(sid, 0);
    } else if (status === "cancel") {
      window.history.replaceState({}, "", "/");
    }
    // eslint-disable-next-line
  }, []);

  const pollStatus = async (sid, attempts) => {
    if (attempts >= 8) { window.history.replaceState({}, "", "/"); return; }
    try {
      const { data } = await api.get(`/checkout/status/${sid}`);
      if (data.payment_status === "paid") {
        await refreshCtx();
        window.history.replaceState({}, "", "/");
        toast(`✅ Paiement réussi ! Plan ${data.plan} activé`, "success");
        return;
      }
      setTimeout(() => pollStatus(sid, attempts + 1), 2000);
    } catch { setTimeout(() => pollStatus(sid, attempts + 1), 2000); }
  };

  return (
    <div className="dash">
      <aside className="sidebar">
        <Logo size={26} />
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((n) => {
            const Icon = n.Icon;
            return (
              <button key={n.id} data-testid={`nav-${n.id}`} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
                <span className="nav-icon"><Icon size={16} strokeWidth={1.7} /></span><span>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div data-testid="plan-pill" className={`plan-pill plan-${user.plan?.toLowerCase()}`} onClick={() => setShowUpgrade(true)}>
            <span>{user.plan}</span>
            {user.plan !== "Gold" && <span className="plan-up">↑</span>}
          </div>
          <button data-testid="logout-btn" className="btn-ghost logout-btn" onClick={onLogout}>Déconnexion</button>
        </div>
      </aside>

      <main className="main">
        {tab === "overview" && <Overview user={user} ctx={ctx} setTab={setTab} refreshCtx={refreshCtx} />}
        {tab === "formations" && <Formations user={user} setShowUpgrade={setShowUpgrade} />}
        {tab === "checklist" && <Missions analysis={ctx.onboarding?.analysis} />}
        {tab === "project" && <ProjectTab project={ctx.project} refreshCtx={refreshCtx} />}
        {tab === "experts" && <Experts user={user} setShowUpgrade={setShowUpgrade} />}
        {tab === "resources" && <Resources user={user} setShowUpgrade={setShowUpgrade} />}
        {tab === "chat" && <ChatTab />}
        {tab === "profile" && <Profile user={user} setUser={setUser} project={ctx.project} refreshCtx={refreshCtx} />}
      </main>

      <AiBubble />
      {showUpgrade && <UpgradeModal user={user} onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}

// ===== Overview Cockpit =====
function Overview({ user, ctx, setTab, refreshCtx }) {
  const score = ctx.onboarding?.analysis?.score || 0;
  const c = score >= 75 ? "#5BC78A" : score >= 55 ? "#C9A84C" : score >= 30 ? "#E89B4C" : "#E05C5C";
  const statut = ctx.project?.statut || "Idée";
  const [postits, setPostits] = useState([]);
  const [events, setEvents] = useState([]);
  const [newPostit, setNewPostit] = useState("");
  const history = ctx.onboarding?.score_history || [];

  const loadPostits = async () => {
    const { data } = await api.get("/postits"); setPostits(data.postits);
  };
  const loadEvents = async () => {
    const { data } = await api.get("/events"); setEvents(data.events);
  };
  useEffect(() => { loadPostits(); loadEvents(); }, []);

  const addPostit = async () => {
    if (!newPostit.trim()) return;
    await api.post("/postits", { text: newPostit });
    setNewPostit(""); loadPostits();
  };
  const deletePostit = async (id) => { await api.delete(`/postits/${id}`); loadPostits(); };
  const markRead = async (id) => { await api.post(`/postits/${id}/read`); loadPostits(); };

  return (
    <div className="page-content">
      <div className="page-head-row">
        <div>
          <h1 className="page-title">Salut {user.name} 👋</h1>
          <p className="page-sub">Ton cockpit Envol — tout ce qu'il faut pour avancer.</p>
        </div>
      </div>

      {/* Top row: Score + Status + Progression */}
      <div className="cockpit-grid">
        <div className="card cockpit-score">
          <div className="card-label">SCORE PROJET</div>
          <div className="cockpit-score-row">
            <div className="score-circle" style={{ "--c": c, width: 120, height: 120 }}>
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={c} strokeWidth="10" strokeDasharray={`${(score / 100) * 314} 314`} strokeLinecap="round" transform="rotate(-90 60 60)" />
              </svg>
              <div className="score-num"><span data-testid="overview-score">{score}</span><span style={{ fontSize: 11 }}>/100</span></div>
            </div>
            <div style={{ flex: 1 }}>
              <p className="card-sub" style={{ marginBottom: 12 }}>{ctx.onboarding?.analysis?.score_reason}</p>
              {history.length > 1 && (
                <div className="score-trend">
                  <span className="trend-label">Évolution</span>
                  <SparkLine values={history.map(h => h.score)} color={c} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card cockpit-status">
          <div className="card-label">STATUT DU PROJET</div>
          <div className="status-stepper">
            {STATUTS.map((s, i) => {
              const idx = STATUTS.indexOf(statut);
              const active = i <= idx;
              return (
                <React.Fragment key={s}>
                  <div className={`status-step ${active ? "active" : ""} ${s === statut ? "current" : ""}`}>
                    <div className="status-dot">{i + 1}</div>
                    <div className="status-label">{s}</div>
                  </div>
                  {i < STATUTS.length - 1 && <div className={`status-line ${active && i < idx ? "active" : ""}`}></div>}
                </React.Fragment>
              );
            })}
          </div>
          <button className="btn-ghost" onClick={() => setTab("project")} style={{ marginTop: 16 }}>Mettre à jour →</button>
        </div>
      </div>

      {/* Post-its + Events */}
      <div className="grid-2">
        <div className="card">
          <div className="card-head-row">
            <div>
              <div className="card-label">POST-ITS</div>
              <div className="card-title">Notes & messages</div>
            </div>
          </div>
          <div className="postit-grid">
            {postits.length === 0 && <div className="empty-msg">Aucune note. Crée ta première !</div>}
            {postits.map((p) => (
              <div key={p.id} className={`postit ${p.color} ${p.read ? "" : "unread"}`} data-testid={`postit-${p.id}`} onClick={() => !p.read && markRead(p.id)}>
                <div className="postit-author">{p.is_admin_post ? "✦ " : ""}{p.author_name}</div>
                <div className="postit-text">{p.text}</div>
                {!p.read && p.is_admin_post && <div className="postit-badge">Nouveau</div>}
                <button className="postit-del" onClick={(e) => { e.stopPropagation(); deletePostit(p.id); }}>×</button>
              </div>
            ))}
          </div>
          <div className="postit-add-row">
            <input data-testid="postit-input" className="input" placeholder="Une note pour toi-même…" value={newPostit} onChange={(e) => setNewPostit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPostit()} />
            <button data-testid="postit-add-btn" className="btn-gold" onClick={addPostit}>+</button>
          </div>
        </div>

        <div className="card">
          <div className="card-head-row">
            <div>
              <div className="card-label">CALENDRIER</div>
              <div className="card-title">À venir</div>
            </div>
          </div>
          <MonthCalendar events={events} />
        </div>
      </div>

      {/* Progress + Quick actions */}
      <div className="grid-2">
        <div className="card">
          <div className="card-label">PROGRESSION FORMATION</div>
          <div className="card-title">2 / 5 modules</div>
          <div className="progress" style={{ marginTop: 12 }}><div className="progress-bar" style={{ width: "40%" }}></div></div>
          <button className="btn-ghost" onClick={() => setTab("formations")} style={{ marginTop: 14 }}>Continuer →</button>
        </div>
        <div className="card cockpit-action">
          <div className="card-label">PROCHAINE ÉTAPE</div>
          <div className="card-title">{ctx.onboarding?.analysis?.ameliorations?.[0] || "Définis ton premier objectif"}</div>
          <button className="btn-gold" onClick={() => setTab("checklist")} style={{ marginTop: 14 }}>Voir mes missions →</button>
        </div>
      </div>
    </div>
  );
}

function MonthCalendar({ events = [] }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(null);
  const firstDay = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const prev = () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const next = () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const eventsByDay = {};
  events.forEach((e) => {
    const d = new Date(e.date);
    if (d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()) {
      const k = d.getDate();
      eventsByDay[k] = [...(eventsByDay[k] || []), e];
    }
  });
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const isToday = (d) => d === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
  return (
    <div className="month-cal">
      <div className="cal-head">
        <button className="cal-nav" onClick={prev}>‹</button>
        <div className="cal-title">{month.toLocaleString('fr', { month: 'long', year: 'numeric' })}</div>
        <button className="cal-nav" onClick={next}>›</button>
      </div>
      <div className="cal-grid cal-dow">
        {["L","M","M","J","V","S","D"].map((d, i) => <div key={i} className="cal-dow-cell">{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => (
          <div key={i} className={`cal-cell ${d ? "" : "empty"} ${isToday(d) ? "today" : ""} ${eventsByDay[d] ? "has" : ""}`} onClick={() => d && eventsByDay[d] && setSelected({ day: d, evs: eventsByDay[d] })}>
            {d && <span className="cal-d">{d}</span>}
            {eventsByDay[d] && <span className="cal-dot"></span>}
          </div>
        ))}
      </div>
      {selected && (
        <div className="cal-popover">
          <div className="cal-popover-h">{selected.day} {month.toLocaleString('fr', { month: 'short' })}</div>
          {selected.evs.map((e) => (
            <div key={e.id} className="cal-popover-evt">
              <div className="event-t">{e.title}</div>
              <div className="event-meta">{new Date(e.date).toLocaleString('fr', { hour: '2-digit', minute: '2-digit' })} · {e.type}</div>
              {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="btn-ghost" style={{ marginTop: 6 }}>Rejoindre</a>}
            </div>
          ))}
          <button className="link-btn" onClick={() => setSelected(null)}>Fermer</button>
        </div>
      )}
    </div>
  );
}


function SparkLine({ values, color = "#C9A84C" }) {
  if (values.length < 2) return null;
  const w = 120, h = 32;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(" ");
  return <svg width={w} height={h} className="sparkline"><polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
}

// ===== Formations (with real video player) =====
function Formations({ user, setShowUpgrade }) {
  const userRank = PLAN_RANK[user.plan] || 1;
  const [modules, setModules] = useState([]);
  const [active, setActive] = useState(null);
  useEffect(() => { api.get("/formations").then((r) => setModules(r.data.formations)); }, []);
  return (
    <div className="page-content">
      <h1 className="page-title">Formations</h1>
      <p className="page-sub">5 modules · De zéro à ta première vente</p>
      <div className="path-line">
        {modules.map((m) => {
          const reqRank = PLAN_RANK[m.plan_required] || 1;
          const locked = reqRank > userRank;
          return (
            <div key={m.n} data-testid={`fmod-${m.n}`} className={`path-mod ${locked ? "lock-plan" : "ready"}`}>
              <div className="path-num">{m.n}</div>
              <div style={{ flex: 1 }}>
                <div className="path-t">{m.title} {locked && <span className="lock-tag">{m.plan_required}+</span>}</div>
                <div className="path-d">{m.description}</div>
                <div className="path-meta">⏱ {m.duration} · {m.lessons.length} leçons</div>
              </div>
              {locked ? (
                <button className="btn-gold" data-testid={`fmod-unlock-${m.n}`} onClick={() => setShowUpgrade(true)}>Débloquer</button>
              ) : (
                <button className="btn-gold" data-testid={`fmod-watch-${m.n}`} onClick={() => setActive(m)}>▶ Regarder</button>
              )}
            </div>
          );
        })}
      </div>
      {active && (
        <div className="modal-bg" onClick={(e) => { if (e.target.className === "modal-bg") setActive(null); }}>
          <div className="modal video-modal">
            <button className="modal-close" onClick={() => setActive(null)}>×</button>
            <div className="card-label">MODULE {active.n}</div>
            <h3 className="modal-title">{active.title}</h3>
            <p className="modal-sub">{active.description}</p>
            <div className="video-wrap">
              <iframe src={active.video_url} title={active.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
            </div>
            <div className="card-label" style={{ marginTop: 18 }}>AU PROGRAMME</div>
            <ul className="bullet-list">
              {active.lessons.map((l, i) => <li key={i}><span>{i + 1}. {l}</span></li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Missions / Checklist =====
function Missions({ analysis }) {
  const ai = analysis?.ameliorations || [];
  const [done, setDone] = useState({});
  const items = [
    ...ai.map((t, i) => ({ id: `ai-${i}`, t, source: "Plan IA", xp: 50 })),
    { id: "g1", t: "Parler à 10 clients potentiels", source: "Validation", xp: 100 },
    { id: "g2", t: "Créer ta landing page", source: "Validation", xp: 75 },
    { id: "g3", t: "Choisir ton statut juridique", source: "Structurer", xp: 80 },
    { id: "g4", t: "Ouvrir un compte pro", source: "Structurer", xp: 60 },
  ];
  const totalXp = items.reduce((s, i) => s + i.xp, 0);
  const earnedXp = items.filter(i => done[i.id]).reduce((s, i) => s + i.xp, 0);
  const lvl = Math.floor(earnedXp / 200) + 1;

  return (
    <div className="page-content">
      <h1 className="page-title">Missions</h1>
      <p className="page-sub">Chaque mission accomplie = des XP et un projet qui avance.</p>

      <div className="card mission-stats">
        <div className="mission-stat">
          <div className="mission-stat-n">{lvl}</div>
          <div className="mission-stat-l">Niveau</div>
        </div>
        <div className="mission-stat">
          <div className="mission-stat-n">{earnedXp}<span className="mission-stat-x">/{totalXp}</span></div>
          <div className="mission-stat-l">XP</div>
        </div>
        <div className="mission-stat">
          <div className="mission-stat-n">{Object.values(done).filter(Boolean).length}<span className="mission-stat-x">/{items.length}</span></div>
          <div className="mission-stat-l">Missions</div>
        </div>
        <div style={{ flex: 2 }}>
          <div className="progress" style={{ height: 10 }}><div className="progress-bar" style={{ width: `${(earnedXp / totalXp) * 100}%` }}></div></div>
        </div>
      </div>

      <div className="card">
        {items.map((it) => (
          <div key={it.id} className="check-item" onClick={() => setDone({ ...done, [it.id]: !done[it.id] })} data-testid={`check-${it.id}`}>
            <div className={`check-box ${done[it.id] ? "checked" : ""}`}>{done[it.id] ? "✓" : ""}</div>
            <div style={{ flex: 1 }}>
              <div className={`check-text ${done[it.id] ? "done" : ""}`}>{it.t}</div>
              <div className="check-source">{it.source}</div>
            </div>
            <div className="check-xp">+{it.xp} XP</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Project (with pitch, objectives, roadmap) =====
function ProjectTab({ project, refreshCtx }) {
  const [p, setP] = useState({
    name: "", secteur: "Tech / SaaS", probleme: "", solution: "",
    stade: "Idée", montant: "", lien: "", pitch: "",
    statut: "Idée",
    objectifs: [],
    roadmap: [],
    ...project,
  });
  const [saved, setSaved] = useState(false);
  const [newObj, setNewObj] = useState("");
  const [newRoad, setNewRoad] = useState({ phase: "", desc: "" });

  const submit = async () => {
    await api.post("/project", p);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    refreshCtx();
  };
  const addObj = () => { if (newObj.trim()) { setP({ ...p, objectifs: [...p.objectifs, newObj] }); setNewObj(""); } };
  const removeObj = (i) => setP({ ...p, objectifs: p.objectifs.filter((_, x) => x !== i) });
  const addRoad = () => { if (newRoad.phase.trim()) { setP({ ...p, roadmap: [...p.roadmap, { ...newRoad }] }); setNewRoad({ phase: "", desc: "" }); } };
  const removeRoad = (i) => setP({ ...p, roadmap: p.roadmap.filter((_, x) => x !== i) });

  return (
    <div className="page-content">
      <h1 className="page-title">Mon projet</h1>
      <p className="page-sub">Ton projet, structuré. Pitch, objectifs, roadmap.</p>

      <div className="card">
        <div className="card-label">IDENTITÉ</div>
        <div className="form-grid">
          <div><label>Nom du projet</label><input data-testid="proj-name" className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Ex : Foodly" /></div>
          <div><label>Secteur</label>
            <select className="input" value={p.secteur} onChange={(e) => setP({ ...p, secteur: e.target.value })}>
              <option>Tech / SaaS</option><option>Commerce</option><option>Éducation</option><option>Santé</option><option>Créatif</option><option>Autre</option>
            </select>
          </div>
        </div>
        <label>Statut actuel</label>
        <div className="seg">
          {STATUTS.map((s) => (
            <button key={s} className={`seg-btn ${p.statut === s ? "active" : ""}`} onClick={() => setP({ ...p, statut: s })}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-label">PITCH</div>
        <textarea className="input" rows={4} value={p.pitch || ""} onChange={(e) => setP({ ...p, pitch: e.target.value })} placeholder="Ton pitch en quelques lignes — clair, percutant, mémorable" />
        <label>Le problème que tu résous</label>
        <textarea className="input" rows={3} value={p.probleme} onChange={(e) => setP({ ...p, probleme: e.target.value })} />
        <label>Ta solution</label>
        <textarea className="input" rows={3} value={p.solution} onChange={(e) => setP({ ...p, solution: e.target.value })} />
      </div>

      <div className="card">
        <div className="card-label">OBJECTIFS</div>
        <ul className="bullet-list">
          {(p.objectifs || []).map((o, i) => (
            <li key={i}><span>{o}</span><button className="x-btn" onClick={() => removeObj(i)}>×</button></li>
          ))}
          {(!p.objectifs || p.objectifs.length === 0) && <div className="empty-msg">Aucun objectif. Définis-en 3 pour commencer.</div>}
        </ul>
        <div className="add-row">
          <input className="input" placeholder="Nouvel objectif…" value={newObj} onChange={(e) => setNewObj(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addObj()} />
          <button className="btn-gold" onClick={addObj}>+</button>
        </div>
      </div>

      <div className="card">
        <div className="card-label">ROADMAP</div>
        <div className="roadmap">
          {(p.roadmap || []).map((r, i) => (
            <div key={i} className="roadmap-item">
              <div className="roadmap-dot"></div>
              <div style={{ flex: 1 }}>
                <div className="roadmap-phase">{r.phase}</div>
                {r.desc && <div className="roadmap-desc">{r.desc}</div>}
              </div>
              <button className="x-btn" onClick={() => removeRoad(i)}>×</button>
            </div>
          ))}
          {(!p.roadmap || p.roadmap.length === 0) && <div className="empty-msg">Aucune phase planifiée.</div>}
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <input className="input" placeholder="Phase (ex: MVP, Bêta, Lancement)" value={newRoad.phase} onChange={(e) => setNewRoad({ ...newRoad, phase: e.target.value })} />
          <input className="input" placeholder="Description (ex: Q2 2026)" value={newRoad.desc} onChange={(e) => setNewRoad({ ...newRoad, desc: e.target.value })} />
        </div>
        <button className="btn-ghost" onClick={addRoad}>+ Ajouter une phase</button>
      </div>

      <div className="card">
        <div className="card-label">DÉTAILS</div>
        <div className="form-grid">
          <div><label>Stade</label>
            <select className="input" value={p.stade} onChange={(e) => setP({ ...p, stade: e.target.value })}>
              <option>Idée</option><option>Prototype</option><option>Premiers clients</option><option>Revenus</option>
            </select>
          </div>
          <div><label>Montant recherché</label><input className="input" value={p.montant} onChange={(e) => setP({ ...p, montant: e.target.value })} /></div>
        </div>
        <label>Lien (site, deck...)</label>
        <input className="input" value={p.lien} onChange={(e) => setP({ ...p, lien: e.target.value })} placeholder="https://..." />
      </div>

      <button data-testid="proj-save-btn" className="btn-gold-lg w-full" onClick={submit}>{saved ? "✓ Enregistré" : "Sauvegarder mon projet →"}</button>
    </div>
  );
}

// ===== Experts =====
function Experts({ user, setShowUpgrade }) {
  const userRank = PLAN_RANK[user.plan] || 1;
  const list = [
    { ini: "BB", n: "Bertrand Boachon", r: "Avocat · Droit des affaires", plan: 2 },
    { ini: "VH", n: "Virginie Heidsieck", r: "Avocate · Sociétés", plan: 2 },
    { ini: "GL", n: "Greffe de Lyon", r: "Immatriculation, statuts", plan: 1 },
    { ini: "EC", n: "Expert-comptable partenaire", r: "Compta, fiscalité, conseil", plan: 2 },
    { ini: "BP", n: "Banque partenaire Envol", r: "Compte pro accéléré", plan: 1 },
    { ini: "M1", n: "Mentor Tech (Gold)", r: "Mentorat 1-1 produit & tech", plan: 3 },
  ];
  return (
    <div className="page-content">
      <h1 className="page-title">Suivi & Experts</h1>
      <p className="page-sub">Ton réseau d'accompagnement.</p>
      <div className="card">
        {list.map((e) => {
          const locked = e.plan > userRank;
          return (
            <div key={e.n} className={`expert-row ${locked ? "locked" : ""}`}>
              <div className="expert-avatar">{e.ini}</div>
              <div style={{ flex: 1 }}>
                <div className="expert-n">{e.n}</div>
                <div className="expert-r">{e.r}</div>
              </div>
              {locked ? (
                <button className="btn-gold" onClick={() => setShowUpgrade(true)}>{e.plan === 3 ? "Gold" : "Silver"}+</button>
              ) : (
                <button className="btn-ghost">Prendre RDV</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Resources =====
function Resources({ user, setShowUpgrade }) {
  const [items, setItems] = useState([]);
  const userRank = PLAN_RANK[user.plan] || 1;
  useEffect(() => { api.get("/resources").then((r) => setItems(r.data.resources)); }, []);
  return (
    <div className="page-content">
      <h1 className="page-title">Ressources</h1>
      <p className="page-sub">Templates, guides et outils prêts à l'emploi.</p>
      <div className="grid-3">
        {items.map((it) => {
          const req = PLAN_RANK[it.plan_required] || 1;
          const locked = req > userRank;
          return (
            <div key={it.id} className={`card resource-card ${locked ? "locked" : ""}`} onClick={() => locked && setShowUpgrade(true)}>
              <div className="resource-icon">{it.icon}</div>
              <div className="card-title">{it.title}</div>
              <p className="card-sub">{it.description}</p>
              <div className="resource-foot">
                <span className="tag">{it.category}</span>
                <span className={`tag plan-tag-${it.plan_required?.toLowerCase()}`}>{it.plan_required}</span>
              </div>
              {locked && <div className="resource-lock">🔒 {it.plan_required}+</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Chat =====
function ChatTab() {
  const [msgs, setList] = useState([
    { who: "Léo · Fondateur", t: "Bienvenue sur Envol ! Posez vos questions ici, on répond chaque jour." },
    { who: "Gaspard · Fondateur", t: "Pour toute question technique ou design, je suis là." },
  ]);
  const [text, setText] = useState("");
  return (
    <div className="page-content">
      <h1 className="page-title">Chat Envol</h1>
      <p className="page-sub">Échange avec l'équipe et la communauté.</p>
      <div className="card chat-box">
        <div className="chat-stream">
          {msgs.map((m, i) => (
            <div key={i} className="chat-msg-row">
              <div className="chat-avatar">{m.who[0]}</div>
              <div><div className="chat-who">{m.who}</div><div className="chat-bubble">{m.t}</div></div>
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input className="input" placeholder="Écris ton message…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-gold" onClick={() => { if (text.trim()) { setList([...msgs, { who: "Toi", t: text }]); setText(""); } }}>Envoyer</button>
        </div>
      </div>
    </div>
  );
}

// ===== Profile (with sub-tabs) =====
function Profile({ user, setUser, project, refreshCtx }) {
  const [sub, setSub] = useState("info");
  return (
    <div className="page-content">
      <h1 className="page-title">Mon profil</h1>
      <p className="page-sub">Informations, projet et documents.</p>
      <div className="sub-tabs">
        <button data-testid="sub-info" className={`sub-tab ${sub === "info" ? "active" : ""}`} onClick={() => setSub("info")}>Profil & Projet</button>
        <button data-testid="sub-docs" className={`sub-tab ${sub === "docs" ? "active" : ""}`} onClick={() => setSub("docs")}>Documents</button>
      </div>
      {sub === "info" && <ProfileInfo user={user} setUser={setUser} project={project} refreshCtx={refreshCtx} />}
      {sub === "docs" && <Documents />}
    </div>
  );
}

function ProfileInfo({ user, setUser, project, refreshCtx }) {
  const [p, setP] = useState({ name: user.name || "", nom: user.nom || "", ville: user.ville || "", age: user.age || "", linkedin: user.linkedin || "", social: user.social || "", bio: user.bio || "" });
  const [saved, setSaved] = useState(false);
  const [photoTs, setPhotoTs] = useState(Date.now());
  const photoRef = useRef(null);
  const save = async () => {
    const { data } = await api.post("/profile", p);
    setUser(data.user); setSaved(true); setTimeout(() => setSaved(false), 2000);
    refreshCtx();
    toast("Profil sauvegardé", "success");
  };
  const uploadPhoto = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/profile/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setUser({ ...user, photo_url: data.photo_url });
    setPhotoTs(Date.now());
    toast("Photo mise à jour", "success");
    refreshCtx();
  };
  const photoSrc = user.photo_url ? `${process.env.REACT_APP_BACKEND_URL}${user.photo_url}?t=${photoTs}` : null;
  return (
    <>
      <div className="card">
        <div className="profile-header">
          <div className="photo-wrap" onClick={() => photoRef.current?.click()}>
            {photoSrc ? <img src={photoSrc} alt="" className="profile-photo" /> : <div className="profile-avatar">{(p.name || "U")[0].toUpperCase()}</div>}
            <div className="photo-overlay"><Camera size={16} /></div>
            <input ref={photoRef} data-testid="photo-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => uploadPhoto(e.target.files[0])} />
          </div>
          <div>
            <div className="card-title">{p.name || user.name}</div>
            <div className="card-sub">{user.email} · plan {user.plan}</div>
          </div>
        </div>
        <div className="form-grid">
          <div><label>Prénom</label><input data-testid="prof-name" className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
          <div><label>Nom</label><input className="input" value={p.nom} onChange={(e) => setP({ ...p, nom: e.target.value })} /></div>
          <div><label>Ville</label><input className="input" value={p.ville} onChange={(e) => setP({ ...p, ville: e.target.value })} /></div>
          <div><label>Âge</label><input className="input" type="number" value={p.age} onChange={(e) => setP({ ...p, age: e.target.value })} /></div>
        </div>
        <label>LinkedIn</label>
        <input className="input" value={p.linkedin} onChange={(e) => setP({ ...p, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
        <label>Instagram / TikTok</label>
        <input className="input" value={p.social} onChange={(e) => setP({ ...p, social: e.target.value })} placeholder="@tonhandle" />
        <label>Ta bio</label>
        <textarea className="input" rows={3} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} />
        <button data-testid="prof-save-btn" className="btn-gold" onClick={save}>{saved ? "✓ Enregistré" : "Sauvegarder →"}</button>
      </div>

      {project?.name && (
        <div className="card">
          <div className="card-label">RÉSUMÉ DU PROJET</div>
          <div className="card-title">{project.name}</div>
          <p className="card-sub">{project.statut} · {project.secteur}</p>
          {project.pitch && <p style={{ marginTop: 12, fontSize: 14, color: "var(--lav-l)", lineHeight: 1.6 }}>{project.pitch}</p>}
          {project.objectifs?.length > 0 && (
            <ul style={{ marginTop: 14, paddingLeft: 18 }}>
              {project.objectifs.slice(0, 3).map((o, i) => <li key={i} style={{ fontSize: 13, color: "var(--lav-l)", marginBottom: 6 }}>{o}</li>)}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function Documents() {
  const [docs, setDocs] = useState([]);
  const [category, setCategory] = useState("Business plan");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const CATS = ["Business plan", "Logos", "Pitch deck", "Stratégie", "Divers"];

  const load = async () => { const { data } = await api.get("/documents"); setDocs(data.documents); };
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    try {
      await api.post("/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      load();
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const download = async (id, filename) => {
    const r = await api.get(`/documents/${id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  };
  const del = async (id) => { if (!window.confirm("Supprimer ?")) return; await api.delete(`/documents/${id}`); load(); };

  const grouped = docs.reduce((acc, d) => ({ ...acc, [d.category]: [...(acc[d.category] || []), d] }), {});
  const fmt = (b) => b < 1024 ? `${b}o` : b < 1048576 ? `${(b / 1024).toFixed(0)}Ko` : `${(b / 1048576).toFixed(1)}Mo`;

  return (
    <>
      <div className="card">
        <div className="card-label">UPLOADER UN DOCUMENT</div>
        <div className="form-grid">
          <div>
            <label>Catégorie</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Fichier</label>
            <input ref={fileRef} data-testid="doc-upload" type="file" className="input" onChange={(e) => upload(e.target.files[0])} disabled={uploading} />
          </div>
        </div>
        {uploading && <div className="card-sub">Upload en cours…</div>}
      </div>

      {CATS.map((cat) => grouped[cat] && (
        <div key={cat} className="card">
          <div className="card-label">{cat.toUpperCase()}</div>
          {grouped[cat].map((d) => (
            <div key={d.id} className="doc-row" data-testid={`doc-${d.id}`}>
              <div className="doc-icon">📄</div>
              <div style={{ flex: 1 }}>
                <div className="doc-name">{d.filename}</div>
                <div className="doc-meta">{fmt(d.size)} · {new Date(d.uploaded_at).toLocaleDateString('fr')}</div>
              </div>
              <button className="btn-ghost" onClick={() => download(d.id, d.filename)}>Télécharger</button>
              <button className="x-btn" onClick={() => del(d.id)}>×</button>
            </div>
          ))}
        </div>
      ))}
      {docs.length === 0 && <div className="empty-msg" style={{ textAlign: "center", padding: 40 }}>Aucun document. Upload ton business plan, ton logo, ton pitch deck…</div>}
    </>
  );
}

// ===== AI Bubble =====
function AiBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "ai", text: "👋 Salut ! Je suis ton assistant Envol. Pose-moi tes questions sur ton projet, le juridique, le marketing, la motivation… Je suis là pour t'aider !" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);
  const send = async () => {
    if (!input.trim() || loading) return;
    const u = input;
    setMessages((m) => [...m, { role: "user", text: u }]); setInput(""); setLoading(true);
    try {
      const { data } = await api.post("/ai/chat", { message: u });
      setMessages((m) => [...m, { role: "ai", text: data.reply }]);
    } catch { setMessages((m) => [...m, { role: "ai", text: "Désolé, je suis indisponible." }]); }
    finally { setLoading(false); }
  };
  return (
    <>
      <button data-testid="ai-bubble-btn" className={`ai-bubble ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>{open ? "×" : "✨"}</button>
      {open && (
        <div className="ai-panel" data-testid="ai-panel">
          <div className="ai-header"><div className="ai-avatar">✨</div><div><div className="ai-name">Envol AI</div><div className="ai-status">En ligne</div></div></div>
          <div className="ai-messages">
            {messages.map((m, i) => <div key={i} className={`ai-msg ${m.role}`}>{m.text}</div>)}
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

// ===== Upgrade Modal =====
function UpgradeModal({ user, onClose }) {
  const [loading, setLoading] = useState(null);
  const upgrade = async (plan) => {
    setLoading(plan);
    try {
      const { data } = await api.post("/checkout/session", { plan, origin_url: window.location.origin });
      window.location.href = data.url;
    } catch (e) {
      alert("Paiement indisponible — réessaie dans un moment");
      setLoading(null);
    }
  };
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target.className === "modal-bg") onClose(); }}>
      <div className="modal" style={{ maxWidth: 880 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 className="modal-title">Choisis ton niveau d'envol.</h3>
        <p className="modal-sub">Plan actuel : <strong style={{ color: "var(--gold)" }}>{user.plan}</strong> · Sans engagement, résiliable à tout moment.</p>
        <div className="pricing-grid" style={{ marginTop: 24 }}>
          {[
            ["Bronze", 49, ["5 modules de formation", "Checklist & ressources", "Communauté", "Assistant IA"], false],
            ["Silver", 99, ["Tout Bronze", "Visios groupe", "Accès experts", "Ressources avancées"], true],
            ["Gold", 199, ["Tout Silver", "Mentorat 1-1", "Visios privées", "Priorité"], false],
          ].map(([t, p, fs, feat]) => {
            const isCurrent = user.plan === t;
            return (
              <div key={t} className={`pricing-card ${feat ? "featured" : ""} ${isCurrent ? "is-current" : ""}`}>
                {feat && <div className="pricing-badge">★ Populaire</div>}
                <div className="pricing-tier">{t}</div>
                <div className="pricing-price">{p}€<span>/mois</span></div>
                <ul>{fs.map((f) => <li key={f}>{f}</li>)}</ul>
                {isCurrent ? (
                  <button className="btn-ghost w-full" disabled>Plan actuel</button>
                ) : (
                  <button data-testid={`upgrade-${t.toLowerCase()}`} className={feat ? "btn-gold w-full" : "btn-ghost w-full"} onClick={() => upgrade(t)} disabled={loading}>{loading === t ? "Redirection…" : `Choisir ${t}`}</button>
                )}
              </div>
            );
          })}
        </div>
        <div className="card-sub" style={{ textAlign: "center", marginTop: 18, fontSize: 11 }}>🔒 Paiement sécurisé via Stripe</div>
      </div>
    </div>
  );
}
