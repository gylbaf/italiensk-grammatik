window.QuizApp = window.QuizApp || {};
QuizApp.exercises = QuizApp.exercises || {};

(function () {
  "use strict";

  const escapeHtml = (s) => QuizApp.markdown.escapeHtml(s);

  function renderHtml(passage) {
    let html = '<div class="passage-box">';
    if (passage.mode === "gender") {
      html += '<div class="passage-hint"><strong>Instruktion:</strong> Klicka 1 gång = 🔵 maskulint · Klicka 2 gånger = 🔴 feminint · Klicka 3 gånger för att återställa</div>';
    } else {
      html += '<div class="passage-hint"><strong>Instruktion:</strong> Klicka 1 gång = stryk under (substantiv) · Klicka 2 gånger = stor bokstav (egennamn) · Klicka 3 gånger för att återställa</div>';
    }
    html += '<div class="passage-text">';
    passage.tokens.forEach((t) => {
      if (t.t === "raw") {
        html += escapeHtml(t.v);
      } else {
        html += `<span class="passage-word" data-word-id="${t.id}" data-role="${escapeHtml(t.role || 'none')}" data-cap="${escapeHtml(t.cap || '')}" data-orig="${escapeHtml(t.v)}">${escapeHtml(t.v)}</span>`;
      }
    });
    html += '</div></div>';
    return html;
  }

  function renderControls(card, session, quiz) {
    const controls = document.getElementById("session-controls");
    const cardBody = document.getElementById("card-body");
    let outcome = null;

    const capitalize = (str, preferredCap) => {
      if (preferredCap) return preferredCap;
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    };

    cardBody.querySelectorAll(".passage-word").forEach((w) => {
      w.dataset.state = "0";

      w.addEventListener("click", () => {
        if (w.classList.contains("disabled")) return;
        const curState = parseInt(w.dataset.state || "0", 10);
        const nextState = (curState + 1) % 3;
        w.dataset.state = String(nextState);

        w.classList.remove("marked-noun", "marked-proper", "correct", "wrong", "missed", "correct-proper", "missed-proper");

        if (card.passage.mode === "gender") {
          if (nextState === 1) {
            // State 1: Blue for masculine
            w.classList.add("marked-masculine");
          } else if (nextState === 2) {
            // State 2: Red for feminine
            w.classList.add("marked-feminine");
          } else {
            // State 0: Normal reset
          }
        } else {
          if (nextState === 1) {
            // State 1: Underlined common noun
            w.classList.add("marked-noun");
            w.textContent = w.dataset.orig;
          } else if (nextState === 2) {
            // State 2: Capitalized proper noun
            w.classList.add("marked-proper");
            w.textContent = capitalize(w.dataset.orig, w.dataset.cap);
          } else {
            // State 0: Normal reset
            w.textContent = w.dataset.orig;
          }
        }
      });
    });

    const grade = (fillCorrect) => {
      let correctCount = 0;
      const total = card.passage.totalItems || 29;
      const isGenderMode = card.passage.mode === "gender";

      card.passage.tokens.forEach((t) => {
        if (t.t !== "word") return;
        const el = cardBody.querySelector(`.passage-word[data-word-id="${t.id}"]`);
        if (!el) return;

        if (fillCorrect) {
          el.classList.add("disabled");
          el.classList.remove("wrong", "missed", "marked-noun", "marked-proper", "marked-masculine", "marked-feminine");
          if (isGenderMode) {
            if (t.role === "masculine") {
              el.classList.add("correct-masculine");
            } else if (t.role === "feminine") {
              el.classList.add("correct-feminine");
            }
          } else {
            if (t.role === "common") {
              el.textContent = t.v;
              el.classList.add("correct");
            } else if (t.role === "proper") {
              el.textContent = t.cap;
              el.classList.add("correct-proper");
            }
          }
        } else {
          const state = parseInt(el.dataset.state || "0", 10);
          if (isGenderMode) {
            if (t.role === "masculine") {
              if (state === 1) {
                correctCount++;
                el.classList.add("correct-masculine");
                el.classList.remove("wrong", "missed");
              } else if (state === 2) {
                el.classList.add("wrong");
              } else {
                el.classList.add("missed");
              }
            } else if (t.role === "feminine") {
              if (state === 2) {
                correctCount++;
                el.classList.add("correct-feminine");
                el.classList.remove("wrong", "missed");
              } else if (state === 1) {
                el.classList.add("wrong");
              } else {
                el.classList.add("missed");
              }
            } else {
              if (state !== 0) {
                el.classList.add("wrong");
              }
            }
          } else {
            if (t.role === "common") {
              if (state === 1) {
                correctCount++;
                el.classList.add("correct");
                el.classList.remove("wrong", "missed");
              } else if (state === 2) {
                el.classList.add("wrong");
              } else {
                el.classList.add("missed");
              }
            } else if (t.role === "proper") {
              if (state === 2) {
                correctCount++;
                el.textContent = t.cap;
                el.classList.add("correct-proper");
                el.classList.remove("wrong", "missed-proper");
              } else if (state === 1) {
                el.classList.add("missed-proper");
              } else {
                el.classList.add("missed-proper");
              }
            } else {
              if (state !== 0) {
                el.classList.add("wrong");
              }
            }
          }
        }
      });

      return { correctCount, total };
    };

    const renderButtons = () => {
      controls.innerHTML = `
        <button class="btn primary" id="check">✅ Rätta</button>
        <button class="btn" id="reveal">👁 Visa facit</button>
      `;
      document.getElementById("check").addEventListener("click", () => {
        const { correctCount, total } = grade(false);
        outcome = correctCount === total;
        document.getElementById("card-result").innerHTML =
          `<div class="check-result ${outcome ? "all-correct" : ""}">${correctCount} / ${total} rätt</div>`;
        QuizApp.storage.recordResult(card.id, outcome);
        if (outcome) { if (!session.correctIds.includes(card.id)) session.correctIds.push(card.id); }
        else { if (!session.wrongIds.includes(card.id)) session.wrongIds.push(card.id); }
      });
      document.getElementById("reveal").addEventListener("click", () => {
        grade(true);
        outcome = false;
        document.getElementById("card-result").innerHTML =
          '<div class="check-result">Facit ifyllt.</div>';
        QuizApp.storage.recordResult(card.id, false);
        if (!session.wrongIds.includes(card.id)) session.wrongIds.push(card.id);
      });
    };
    renderButtons();
  }

  QuizApp.exercises.passage = {
    renderHtml,
    renderControls,
  };
})();
