// ============================================================
//  TEKKEN LEAGUE — script.js
//  Firebase Firestore · Scores · Classement auto
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── CONFIG FIREBASE ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDq0ara0wRNwJ11knXy8OvAD3CZEUicgTI",
  authDomain: "tekken-league.firebaseapp.com",
  projectId: "tekken-league",
  storageBucket: "tekken-league.firebasestorage.app",
  messagingSenderId: "651014765407",
  appId: "1:651014765407:web:30b43100dccca82bdcd4ea",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── DONNÉES JOUEURS ──────────────────────────────────────────
const DIVISIONS = {
  d1: [
    "Kuro-Exodus",
    "Mood",
    "Aquila",
    "Geek",
    "LeBron James",
    "White",
    "Darwin",
    "King",
    "Itachi_228",
    "Allmight",
  ],
  d2: [
    "Eclairomax",
    "CBlacks",
    "Nacho",
    "Livingstone",
    "Dan",
    "Gargos",
    "Kami",
    "Beckham",
    "Warrax",
    "Dave'l",
  ],
};

// ── SYSTÈME DE POINTS ────────────────────────────────────────
// Victoire 2-0 → +2 pts  |  2-1 → +1 pt
// Défaite  0-2 → -2 pts  |  1-2 → -1 pt
function calcPoints(scoreA, scoreB) {
  if (scoreA === 2 && scoreB === 0) return [2, -2];
  if (scoreA === 2 && scoreB === 1) return [1, -1];
  if (scoreA === 0 && scoreB === 2) return [-2, 2];
  if (scoreA === 1 && scoreB === 2) return [-1, 1];
  return [0, 0];
}

// ── CLÉ D'UN MATCH ───────────────────────────────────────────
// Toujours "joueurA_vs_joueurB" dans l'ordre alphabétique
// pour éviter les doublons dans Firestore
function matchKey(p1, p2) {
  return [p1, p2].sort().join("___vs___");
}

// ── ÉTAT LOCAL ───────────────────────────────────────────────
let scores = {}; // { matchKey: { p1, p2, s1, s2 } }
let modalState = { div: null, p1: null, p2: null, s1: null, s2: null };

// ============================================================
//  PAGE : matchs.html
// ============================================================
function initMatchsPage() {
  buildCrossTable("d1");
  buildCrossTable("d2");

  // Écoute en temps réel Firestore → met à jour les tableaux
  onSnapshot(collection(db, "scores"), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      scores[change.doc.id] = data;
    });
    renderAllCells();
  });
}

