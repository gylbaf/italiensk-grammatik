window.QuizApp = window.QuizApp || {};
QuizApp.exercises = QuizApp.exercises || {};

(function () {
  "use strict";

  const escapeHtml = (s) => QuizApp.markdown.escapeHtml(s);

  function renderHtml(groups) {
    let html = '<div class="matching-container">';
    groups.forEach((g, gi) => {
      html += `<div class="matching-group" data-group="${gi}">`;
      if (g.groupTitle) {
        html += `<div class="matching-group-title">${escapeHtml(g.groupTitle)}</div>`;
      }
      html += '<div class="matching-board">';
      html += '<div class="matching-col matching-col-left">';
      g.left.forEach((item) => {
        html += `
          <div class="match-item match-left" data-group="${gi}" data-left-id="${escapeHtml(item.id)}" data-ans="${escapeHtml(item.ans)}" draggable="true">
            <span class="match-text">${escapeHtml(item.text)}</span>
            <span class="match-target-badge" data-left-badge="${escapeHtml(item.id)}"></span>
          </div>`;
      });
      html += '</div>';
      html += '<div class="matching-col matching-col-right">';
      g.right.forEach((target) => {
        html += `
          <div class="match-item match-right" data-group="${gi}" data-right-id="${escapeHtml(target.id)}">
            <span class="match-text">${escapeHtml(target.text)}</span>
            <span class="match-source-badge" data-right-badge="${escapeHtml(target.id)}"></span>
          </div>`;
      });
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderControls(card, session, quiz) {
    const controls = document.getElementById("session-controls");
    const cardBody = document.getElementById("card-body");
    let outcome = null;

    const connections = card.matching.map(() => ({}));
    let activeLeft = null;

    const updateUI = () => {
      card.matching.forEach((g, gi) => {
        const groupEl = cardBody.querySelector(`.matching-group[data-group="${gi}"]`);
        if (!groupEl) return;
        const groupConn = connections[gi] || {};
        const reversed = {};
        Object.entries(groupConn).forEach(([l, r]) => { reversed[r] = l; });

        g.left.forEach((item) => {
          const el = groupEl.querySelector(`.match-left[data-left-id="${item.id}"]`);
          const badge = el ? el.querySelector(".match-target-badge") : null;
          const pairedTo = groupConn[item.id];
          if (el && badge) {
            el.classList.toggle("paired", Boolean(pairedTo));
            badge.textContent = pairedTo ? `➜ ${pairedTo}` : "";
            badge.style.display = pairedTo ? "inline-block" : "none";
          }
        });

        g.right.forEach((target) => {
          const el = groupEl.querySelector(`.match-right[data-right-id="${target.id}"]`);
          const badge = el ? el.querySelector(".match-source-badge") : null;
          const pairedFrom = reversed[target.id];
          if (el && badge) {
            el.classList.toggle("paired", Boolean(pairedFrom));
            badge.textContent = pairedFrom ? `⇠ ${pairedFrom}` : "";
            badge.style.display = pairedFrom ? "inline-block" : "none";
          }
        });
      });
    };

    // Tap-to-pair left items
    cardBody.querySelectorAll(".match-left").forEach((el) => {
      el.addEventListener("click", () => {
        if (el.classList.contains("disabled")) return;
        const gi = parseInt(el.dataset.group, 10);
        const leftId = el.dataset.leftId;

        if (activeLeft && activeLeft.group === gi && activeLeft.id === leftId) {
          el.classList.remove("active-source");
          activeLeft = null;
        } else {
          cardBody.querySelectorAll(".match-left").forEach((item) => item.classList.remove("active-source"));
          el.classList.add("active-source");
          activeLeft = { group: gi, id: leftId, el };
        }
      });
    });

    // Tap-to-pair right items
    cardBody.querySelectorAll(".match-right").forEach((el) => {
      el.addEventListener("click", () => {
        if (el.classList.contains("disabled")) return;
        const gi = parseInt(el.dataset.group, 10);
        const rightId = el.dataset.rightId;

        if (activeLeft && activeLeft.group === gi) {
          connections[gi][activeLeft.id] = rightId;
          cardBody.querySelectorAll(".match-left").forEach((item) => item.classList.remove("active-source"));
          activeLeft = null;
          updateUI();
        } else {
          const groupConn = connections[gi] || {};
          const leftKey = Object.keys(groupConn).find((k) => groupConn[k] === rightId);
          if (leftKey) {
            delete groupConn[leftKey];
            updateUI();
          }
        }
      });
    });

    // Drag and drop
    cardBody.querySelectorAll(".match-left").forEach((el) => {
      el.addEventListener("dragstart", (e) => {
        if (el.classList.contains("disabled")) return;
        const gi = parseInt(el.dataset.group, 10);
        const leftId = el.dataset.leftId;
        e.dataTransfer.setData("text/plain", JSON.stringify({ group: gi, leftId }));
      });
    });

    cardBody.querySelectorAll(".match-right").forEach((el) => {
      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        el.classList.add("drag-over");
      });
      el.addEventListener("dragleave", () => {
        el.classList.remove("drag-over");
      });
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.classList.remove("drag-over");
        if (el.classList.contains("disabled")) return;
        try {
          const data = JSON.parse(e.dataTransfer.getData("text/plain"));
          const gi = parseInt(el.dataset.group, 10);
          const rightId = el.dataset.rightId;
          if (data.group === gi) {
            connections[gi][data.leftId] = rightId;
            cardBody.querySelectorAll(".match-left").forEach((item) => item.classList.remove("active-source"));
            activeLeft = null;
            updateUI();
          }
        } catch (err) {}
      });
    });

    updateUI();

    const grade = (fillCorrect) => {
      let correctCount = 0, total = 0;
      card.matching.forEach((g, gi) => {
        const groupEl = cardBody.querySelector(`.matching-group[data-group="${gi}"]`);
        if (!groupEl) return;

        g.left.forEach((item) => {
          total++;
          const leftEl = groupEl.querySelector(`.match-left[data-left-id="${item.id}"]`);
          const badge = leftEl ? leftEl.querySelector(".match-target-badge") : null;
          const expectedAns = item.ans.toLowerCase();

          if (fillCorrect) {
            connections[gi][item.id] = expectedAns;
            if (leftEl && badge) {
              leftEl.classList.add("disabled", "correct");
              leftEl.classList.remove("active-source", "wrong", "missed", "paired");
              badge.textContent = `➜ ${expectedAns}`;
              badge.style.display = "inline-block";
            }
          } else {
            const userAns = (connections[gi][item.id] || "").toLowerCase();
            const isCorrect = userAns === expectedAns;
            if (isCorrect) {
              correctCount++;
              if (leftEl && badge) {
                leftEl.classList.add("correct");
                leftEl.classList.remove("wrong", "missed", "paired");
                badge.textContent = `✓ ${userAns}`;
              }
            } else {
              if (leftEl && badge) {
                if (userAns) {
                  leftEl.classList.add("wrong");
                  badge.textContent = `✗ ${userAns} (rätt: ${expectedAns})`;
                } else {
                  leftEl.classList.add("missed");
                  badge.textContent = `(rätt: ${expectedAns})`;
                }
                leftEl.classList.remove("correct", "paired");
                badge.style.display = "inline-block";
              }
            }
          }
        });

        g.right.forEach((target) => {
          const rightEl = groupEl.querySelector(`.match-right[data-right-id="${target.id}"]`);
          if (!rightEl) return;
          if (fillCorrect) {
            rightEl.classList.add("disabled", "correct");
            rightEl.classList.remove("wrong", "missed");
          }
        });
      });

      if (fillCorrect) updateUI();
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

  QuizApp.exercises.matching = {
    renderHtml,
    renderControls,
  };
})();
