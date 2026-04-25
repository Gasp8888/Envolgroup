import React, { useState } from "react";
import { api, TOKEN_KEY } from "./api";

export function Landing({ onAuth, onAdminClick }) {
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
      <div className="orb orb3"></div>
      <nav className="nav">
        <div className="logo" onClick={onAdminClick}>ENVOL</div>
        <div className="nav-actions">
          <button data-testid="open-login-btn" className="btn-ghost" onClick={() => { setMode("login"); setShowAuth(true); }}>Connexion</button>
          <button data-testid="open-register-btn" className="btn-gold" onClick={() => { setMode("register"); setShowAuth(true); }}>Créer un compte</button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-tag"><span className="hero-dot"></span>L'INCUBATEUR DES 15–25 ANS</div>
        <h1 className="hero-title">Ton idée mérite<br/><em>de prendre son envol.</em></h1>
        <p className="hero-sub">L'unique plateforme qui transforme tes intuitions en projets concrets. Formations, mentors, experts, IA, communauté — à ton rythme, sans jargon.</p>
        <div className="hero-cta">
          <button data-testid="hero-cta-btn" className="btn-gold-lg" onClick={() => { setMode("register"); setShowAuth(true); }}>Commencer maintenant →</button>
          <button className="btn-ghost-lg" onClick={() => { setMode("login"); setShowAuth(true); }}>J'ai déjà un compte</button>
        </div>
        <div className="hero-stats">
          <div><div className="stat-n">5</div><div className="stat-l">modules</div></div>
          <div><div className="stat-n">100+</div><div className="stat-l">jeunes accompagnés</div></div>
          <div><div className="stat-n">24/7</div><div className="stat-l">assistant IA</div></div>
          <div><div className="stat-n">∞</div><div className="stat-l">d'ambition</div></div>
        </div>
      </section>

      <section className="features">
        <div className="features-h">
          <div className="features-tag">CE QUE TU VAS Y TROUVER</div>
          <h2>Tout ce qu'il faut pour passer<br/><em>du rêve à l'action.</em></h2>
        </div>
        <div className="feat-grid">
          {[
            ["✦", "Analyse IA", "Score sur 100, points forts, pistes concrètes — généré par Claude"],
            ["▤", "5 modules", "De l'idée à ta première vente, structuré et progressif"],
            ["✓", "Missions", "Coche tes étapes, célèbre tes victoires"],
            ["◆", "Mon projet", "Un espace dédié pour structurer pitch, objectifs et roadmap"],
            ["◉", "Experts", "Avocats, comptables, mentors à portée de clic"],
            ["▦", "Documents", "Centralise tous tes fichiers stratégiques"],
            ["◯", "Chat & visio", "Une communauté, des sessions live"],
            ["✨", "Assistant IA", "Une question ? Une réponse en 5s"],
          ].map(([i, t, d]) => (
            <div key={t} className="feat-card">
              <div className="feat-icon">{i}</div>
              <div className="feat-t">{t}</div>
              <div className="feat-d">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing">
        <div className="features-h">
          <div className="features-tag">TROIS NIVEAUX D'ENVOL</div>
          <h2>Choisis ton accompagnement.</h2>
        </div>
        <div className="pricing-grid">
          {[
            ["Bronze", "49€", "Pour démarrer en autonomie", ["5 modules de formation", "Checklist & ressources", "Communauté privée", "Assistant IA"], false],
            ["Silver", "99€", "Avec coaching et réseau", ["Tout Bronze inclus", "Visios groupe mensuelles", "Accès experts (avocats…)", "Ressources avancées"], true],
            ["Gold", "199€", "L'accompagnement maximal", ["Tout Silver inclus", "Mentorat 1-1", "Visios privées", "Accès prioritaire", "Mise en relation invest."], false],
          ].map(([t, p, d, fs, feat]) => (
            <div key={t} className={`pricing-card ${feat ? "featured" : ""}`}>
              {feat && <div className="pricing-badge">★ Populaire</div>}
              <div className="pricing-tier">{t}</div>
              <div className="pricing-price">{p}<span>/mois</span></div>
              <div className="pricing-desc">{d}</div>
              <ul>{fs.map((f) => <li key={f}>{f}</li>)}</ul>
              <button className={feat ? "btn-gold w-full" : "btn-ghost w-full"} onClick={() => { setMode("register"); setShowAuth(true); }}>Démarrer en {t}</button>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="footer-logo">ENVOL</div>
        <div className="footer-text">L'incubateur qui croit aux jeunes audacieux.</div>
        <div className="footer-link"><button className="link-btn" onClick={onAdminClick}>Espace admin</button></div>
      </footer>

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
              {mode === "register" && <input data-testid="input-name" className="input" placeholder="Ton prénom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
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
