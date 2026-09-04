# -*- coding: utf-8 -*-
"""Markdown text extraction and heading manipulation helpers."""
import re
from pathlib import Path
from .constants import HEADING_RE


def read(path: Path) -> str:
    """Read a text file in utf-8 encoding."""
    return path.read_text(encoding="utf-8")


def split_headings(text: str):
    """Return list of dicts: level, text, body (char offsets of the body,
    i.e. right after the heading line until the next heading or EOF)."""
    matches = list(HEADING_RE.finditer(text))
    out = []
    for i, m in enumerate(matches):
        level = len(m.group(1))
        heading_text = m.group(2).strip()
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        out.append({
            "level": level,
            "text": heading_text,
            "body": text[body_start:body_end].strip("\n"),
        })
    return out


def strip_title_and_source(text: str):
    """Remove the leading '# Title' and '*Källa: ...*' lines, return the rest."""
    lines = text.split("\n")
    idx = 0
    title = None
    while idx < len(lines):
        line = lines[idx].strip()
        if line.startswith("# ") and title is None:
            title = line[2:].strip()
            idx += 1
            continue
        if line.startswith("*K\u00e4lla:") or line == "":
            idx += 1
            continue
        break
    return title, "\n".join(lines[idx:])


def normalize_heading(s: str) -> str:
    """Normalize heading for fuzzy/exact matching between questions and answer keys."""
    s = s.strip()
    # strip leading numbering like "01 • " or "1. " or "3)"
    s = re.sub(r'^\d{1,2}\s*[\u2022\.\)]\s*', '', s)
    # strip trailing "– svar" / "- facit" / "(facit)" / "– risposte" style suffixes
    s = re.sub(r'[\-\u2013\u2014]\s*(svar|facit|risposte|soluzioni)\s*$', '', s, flags=re.I)
    s = re.sub(r'\(\s*(facit|svar|risposte)\s*\)', '', s, flags=re.I)
    s = s.lower()
    s = re.sub(r'[^\w\s\u00e0\u00e8\u00e9\u00ec\u00f2\u00f9]', '', s, flags=re.UNICODE)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def top_level_sections(headings, exclude_note_like=False):
    """Level-2 headings, in order. Optionally drop headings that look like
    teacher notes rather than quiz content."""
    out = []
    for h in headings:
        if h["level"] != 2:
            continue
        if exclude_note_like and re.search(r'istruzioni', h["text"], re.I):
            continue
        out.append(h)
    return out


def match_sections(q_sections, a_sections):
    """Best-effort matching of question sections to answer sections by
    normalized heading text (exact, then prefix). Returns list same length
    as q_sections, each element the matched answer body or None."""
    used = set()
    results = [None] * len(q_sections)
    norm_a = [normalize_heading(a["text"]) for a in a_sections]

    for i, q in enumerate(q_sections):
        nq = normalize_heading(q["text"])
        # exact match
        for j, na in enumerate(norm_a):
            if j in used:
                continue
            if na == nq and nq:
                results[i] = a_sections[j]["body"].strip()
                used.add(j)
                break
        if results[i] is not None:
            continue
        # prefix match (either direction), require reasonable length
        for j, na in enumerate(norm_a):
            if j in used:
                continue
            if not na or not nq:
                continue
            if len(nq) >= 8 and len(na) >= 8 and (na.startswith(nq) or nq.startswith(na)):
                results[i] = a_sections[j]["body"].strip()
                used.add(j)
                break
    return results