// ── CONSTRUCTION DU TABLEAU CROISÉ ──────────────────────────
function buildCrossTable(div) {
  const players = DIVISIONS[div];
  const tbody = document.getElementById(`tbody-${div}`);
  if (!tbody) return;

  tbody.innerHTML = "";

  players.forEach((rowPlayer) => {
    const tr = document.createElement("tr");

    // Cellule nom du joueur (première colonne)
    const nameTd = document.createElement("td");
    nameTd.className = "player-name";
    nameTd.textContent = rowPlayer;
    tr.appendChild(nameTd);

    // Cellules adversaires
    players.forEach((colPlayer) => {
      const td = document.createElement("td");

      if (rowPlayer === colPlayer) {
        // Case identique → non cliquable
        td.className = "cell-self";
        td.innerHTML = `<span class="cross-icon">✕</span>`;
      } else {
        td.className = "cell-score";
        td.dataset.div = div;
        td.dataset.row = rowPlayer;
        td.dataset.col = colPlayer;
        td.innerHTML = `<span class="score-display">—</span>`;
        td.addEventListener("click", () =>
          openModal(div, rowPlayer, colPlayer, td),
        );
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ── RENDU DES SCORES DANS LES CELLULES ──────────────────────
function renderAllCells() {
  document.querySelectorAll(".cell-score").forEach((td) => {
    const { row, col, div } = td.dataset;
    const key = matchKey(row, col);
    const match = scores[key];

    if (!match) {
      td.querySelector(".score-display").textContent = "—";
      td.querySelector(".score-display").className = "score-display";
      td.classList.remove("filled");
      return;
    }

    // Retrouve le bon sens (row peut être p1 ou p2)
    let s1, s2;
    if (match.p1 === row) {
      s1 = match.s1;
      s2 = match.s2;
    } else {
      s1 = match.s2;
      s2 = match.s1;
    }

    const span = td.querySelector(".score-display");
    span.textContent = `${s1} — ${s2}`;
    td.classList.add("filled");

    if (s1 > s2) span.className = "score-display win";
    else if (s1 < s2) span.className = "score-display loss";
    else span.className = "score-display draw";
  });
}

// ============================================================
//  MODAL
// ============================================================
function openModal(div, p1, p2, td) {
  modalState = { div, p1, p2, s1: null, s2: null };

  document.getElementById("modal-p1-name").textContent = p1;
  document.getElementById("modal-p2-name").textContent = p2;
  document.getElementById("modal-error").textContent = "";

  // Réinitialise les boutons
  resetBtnSelection("p1");
  resetBtnSelection("p2");

  // Pré-remplit si score existant
  const key = matchKey(p1, p2);
  const existing = scores[key];
  if (existing) {
    let s1, s2;
    if (existing.p1 === p1) {
      s1 = existing.s1;
      s2 = existing.s2;
    } else {
      s1 = existing.s2;
      s2 = existing.s1;
    }
    selectScore("p1", s1);
    selectScore("p2", s2);
    document.getElementById("btn-reset").style.display = "inline-block";
  } else {
    document.getElementById("btn-reset").style.display = "none";
  }

  document.getElementById("modal-overlay").classList.add("open");
}

window.closeModal = function () {
  document.getElementById("modal-overlay").classList.remove("open");
};

window.selectScore = function (player, value) {
  modalState[player === "p1" ? "s1" : "s2"] = value;
  const btns = document.querySelectorAll(`#btns-${player} .score-btn`);
  btns.forEach((btn) => {
    btn.classList.toggle("selected", parseInt(btn.textContent) === value);
  });
  document.getElementById("modal-error").textContent = "";
};

function resetBtnSelection(player) {
  const btns = document.querySelectorAll(`#btns-${player} .score-btn`);
  btns.forEach((btn) => btn.classList.remove("selected"));
  modalState[player === "p1" ? "s1" : "s2"] = null;
}

window.confirmScore = async function () {
  const { div, p1, p2, s1, s2 } = modalState;

  // Validation
  if (s1 === null || s2 === null) {
    document.getElementById("modal-error").textContent =
      "⚠ Sélectionne un score pour chaque joueur.";
    return;
  }
  // Score valide : doit avoir exactement un 2
  if (s1 !== 2 && s2 !== 2) {
    document.getElementById("modal-error").textContent =
      "⚠ Au moins un joueur doit avoir 2.";
    return;
  }
  if (s1 === 2 && s2 === 2) {
    document.getElementById("modal-error").textContent =
      "⚠ Les deux joueurs ne peuvent pas avoir 2.";
    return;
  }

  const key = matchKey(p1, p2);

  // Détermine p1 = celui du matchKey trié alphabétiquement
  const [sortedP1, sortedP2] = [p1, p2].sort();
  const finalS1 = sortedP1 === p1 ? s1 : s2;
  const finalS2 = sortedP1 === p1 ? s2 : s1;

  try {
    await setDoc(doc(db, "scores", key), {
      div,
      p1: sortedP1,
      p2: sortedP2,
      s1: finalS1,
      s2: finalS2,
    });
    closeModal();
  } catch (e) {
    document.getElementById("modal-error").textContent =
      "⚠ Erreur de connexion. Réessaie.";
    console.error(e);
  }
};

window.resetScore = async function () {
  const { p1, p2 } = modalState;
  const key = matchKey(p1, p2);
  try {
    await setDoc(doc(db, "scores", key), {
      div: modalState.div,
      p1: [p1, p2].sort()[0],
      p2: [p1, p2].sort()[1],
      s1: null,
      s2: null,
      deleted: true,
    });
    scores[key] = null;
    closeModal();
  } catch (e) {
    console.error(e);
  }
};

// Fermer modal en cliquant sur l'overlay
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("modal-overlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }
});

// ── TAB SWITCH (calendrier des tours) ───────────────────────
window.showDiv = function (div, e) {
  document
    .querySelectorAll(".division-panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(`panel-${div}`).classList.add("active");
  e.target.classList.add("active");
};

// ============================================================
//  PAGE : classement.html
// ============================================================
function initClassementPage() {
  onSnapshot(collection(db, "scores"), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      if (data.deleted) {
        scores[change.doc.id] = null;
      } else {
        scores[change.doc.id] = data;
      }
    });
    updateClassement();
  });
}

function updateClassement() {
  const stats = {};

  // Initialise tous les joueurs
  ["d1", "d2"].forEach((div) => {
    DIVISIONS[div].forEach((p) => {
      stats[p] = { mj: 0, mg: 0, mp: 0, pts: 0, div };
    });
  });

  // Calcule les stats depuis les scores
  Object.values(scores).forEach((match) => {
    if (!match || match.deleted || match.s1 === null || match.s2 === null)
      return;

    const { p1, p2, s1, s2 } = match;
    if (!stats[p1] || !stats[p2]) return;

    const [pts1, pts2] = calcPoints(s1, s2);

    stats[p1].mj++;
    stats[p2].mj++;
    stats[p1].pts += pts1;
    stats[p2].pts += pts2;

    if (s1 > s2) {
      stats[p1].mg++;
      stats[p2].mp++;
    } else if (s2 > s1) {
      stats[p2].mg++;
      stats[p1].mp++;
    }
  });

  // Met à jour les tableaux DOM
  ["d1", "d2"].forEach((div) => {
    const players = [...DIVISIONS[div]].sort(
      (a, b) => stats[b].pts - stats[a].pts || stats[b].mg - stats[a].mg,
    );

    const tbody = document.querySelector(`#standings-tbody-${div}`);
    if (!tbody) return;

    const rows = tbody.querySelectorAll("tr");
    players.forEach((player, idx) => {
      const row = rows[idx];
      if (!row) return;
      const s = stats[player];

      // Met à jour le rang
      row.querySelector(".rank-cell").textContent = String(idx + 1).padStart(
        2,
        "0",
      );

      // Met à jour le pseudo (garde les badges)
      const pseudoCell = row.querySelector(".pseudo-cell");
      pseudoCell.dataset.player = player;
      // Reconstruit le contenu avec le badge si nécessaire
      let badge = "";
      if (div === "d1") {
        if (idx < 4) badge = `<span class="playoffs-badge">Playoffs</span>`;
        else if (idx >= 8)
          badge = `<span class="relegation-badge">Relégation</span>`;
      } else {
        if (idx < 4) badge = `<span class="playoffs-badge">Playoffs</span>`;
        else if (idx >= 8)
          badge = `<span class="promotion-badge">Promotion</span>`;
      }
      pseudoCell.innerHTML = player + " " + badge;

      // Stats
      const tds = row.querySelectorAll("td");
      tds[2].textContent = s.mj;
      tds[3].textContent = s.mg;
      tds[4].textContent = s.mp;
      row.querySelector(".score-cell").textContent =
        s.pts > 0 ? `+${s.pts}` : s.pts;
    });
  });
}

// ============================================================
//  INIT — détecte la page courante
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "matchs") initMatchsPage();
  if (page === "classement") initClassementPage();
});
