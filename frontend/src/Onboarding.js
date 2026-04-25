import React, { useEffect, useState } from "react";
import { api } from "./api";

export function Onboarding({ onDone }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { api.get("/onboarding/questions").then((r) => setQuestions(r.data.questions)); }, []);
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
      <div className="orb orb2"></div>
      <div className="onboard-card">
        <div className="onboard-progress"><div className="onboard-progress-bar" style={{ width: `${((step + 1) / total) * 100}%` }}></div></div>
        <div className="onboard-step">Question {step + 1} / {total}</div>
        <h2 className="onboard-q" data-testid="onboard-question">{q.label}</h2>

        {q.type === "textarea" && <textarea data-testid={`onboard-input-${q.id}`} className="onboard-input" placeholder={q.placeholder} value={value} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} autoFocus />}
        {q.type === "text" && <input data-testid={`onboard-input-${q.id}`} className="onboard-input" placeholder={q.placeholder} value={value} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} autoFocus />}
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

export function AnalysisResult({ analysis, onContinue }) {
  const score = analysis.score || 0;
  const c = score >= 75 ? "#5BC78A" : score >= 55 ? "#C9A84C" : score >= 30 ? "#E89B4C" : "#E05C5C";
  return (
    <div className="onboard-bg">
      <div className="orb orb1"></div>
      <div className="orb orb2"></div>
      <div className="result-card">
        <div className="result-header">
          <div className="score-circle" style={{ "--c": c }}>
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={c} strokeWidth="10" strokeDasharray={`${(score / 100) * 314} 314`} strokeLinecap="round" transform="rotate(-90 60 60)" />
            </svg>
            <div className="score-num" data-testid="analysis-score">{score}<span>/100</span></div>
          </div>
          <div>
            <h2 className="result-title">Analyse de ton projet</h2>
            <p className="result-sub">{analysis.score_reason}</p>
          </div>
        </div>
        {analysis.points_forts?.length > 0 && (
          <div className="result-section"><div className="result-section-h" style={{ color: "#5BC78A" }}>✓ Points forts</div><ul className="result-list green">{analysis.points_forts.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
        )}
        {analysis.points_vigilance?.length > 0 && (
          <div className="result-section"><div className="result-section-h" style={{ color: "#E89B4C" }}>⚠ Points de vigilance</div><ul className="result-list orange">{analysis.points_vigilance.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
        )}
        {analysis.points_negatifs?.length > 0 && (
          <div className="result-section"><div className="result-section-h" style={{ color: "#E05C5C" }}>× Points négatifs</div><ul className="result-list red">{analysis.points_negatifs.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
        )}
        {analysis.ameliorations?.length > 0 && (
          <div className="result-section"><div className="result-section-h" style={{ color: "#C9A84C" }}>→ Plan d'action concret</div><ol className="result-list-ord">{analysis.ameliorations.map((p, i) => <li key={i}>{p}</li>)}</ol></div>
        )}
        <button data-testid="continue-to-dashboard-btn" className="btn-gold-lg w-full" onClick={onContinue}>Accéder à mon espace →</button>
      </div>
    </div>
  );
}
