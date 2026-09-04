# -*- coding: utf-8 -*-
"""Column matching exercise builder."""
import re


def build_matching(body: str, answer_body: str):
    """If body and answer_body represent a column-matching exercise,
    return a structured list of matching groups for drag-and-drop / click-to-pair."""
    if not body or not answer_body:
        return None

    ans_lines = [l.strip() for l in answer_body.split("\n") if l.strip()]
    pair_re = re.compile(r"^(?:[-\u2022]\s*)?(\d+)[\.\)]\s*(.*?)\s*(?:→|➜|->)\s*([a-z])[\.\)]\s*(.*)$", re.I)

    ans_groups = []
    current_pairs = []
    for al in ans_lines:
        m = pair_re.match(al)
        if m:
            num = m.group(1)
            left_text = re.sub(r"\*\*", "", m.group(2)).strip()
            letter = m.group(3).lower()
            right_text = re.sub(r"\*\*", "", m.group(4)).strip()
            current_pairs.append({
                "num": num,
                "left": left_text,
                "letter": letter,
                "right": right_text,
            })
        elif re.search(r"gruppo", al, re.I) and current_pairs:
            ans_groups.append(current_pairs)
            current_pairs = []
    if current_pairs:
        ans_groups.append(current_pairs)

    if not ans_groups:
        return None

    body_blocks = [b.strip() for b in body.split("\n\n") if b.strip()]
    matching_result = []

    if len(ans_groups) == 2 and len(body_blocks) >= 4:
        b_left1 = [l.strip() for l in body_blocks[0].split("\n") if l.strip()]
        b_right1 = [l.strip() for l in body_blocks[1].split("\n") if l.strip()]
        b_left2 = [l.strip() for l in body_blocks[2].split("\n") if l.strip()]
        b_right2 = [l.strip() for l in body_blocks[3].split("\n") if l.strip()]

        ans_map1 = {p["num"]: p["letter"] for p in ans_groups[0]}
        left1 = []
        for l in b_left1:
            m_l = re.match(r"^(\d+)[\.\)]\s*(.*)$", l)
            if m_l:
                n = m_l.group(1)
                left1.append({"id": n, "text": l, "ans": ans_map1.get(n, "")})
        right1 = []
        for r in b_right1:
            m_r = re.match(r"^([a-z])[\.\)]\s*(.*)$", r, re.I)
            if m_r:
                let = m_r.group(1).lower()
                right1.append({"id": let, "text": r})

        ans_map2 = {p["num"]: p["letter"] for p in ans_groups[1]}
        left2 = []
        for l in b_left2:
            m_l = re.match(r"^(\d+)[\.\)]\s*(.*)$", l)
            if m_l:
                n = m_l.group(1)
                left2.append({"id": n, "text": l, "ans": ans_map2.get(n, "")})
        right2 = []
        for r in b_right2:
            m_r = re.match(r"^([a-z])[\.\)]\s*(.*)$", r, re.I)
            if m_r:
                let = m_r.group(1).lower()
                right2.append({"id": let, "text": r})

        if left1 and right1 and left2 and right2:
            matching_result.append({"groupTitle": "Primo gruppo (Tozzi)", "left": left1, "right": right1})
            matching_result.append({"groupTitle": "Secondo gruppo (Silvestri)", "left": left2, "right": right2})
    elif len(ans_groups) == 1:
        ans_map = {p["num"]: p["letter"] for p in ans_groups[0]}
        b_lines = [l.strip() for l in body.split("\n") if l.strip()]
        left = []
        right = []
        for l in b_lines:
            m_l = re.match(r"^(\d+)[\.\)]\s*(.*)$", l)
            m_r = re.match(r"^([a-z])[\.\)]\s*(.*)$", l, re.I)
            if m_l:
                n = m_l.group(1)
                left.append({"id": n, "text": l, "ans": ans_map.get(n, "")})
            elif m_r:
                let = m_r.group(1).lower()
                right.append({"id": let, "text": l})
        if left and right:
            matching_result.append({"groupTitle": None, "left": left, "right": right})

    return matching_result if matching_result else None
