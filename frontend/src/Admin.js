import React, { useEffect, useState } from "react";
import { api, TOKEN_KEY } from "./api";

export function AdminLogin({ onLogin, onBack }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/admin-login", form);
      localStorage.setItem(TOKEN_KEY, data.token);
      onLogin(data.user);
    } catch (e) { setErr(e.response?.data?.detail || "Accès refusé"); }
    finally { setLoading(false); }
  };
  return (
    <div className="onboard-bg">
      <div className="orb orb1"></div>
      <div className="onboard-card" style={{ maxWidth: 420 }}>
        <div className="admin-badge">ESPACE ADMIN</div>
        <h2 className="onboard-q">Accès réservé à l'équipe Envol.</h2>
        <form onSubmit={submit}>
          <input data-testid="admin-email" className="onboard-input" type="email" placeholder="admin@envol.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input data-testid="admin-password" className="onboard-input" type="password" placeholder="Mot de passe admin" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          {err && <div className="err-msg">{err}</div>}
          <div className="onboard-nav">
            <button type="button" className="btn-ghost" onClick={onBack}>← Retour</button>
            <button data-testid="admin-submit" className="btn-gold" disabled={loading}>{loading ? "..." : "Se connecter"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ADMIN_NAV = [
  { id: "users", label: "Utilisateurs", icon: "👥" },
  { id: "events", label: "Événements", icon: "📅" },
  { id: "resources", label: "Ressources", icon: "📚" },
  { id: "postits", label: "Post-its", icon: "📌" },
];

export function AdminDashboard({ admin, onLogout }) {
  const [tab, setTab] = useState("users");
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/stats").then((r) => setStats(r.data)); }, []);

  return (
    <div className="dash">
      <aside className="sidebar admin-sidebar">
        <div className="sidebar-logo">ENVOL <span className="admin-pill">ADMIN</span></div>
        <nav className="sidebar-nav">
          {ADMIN_NAV.map((n) => (
            <button key={n.id} data-testid={`admin-nav-${n.id}`} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
              <span className="nav-icon">{n.icon}</span><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button data-testid="admin-logout" className="btn-ghost logout-btn" onClick={onLogout}>Déconnexion</button>
        </div>
      </aside>
      <main className="main">
        <div className="page-content">
          <div className="page-head-row">
            <div>
              <h1 className="page-title">Admin Envol</h1>
              <p className="page-sub">Bienvenue {admin.name}.</p>
            </div>
          </div>
          {stats && (
            <div className="grid-3 admin-stats-row">
              <div className="card stat-card"><div className="stat-card-n">{stats.total_users}</div><div className="stat-card-l">Membres</div></div>
              <div className="card stat-card"><div className="stat-card-n">{stats.onboarded}</div><div className="stat-card-l">Onboardés</div></div>
              <div className="card stat-card"><div className="stat-card-n">{stats.mrr}€</div><div className="stat-card-l">MRR</div></div>
            </div>
          )}
          {tab === "users" && <AdminUsers />}
          {tab === "events" && <AdminEvents />}
          {tab === "resources" && <AdminResources />}
          {tab === "postits" && <AdminPostits />}
        </div>
      </main>
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");
  useEffect(() => { api.get("/admin/users").then((r) => setUsers(r.data.users)); }, []);
  const filtered = users.filter(u => !filter || u.plan === filter);
  return (
    <div className="card">
      <div className="card-head-row">
        <div className="card-title">Tous les utilisateurs ({filtered.length})</div>
        <select className="input" style={{ width: 160, margin: 0 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tous les plans</option><option>Bronze</option><option>Silver</option><option>Gold</option>
        </select>
      </div>
      <table className="admin-table">
        <thead><tr><th>Nom</th><th>Email</th><th>Plan</th><th>Score</th><th>Projet</th><th>Statut</th></tr></thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id} data-testid={`admin-user-${u.id}`}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td><span className={`tag plan-tag-${u.plan?.toLowerCase()}`}>{u.plan}</span></td>
              <td>{u.score ?? "—"}</td>
              <td>{u.project_name || "—"}</td>
              <td>{u.project_statut || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", date: "", duration: 60, link: "", type: "visio", plan_required: "" });
  const load = async () => { const { data } = await api.get("/events"); setEvents(data.events); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.title || !form.date) return alert("Titre et date requis");
    const payload = { ...form, plan_required: form.plan_required || null };
    await api.post("/events", payload);
    setForm({ title: "", description: "", date: "", duration: 60, link: "", type: "visio", plan_required: "" });
    load();
  };
  const del = async (id) => { if (!window.confirm("Supprimer ?")) return; await api.delete(`/events/${id}`); load(); };
  return (
    <>
      <div className="card">
        <div className="card-label">CRÉER UN ÉVÉNEMENT</div>
        <div className="form-grid">
          <div><label>Titre</label><input data-testid="evt-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label>Date & heure</label><input data-testid="evt-date" className="input" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><label>Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="visio">Visio</option><option value="groupe">Groupe</option><option value="privee">Privée</option><option value="deadline">Deadline</option>
            </select>
          </div>
          <div><label>Plan requis</label>
            <select className="input" value={form.plan_required} onChange={(e) => setForm({ ...form, plan_required: e.target.value })}>
              <option value="">Tous</option><option>Bronze</option><option>Silver</option><option>Gold</option>
            </select>
          </div>
        </div>
        <label>Description</label>
        <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label>Lien (Meet, Teams…)</label>
        <input className="input" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://meet.google.com/..." />
        <button data-testid="evt-create" className="btn-gold" onClick={create}>Créer →</button>
      </div>
      <div className="card">
        <div className="card-label">ÉVÉNEMENTS PROGRAMMÉS ({events.length})</div>
        {events.map((e) => (
          <div key={e.id} className="event-row">
            <div className="event-date"><div className="event-d">{new Date(e.date).getDate()}</div><div className="event-m">{new Date(e.date).toLocaleString('fr', { month: 'short' })}</div></div>
            <div style={{ flex: 1 }}>
              <div className="event-t">{e.title} {e.plan_required && <span className={`tag plan-tag-${e.plan_required.toLowerCase()}`}>{e.plan_required}+</span>}</div>
              <div className="event-meta">{new Date(e.date).toLocaleString('fr', { hour: '2-digit', minute: '2-digit' })} · {e.type}</div>
            </div>
            <button className="x-btn" onClick={() => del(e.id)}>×</button>
          </div>
        ))}
        {events.length === 0 && <div className="empty-msg">Aucun événement.</div>}
      </div>
    </>
  );
}

function AdminResources() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", category: "Stratégie", icon: "📄", plan_required: "Bronze", url: "" });
  const load = async () => { const { data } = await api.get("/resources"); setItems(data.resources); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.title) return;
    await api.post("/resources", form);
    setForm({ title: "", description: "", category: "Stratégie", icon: "📄", plan_required: "Bronze", url: "" });
    load();
  };
  const del = async (id) => { if (!window.confirm("Supprimer ?")) return; await api.delete(`/resources/${id}`); load(); };
  return (
    <>
      <div className="card">
        <div className="card-label">AJOUTER UNE RESSOURCE</div>
        <div className="form-grid">
          <div><label>Titre</label><input data-testid="res-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label>Icône</label><input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
          <div><label>Catégorie</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div><label>Plan requis</label>
            <select className="input" value={form.plan_required} onChange={(e) => setForm({ ...form, plan_required: e.target.value })}>
              <option>Bronze</option><option>Silver</option><option>Gold</option>
            </select>
          </div>
        </div>
        <label>Description</label>
        <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label>URL (optionnel)</label>
        <input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <button data-testid="res-create" className="btn-gold" onClick={create}>Ajouter →</button>
      </div>
      <div className="card">
        <div className="card-label">RESSOURCES ({items.length})</div>
        {items.map((it) => (
          <div key={it.id} className="event-row">
            <div className="event-date" style={{ background: "rgba(201,168,76,.1)" }}>{it.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="event-t">{it.title} <span className={`tag plan-tag-${it.plan_required?.toLowerCase()}`}>{it.plan_required}</span></div>
              <div className="event-meta">{it.category} · {it.description}</div>
            </div>
            <button className="x-btn" onClick={() => del(it.id)}>×</button>
          </div>
        ))}
      </div>
    </>
  );
}

function AdminPostits() {
  const [users, setUsers] = useState([]);
  const [target, setTarget] = useState("");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => { api.get("/admin/users").then((r) => setUsers(r.data.users)); }, []);
  const send = async () => {
    if (!target || !text.trim()) return;
    await api.post("/postits", { target_user_id: target, text });
    setText(""); setSent(true); setTimeout(() => setSent(false), 2000);
  };
  return (
    <div className="card">
      <div className="card-label">ENVOYER UN POST-IT À UN UTILISATEUR</div>
      <p className="card-sub">Le post-it apparaîtra en doré dans son cockpit avec une notification.</p>
      <label>Destinataire</label>
      <select data-testid="postit-target" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Choisis un utilisateur…</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
      </select>
      <label>Message</label>
      <textarea data-testid="postit-admin-text" className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex : Bravo pour ton avancée ! Pense à me partager ton pitch." />
      <button data-testid="postit-admin-send" className="btn-gold" onClick={send} disabled={!target || !text.trim()}>{sent ? "✓ Envoyé" : "Envoyer le post-it →"}</button>
    </div>
  );
}
