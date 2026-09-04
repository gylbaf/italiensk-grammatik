# Italiensk Grammatik – Quiz & Study App

A lightweight, fully static web application for practicing Italian grammar based on course materials, grammar sheets (*schede*), and exercise books.

## Project Structure

```text
├── webapp/                         # Static frontend application
│   ├── index.html                  # Main UI entry point (open directly in browser)
│   ├── app.js                      # Main coordinator and view router (~190 lines)
│   ├── style.css                   # Master stylesheet importing css/ components
│   ├── data.js                     # Generated quiz data (loaded via <script>)
│   ├── js/                         # Modular JavaScript components
│   │   ├── storage.js              # LocalStorage & statistics
│   │   ├── markdown.js             # Markdown parser & table renderer
│   │   ├── deck.js                 # Card deck formatting & shuffling
│   │   └── exercises/              # Question type controllers
│   │       ├── blanks.js           # Fill-in-the-blank & choices
│   │       ├── matching.js         # Two-column matching
│   │       ├── passage.js          # Passage text marking
│   │       ├── categorization.js   # Category sorting
│   │       └── reveal.js           # Self-assessment (reveal facit)
│   ├── css/                        # Modular component stylesheets
│   │   ├── base.css                # Typography, tabs, layout & buttons
│   │   ├── card.css                # Card layout & progress bar
│   │   ├── blanks.css              # Inputs, chips & inline buttons
│   │   ├── matching.css            # Matching columns & badges
│   │   ├── passage.css             # Text marking styles
│   │   └── categorization.css      # Drag-and-drop category boxes
│   └── tools/
│       ├── build_quiz_data.py      # CLI compiler entrypoint
│       └── quiz_builder/           # Modular Python data builder
│           ├── blanks.py           # Blank & choice heuristics
│           ├── matching.py         # Matching parser
│           ├── passage.py          # Passage parser
│           ├── categorization.py   # Category parser
│           ├── scheda_parser.py    # Scheda & soluzioni parser
│           ├── esercizi_parser.py  # Standalone exercises parser
│           ├── helpers.py          # Markdown heading helpers
│           └── constants.py        # Shared regexes & paths
├── md/                             # Markdown transcriptions of grammar sheets & exercises
│   ├── scheda*.md                  # Grammar theory + numbered exercises (1-40)
│   ├── soluzioni-*.md              # Answer keys (facit) for schede
│   └── Esercizi*.md                # Standalone exercise sets and answer keys
└── pdf/                            # Original source PDFs (reference only)
│   ├── *.pdf                           
```

## Getting Started

### Running the App
No local web server or build toolchain is required! Simply open `webapp/index.html` directly in any web browser (via `file://`).

### Rebuilding Quiz Data
Whenever markdown files in `md/` are added, updated, or corrected, regenerate `webapp/data.js` by running:

```bash
py webapp/tools/build_quiz_data.py
```

The script prints match statistics (e.g., `Scheda exercises: 156, matched: 156`) to verify data integrity.

## Token Efficiency & Development Workflow
- **No external runtime dependencies:** Pure vanilla HTML/JS/Python.
- **Small focused files:** All source code files are kept between 30 and 250 lines so AI assistants only need minimal context for any task.
- **Pre-parsed JSON data:** `data.js` exposes `window.QUIZ_DATA` directly so the frontend runs offline without asynchronous `fetch` calls or CORS restrictions.
- **Reference documentation:** See `.opencode/skill/italian-quiz-data/SKILL.md` and `docs/workflow.md` for technical notes, AI context rules, and data schemas.
