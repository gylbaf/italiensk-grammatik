/* Italiensk grammatik – Förhör
 * Fully static, offline app. Reads window.QUIZ_DATA (see data.js, generated
 * by tools/build_quiz_data.py from the transcribed md/ files).
 */

(function () {
  "use strict";

  const STATS_KEY = "italianQuiz.stats.v1";
  const app = document.getElementById("app");

  // ---------------------------------------------------------------------
  // Stats (localStorage) — per-card correct/wrong counters
  // ---------------------------------------------------------------------
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
    const total = correct + wrong;
    el.textContent = total ? `✔ ${correct} / ✘ ${wrong} (totalt ${total})` : "";
  }

  // ---------------------------------------------------------------------
  // Minimal markdown renderer (bold + tables + paragraphs)
  // ---------------------------------------------------------------------
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function inline(line) {
    let s = escapeHtml(line);
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return s;
  }
  function isTableLine(line) {
    return /^\s*\|.*\|\s*$/.test(line);
  }
  function renderTable(lines) {
    const rows = lines.map((l) =>
      l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
    );
    const filtered = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
    if (!filtered.length) return "";
    let html = '<table class="qmd-table">';
    filtered.forEach((row, idx) => {
      const tag = idx === 0 ? "th" : "td";
      html += "<tr>" + row.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>";
    });
    html += "</table>";
    return html;
  }
  function mdToHtml(text) {
    if (!text) return "";
    const lines = text.split("\n");
    let html = "";
    let i = 0;
    while (i < lines.length) {
      if (lines[i].trim() === "") { i++; continue; }
      if (isTableLine(lines[i])) {
        const tableLines = [];
        while (i < lines.length && isTableLine(lines[i])) { tableLines.push(lines[i]); i++; }
        html += renderTable(tableLines);
        continue;
      }
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== "" && !isTableLine(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      html += '<div class="body-text">' + paraLines.map(inline).join("\n") + "</div>";
    }
    return html;
  }

  // ---------------------------------------------------------------------
  // Fill-in-the-blank rendering + auto-grading (only for exercises where
  // build_quiz_data.py could align '___' blanks 1:1 with '**bold**' facit
  // words on every line — see card.blanks)
  // ---------------------------------------------------------------------
  function normalizeAnswer(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[\u2018\u2019\u02bc\u0060]/g, "'")
      .replace(/\s*'\s*/g, "'")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\s+/g, " ");
  }

  function renderBlanksHtml(blanksLines, wordBank) {
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
    html += '<div class="fill-lines">';
    blanksLines.forEach((line, li) => {
      if (wordBank && wordBank.length && line.segments.length === 1 && line.segments[0].t === "text" && line.segments[0].v.includes("•")) {
        return;
      }
      html += '<div class="fill-line">';
      line.segments.forEach((seg) => {
        if (seg.t === "text") {
          html += `<span>${escapeHtml(seg.v)}</span>`;
        } else if (seg.t === "blank") {
          const expectedLen = (seg.answers && seg.answers[0]) ? seg.answers[0].length : ((line.answers && line.answers[seg.i]) ? line.answers[seg.i].length : 8);
          const inputSize = Math.max(8, Math.min(26, expectedLen + 2));
          html += `<input type="text" class="blank-input" autocomplete="off" autocapitalize="off" spellcheck="false" data-line="${li}" data-blank="${seg.i}" size="${inputSize}">`;
        } else if (seg.t === "choice") {
          html += `<span class="choice-group" data-line="${li}" data-choice="${seg.i}">` +
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

  function renderMatchingHtml(groups) {
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

  function renderPassageMarkingHtml(passage) {
    let html = '<div class="passage-box">';
    html += '<div class="passage-hint"><strong>Instruktion:</strong> Klicka 1 gång = stryk under (substantiv) · Klicka 2 gånger = stor bokstav (egennamn) · Klicka 3 gånger för att återställa</div>';
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

  // ---------------------------------------------------------------------
  // Build flat "deck" structures from QUIZ_DATA
  // ---------------------------------------------------------------------
  const DATA = window.QUIZ_DATA || { schede: [], esercizi: [] };

  function schedaCards(scheda) {
    return scheda.exercises.map((ex) => ({
      id: `scheda:${scheda.file}:${ex.num}`,
      groupTitle: `Scheda ${scheda.id} – ${scheda.title}`,
      label: `${ex.num} •`,
      instruction: ex.instruction,
      body: ex.body,
      answerBody: ex.answerBody || null,
      blanks: ex.blanks || null,
      matching: ex.matching || null,
      passage: ex.passage || null,
      wordBank: ex.wordBank || null,
    }));
  }

  function esercizioCards(es) {
    return es.sections.map((sec, i) => ({
      id: `es:${es.file}:${i}`,
      groupTitle: es.title,
      label: "",
      instruction: sec.heading,
      body: sec.body,
      answerBody: sec.answerBody || null,
      blanks: sec.blanks || null,
      matching: sec.matching || null,
      passage: sec.passage || null,
      wordBank: sec.wordBank || null,
    }));
  }

  function allSchedaCards() {
    return DATA.schede.flatMap(schedaCards);
  }
  function allEserciziCards() {
    return DATA.esercizi.flatMap(esercizioCards);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------
  const Quiz = {
    tab: "schede",

    goHome() {
      this.session = null;
      this.renderHome();
    },

    renderHome() {
      const schedeWithAnswers = DATA.schede.filter((s) => s.exercises.some((e) => e.answerBody));
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
          <button class="btn primary" id="quiz-all-schede">🔀 Blanda alla scheda-övningar (${allSchedaCards().length} st)</button>
        </div>
        <div class="grid">${tiles}</div>
      `;
      document.getElementById("quiz-all-schede").addEventListener("click", () =>
        this.startSession(shuffle(allSchedaCards()), "Alla scheda-övningar", { type: "schede" })
      );
      el.querySelectorAll("[data-scheda]").forEach((t) =>
        t.addEventListener("click", () => {
          const s = DATA.schede.find((x) => x.id == t.dataset.scheda);
          this.startSession(schedaCards(s), `Scheda ${s.id} – ${s.title}`, { type: "scheda", id: s.id });
        })
      );
    },

    renderEserciziTab() {
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
          <button class="btn primary" id="quiz-all-es">🔀 Blanda alla fristående övningar (${allEserciziCards().length} st)</button>
        </div>
        <div class="grid">${tiles}</div>
      `;
      document.getElementById("quiz-all-es").addEventListener("click", () =>
        this.startSession(shuffle(allEserciziCards()), "Alla fristående övningar", { type: "esercizi" })
      );
      el.querySelectorAll("[data-es]").forEach((t) =>
        t.addEventListener("click", () => {
          const e = DATA.esercizi[t.dataset.es];
          this.startSession(esercizioCards(e), e.title, { type: "esercizio", idx: t.dataset.es });
        })
      );
    },

    // -------------------------------------------------------------------
    // Quiz session
    // -------------------------------------------------------------------
    startSession(cards, title, scope) {
      if (!cards.length) return;
      this.session = {
        title,
        scope,
        cards: shuffle(cards),
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

      const bodyHtml = card.passage
        ? renderPassageMarkingHtml(card.passage)
        : (card.matching
          ? renderMatchingHtml(card.matching)
          : (card.blanks ? renderBlanksHtml(card.blanks, card.wordBank) : mdToHtml(card.body)));

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
        <div class="session-controls" id="session-controls"></div>
      `;

      document.getElementById("back-home").addEventListener("click", () => this.goHome());

      if (card.passage) this.renderPassageMarkingControls(card);
      else if (card.matching) this.renderMatchingControls(card);
      else if (card.blanks) this.renderGradableControls(card);
      else this.renderRevealControls(card);
    },

    // Passage marking: underline common nouns and capitalize proper nouns
    renderPassageMarkingControls(card) {
      const s = this.session;
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
        });
      });

      const grade = (fillCorrect) => {
        let correctCount = 0;
        const total = card.passage.totalItems || 29;

        card.passage.tokens.forEach((t) => {
          if (t.t !== "word") return;
          const el = cardBody.querySelector(`.passage-word[data-word-id="${t.id}"]`);
          if (!el) return;

          if (fillCorrect) {
            el.classList.add("disabled");
            el.classList.remove("wrong", "missed", "marked-noun", "marked-proper");
            if (t.role === "common") {
              el.textContent = t.v;
              el.classList.add("correct");
            } else if (t.role === "proper") {
              el.textContent = t.cap;
              el.classList.add("correct-proper");
            }
          } else {
            const state = parseInt(el.dataset.state || "0", 10);
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
        });

        return { correctCount, total };
      };

      const renderButtons = () => {
        controls.innerHTML = `
          <button class="btn primary" id="check">✅ Rätta</button>
          <button class="btn" id="reveal">👁 Visa facit</button>
          ${outcome !== null ? '<button class="btn" id="next">Nästa ▶</button>' : ""}
        `;
        document.getElementById("check").addEventListener("click", () => {
          const { correctCount, total } = grade(false);
          outcome = correctCount === total;
          document.getElementById("card-result").innerHTML =
            `<div class="check-result ${outcome ? "all-correct" : ""}">${correctCount} / ${total} rätt</div>`;
          renderButtons();
        });
        document.getElementById("reveal").addEventListener("click", () => {
          grade(true);
          outcome = false;
          document.getElementById("card-result").innerHTML =
            '<div class="check-result">Facit ifyllt.</div>';
          renderButtons();
        });
        const nextBtn = document.getElementById("next");
        if (nextBtn) {
          nextBtn.addEventListener("click", () => {
            recordResult(card.id, outcome);
            (outcome ? s.correctIds : s.wrongIds).push(card.id);
            s.index++;
            this.renderSession();
          });
        }
      };
      renderButtons();
    },

    // Matching exercises: two-column drag-and-drop / click-to-pair.
    renderMatchingControls(card) {
      const s = this.session;
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
          ${outcome !== null ? '<button class="btn" id="next">Nästa ▶</button>' : ""}
        `;
        document.getElementById("check").addEventListener("click", () => {
          const { correctCount, total } = grade(false);
          outcome = correctCount === total;
          document.getElementById("card-result").innerHTML =
            `<div class="check-result ${outcome ? "all-correct" : ""}">${correctCount} / ${total} rätt</div>`;
          renderButtons();
        });
        document.getElementById("reveal").addEventListener("click", () => {
          grade(true);
          outcome = false;
          document.getElementById("card-result").innerHTML =
            '<div class="check-result">Facit ifyllt.</div>';
          renderButtons();
        });
        const nextBtn = document.getElementById("next");
        if (nextBtn) {
          nextBtn.addEventListener("click", () => {
            recordResult(card.id, outcome);
            (outcome ? s.correctIds : s.wrongIds).push(card.id);
            s.index++;
            this.renderSession();
          });
        }
      };
      renderButtons();
    },

    // Exercises with structured `blanks` / `choices` / `markable`: inline auto-graded inputs.
    renderGradableControls(card) {
      const s = this.session;
      const controls = document.getElementById("session-controls");
      const cardBody = document.getElementById("card-body");
      let outcome = null; // true/false once checked or facit shown

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
          ${outcome !== null ? '<button class="btn" id="next">Nästa ▶</button>' : ""}
        `;
        document.getElementById("check").addEventListener("click", () => {
          const { correctCount, total } = paintInputs(false);
          outcome = correctCount === total;
          document.getElementById("card-result").innerHTML =
            `<div class="check-result ${outcome ? "all-correct" : ""}">${correctCount} / ${total} rätt</div>`;
          renderButtons();
        });
        document.getElementById("reveal").addEventListener("click", () => {
          paintInputs(true);
          outcome = false; // seeing the facit counts as "not answered correctly" for stats
          document.getElementById("card-result").innerHTML =
            '<div class="check-result">Facit ifyllt.</div>';
          renderButtons();
        });
        const nextBtn = document.getElementById("next");
        if (nextBtn) {
          nextBtn.addEventListener("click", () => {
            recordResult(card.id, outcome);
            (outcome ? s.correctIds : s.wrongIds).push(card.id);
            s.index++;
            this.renderSession();
          });
        }
      };
      renderButtons();

      // Allow pressing Enter in a blank to trigger "Rätta".
      document.getElementById("card-body").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("check").click();
      });
    },

    // Exercises without structured blanks: whole-block self-assessment.
    renderRevealControls(card) {
      const s = this.session;
      const controls = document.getElementById("session-controls");
      let revealed = false;

      const renderButtons = () => {
        controls.innerHTML = !revealed
          ? `<button class="btn primary" id="reveal">👁 Visa facit</button>
             <button class="btn" id="skip">Hoppa över ▶</button>`
          : `<div class="result-buttons">
               <button class="btn correct" id="mark-correct">✅ Rätt</button>
               <button class="btn wrong" id="mark-wrong">❌ Fel</button>
             </div>
             <button class="btn" id="next">Nästa ▶</button>`;

        if (!revealed) {
          document.getElementById("reveal").addEventListener("click", () => {
            revealed = true;
            document.getElementById("card-result").innerHTML = card.answerBody
              ? `<div class="answer-block"><div class="label">Facit</div>${mdToHtml(card.answerBody)}</div>`
              : `<div class="no-answer">Inget facit tillgängligt för denna övning.</div>`;
            renderButtons();
          });
          document.getElementById("skip").addEventListener("click", () => {
            s.index++;
            this.renderSession();
          });
        } else {
          document.getElementById("mark-correct").addEventListener("click", () => {
            recordResult(card.id, true);
            s.correctIds.push(card.id);
            s.index++;
            this.renderSession();
          });
          document.getElementById("mark-wrong").addEventListener("click", () => {
            recordResult(card.id, false);
            s.wrongIds.push(card.id);
            s.index++;
            this.renderSession();
          });
          document.getElementById("next").addEventListener("click", () => {
            s.index++;
            this.renderSession();
          });
        }
      };
      renderButtons();
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
  renderGlobalStats();
  Quiz.renderHome();
})();
