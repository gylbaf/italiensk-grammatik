---
name: italian-quiz-data
description: Use when building, extending, or debugging the Italian-grammar quiz webapp for this folder ("Italiensk grammatik") — i.e. when the user mentions the quiz app, förhör/quiz i italienska, webapp/, data.js, build_quiz_data.py, the md/ folder, scheda-filerna, soluzioni-filerna, or parsing exercises/facit from the transcribed markdown files. Explains the modular file layout, context-saving guidelines for AI, data format, file naming, and known quirks needed to parse questions and answers correctly.
---

# Italian quiz data (scheda + esercizi + soluzioni)

## ⚠️ AI Context Efficiency Rules (Read Before Doing Anything)

1. **NEVER read `webapp/data.js` into context.** It is an auto-generated file of ~26,000+ lines. Reading it will waste context.
   - If you need to inspect the data shape, read the documented schema below.
   - If you need to test or inspect a card, run a 1-line script:
     `node -e "require('./webapp/data.js'); console.log(window.QUIZ_DATA.schede[0].exercises[0]);"`
2. **Never search without filtering.** When using `grep`, always supply an `include` pattern (e.g. `include="*.py"` or path="webapp/js") to avoid matching `data.js`.
3. **Use the modular file map.** All code is split into small (30–250 lines) files with single responsibilities. Only open the specific file for your task:

### Codebase File Map

| Task / Domain | Frontend UI (`webapp/js/`) | Styling (`webapp/css/`) | Parser / Builder (`webapp/tools/quiz_builder/`) |
|---|---|---|---|
| **Fill-in-the-blank / Choices** | `js/exercises/blanks.js` | `css/blanks.css` | `blanks.py` |
| **Two-column Matching** | `js/exercises/matching.js` | `css/matching.css` | `matching.py` |
| **Passage Text Marking** | `js/exercises/passage.js` | `css/passage.css` | `passage.py` |
| **Category Sorting / Drag-Drop**| `js/exercises/categorization.js` | `css/categorization.css` | `categorization.py` |
| **Self-assessment (Reveal facit)** | `js/exercises/reveal.js` | `css/card.css` | N/A (fallback) |
| **Stats & LocalStorage** | `js/storage.js` | `css/base.css` | N/A |
| **Markdown & Table rendering** | `js/markdown.js` | `css/card.css` | N/A |
| **Card deck & Shuffling** | `js/deck.js` | N/A | N/A |
| **App router & Session flow** | `webapp/app.js` | `css/base.css`, `css/card.css` | N/A |
| **Scheda markdown parsing** | N/A | N/A | `scheda_parser.py` |
| **Esercizi markdown parsing** | N/A | N/A | `esercizi_parser.py` |
| **Markdown heading helpers** | N/A | N/A | `helpers.py` |
| **Regexes & Sökvägar** | N/A | N/A | `constants.py` |
| **Compiler Entrypoint** | N/A | N/A | `build_quiz_data.py` (CLI wrapper) |

---

## The webapp

`webapp/` is a fully static (no build tools, no server, no npm runtime, no CDN) offline quiz app:

- `webapp/index.html` — open directly in any browser (works via `file://`).
- `webapp/style.css` — imports modular CSS from `webapp/css/`.
- `webapp/app.js` — main view coordinator and router.
- `webapp/data.js` — generated data bundle, sets `window.QUIZ_DATA = {...}`.
- `webapp/tools/build_quiz_data.py` — parses every file in `md/` and writes `webapp/data.js`.
  **Re-run after editing any md file or builder logic**:
  ```bash
  py webapp/tools/build_quiz_data.py
  ```
  It prints counts, e.g. `Scheda exercises: 156, matched: 156` — use this to sanity-check changes.

### `QUIZ_DATA` Schema

```js
{
  schede: [
    {
      id: 1,
      title: "Gli articoli determinativi",
      file: "scheda1_gliarticoli1.md",
      theory: "## LA FORMA...",
      exercises: [
        {
          num: "01",
          instruction: "Inserisci l'articolo...",
          body: "1. ___ libro\n2. ___ casa",
          answerBody: "1. **il** libro\n2. **la** casa",
          blanks: [...],          // optional structured blanks
          matching: [...],        // optional column pairs
          passage: {...},         // optional word marking
          categorization: {...},  // optional category sorting
          wordBank: [...]         // optional word bank
        }
      ]
    }
  ],
  esercizi: [
    {
      title: "Esercizi lezione 1",
      file: "Esercizi lezione  1.md",
      answerFile: "Esercizi lezione 1 rätt svar.md",
      note: null,
      hasAnswers: true,
      sections: [
        {
          heading: "1. Skriv bestämd artikel",
          body: "- a. ___ zaino",
          answerBody: "- a. **lo** zaino",
          blanks: [...],
          matching: null,
          categorization: null,
          wordBank: null
        }
      ]
    }
  ]
}
```

