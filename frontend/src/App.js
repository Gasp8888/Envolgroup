import React, { useEffect, useState } from "react";
import "./App.css";
import { api, TOKEN_KEY } from "./api";
import { Landing } from "./Landing";
import { Onboarding, AnalysisResult } from "./Onboarding";
import { Dashboard } from "./Dashboard";
import { AdminLogin, AdminDashboard } from "./Admin";
import { ToastHost } from "./ui";

function App() {
  const [user, setUser] = useState(null);
  const [stage, setStage] = useState("loading");
  const [analysis, setAnalysis] = useState(null);
  const [ctx, setCtx] = useState({ onboarding: null, project: null });
  const [adminMode, setAdminMode] = useState(false);

  // Detect admin path
  useEffect(() => {
    if (window.location.pathname === "/admin" || window.location.hash === "#admin") {
      setAdminMode(true);
    }
  }, []);

  const refreshCtx = async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setCtx({ onboarding: data.onboarding, project: data.project });
      return data;
    } catch { localStorage.removeItem(TOKEN_KEY); }
  };

  const loadMe = async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) { setStage("landing"); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setCtx({ onboarding: data.onboarding, project: data.project });
      if (data.user.is_admin) {
        setAdminMode(true);
        setStage("admin-dash");
      } else if (!data.user.onboarded) setStage("onboarding");
      else setStage("dashboard");
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setStage("landing");
    }
  };

  useEffect(() => { loadMe(); /* eslint-disable-next-line */ }, []);

  const handleAuth = (u) => {
    setUser(u);
    if (u.is_admin) { setAdminMode(true); setStage("admin-dash"); }
    else if (!u.onboarded) setStage("onboarding");
    else { loadMe(); setStage("dashboard"); }
  };

  const handleAdminLogin = (u) => { setUser(u); setStage("admin-dash"); };

  const handleOnboardDone = (a) => { setAnalysis(a); setUser({ ...user, onboarded: true }); setStage("result"); };
  const handleContinue = async () => { await loadMe(); setStage("dashboard"); };
  const handleLogout = () => { localStorage.removeItem(TOKEN_KEY); setUser(null); setAnalysis(null); setAdminMode(false); window.history.pushState({}, "", "/"); setStage("landing"); };

  if (stage === "loading") return <div className="loading-screen">Envol…</div>;

  let content;
  if (adminMode) {
    if (stage === "admin-dash" && user?.is_admin) content = <AdminDashboard admin={user} onLogout={handleLogout} />;
    else content = <AdminLogin onLogin={handleAdminLogin} onBack={() => { setAdminMode(false); setStage("landing"); }} />;
  } else if (stage === "landing") content = <Landing onAuth={handleAuth} onAdminClick={() => setAdminMode(true)} />;
  else if (stage === "onboarding") content = <Onboarding onDone={handleOnboardDone} />;
  else if (stage === "result") content = <AnalysisResult analysis={analysis} onContinue={handleContinue} />;
  else if (stage === "dashboard") content = <Dashboard user={user} setUser={setUser} onLogout={handleLogout} ctx={ctx} refreshCtx={refreshCtx} />;

  return <>{content}<ToastHost /></>;
}

export default App;
