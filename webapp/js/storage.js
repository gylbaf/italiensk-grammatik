window.QuizApp = window.QuizApp || {};

(function () {
  "use strict";

  const STATS_KEY = "italianQuiz.stats.v1";

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function recordResult(cardId, correct) {
    const stats = loadStats();
    const s = stats[cardId] || { correct: 0, wrong: 0 };
    if (correct) s.correct++; else s.wrong++;
    stats[cardId] = s;
    saveStats(stats);
    renderGlobalStats();
  }

  function renderGlobalStats() {
    const stats = loadStats();
    let correct = 0, wrong = 0;
    Object.values(stats).forEach((s) => { correct += s.correct; wrong += s.wrong; });
    const el = document.getElementById("global-stats");
    if (!el) return;
    const total = correct + wrong;
    el.textContent = total ? `✔ ${correct} / ✘ ${wrong} (totalt ${total})` : "";
  }

  QuizApp.storage = {
    loadStats,
    saveStats,
    recordResult,
    renderGlobalStats,
  };
})();