Design decision: quiz cards support auto-graded interactive controls when structured data exists (`blanks`, `matching`, `passage`, `categorization`), falling back to block-level self-assessment ("Visa facit" + "Rätt / Fel"). Progress (`correct`/`wrong` per card id) is stored in `localStorage` under `italianQuiz.stats.v1`.

---

## Where the data lives

- **PDFs** (source of truth, rarely touched): folder root.
- **Markdown** (transcribed course material): `md/` subfolder, one `.md` per `.pdf`.

Two independent sets of files:

1. **`schedaN_*.md`** (40 files, N = 1–40) — grammar lesson + exercises.
   - `# Title` and `*Källa: <pdf filename>*` header.
   - Prose sections (`## LA FORMA`, `## L'USO`, etc.) with rules, markdown tables, and examples.
   - After a `---` separator, numbered exercises: `### 01 • <instruction>`, `### 02 • ...`.
   - **Scheda files do NOT contain answers.** Answers live in `soluzioni-*` files.

2. **`soluzioni-schede-di-grammatica_del0N_sXX-YY.md`** (8 files) — answer keys for the scheda exercises.
   - Structure: `## Scheda N – <topic>` sections, then `### 01 • <instruction>` with answers.

   **Known numbering quirk — read the header note in each soluzioni file before trusting the filename:**
   - `del01` → schede 1–5, `del02` → schede 6–10, `del03` → schede 11–15, `del04` → schede 16–19 (scheda 20 missing from this PDF).
   - `del05` → schede 20 (tail end) – 24 (not 21–25).
   - `del06` → schede 25–29 (not 26–30).
   - `del07` → schede 30–34 (not 31–35).
   - `del08` → schede 35–40 (covers 35–40, no scheda 41).
   - Use the explicit `## Scheda N – ...` headings inside each soluzioni file as source of truth.

3. **`Esercizi *.md` / `75_esercizi...` / `36_esercizi...` / `ED test...`**
   - Standalone exercise sets. Paired with answer files (e.g. `... rätt svar.md`) in `ESERCIZI_PAIRS` in `esercizi_parser.py`.
   - `36_...` and `75_...` have answers embedded in the same file under `## Soluzioni`.
   - Files with genuinely no answer key (`ED test_di_ammissione_M1.md`, `Esercizi verbi 4-6.md`) have `answerBody: null`.

---

## Format conventions to rely on when parsing

- Every file starts with `# Title` then `*Källa: <original pdf>*`.
- Exercise blocks are `### NN • <instruction>` followed by numbered/lettered lists.
- Blanks in unanswered exercises are literal `___` (three underscores).
- Multiple-choice items are written `option1 / option2 / option3` inline.
- Known intentional typo fixes (kept in the md, differ from OCR errors): `l'usignuolo`, `Scialoja`, `Sei uscito`, `vengo`.

---

## Auto-grading heuristics in `quiz_builder/`

- **Passage Marking (`passage.py`)**: Sottolinea nel brano + maiuscola (Scheda 4 Ex 01).
- **Matching (`matching.py`)**: Arrow-linked pairs `1. X → a. Y` (Scheda 3 Ex 02).
- **Categorization (`categorization.py`)**: Column lists with headings `- Title: item1, item2` (Scheda 4 Ex 02, etc.).
- **Blanks & Choices (`blanks.py`)**:
  1. Primary: every non-empty line's `___` blank count matches facit line's `**bold**`-word count exactly.
  2. Fallback (`try_slash_line_answers`): only for lines with **2+** blanks where facit repeats filled phrases separated by `' / '`. **Do not loosen `n_blanks < 2` guard** without checking scheda 3 ex03, scheda 7 ex01/02, scheda 20 ex01, scheda 17 ex05.
  3. Choices (`build_choices`): slash options in prompt where one option is bolded in facit.
  4. Word bank (`extract_word_bank`): bullet-separated word list at top of exercise.

If a line cannot be parsed with certainty, the builder returns `None` and the app gracefully falls back to whole-block self-assessment.

---

## Verifying Changes (Smoke Test)

Without opening a browser, verify the entire JS runtime via node:

```bash
node -e "
const fs = require('fs'), vm = require('vm');
const ctx = { window: {}, document: { getElementById: () => ({ addEventListener: ()=>{}, querySelectorAll: ()=>[], innerHTML: '', textContent: '' }), querySelectorAll: ()=>[] }, localStorage: { getItem: ()=>null, setItem: ()=>{} } };
ctx.window = ctx;
['data.js','js/storage.js','js/markdown.js','js/deck.js','js/exercises/reveal.js','js/exercises/blanks.js','js/exercises/matching.js','js/exercises/passage.js','js/exercises/categorization.js','app.js'].forEach(f => vm.runInNewContext(fs.readFileSync('webapp/' + f, 'utf8'), ctx));
console.log('App initialized successfully, schede count:', ctx.QuizApp.deck.getData().schede.length);
"
```
