import React, { useEffect, useState } from "react";
import { api, TOKEN_KEY } from "./api";
import { Sparkles, Layers, CheckCircle2, Target, Users, FolderOpen, MessageCircle, Bot } from "lucide-react";
import { CountUp, Logo, Reveal } from "./ui";

export function Landing({ onAuth, onAdminClick }) {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(null); // null | "request" | "confirm"
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [about, setAbout] = useState(null);

  useEffect(() => { api.get("/about").then((r) => setAbout(r.data)).catch(() => {}); }, []);

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

  const requestReset = async () => {
    setResetMsg("");
    try {
      const { data } = await api.post("/auth/request-reset", { email: resetEmail });
      if (data.token) {
        setResetToken(data.token); setResetMode("confirm");
        setResetMsg("Token de réinitialisation généré. Saisis ton nouveau mot de passe.");
      } else {
        setResetMsg("Si ce compte existe, un email a été envoyé.");
      }
    } catch (e) { setResetMsg(e.response?.data?.detail || "Erreur"); }
  };
  const confirmReset = async () => {
    setResetMsg("");
    try {
      await api.post("/auth/reset-password", { token: resetToken, new_password: newPassword });
      setResetMsg("✓ Mot de passe réinitialisé. Tu peux te connecter.");
      setTimeout(() => { setResetMode(null); setMode("login"); }, 1500);
    } catch (e) { setResetMsg(e.response?.data?.detail || "Erreur"); }
  };

  return (
    <div className="landing">
      <div className="orb orb1"></div>
      <div className="orb orb2"></div>
      <div className="orb orb3"></div>
      <nav className="nav">
        <Logo size={32} onClick={onAdminClick} />
        <div className="nav-actions">
          <a href="#about" className="nav-link">Qui sommes-nous</a>
          <a href="#pricing" className="nav-link">Tarifs</a>
          <button data-testid="open-login-btn" className="btn-ghost" onClick={() => { setMode("login"); setShowAuth(true); }}>Connexion</button>
          <button data-testid="open-register-btn" className="btn-gold" onClick={() => { setMode("register"); setShowAuth(true); }}>Créer un compte</button>
        </div>
      </nav>

      <section className="hero">
        <Reveal>
          <div className="hero-tag"><span className="hero-dot"></span>L'INCUBATEUR DES 15–25 ANS</div>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="hero-title">Ton idée mérite<br/><em>de prendre son envol.</em></h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="hero-sub">L'unique plateforme qui transforme tes intuitions en projets concrets. Formations, mentors, experts, IA, communauté — à ton rythme, sans jargon.</p>
        </Reveal>
        <Reveal delay={300}>
          <div className="hero-cta">
            <button data-testid="hero-cta-btn" className="btn-gold-lg" onClick={() => { setMode("register"); setShowAuth(true); }}>Commencer maintenant →</button>
            <button className="btn-ghost-lg" onClick={() => { setMode("login"); setShowAuth(true); }}>J'ai déjà un compte</button>
          </div>
        </Reveal>
        <Reveal delay={400}>
          <div className="hero-stats">
            <div><div className="stat-n"><CountUp end={5} /></div><div className="stat-l">modules</div></div>
            <div><div className="stat-n"><CountUp end={100} suffix="+" /></div><div className="stat-l">jeunes accompagnés</div></div>
            <div><div className="stat-n"><CountUp end={24} />/<CountUp end={7} /></div><div className="stat-l">assistant IA</div></div>
            <div><div className="stat-n"><CountUp end={92} suffix="%" /></div><div className="stat-l">de satisfaction</div></div>
          </div>
        </Reveal>
      </section>

      {about && (
        <section className="about" id="about">
          <Reveal>
            <div className="features-h">
              <div className="features-tag">QUI SOMMES-NOUS</div>
              <h2>Une équipe qui croit<br/><em>aux jeunes audacieux.</em></h2>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <p className="about-mission">{about.mission}</p>
          </Reveal>
          <div className="team-grid">
            {about.team.map((m, i) => (
              <Reveal key={m.name} delay={200 + i * 100}>
                <div className="team-card">
                  <div className={`team-photo ${m.color}`}>{m.initials}</div>
                  <div className="team-name">{m.name}</div>
                  <div className="team-role">{m.role}</div>
                  <p className="team-bio">{m.bio}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="values-grid">
            {about.values.map((v, i) => (
              <Reveal key={v.title} delay={400 + i * 80}>
                <div className="value-card">
                  <div className="value-num">0{i + 1}</div>
                  <div className="value-title">{v.title}</div>
                  <div className="value-desc">{v.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="features">
        <Reveal>
          <div className="features-h">
            <div className="features-tag">CE QUE TU VAS Y TROUVER</div>
            <h2>Tout ce qu'il faut pour passer<br/><em>du rêve à l'action.</em></h2>
          </div>
        </Reveal>
        <div className="feat-grid">
          {[
            [Sparkles, "Analyse IA", "Score sur 100, points forts, pistes concrètes — généré par Claude"],
            [Layers, "5 modules", "De l'idée à ta première vente, structuré et progressif"],
            [CheckCircle2, "Missions", "Coche tes étapes, célèbre tes victoires"],
            [Target, "Mon projet", "Un espace dédié pour structurer pitch, objectifs et roadmap"],
            [Users, "Experts", "Avocats, comptables, mentors à portée de clic"],
            [FolderOpen, "Documents", "Centralise tous tes fichiers stratégiques"],
            [MessageCircle, "Chat & visio", "Une communauté, des sessions live"],
            [Bot, "Assistant IA", "Une question ? Une réponse en 5s"],
          ].map(([Icon, t, d], i) => (
            <Reveal key={t} delay={80 * i}>
              <div className="feat-card">
                <div className="feat-icon"><Icon size={20} strokeWidth={1.7} /></div>
                <div className="feat-t">{t}</div>
                <div className="feat-d">{d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="pricing" id="pricing">
        <Reveal>
          <div className="features-h">
            <div className="features-tag">TROIS NIVEAUX D'ENVOL</div>
            <h2>Choisis ton accompagnement.</h2>
          </div>
        </Reveal>
        <div className="pricing-grid">
          {[
            ["Bronze", "49€", "Pour démarrer en autonomie", ["5 modules de formation", "Checklist & ressources de base", "Communauté privée", "Assistant IA Envol", "Score & analyse de projet"], false],
            ["Silver", "99€", "Avec coaching et réseau", ["Tout Bronze inclus", "Modules avancés (4 & 5)", "Visios groupe mensuelles", "Accès experts (avocats, comptable…)", "Ressources premium"], true],
            ["Gold", "199€", "L'accompagnement maximal", ["Tout Silver inclus", "Mentorat 1-1", "Visios privées illimitées", "Accès prioritaire aux experts", "Mise en relation investisseurs"], false],
          ].map(([t, p, d, fs, feat], i) => (
            <Reveal key={t} delay={i * 120}>
              <div className={`pricing-card ${feat ? "featured" : ""}`}>
                {feat && <div className="pricing-badge">★ Populaire</div>}
                <div className="pricing-tier">{t}</div>
                <div className="pricing-price">{p}<span>/mois</span></div>
                <div className="pricing-desc">{d}</div>
                <ul>{fs.map((f) => <li key={f}>{f}</li>)}</ul>
                <button className={feat ? "btn-gold w-full" : "btn-ghost w-full"} onClick={() => { setMode("register"); setShowAuth(true); }}>Démarrer en {t}</button>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="pricing-note">Sans engagement · Résiliable à tout moment · Tu peux upgrader/downgrader quand tu veux</div>
      </section>

      <footer className="footer">
        <Logo size={24} />
        <div className="footer-text">L'incubateur qui croit aux jeunes audacieux · © 2026</div>
        <div className="footer-link"><button className="link-btn" onClick={onAdminClick}>Espace admin</button></div>
      </footer>

      {showAuth && (
        <div className="modal-bg" onClick={(e) => { if (e.target.className === "modal-bg") { setShowAuth(false); setResetMode(null); } }}>
          <div className="modal">
            <button className="modal-close" onClick={() => { setShowAuth(false); setResetMode(null); }}>×</button>
            {resetMode === null && (
              <>
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
                  {mode === "login" && (
                    <button type="button" className="link-btn" style={{ marginTop: 12, display: "block", margin: "12px auto 0" }} onClick={() => { setResetMode("request"); setResetEmail(form.email); }}>Mot de passe oublié ?</button>
                  )}
                </form>
              </>
            )}
            {resetMode === "request" && (
              <>
                <h3 className="modal-title">Réinitialiser</h3>
                <p className="modal-sub">Entre ton email, on te génère un token.</p>
                <input className="input" type="email" placeholder="ton@email.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                {resetMsg && <div className="info-msg">{resetMsg}</div>}
                <button data-testid="reset-request-btn" className="btn-gold w-full" onClick={requestReset}>Envoyer →</button>
                <button type="button" className="link-btn" style={{ marginTop: 12, display: "block", margin: "12px auto 0" }} onClick={() => setResetMode(null)}>← Retour</button>
              </>
            )}
            {resetMode === "confirm" && (
              <>
                <h3 className="modal-title">Nouveau mot de passe</h3>
                <p className="modal-sub">Token généré (en prod, envoyé par email).</p>
                <input className="input" type="password" placeholder="Nouveau mot de passe (min. 6)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                {resetMsg && <div className="info-msg">{resetMsg}</div>}
                <button data-testid="reset-confirm-btn" className="btn-gold w-full" onClick={confirmReset}>Valider →</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
