const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", service: "Envolgroup Backend" });
});

// ── /api/about ────────────────────────────────────────────────────────────────
app.get("/api/about", (req, res) => {
  res.json({
    team: [
      {
        name: "Léo",
        role: "Fondateur · Vision & coaching",
        bio: "Entrepreneur depuis ses 18 ans, Léo a accompagné des dizaines de jeunes à transformer leurs intuitions en projets concrets.",
        initials: "L",
        color: "gold",
      },
      {
        name: "Gaspard",
        role: "Co-fondateur · Tech & design",
        bio: "Designer-développeur, Gaspard structure les outils et l'expérience de la plateforme pour qu'elle soit aussi belle qu'utile.",
        initials: "G",
        color: "lav",
      },
    ],
    mission:
      "Envol croit que chaque jeune mérite un cadre solide pour faire éclore ses idées. Ni mentor distant ni cours en ligne impersonnel : un vrai compagnon de route, du premier doute à la première facture.",
    values: [
      { title: "Concret", desc: "Chaque exercice mène à un livrable réel. Pas de bla-bla." },
      { title: "Honnête", desc: "On te dit ce qui marche, ce qui ne marche pas, et pourquoi." },
      { title: "Personnel", desc: "Ton parcours est unique. Notre accompagnement aussi." },
    ],
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Envolgroup backend running on port ${PORT}`);
});
