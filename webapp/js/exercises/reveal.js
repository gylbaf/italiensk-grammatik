window.QuizApp = window.QuizApp || {};
QuizApp.exercises = QuizApp.exercises || {};

(function () {
  "use strict";

  function renderControls(card, session, quiz) {
    const controls = document.getElementById("session-controls");
    let revealed = false;

    const renderButtons = () => {
      controls.innerHTML = !revealed
        ? `<button class="btn primary" id="reveal">👁 Visa facit</button>`
        : `<div class="result-buttons">
             <button class="btn correct" id="mark-correct">✅ Rätt</button>
             <button class="btn wrong" id="mark-wrong">❌ Fel</button>
           </div>`;

      if (!revealed) {
        document.getElementById("reveal").addEventListener("click", () => {
          revealed = true;
          document.getElementById("card-result").innerHTML = card.answerBody
            ? `<div class="answer-block"><div class="label">Facit</div>${QuizApp.markdown.toHtml(card.answerBody)}</div>`
            : `<div class="no-answer">Inget facit tillgängligt för denna övning.</div>`;
          renderButtons();
        });
      } else {
        document.getElementById("mark-correct").addEventListener("click", () => {
          QuizApp.storage.recordResult(card.id, true);
          if (!session.correctIds.includes(card.id)) session.correctIds.push(card.id);
          session.index++;
          quiz.renderSession();
        });
        document.getElementById("mark-wrong").addEventListener("click", () => {
          QuizApp.storage.recordResult(card.id, false);
          if (!session.wrongIds.includes(card.id)) session.wrongIds.push(card.id);
          session.index++;
          quiz.renderSession();
        });
      }
    };
    renderButtons();
  }

  QuizApp.exercises.reveal = {
    renderControls,
  };
})();
