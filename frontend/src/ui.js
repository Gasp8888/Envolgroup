import React, { useEffect, useRef, useState } from "react";

// Animated counter (counts up when in view)
export function CountUp({ end, duration = 1800, suffix = "" }) {
  const [v, setV] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setV(Math.round(end * eased));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end, duration]);
  return <span ref={ref}>{v}{suffix}</span>;
}

// Logo component
export function Logo({ size = 28, withText = true, onClick }) {
  return (
    <div className="brand" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <img src="/assets/logo.png" alt="Envol" className="brand-img" style={{ width: size, height: size }} />
      {withText && <span className="brand-text">ENVOL</span>}
    </div>
  );
}

// Reveal on scroll
export function Reveal({ children, delay = 0, as: Tag = "div", className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { setTimeout(() => setShown(true), delay); obs.disconnect(); }
      });
    }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [delay]);
  return <Tag ref={ref} className={`${className} reveal ${shown ? "shown" : ""}`}>{children}</Tag>;
}

// Toast notification
let toastQueue = null;
export function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => { toastQueue = (msg, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }; }, []);
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}
export const toast = (msg, type) => toastQueue && toastQueue(msg, type);
