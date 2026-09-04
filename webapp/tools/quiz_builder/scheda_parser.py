# -*- coding: utf-8 -*-
"""Parser for scheda (lesson + exercises) and soluzioni (answer keys) files."""
import re
from .constants import (
    MD_DIR,
    EXERCISE_HEADING_RE,
    SCHEDA_NUM_IN_TITLE_RE,
)
from .helpers import (
    read,
    split_headings,
    strip_title_and_source,
)


def parse_scheda_files():
    """Parse all 40 scheda*.md files into a list of schede with theory and exercises."""
    schede = []
    for path in MD_DIR.glob("scheda*.md"):
        m = re.match(r'scheda(\d+)_', path.name)
        if not m:
            print(f"WARN: could not extract scheda number from {path.name}")
            continue
        num = int(m.group(1))
        text = read(path)
        title, rest = strip_title_and_source(text)
        headings = split_headings(rest)

        exercises = []
        theory_parts = []
        for h in headings:
            em = EXERCISE_HEADING_RE.match(h["text"])
            if em:
                ex_num = em.group(1)
                ex_instr = em.group(2).strip()
                ex_body = h["body"].strip()
                # Special fix for Scheda 5 Exercise 02 where words were asterisked instead of italicized in markdown
                if num == 5 and ex_num == "02":
                    ex_body = re.sub(r'[\*_]([a-zA-ZàèéìòùÀÈÉÌÒÙ\']+)[\*_]', r'*\1*', ex_body)
                exercises.append({
                    "num": ex_num,
                    "instruction": ex_instr,
                    "body": ex_body,
                })
            elif not exercises:
                theory_parts.append("#" * h["level"] + " " + h["text"] + "\n" + h["body"])

        schede.append({
            "id": num,
            "title": title or path.stem,
            "file": path.name,
            "theory": "\n\n".join(theory_parts).strip(),
            "exercises": exercises,
        })
    schede.sort(key=lambda s: s["id"])
    return schede


def parse_soluzioni_files():
    """Parse all 8 soluzioni-*.md files into answer_map[scheda_num][exercise_num]."""
    answer_map = {}
    for path in sorted(MD_DIR.glob("soluzioni-*.md")):
        text = read(path)
        _, rest = strip_title_and_source(text)
        headings = split_headings(rest)

        current_scheda = None
        for h in headings:
            if h["level"] == 2:
                sm = SCHEDA_NUM_IN_TITLE_RE.search(h["text"])
                if sm:
                    current_scheda = int(sm.group(1))
                continue
            if h["level"] in (3, 4) and current_scheda is not None:
                em = EXERCISE_HEADING_RE.match(h["text"])
                if em:
                    body = h["body"].strip()
                    # Ta bort avslutande "---" separator som hör till nästa scheda, inte övningen
                    body = re.sub(r"\n---+\s*$", "", body).strip()
                    body = re.sub(r"^---+\n", "", body).strip()
                    answer_map.setdefault(current_scheda, {})[em.group(1)] = body
    return answer_map
