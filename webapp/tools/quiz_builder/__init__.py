# -*- coding: utf-8 -*-
"""Quiz builder module for converting markdown exercises to quiz data."""
import json
from .constants import OUT_FILE
from .scheda_parser import parse_scheda_files, parse_soluzioni_files
from .esercizi_parser import parse_esercizi_files
from .matching import build_matching
from .passage import build_passage_marking
from .categorization import build_categorization
from .blanks import build_interactive_items, extract_word_bank


def build_all_data():
    """Build all schede and esercizi data and return the full dictionary."""
    schede = parse_scheda_files()
    answer_map = parse_soluzioni_files()

    matched = 0
    total = 0
    for s in schede:
        for ex in s["exercises"]:
            total += 1
            ans = answer_map.get(s["id"], {}).get(ex["num"])
            ex["answerBody"] = ans
            matching = build_matching(ex["body"], ans)
            passage = build_passage_marking(ex["body"], ans, ex["instruction"])
            categorization = build_categorization(ex["body"], ans, ex["instruction"])
            wb = extract_word_bank(ex["body"])
            ex["matching"] = matching
            ex["passage"] = passage
            ex["categorization"] = categorization
            ex["wordBank"] = wb
            ex["blanks"] = build_interactive_items(ex["body"], ans) if not matching and not passage and not categorization else None
            if ans:
                matched += 1
    print(f"Scheda exercises: {total}, matched with an answer: {matched}")

    esercizi = parse_esercizi_files()
    es_total = sum(len(e["sections"]) for e in esercizi)
    es_matched = sum(1 for e in esercizi for s in e["sections"] if s["answerBody"])
    print(f"Esercizi sections: {es_total}, matched with an answer: {es_matched}")

    return {"schede": schede, "esercizi": esercizi}


def main():
    """Entrypoint to build quiz data and write to data.js."""
    data = build_all_data()
    OUT_FILE.write_text(
        "window.QUIZ_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_FILE}")
