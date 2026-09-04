# -*- coding: utf-8 -*-
"""Parser for standalone exercises (Esercizi *.md) and answer keys."""
import re
from .constants import MD_DIR, LOOSE_NUM_HEADING_RE, LEADING_NUM_RE
from .helpers import (
    read,
    split_headings,
    strip_title_and_source,
    top_level_sections,
    match_sections,
)
from .blanks import build_interactive_items, extract_word_bank
from .matching import build_matching
from .categorization import build_categorization

ESERCIZI_PAIRS = [
    ("36_esercizi_grammatica_C1 gerundio.md", None),
    ("75_esercizi_grammatica_B2.md", None),
    ("ED test_di_ammissione_M1.md", None),
    ("Esercizi 2 pronomen.md", "Esercizi 2 r\u00e4tt svar.md"),
    ("Esercizi gerundio participio.md", "Esercizi gerundio participio svar.md"),
    ("Esercizi lezione  1.md", "Esercizi lezione 1 rätt svar.md"),
    ("Esercizi per il 16 marzo.md", "Esercizi per il 16 marzo con risposte.md"),
    ("Esercizi pronomi 1.md", "Esercizi pronomi 1 r\u00e4tt svar.md"),
    ("Esercizi verbi 1.md", "Esercizi verbi r\u00e4tt svar.md"),
    ("Esercizi verbi 4-6.md", None),
]

EMBEDDED_ANSWER_FILES = {
    "36_esercizi_grammatica_C1 gerundio.md",
    "75_esercizi_grammatica_B2.md",
}


def parse_embedded_36(text):
    """36_esercizi_grammatica_C1 gerundio.md: one exercise section, a teacher
    note section, and a single 'Soluzioni' answer blob."""
    title, rest = strip_title_and_source(text)
    headings = split_headings(rest)
    exercise_h = None
    note_h = None
    soluzioni_h = None
    for h in headings:
        if h["level"] != 2:
            continue
        if re.search(r'istruzioni', h["text"], re.I):
            note_h = h
        elif re.search(r'^soluzioni$', h["text"], re.I):
            soluzioni_h = h
        elif exercise_h is None:
            exercise_h = h
    sections = []
    if exercise_h:
        answer_body = soluzioni_h["body"].strip() if soluzioni_h else None
        sections.append({
            "heading": exercise_h["text"],
            "body": exercise_h["body"].strip(),
            "answerBody": answer_body,
            "blanks": build_interactive_items(exercise_h["body"].strip(), answer_body),
        })
    return title, (note_h["body"].strip() if note_h else None), sections


def parse_embedded_75(text):
    """75_esercizi_grammatica_B2.md: 3 numbered exercise sections, then a
    'Soluzioni' heading with '### Esercizio N.' sub-answers."""
    title, rest = strip_title_and_source(text)
    headings = split_headings(rest)
    q_sections = []
    answers_by_num = {}
    in_soluzioni = False
    for h in headings:
        if h["level"] == 2 and re.match(r'soluzioni', h["text"], re.I):
            in_soluzioni = True
            continue
        if not in_soluzioni and h["level"] == 2:
            nm = LOOSE_NUM_HEADING_RE.match(h["text"])
            q_sections.append({
                "heading": h["text"],
                "num": nm.group(1) if nm else None,
                "body": h["body"].strip(),
            })
        elif in_soluzioni and h["level"] == 3:
            nm = LEADING_NUM_RE.search(h["text"].replace("Esercizio", "").strip())
            num = None
            em = re.search(r'(\d+)', h["text"])
            if em:
                num = em.group(1)
            if num:
                answers_by_num[num] = h["body"].strip()

    sections = []
    for q in q_sections:
        ans = answers_by_num.get(q["num"]) if q["num"] else None
        sections.append({
            "heading": q["heading"],
            "body": q["body"],
            "answerBody": ans,
            "blanks": build_interactive_items(q["body"], ans),
        })
    return title, None, sections


def parse_esercizi_files():
    """Parse standalone exercise markdown files and align them with answer keys."""
    entries = []
    for q_name, a_name in ESERCIZI_PAIRS:
        q_path = MD_DIR / q_name
        if not q_path.exists():
            print(f"WARN: missing {q_name}")
            continue
        text = read(q_path)

        if q_name in EMBEDDED_ANSWER_FILES:
            if q_name.startswith("36_"):
                title, note, sections = parse_embedded_36(text)
            else:
                title, note, sections = parse_embedded_75(text)
            entries.append({
                "title": title or q_path.stem,
                "file": q_name,
                "answerFile": None,
                "note": note,
                "hasAnswers": any(s["answerBody"] for s in sections),
                "sections": sections,
            })
            continue

        title, rest = strip_title_and_source(text)
        headings = split_headings(rest)
        q_sections = top_level_sections(headings, exclude_note_like=True)

        a_sections = []
        if a_name:
            a_path = MD_DIR / a_name
            if a_path.exists():
                a_text = read(a_path)
                _, a_rest = strip_title_and_source(a_text)
                a_headings = split_headings(a_rest)
                a_sections = top_level_sections(a_headings, exclude_note_like=True)
            else:
                print(f"WARN: missing answer file {a_name}")

        answer_bodies = match_sections(q_sections, a_sections) if a_sections else [None] * len(q_sections)

        sections = []
        for h, ans in zip(q_sections, answer_bodies):
            matching = build_matching(h["body"].strip(), ans)
            categorization = build_categorization(h["body"].strip(), ans, h["text"])
            wb = extract_word_bank(h["body"].strip())
            sections.append({
                "heading": h["text"],
                "body": h["body"].strip(),
                "answerBody": ans,
                "blanks": build_interactive_items(h["body"].strip(), ans) if not matching and not categorization else None,
                "matching": matching,
                "categorization": categorization,
                "wordBank": wb,
            })

        entries.append({
            "title": title or q_path.stem,
            "file": q_name,
            "answerFile": a_name,
            "note": None,
            "hasAnswers": any(s["answerBody"] for s in sections),
            "sections": sections,
        })
    return entries
