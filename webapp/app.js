/* Italiensk grammatik – Förhör
 * Main application coordinator & view router.
 * Relies on QuizApp modules in js/: storage, markdown, deck, and exercises/*.
 */

(function () {
  "use strict";

  const app = document.getElementById("app");
  const escapeHtml = (s) => QuizApp.markdown.escapeHtml(s);

  const Quiz = {
    tab: "schede",
    session: null,

    goHome() {
      this.session = null;
      this.renderHome();
    },

    renderHome() {
      app.innerHTML = `
        <div class="section-tabs">
          <button class="btn ${this.tab === "schede" ? "active" : ""}" data-tab="schede">📘 Scheda (grammatik)</button>
          <button class="btn ${this.tab === "esercizi" ? "active" : ""}" data-tab="esercizi">📝 Fristående övningar</button>
        </div>
        <div id="tab-content"></div>
      `;
      app.querySelectorAll("[data-tab]").forEach((b) =>
        b.addEventListener("click", () => { this.tab = b.dataset.tab; this.renderHome(); })
      );
      if (this.tab === "schede") this.renderSchedeTab();
      else this.renderEserciziTab();
    },

    renderSchedeTab() {
      const DATA = QuizApp.deck.getData();
      const el = document.getElementById("tab-content");
      const tiles = DATA.schede.map((s) => {
        const n = s.exercises.length;
        const withAns = s.exercises.filter((e) => e.answerBody).length;
        return `
          <div class="tile" data-scheda="${s.id}">
            <span class="num">Scheda ${s.id}</span>
            <div class="title">${escapeHtml(s.title)}</div>
            <div class="meta">${n} övningar${withAns < n ? ` · ${withAns} med facit` : ""}</div>
          </div>`;
      }).join("");

      el.innerHTML = `
        <div class="actions-row">
          <button class="btn primary" id="quiz-all-schede">🔀 Blanda alla scheda-övningar (${QuizApp.deck.allSchedaCards().length} st)</button>
        </div>
        <div class="grid">${tiles}</div>
      `;

      document.getElementById("quiz-all-schede").addEventListener("click", () =>
        this.startSession(QuizApp.deck.shuffle(QuizApp.deck.allSchedaCards()), "Alla scheda-övningar", { type: "schede" })
      );
      el.querySelectorAll("[data-scheda]").forEach((t) =>
        t.addEventListener("click", () => {
          const s = DATA.schede.find((x) => x.id == t.dataset.scheda);
          this.startSession(QuizApp.deck.schedaCards(s), `Scheda ${s.id} – ${s.title}`, { type: "scheda", id: s.id }, false);
        })
      );
    },

    renderEserciziTab() {
      const DATA = QuizApp.deck.getData();
      const el = document.getElementById("tab-content");
      const tiles = DATA.esercizi.map((e, idx) => {
        const n = e.sections.length;
        const withAns = e.sections.filter((s) => s.answerBody).length;
        return `
          <div class="tile" data-es="${idx}">
            <div class="title">${escapeHtml(e.title)}</div>
            <div class="meta">${n} avsnitt${withAns < n ? ` · ${withAns} med facit` : ""}</div>
            ${withAns === 0 ? '<span class="badge-noanswers">inget facit</span>' : ""}
          </div>`;
      }).join("");

      el.innerHTML = `
        <div class="actions-row">
          <button class="btn primary" id="quiz-all-es">🔀 Blanda alla fristående övningar (${QuizApp.deck.allEserciziCards().length} st)</button>
        </div>
        <div class="grid">${tiles}</div>
      `;

      document.getElementById("quiz-all-es").addEventListener("click", () =>
        this.startSession(QuizApp.deck.shuffle(QuizApp.deck.allEserciziCards()), "Alla fristående övningar", { type: "esercizi" })
      );
      el.querySelectorAll("[data-es]").forEach((t) =>
        t.addEventListener("click", () => {
          const e = DATA.esercizi[t.dataset.es];
          this.startSession(QuizApp.deck.esercizioCards(e), e.title, { type: "esercizio", idx: t.dataset.es }, false);
        })
      );
    },

    // -------------------------------------------------------------------
    // Quiz session
    // -------------------------------------------------------------------
    startSession(cards, title, scope, shouldShuffle = true) {
      if (!cards.length) return;
      this.session = {
        title,
        scope,
        cards: shouldShuffle ? QuizApp.deck.shuffle(cards) : cards.slice(),
        index: 0,
        revealed: false,
        correctIds: [],
        wrongIds: [],
      };
      this.renderSession();
    },

    renderSession() {
      const s = this.session;
      if (!s) return this.renderHome();
      if (s.index >= s.cards.length) return this.renderSummary();

      const card = s.cards[s.index];
      const pct = Math.round((s.index / s.cards.length) * 100);

      let bodyHtml = "";
      if (card.passage) {
        bodyHtml = QuizApp.exercises.passage.renderHtml(card.passage);
      } else if (card.matching) {
        bodyHtml = QuizApp.exercises.matching.renderHtml(card.matching);
      } else if (card.categorization) {
        bodyHtml = QuizApp.exercises.categorization.renderHtml(card.categorization);
      } else if (card.blanks) {
        bodyHtml = QuizApp.exercises.blanks.renderHtml(card.blanks, card.wordBank);
      } else {
        bodyHtml = QuizApp.markdown.toHtml(card.body);
      }

      app.innerHTML = `
        <div class="breadcrumb"><a id="back-home">◀ Till start</a> — ${escapeHtml(s.title)}</div>
        <div class="progress">Övning ${s.index + 1} av ${s.cards.length}</div>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="card">
          <div class="meta" style="margin-bottom:.3rem;">${escapeHtml(card.groupTitle)}</div>
          <div class="instruction">${escapeHtml(card.label ? card.label + " " : "")}${escapeHtml(card.instruction)}</div>
          <div id="card-body">${bodyHtml}</div>
          <div id="card-result"></div>
        </div>
        <div class="session-nav" style="display: flex; justify-content: space-between; margin-top: .8rem; margin-bottom: .8rem;">
          <button class="btn" id="prev-btn" ${s.index === 0 ? "disabled" : ""}>◀ Föregående</button>
          <button class="btn" id="next-btn" ${s.index >= s.cards.length - 1 ? "disabled" : ""}>Nästa ▶</button>
        </div>
        <div class="session-controls" id="session-controls"></div>
      `;

      document.getElementById("back-home").addEventListener("click", () => this.goHome());
      document.getElementById("prev-btn").addEventListener("click", () => {
        if (s.index > 0) {
          s.index--;
          this.renderSession();
        }
      });
      document.getElementById("next-btn").addEventListener("click", () => {
        if (s.index < s.cards.length - 1) {
          s.index++;
          this.renderSession();
        }
      });

      if (card.passage) {
        QuizApp.exercises.passage.renderControls(card, s, this);
      } else if (card.matching) {
        QuizApp.exercises.matching.renderControls(card, s, this);
      } else if (card.categorization) {
        QuizApp.exercises.categorization.renderControls(card, s, this);
      } else if (card.blanks) {
        QuizApp.exercises.blanks.renderControls(card, s, this);
      } else {
        QuizApp.exercises.reveal.renderControls(card, s, this);
      }
    },

    renderSummary() {
      const s = this.session;
      const answered = s.correctIds.length + s.wrongIds.length;
      app.innerHTML = `
        <div class="card summary-box">
          <h2>Klart! 🎉</h2>
          <div class="meta">${escapeHtml(s.title)}</div>
          <div class="big"><span class="correct">${s.correctIds.length}</span> / <span class="wrong">${s.wrongIds.length}</span></div>
          <div class="meta">rätt / fel av ${answered} bedömda (${s.cards.length} övningar totalt)</div>
          <div class="session-controls" style="justify-content:center;margin-top:1.3rem;">
            ${s.wrongIds.length ? '<button class="btn primary" id="retry-wrong">🔁 Öva bara felen igen</button>' : ""}
            <button class="btn" id="retry-all">🔁 Kör om alla</button>
            <button class="btn" id="to-home">🏠 Till start</button>
          </div>
        </div>
      `;
      document.getElementById("to-home").addEventListener("click", () => this.goHome());
      document.getElementById("retry-all").addEventListener("click", () =>
        this.startSession(s.cards, s.title, s.scope)
      );
      if (s.wrongIds.length) {
        document.getElementById("retry-wrong").addEventListener("click", () => {
          const wrongCards = s.cards.filter((c) => s.wrongIds.includes(c.id));
          this.startSession(wrongCards, s.title + " (om felen)", s.scope);
        });
      }
    },
  };

  window.Quiz = Quiz;
  QuizApp.storage.renderGlobalStats();
  Quiz.renderHome();
})();
