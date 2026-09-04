window.QuizApp = window.QuizApp || {};
QuizApp.exercises = QuizApp.exercises || {};

(function () {
  "use strict";

  const escapeHtml = (s) => QuizApp.markdown.escapeHtml(s);

  function normalizeAnswer(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[\u2018\u2019\u02bc\u0060]/g, "'")
      .replace(/\s*'\s*/g, "'")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\s+/g, " ");
  }

  function renderHtml(blanksLines, wordBank) {
    let html = "";
    if (wordBank && wordBank.length) {
      html += '<div class="word-bank">';
      html += '<div class="word-bank-header">Ordlista (dra eller klicka för att placera):</div>';
      html += '<div class="word-bank-chips">';
      wordBank.forEach((w) => {
        html += `<span class="bank-chip" draggable="true" data-word="${escapeHtml(w)}">${escapeHtml(w)}</span>`;
      });
      html += '</div></div>';
    }
    const isYAlign = blanksLines.length >= 6 && blanksLines.every((line) => {
      const choices = line.segments.filter((s) => s.t === "choice").length;
      if (choices !== 1) return false;
      const first = line.segments[0];
      if (!first || first.t !== "text" || !/^\s*\d+\.\s*$/.test(first.v)) return false;
      const last = line.segments[line.segments.length - 1];
      if (!last || last.t !== "text") return false;
      const txt = last.v.trim();
      if (txt.length > 18 || txt.includes(".") || txt.includes(",") || txt.split(/\s+/).length > 2) return false;
      const opts = line.segments.find((s) => s.t === "choice").options;
      if (!opts || opts.some((o) => o.length > 8)) return false;
      return true;
    });
    html += '<div class="fill-lines' + (isYAlign ? ' fill-lines--y-align' : '') + '">';
    blanksLines.forEach((line, li) => {
      if (wordBank && wordBank.length && line.segments.length === 1 && line.segments[0].t === "text" && line.segments[0].v.includes("•")) {
        return;
      }
      const isHelp = !!line.isHelp;
      html += '<div class="fill-line' + (isHelp ? ' fill-line--help' : '') + '">';
      line.segments.forEach((seg) => {
        if (seg.t === "text") {
          html += `<span>${escapeHtml(seg.v)}</span>`;
        } else if (seg.t === "blank") {
          const expectedLen = (seg.answers && seg.answers[0]) ? seg.answers[0].length : ((line.answers && line.answers[seg.i]) ? line.answers[seg.i].length : 8);
          const inputSize = Math.max(8, Math.min(26, expectedLen + 2));
          html += `<input type="text" class="blank-input" autocomplete="off" autocapitalize="off" spellcheck="false" data-line="${li}" data-blank="${seg.i}" size="${inputSize}">`;
        } else if (seg.t === "choice") {
          html += `<span class="choice-group" data-line="${li}" data-choice="${seg.i}" style="--choice-count:${seg.options.length}">` +
            seg.options.map((opt) =>
              `<button type="button" class="choice-btn" data-val="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`
            ).join("") +
            `</span>`;
        } else if (seg.t === "markable") {
          const words = seg.sentence.split(/\s+/);
          html += `<span class="markable-sentence" data-line="${li}" data-mark="${seg.i}" data-target="${escapeHtml(seg.target)}">` +
            words.map((w) => {
              const cleanWord = w.replace(/^[^\w\u00c0-\u017f']+|[^\w\u00c0-\u017f']+$/g, "");
              return `<span class="mark-word" data-word="${escapeHtml(cleanWord)}">${escapeHtml(w)}</span>`;
            }).join(" ") +
            `</span>`;
        }
      });
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  function renderControls(card, session, quiz) {
    const controls = document.getElementById("session-controls");
    const cardBody = document.getElementById("card-body");
    let outcome = null;

    // Attach click handlers to interactive choice buttons
    cardBody.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const group = btn.closest(".choice-group");
        if (!group) return;
        group.querySelectorAll(".choice-btn").forEach((b) => b.classList.remove("selected", "wrong", "missed"));
        btn.classList.add("selected");
      });
    });

    // Attach click handlers to markable words (e.g. circling articles)
    cardBody.querySelectorAll(".mark-word").forEach((w) => {
      w.addEventListener("click", () => {
        if (w.classList.contains("disabled")) return;
        const sentence = w.closest(".markable-sentence");
        if (!sentence) return;
        const wasSelected = w.classList.contains("selected");
        sentence.querySelectorAll(".mark-word").forEach((el) => el.classList.remove("selected", "wrong", "missed"));
        if (!wasSelected) {
          w.classList.add("selected");
        }
      });
    });

    // Word bank interactions (drag & drop and tap-to-place)
    let activeChip = null;

    const updateWordBankUsage = () => {
      const inputs = Array.from(cardBody.querySelectorAll(".blank-input"));
      const inputValues = inputs.map((inp) => normalizeAnswer(inp.value)).filter(Boolean);
      cardBody.querySelectorAll(".bank-chip").forEach((chip) => {
        const w = normalizeAnswer(chip.dataset.word);
        const isUsed = inputValues.includes(w);
        chip.classList.toggle("used", isUsed);
      });
    };

    cardBody.querySelectorAll(".bank-chip").forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        if (chip.classList.contains("disabled")) return;
        e.dataTransfer.setData("text/plain", chip.dataset.word);
      });

      chip.addEventListener("click", () => {
        if (chip.classList.contains("disabled")) return;
        if (activeChip === chip) {
          chip.classList.remove("active-chip");
          activeChip = null;
        } else {
          cardBody.querySelectorAll(".bank-chip").forEach((c) => c.classList.remove("active-chip"));
          chip.classList.add("active-chip");
          activeChip = chip;
        }
      });
    });

    cardBody.querySelectorAll(".blank-input").forEach((input) => {
      input.addEventListener("dragover", (e) => {
        e.preventDefault();
        input.classList.add("drag-over");
      });
      input.addEventListener("dragleave", () => {
        input.classList.remove("drag-over");
      });
      input.addEventListener("drop", (e) => {
        e.preventDefault();
        input.classList.remove("drag-over");
        if (input.disabled) return;
        const word = e.dataTransfer.getData("text/plain");
        if (word) {
          input.value = word;
          updateWordBankUsage();
        }
      });
      input.addEventListener("click", () => {
        if (activeChip && !input.disabled) {
          input.value = activeChip.dataset.word;
          activeChip.classList.remove("active-chip");
          activeChip = null;
          updateWordBankUsage();
        }
      });
      input.addEventListener("input", updateWordBankUsage);
    });

    updateWordBankUsage();

    const paintInputs = (fillCorrect) => {
      document.querySelectorAll(".blank-hint").forEach((el) => el.remove());
      let correctCount = 0, total = 0;
      card.blanks.forEach((line, li) => {
        line.segments.forEach((seg) => {
          if (seg.t === "blank") {
            total++;
            const accepted = seg.answers || (line.answers ? [line.answers[seg.i]] : []);
            const ans = accepted[0] || "";
            const input = document.querySelector(`input[data-line="${li}"][data-blank="${seg.i}"]`);
            if (!input) return;
            if (fillCorrect) {
              input.value = ans;
              input.disabled = true;
              input.classList.remove("correct", "wrong");
            } else {
              const ok = accepted.some((a) => normalizeAnswer(input.value) === normalizeAnswer(a));
              input.classList.toggle("correct", ok);
              input.classList.toggle("wrong", !ok);
              if (ok) correctCount++;
              else input.insertAdjacentHTML("afterend", `<span class="blank-hint">(rätt: ${escapeHtml(ans)})</span>`);
            }
          } else if (seg.t === "choice") {
            total++;
            const ans = seg.answer || (line.answers && line.answers[seg.i]) || "";
            const group = document.querySelector(`.choice-group[data-line="${li}"][data-choice="${seg.i}"]`);
            if (!group) return;
            const buttons = group.querySelectorAll(".choice-btn");
            if (fillCorrect) {
              buttons.forEach((b) => {
                b.disabled = true;
                b.classList.remove("selected", "wrong", "missed");
                const isAns = normalizeAnswer(b.dataset.val) === normalizeAnswer(ans);
                b.classList.toggle("correct", isAns);
              });
            } else {
              const selected = group.querySelector(".choice-btn.selected");
              const ok = selected && normalizeAnswer(selected.dataset.val) === normalizeAnswer(ans);
              buttons.forEach((b) => b.classList.remove("missed"));
              if (ok) {
                correctCount++;
                selected.classList.add("correct");
                selected.classList.remove("wrong");
              } else {
                if (selected) {
                  selected.classList.add("wrong");
                  selected.classList.remove("correct");
                }
                buttons.forEach((b) => {
                  if (normalizeAnswer(b.dataset.val) === normalizeAnswer(ans)) {
                    b.classList.add("missed");
                  }
                });
              }
            }
          } else if (seg.t === "markable") {
            total++;
            const sentence = document.querySelector(`.markable-sentence[data-line="${li}"][data-mark="${seg.i}"]`);
            if (!sentence) return;
            const targetNorm = normalizeAnswer(seg.target);
            const words = sentence.querySelectorAll(".mark-word");
            if (fillCorrect) {
              words.forEach((w) => {
                w.classList.add("disabled");
                w.classList.remove("selected", "wrong", "missed");
                const isTarget = normalizeAnswer(w.dataset.word) === targetNorm;
                w.classList.toggle("correct", isTarget);
              });
            } else {
              const selected = sentence.querySelector(".mark-word.selected");
              words.forEach((w) => w.classList.remove("missed"));
              const ok = selected && normalizeAnswer(selected.dataset.word) === targetNorm;
              if (ok) {
                correctCount++;
                selected.classList.add("correct");
                selected.classList.remove("wrong");
              } else {
                if (selected) {
                  selected.classList.add("wrong");
                  selected.classList.remove("correct");
                }
                words.forEach((w) => {
                  if (normalizeAnswer(w.dataset.word) === targetNorm) {
                    w.classList.add("missed");
                  }
                });
              }
            }
          }
        });
      });
      return { correctCount, total };
    };

    const renderButtons = () => {
      controls.innerHTML = `
        <button class="btn primary" id="check">✅ Rätta</button>
        <button class="btn" id="reveal">👁 Visa facit</button>
      `;
      document.getElementById("check").addEventListener("click", () => {
        const { correctCount, total } = paintInputs(false);
        outcome = correctCount === total;
        document.getElementById("card-result").innerHTML =
          `<div class="check-result ${outcome ? "all-correct" : ""}">${correctCount} / ${total} rätt</div>`;
        QuizApp.storage.recordResult(card.id, outcome);
        if (outcome) { if (!session.correctIds.includes(card.id)) session.correctIds.push(card.id); }
        else { if (!session.wrongIds.includes(card.id)) session.wrongIds.push(card.id); }
      });
      document.getElementById("reveal").addEventListener("click", () => {
        paintInputs(true);
        outcome = false;
        document.getElementById("card-result").innerHTML =
          '<div class="check-result">Facit ifyllt.</div>';
        QuizApp.storage.recordResult(card.id, false);
        if (!session.wrongIds.includes(card.id)) session.wrongIds.push(card.id);
      });
    };
    renderButtons();

    document.getElementById("card-body").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("check").click();
    });
  }

  QuizApp.exercises.blanks = {
    normalizeAnswer,
    renderHtml,
    renderControls,
  };
})();
