# -*- coding: utf-8 -*-
"""Categorization (sorting words into category columns) builder."""
import re
from .constants import _norm_ws
from .blanks import extract_word_bank


def build_categorization(body: str, answer_body: str, instruction: str = ""):
    """If body and answer_body represent a column / category classification exercise,
    return a structured representation for drag-and-drop / click-to-place categorization."""
    if not body or not answer_body:
        return None

    ans_lines = [l.strip() for l in answer_body.split("\n") if l.strip()]
    cat_lines = []
    cat_re = re.compile(r'^[-•]\s*([^:]+):\s*(.+)$')
    for l in ans_lines:
        m = cat_re.match(l)
        if m:
            cat_title = m.group(1).strip()
            # Ignore non-category lines like "- Nomi propri corretti:" or metadata
            if re.search(r'^(?:elenco|nota|corretti)\b', cat_title, re.I):
                continue
            items_raw = m.group(2).strip()
            items = [w.strip() for w in items_raw.split(",") if w.strip()]
            if items:
                cat_lines.append((cat_title, items))

    if len(cat_lines) < 2:
        return None

    # Get word bank from body (bullet separated line)
    wb = extract_word_bank(body)

    # If no word bank line in body, check if there's an 'Elenco:' in answer_body
    if not wb:
        for l in ans_lines:
            if l.lower().startswith("elenco:"):
                elenco_text = l[len("elenco:"):].strip()
                wb = [w.strip() for w in re.split(r'[,•]', elenco_text) if w.strip()]
                break

    # If still no word bank, collect items from categories
    if not wb:
        wb = [item for _, items in cat_lines for item in items]

    categories = []
    cat_map = {}
    for idx, (cat_title, items) in enumerate(cat_lines):
        cat_id = f"cat_{idx}"
        categories.append({"id": cat_id, "title": cat_title})
        for itm in items:
            cat_map[itm.strip().lower()] = (cat_id, itm.strip())

    items_out = []
    for idx, w in enumerate(wb):
        w_clean = w.strip()
        w_norm = w_clean.lower()
        if w_norm in cat_map:
            cat_id, facit_text = cat_map[w_norm]
        else:
            # Fallback search without punctuation or extra spaces
            found = False
            for k, (cid, ftext) in cat_map.items():
                if _norm_ws(k) == _norm_ws(w_norm):
                    cat_id, facit_text = cid, ftext
                    found = True
                    break
            if not found:
                return None

        items_out.append({
            "id": f"w_{idx}",
            "text": w_clean,
            "facitText": facit_text,
            "targetCat": cat_id,
        })

    if not items_out:
        return None

    return {
        "categories": categories,
        "items": items_out,
    }
