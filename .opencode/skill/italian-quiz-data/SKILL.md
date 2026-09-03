---
name: italian-quiz-data
description: Use when building, extending, or debugging the Italian-grammar quiz webapp for this folder ("Italiensk grammatik") — i.e. when the user mentions the quiz app, förhör/quiz i italienska, webapp/, data.js, build_quiz_data.py, the md/ folder, scheda-filerna, soluzioni-filerna, or parsing exercises/facit from the transcribed markdown files. Explains the data format, file naming, the existing static webapp, and known quirks needed to parse questions and answers correctly.
---

# Italian quiz data (scheda + esercizi + soluzioni)

## The webapp (already built)

`webapp/` contains a working, fully static (no build tools, no server, no
CDN) quiz app:

- `webapp/index.html` + `webapp/style.css` + `webapp/app.js` — the UI.
  Open `index.html` directly in a browser (file://, no server needed).
- `webapp/data.js` — generated data file, `window.QUIZ_DATA = {...}`,
  loaded via a plain `<script src="data.js">` tag (chosen over `fetch`-ing
  a `.json` specifically so the app works from `file://` without CORS
  issues or a local server).
- `webapp/tools/build_quiz_data.py` — parses every file in `md/` and
  (re)writes `webapp/data.js`. **Re-run this after editing any md file**:
  `py webapp/tools/build_quiz_data.py` (from anywhere; paths are computed
  relative to the script). It prints how many exercises/sections got
  matched with an answer, e.g. `Scheda exercises: 156, matched: 156` —
  use that count to sanity-check after changes.

`QUIZ_DATA` shape:
```js
{
  schede: [ { id, title, file, theory, exercises: [ { num, instruction, body, answerBody } ] } ],
  esercizi: [ { title, file, answerFile, note, hasAnswers, sections: [ { heading, body, answerBody } ] } ]
}
```
Design decision: quiz cards are **block-level** (one whole `### NN`
exercise, or one whole `## heading` section — not split into individual
fill-in items) *except* where auto-grading is possible — see below. `body`/`answerBody` are raw
markdown-ish text rendered client-side by a tiny renderer in `app.js`
(`mdToHtml`) that handles `**bold**`, pipe tables, and paragraphs — nothing
fancier. Progress (`correct`/`wrong` per card id) is stored in
`localStorage` under `italianQuiz.stats.v1`.

If asked to change how cards are structured, add new question types, or
persist progress differently, edit `build_quiz_data.py` (data shape) and
`app.js` (rendering/logic) together, then re-run the build script and
manually click through the app (or reuse the jsdom-based smoke test
pattern used during development — install `jsdom` under a temp/scratch
node_modules and `require()` `data.js`+`app.js` into a `JSDOM` instance to
click through tabs/sessions programmatically) before telling the user it
works.

This skill describes the data set that backs a planned/ongoing webapp that
quizzes the user in Italian grammar. All quiz content comes from markdown
files transcribed from PDFs — there is no other data source. Do not invent
questions or answers; only use what's in these files.

## Where the data lives

- PDFs (source of truth, rarely need to be touched again): folder root.
- Markdown (use this for the app): `md/` subfolder, one `.md` per `.pdf`,
  same base filename.

Two independent sets of files:

1. **`schedaN_*.md`** (40 files, N = 1–40) — grammar lesson + exercises.
   Each file has:
   - `# Title` and `*Källa: <pdf filename>*` header.
   - Prose sections (`## LA FORMA`, `## L'USO`, etc.) with rules, tables
     (markdown tables), and example sentences in Italian. This is
     explanatory content, not quiz material.
   - After a `---` separator, numbered exercises: `### 01 • <instruction>`,
     `### 02 • ...` etc. Exercises contain fill-in-the-blank items (`___`),
     multiple-choice items (`il / lo / un zio`), or transformation tasks.
   - **Scheda files do NOT contain answers.** Answers live in the separate
     `soluzioni-*` files (see below), except where an example answer is
     given inline as a worked example (e.g. `un quaderno ➜ i quaderni`
     before the numbered list — that's a model answer, not item 1).

2. **`soluzioni-schede-di-grammatica_del0N_sXX-YY.md`** (8 files) — answer
   keys for the scheda exercises, transcribed from scanned/image PDFs (the
   answers were handwritten/underlined in the source). Structure:
   - `## Scheda N – <topic>` sections, then `### 01 • <instruction>` with
     the answers listed (numbered to match the scheda's numbering).

   **Known numbering quirk — read the header note in each soluzioni file
   before trusting the filename:**
   - `del01` → schede 1–5, `del02` → schede 6–10, `del03` → schede 11–15,
     `del04` → schede 16–19 (scheda 20 is missing from this PDF entirely).
   - `del05` → actually schede 20 (tail end) – 24 (not 21–25 as the
     filename implies).
   - `del06` → actually schede 25–29 (not 26–30).
   - `del07` → actually schede 30–34 (not 31–35).
   - `del08` → schede 35–41... but there is no scheda 41; it covers 35–40.
   - Each affected soluzioni `.md` has an italicized note near the top
     explaining the real page/scheda mapping — parse that note or hardcode
     the corrected mapping table above; don't trust `sXX-YY` in the
     filename literally.
   - When building a scheda→soluzioni lookup for the app, use the explicit
     `## Scheda N – ...` headings inside each soluzioni file as the source
     of truth for which scheda a section answers, not the filename.

3. **`Esercizi *.md` / `75_esercizi...` / `36_esercizi...` / `ED test...`**
   (standalone exercise sets, ~15 files) — some come in pairs: a plain
   exercise file and a matching `... rätt svar.md` / `... svar.md` /
   `... con risposte.md` answer file with the same numbering. Match them by
   filename similarity (strip the "rätt svar"/"svar"/"con risposte" suffix).
   A few of these exercises have no answer key at all (verified during
   transcription) — in that case there's simply no matching file; don't
   assume one is missing due to an error.

## Format conventions to rely on when parsing

- Every file starts with `# Title` then `*Källa: <original pdf>*`.
- Exercise blocks are `### NN • <instruction in Italian (or Swedish for
  translation exercises)>` followed by a numbered/lettered list.
- Blanks in unanswered exercises are literal `___` (three underscores).
- Multiple-choice items are written `option1 / option2 / option3` inline
  after the item number.
- Transformation exercises show `question/prompt → answer` only in
  soluzioni files (or as the one worked example at the top of a scheda
  exercise, before the real numbered items start).
- Tables use standard markdown table syntax; conjugation/case tables have a
  header row per grammatical category — parse with a normal markdown table
  parser, don't assume fixed column counts across files.
- Known intentional typo fixes (kept in the md, differ from the raw PDF
  OCR): `l'usignuolo`, `Scialoja`, `Sei uscito`, `vengo` — these are
  correct Italian, not bugs.

## How the build script resolves things (already solved, for reference)

- **Scheda exercises**: any `### NN • ...` heading (two-digit number + `•`)
  in a `schedaN_*.md` file is one exercise card. Everything before the
  first such heading is "theory" (kept, currently unused by the UI).
- **Soluzioni → scheda matching**: the build script does NOT trust the
  `del0N_sXX-YY` filename. It reads the `## Scheda N – ...` headings
  *inside* each soluzioni file (already corrected during transcription) to
  build an `answer_map[scheda_num][exercise_num]`, then looks up each
  scheda exercise's answer by `(scheda.id, exercise.num)`. Scheda 19's
  answers are nested one level deeper (`#### 01` under `### Del A`) in the
  del04 file — the heading parser scans levels 2–4 to catch this.
- **Esercizi pairing**: hardcoded `ESERCIZI_PAIRS` list in
  `build_quiz_data.py` (only ~10 files, not worth a generic heuristic
  alone). Sections are matched between a question file and its answer
  file by normalized heading text (strip numbering/`– svar`/`(facit)`
  suffixes, lowercase), exact match first, then prefix match. `36_...` and
  `75_...` have answers embedded in the *same* file under a `## Soluzioni`
  heading and get bespoke parsing functions
  (`parse_embedded_36`/`parse_embedded_75`). Files with genuinely no
  answer key (`ED test_di_ammissione_M1.md`, `Esercizi lezione  1.md`,
  `Esercizi verbi 4-6.md`, and the "indefinita" sections of
  `Esercizi pronomi 1.md`) correctly end up with `answerBody: null` —
  don't try to "fix" this, there is no facit for those in the source PDFs.

- **Auto-graded blanks (partial coverage)**: `build_quiz_data.py` computes
  an optional `blanks` field on each scheda exercise / esercizi section, in
  two passes:
  1. Primary: every non-empty line's `___` blank count matches its facit
     line's `**bold**`-word count exactly → those bold words are the
     answers, in order.
  2. Fallback (`try_slash_line_answers`): only for lines with **2+**
     blanks where the facit has no bold but repeats each blank's filled
     phrase separated by `' / '` (e.g. q: `___ pesce ___ albero`, a:
     `il pesce / l'albero`) — the shared noun after each blank is
     suffix-matched and stripped to recover just the answer word. This is
     deliberately narrow (2+ blanks AND a literal `/` required) — an
     earlier, looser version of this heuristic produced silently wrong
     answers for several single-blank exercises (scheda 3 ex03, scheda 7
     ex01/02, scheda 20 ex01, scheda 17 ex05) by grabbing unrelated
     trailing text. **Do not loosen the `n_blanks < 2` / `"/" not in
     a_line` guard without re-checking those five exercises render
     sensible answers again.**

  Lines with zero blanks (worked examples) are never validated against
  the facit and don't block the rest of the exercise from being gradable.
  If BOTH passes fail for any one line, the whole exercise falls back to
  block-level self-assessment (all-or-nothing per exercise, not per line).

  Current coverage: **40/156** scheda exercises, **11/52** esercizi
  sections (run `py webapp/tools/build_quiz_data.py` to recheck after any
  md change — it prints matched counts, and you can rerun the ad-hoc
  "which exercises use the slash path" / "diff old vs new gradable set"
  snippets from the dev session — reproduce with
  `build_quiz_data.build_blanks(body, answer)` in a `py -c` one-liner — if
  you touch this logic again). Exercises where `blanks` is `null` keep the
  whole-block "reveal + rätt/fel" self-assessment flow — **don't** try to
  force those into inputs by guessing where blanks map to which word; only
  trust the two validated mechanical methods above.
- If asked to raise the auto-graded coverage, the honest way is to go back
  and re-transcribe more soluzioni/svar files so the changed word is
  wrapped in `**bold**` on every line (one bold span per `___`), then
  simply re-run the build script — `build_blanks()` will pick them up
  automatically. Do not add fuzzy/heuristic blank-matching in the JS
  layer; wrong auto-grading is worse than no auto-grading.

## Extending the quiz app

The app already exists (see "The webapp" section above) with block-level
flashcard cards, plus auto-graded inline inputs where the data supports it
(see above). If asked to add finer-grained grading for exercises that
currently fall back to whole-block self-assessment:
- Don't attempt to re-derive answers algorithmically (e.g. conjugating
  verbs programmatically) — always source them from the soluzioni/svar
  text, since some items explicitly allow multiple valid answers
  ("più risposte sono possibili").
- Per-item parsing will need per-scheda-family special-casing (numbered
  lists, lettered lists, inline `___` pairs on one line, arrow
  transformations `→` are all used inconsistently across the 63 files) —
  there is no single regex that covers every exercise type cleanly, which
  is exactly why the current implementation stays at block level.

## Caveats already flagged during transcription

A few soluzioni entries were transcribed from low-resolution scans with
some visual ambiguity (crossed matching-arrows, overlapping handwriting).
These are called out inline in the affected files with a note — search for
"PDF" or "scan" inside a soluzioni file if an answer looks suspicious, the
uncertainty is usually documented right next to it rather than silently
guessed.
