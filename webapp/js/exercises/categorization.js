window.QuizApp = window.QuizApp || {};
QuizApp.exercises = QuizApp.exercises || {};

(function () {
  "use strict";

  const escapeHtml = (s) => QuizApp.markdown.escapeHtml(s);

  function renderHtml(categorization) {
    let html = '<div class="categorization-container">';
    html += '<div class="categorization-bank-card">';
    html += '<div class="categorization-bank-header">Ord att sortera (dra eller klicka för att flytta):</div>';
    html += '<div class="categorization-bank-chips" data-cat-zone="bank">';
    categorization.items.forEach((item) => {
      html += `<span class="cat-chip" draggable="true" data-item-id="${escapeHtml(item.id)}" data-orig="${escapeHtml(item.text)}" data-facit="${escapeHtml(item.facitText)}" data-target="${escapeHtml(item.targetCat)}">${escapeHtml(item.text)}</span>`;
    });
    html += '</div></div>';

    const numCols = Math.min(categorization.categories.length, 3);
    html += `<div class="categorization-grid cols-${numCols}">`;
    categorization.categories.forEach((cat) => {
      html += `
        <div class="categorization-box" data-cat-id="${escapeHtml(cat.id)}">
          <div class="cat-box-header">
            <span class="cat-title">${escapeHtml(cat.title)}</span>
            <span class="cat-count-badge" data-count-for="${escapeHtml(cat.id)}">0</span>
          </div>
          <div class="cat-dropzone" data-cat-zone="${escapeHtml(cat.id)}">
            <div class="cat-empty-placeholder">Dra eller klicka ord hit</div>
          </div>
        </div>`;
    });
    html += '</div></div>';
    return html;
  }

  function renderControls(card, session, quiz) {
    const controls = document.getElementById("session-controls");
    const cardBody = document.getElementById("card-body");
    let outcome = null;

    const placements = {};
    card.categorization.items.forEach((item) => {
      placements[item.id] = "bank";
    });

    let activeItem = null;

    const updateUI = () => {
      card.categorization.items.forEach((item) => {
        const chip = cardBody.querySelector(`.cat-chip[data-item-id="${item.id}"]`);
        if (!chip) return;
        const targetZoneId = placements[item.id] || "bank";
        const targetZone = cardBody.querySelector(`[data-cat-zone="${targetZoneId}"]`);
        if (targetZone && chip.parentElement !== targetZone) {
          targetZone.appendChild(chip);
        }
        if (targetZoneId === "bank") {
          chip.textContent = item.text;
          chip.classList.remove("placed");
        } else {
          chip.textContent = item.facitText || item.text;
          chip.classList.add("placed");
        }
        chip.classList.toggle("active-chip", activeItem === item.id);
      });

      card.categorization.categories.forEach((cat) => {
        const count = Object.values(placements).filter((z) => z === cat.id).length;
        const badge = cardBody.querySelector(`[data-count-for="${cat.id}"]`);
        if (badge) badge.textContent = count;
        const zone = cardBody.querySelector(`[data-cat-zone="${cat.id}"]`);
        if (zone) {
          const placeholder = zone.querySelector(".cat-empty-placeholder");
          if (placeholder) {
            placeholder.style.display = count > 0 ? "none" : "block";
          }
        }
      });
    };

    // Click / Tap events on chips
    cardBody.querySelectorAll(".cat-chip").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        if (chip.classList.contains("disabled")) return;
        const itemId = chip.dataset.itemId;
        const currentZone = placements[itemId] || "bank";

        if (currentZone === "bank") {
          if (activeItem === itemId) {
            activeItem = null;
          } else {
            activeItem = itemId;
          }
        } else {
          // Chip is already inside a category box - clicking it sends it back to bank!
          placements[itemId] = "bank";
          if (activeItem === itemId) activeItem = null;
        }
        updateUI();
      });

      chip.addEventListener("dragstart", (e) => {
        if (chip.classList.contains("disabled")) return;
        e.dataTransfer.setData("text/plain", chip.dataset.itemId);
        chip.classList.add("dragging");
      });

      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
      });
    });

    // Dropzones & container clicks
    const zones = cardBody.querySelectorAll("[data-cat-zone]");
    zones.forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("drag-over");
      });
      zone.addEventListener("dragleave", () => {
        zone.classList.remove("drag-over");
      });
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        const itemId = e.dataTransfer.getData("text/plain");
        const targetZone = zone.dataset.catZone;
        if (itemId && targetZone) {
          placements[itemId] = targetZone;
          activeItem = null;
          updateUI();
        }
      });

      zone.addEventListener("click", () => {
        if (!activeItem) return;
        const targetZone = zone.dataset.catZone;
        if (targetZone) {
          placements[activeItem] = targetZone;
          activeItem = null;
          updateUI();
        }
      });
    });

    // Also category box header/card clicks
    cardBody.querySelectorAll(".categorization-box").forEach((box) => {
      box.addEventListener("click", () => {
        if (!activeItem) return;
        const targetZone = box.dataset.catId;
        if (targetZone) {
          placements[activeItem] = targetZone;
          activeItem = null;
          updateUI();
        }
      });
    });

    updateUI();

    const grade = (fillCorrect) => {
      let correctCount = 0;
      const total = card.categorization.items.length;

      card.categorization.items.forEach((item) => {
        const chip = cardBody.querySelector(`.cat-chip[data-item-id="${item.id}"]`);
        if (!chip) return;

        if (fillCorrect) {
          placements[item.id] = item.targetCat;
          chip.classList.add("disabled", "correct");
          chip.classList.remove("wrong", "missed", "active-chip");
        } else {
          const curZone = placements[item.id] || "bank";
          chip.classList.remove("correct", "wrong", "missed");
          if (curZone === "bank") {
            chip.classList.add("missed");
          } else if (curZone === item.targetCat) {
            correctCount++;
            chip.classList.add("correct");
          } else {
            chip.classList.add("wrong");
          }
        }
      });

      updateUI();
      if (fillCorrect) {
        cardBody.querySelectorAll(".cat-chip").forEach((chip) => {
          chip.classList.add("disabled", "correct");
          chip.classList.remove("wrong", "missed");
        });
      }
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

  QuizApp.exercises.categorization = {
    renderHtml,
    renderControls,
  };
})();
