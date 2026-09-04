# Developer Workflow & Token Efficiency Guide

This guide outlines efficient practices for working with the Italian Grammar Quiz project while minimizing token usage and maintaining data integrity.

## Core Architectural Principles

1. **Static First:** The webapp (`webapp/`) is entirely static. No npm, webpack, or server is needed. Open `webapp/index.html` via `file://`.
2. **Deterministic Data Pipeline:** 
   - Source of truth: Markdown files in `md/`.
   - Compiler: `python webapp/tools/build_quiz_data.py`.
   - Consumer: `webapp/data.js` (`window.QUIZ_DATA`).
3. **Token Conservation:** 
   - **Never read `webapp/data.js` into context** (26,000+ lines).
   - Only open the specific small modular file required for your task (30–250 lines).

## Modular Codebase Map

When working on any part of the application, locate the small focused file below:

### Frontend (`webapp/`)
- `index.html` — HTML shell and script loader.
- `app.js` — Core router and view coordinator (`Quiz.renderHome`, `Quiz.renderSession`, etc.).
- `style.css` — Master CSS importing stylesheets from `css/`.
- `css/` — Modular CSS:
  - `base.css` — Variables, layout, header, flikar, buttons, rutnät.
  - `card.css` — Kortcontainer, progressbar, tabeller, sammanfattningsvy.
  - `blanks.css` — Lucktext, ordlåda, flervalsknappar, felmarkeringar.
  - `matching.css` — Tvåkolumnsmatchning och drag-and-drop.
  - `passage.css` — Textmarkering och stor bokstav.
  - `categorization.css` — Kategorilådor och drag-and-drop-brickor.
- `js/` — Modular JavaScript:
  - `storage.js` — LocalStorage och framstegsstatistik (`QuizApp.storage`).
  - `markdown.js` — Markdown-, fetstils- och tabellrendering (`QuizApp.markdown`).
  - `deck.js` — Kortleksformatering och slumpning (`QuizApp.deck`).
  - `exercises/` — Separata moduler för varje frågetyp (`QuizApp.exercises.*`):
    - `reveal.js` — Självrättning / visa facit.
    - `blanks.js` — Lucktext, flerval och ordlåda.
    - `matching.js` — Tvåkolumnskoppling.
    - `passage.js` — Textmarkeringsövningar.
    - `categorization.js` — Sortering i kolumner/kategorier.

### Compiler / Data Builder (`webapp/tools/quiz_builder/`)
- `constants.py` — Sökvägar och regexmönster.
- `helpers.py` — Fil- och rubrikparsning.
- `blanks.py` — Lucktext- och flervalsanalys.
- `matching.py` — Tvåkolumnsmatchning.
- `passage.py` — Textmarkeringsparsning.
- `categorization.py` — Kategoriseringsparsning.
- `scheda_parser.py` — Parsning av `scheda*.md` och facit i `soluzioni-*.md`.
- `esercizi_parser.py` — Parsning av fristående övningar och facitkoppling.
- `build_quiz_data.py` — CLI-wrapper för att bygga `data.js`.

---

## Common Development Tasks

### 1. Updating Quiz Content / Exercises
- Edit the relevant markdown file under `md/` (e.g., `schedaN_*.md` or `soluzioni-*.md`).
- Rebuild the data bundle:
  ```bash
  py webapp/tools/build_quiz_data.py
  ```
- Check console output to ensure exercise and answer counts match expectations.
- Open `webapp/index.html` in a browser to visually verify changes.

### 2. Modifying or Adding Question Types
- Each question type has 3 dedicated files:
  1. Parser: `webapp/tools/quiz_builder/<type>.py`
  2. UI Controller: `webapp/js/exercises/<type>.js`
  3. Styles: `webapp/css/<type>.css`
- Keep changes isolated to these files rather than modifying the main `app.js` or `style.css`.

### 3. Smoke Testing the Webapp Runtime
Run this quick node snippet to test that all JS modules load without errors:
```bash
node -e "
const fs = require('fs'), vm = require('vm');
const ctx = { window: {}, document: { getElementById: () => ({ addEventListener: ()=>{}, querySelectorAll: ()=>[], innerHTML: '', textContent: '' }), querySelectorAll: ()=>[] }, localStorage: { getItem: ()=>null, setItem: ()=>{} } };
ctx.window = ctx;
['data.js','js/storage.js','js/markdown.js','js/deck.js','js/exercises/reveal.js','js/exercises/blanks.js','js/exercises/matching.js','js/exercises/passage.js','js/exercises/categorization.js','app.js'].forEach(f => vm.runInNewContext(fs.readFileSync('webapp/' + f, 'utf8'), ctx));
console.log('QuizApp initialized successfully!');
"
```
