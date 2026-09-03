# -*- coding: utf-8 -*-
"""
Parses all transcribed .md files in ../../md/ into a single JSON data file
consumed by the static quiz webapp (../data.js).

Run with:  py build_quiz_data.py
(from this folder, or any folder - paths are computed relative to this file)
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent          # ".../Italiensk grammatik"
MD_DIR = ROOT / "md"
OUT_FILE = HERE.parent / "data.js"

HEADING_RE = re.compile(r'^(#{1,4})\s+(.*?)\s*$', re.MULTILINE)
EXERCISE_HEADING_RE = re.compile(r'^(\d{2})\s*\u2022\s*(.*)$')  # "01 • Instruction"
LOOSE_NUM_HEADING_RE = re.compile(r'^(\d+)[\.\)]\s*(.*)$')       # "1. Instruction"
SCHEDA_NUM_IN_TITLE_RE = re.compile(r'Scheda\s+(\d+)', re.I)
LEADING_NUM_RE = re.compile(r'^\s*(\d+)')
BOLD_RE = re.compile(r'\*\*(.+?)\*\*')


def _norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip())


def try_arrow_or_dash_line_answers(q_line: str, a_line: str, n_blanks: int):
    """Fallback for single-blank lines where the facit uses an arrow or dash
    separator to provide the transformed phrase (e.g. '1. una finestra ➜ ___'
    -> '1. una finestra → le finestre', or '1. l'omicida ___' -> '1. l'omicida – gli omicidi')."""
    if n_blanks != 1:
        return None
    a_clean = re.sub(r'^[-\u2022]\s*', '', a_line.strip())
    a_clean = re.sub(r'\s*\([^)]*(?:esempio|modello)[^)]*\)\s*$', '', a_clean, flags=re.I)

    bolds = BOLD_RE.findall(a_clean)
    if len(bolds) == 1:
        return [bolds[0].strip()]

    sep_pattern = r'\s*(?:➜|→|->|—|–)\s*'
    a_parts = re.split(sep_pattern, a_clean)
    q_parts = re.split(sep_pattern, q_line)

    if len(a_parts) == 2 and len(q_parts) == 2:
        if "___" in q_parts[1]:
            ans = a_parts[1].strip()
            return [ans]
        elif "___" in q_parts[0]:
            ans = a_parts[0].strip()
            ans = re.sub(r'^\d+[\.\)]\s*', '', ans)
            return [ans]

    if len(a_parts) == 2:
        return [a_parts[1].strip()]

    return None


def try_slash_line_answers(q_line: str, a_line: str, n_blanks: int):
    """Fallback for lines where the facit doesn't use **bold** at all but
    instead repeats each blank's filled phrase, separated by ' / ', in the
    same order as the blanks (e.g. q: '___ pesce ___ albero',
    a: '- il pesce / l' albero'). Deliberately narrow: only fires when
    there are >= 2 blanks on the line AND a literal '/' is present in the
    facit line, so it can't misfire on ordinary single-blank sentences that
    merely happen to have one '/'-free facit segment (that produced wrong
    answers for e.g. scheda3 ex03 / scheda7 ex01 / scheda20 ex01 during
    development — don't loosen this without re-checking those). Only
    returns answers when the shared text after each blank (the noun) can be
    found as a validated suffix of the corresponding segment — if it can't
    be validated, returns None rather than guessing."""
    if n_blanks < 2 or "/" not in a_line:
        return None
    a_clean = re.sub(r'^[\-\u2022]\s*', '', a_line.strip())
    a_clean = re.sub(r'\s*\([^)]*\)\s*$', '', a_clean)  # drop trailing "(esempio)" etc.
    segments = [s.strip() for s in a_clean.split('/')]
    if len(segments) != n_blanks:
        return None
    q_parts = q_line.split("___")  # length n_blanks + 1
    answers = []
    for i in range(n_blanks):
        following = _norm_ws(q_parts[i + 1]) if i + 1 < len(q_parts) else ""
        seg = _norm_ws(segments[i])
        if not seg:
            return None
        if following:
            if len(following) >= len(seg) or not seg.lower().endswith(following.lower()):
                return None
            answer_word = seg[: len(seg) - len(following)].strip()
        else:
            answer_word = seg
        if not answer_word or "*" in answer_word:
            return None
        answers.append(answer_word)
    return answers


def build_choices(body: str, answer_body: str):
    """If `body` (question) and `answer_body` (facit) line up 1:1, and every
    line has slash-separated choice options (e.g. '1. il / lo / un zio', or
    multiple choice groups on a line like '3. Kilimangiaro / Il Kilimangiaro è un monte di Africa / dell'Africa.')
    and the answer line highlights the correct choice with '**bold**', return a structured
    line-by-line representation with 'choice' segments for interactive selection."""
    if not body or not answer_body:
        return None
    if "___" in body:
        return None

    q_lines = [l for l in body.split("\n") if l.strip() != ""]
    a_lines = [l for l in answer_body.split("\n") if l.strip() != ""]
    if len(q_lines) != len(a_lines):
        return None

    lines = []
    total_choices = 0
    for q_line, a_line in zip(q_lines, a_lines):
        a_clean = re.sub(r'\s*\([^)]*(?:PDF|esempio|sotto)[^)]*\)\s*$', '', a_line.strip())
        if " / " not in a_clean or "**" not in a_clean:
            return None

        bolds = list(BOLD_RE.finditer(a_clean))
        if not bolds:
            return None

        if len(bolds) == 1:
            parts = a_clean.split(" / ")
            p0 = parts[0]
            if "**" in p0:
                m0 = re.search(r'^(.*?)\*\*(.+?)\*\*(.*)$', p0)
                prefix = m0.group(1)
                opt0 = m0.group(2)
            else:
                m_num = re.match(r'^(\s*(?:\d+[\.\)]\s*)?)(.*)$', p0)
                num_prefix = m_num.group(1) if m_num else ""
                rest0 = m_num.group(2) if m_num else p0
                words = rest0.split()
                if not words:
                    return None
                if len(words) == 1:
                    prefix = num_prefix
                    opt0 = words[0]
                elif len(words) == 2 and words[0].lower() in ("da", "di", "in", "a", "su", "per", "con", "del", "della", "dei"):
                    prefix = num_prefix
                    opt0 = rest0
                else:
                    bold_word_count = len(bolds[0].group(1).split())
                    if len(words) >= bold_word_count + 1 and words[-bold_word_count-1].lower() in ("il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "un'", "da", "di", "in", "a"):
                        opt_words = words[-bold_word_count-1:]
                    elif len(words) >= bold_word_count and words[-bold_word_count].lower() in ("il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "un'", "da", "di", "in", "a"):
                        opt_words = words[-bold_word_count:]
                    else:
                        opt_words = [words[-1]]
                    opt0 = " ".join(opt_words)
                    prefix = num_prefix + rest0[: len(rest0) - len(opt0)]

            pN = parts[-1]
            if "**" in pN:
                mN = re.search(r'^(.*?)\*\*(.+?)\*\*(.*)$', pN)
                optN = mN.group(2)
                suffix = mN.group(3)
            else:
                words = pN.split()
                if not words:
                    return None
                if len(words) == 1:
                    optN = words[0]
                    suffix = ""
                else:
                    bold_word_count = len(bolds[0].group(1).split())
                    if words[0].lower() in ("il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "un'", "dal", "del", "dalla", "dello"):
                        opt_len = bold_word_count + (0 if bolds[0].group(1).split()[0].lower() in ("il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "un'", "dal", "del", "dalla", "dello") else 1)
                        opt_len = min(len(words), max(1, opt_len))
                    else:
                        opt_len = 1
                    optN = " ".join(words[:opt_len])
                    suffix = pN[len(optN):]

            mid_opts = []
            for p in parts[1:-1]:
                m = BOLD_RE.search(p)
                if m:
                    mid_opts.append(m.group(1).strip())
                else:
                    mid_opts.append(p.strip())

            all_opts = [opt0.strip()] + mid_opts + [optN.strip()]
            ans = bolds[0].group(1).strip()
            if ans not in all_opts:
                clean_ans = ans.rstrip(".").strip()
                if clean_ans in all_opts:
                    ans = clean_ans
                else:
                    return None

            segments = []
            if prefix:
                segments.append({"t": "text", "v": prefix})
            segments.append({"t": "choice", "i": 0, "options": all_opts, "answer": ans})
            if suffix:
                segments.append({"t": "text", "v": suffix})

            lines.append({"segments": segments, "answers": [ans]})
            total_choices += 1

        else:
            # Multiple bold matches on the line
            segments = []
            answers = []
            mid_text = a_clean[bolds[0].end():bolds[1].start()]
            slash_pos = mid_text.find("/")
            before_slash = mid_text[:slash_pos].rstrip()
            words_before = before_slash.split()
            opt_words_cnt = 2 if len(words_before) >= 2 and words_before[-2].lower() in ("da", "di", "in", "a", "su", "per", "con") else 1
            opt_before_slash = " ".join(words_before[-opt_words_cnt:])
            bridge_text = before_slash[:len(before_slash) - len(opt_before_slash)]

            prefix_0 = a_clean[:bolds[0].start()]
            parts_0 = prefix_0.split(" / ")
            m_num = re.match(r"^(\s*(?:\d+[\.\)]\s*)?)(.*)$", parts_0[0])
            num_pfx = m_num.group(1) if m_num else ""
            opt_0_left = m_num.group(2).strip() if m_num else parts_0[0].strip()
            opt_0_ans = bolds[0].group(1).strip()

            if num_pfx:
                segments.append({"t": "text", "v": num_pfx})
            segments.append({"t": "choice", "i": 0, "options": [opt_0_left, opt_0_ans], "answer": opt_0_ans})
            answers.append(opt_0_ans)

            if bridge_text:
                segments.append({"t": "text", "v": bridge_text})

            opt_1_left = opt_before_slash
            opt_1_ans = bolds[1].group(1).strip()
            suffix_1 = a_clean[bolds[1].end():]

            segments.append({"t": "choice", "i": 1, "options": [opt_1_left, opt_1_ans], "answer": opt_1_ans})
            answers.append(opt_1_ans)

            if suffix_1:
                segments.append({"t": "text", "v": suffix_1})

            lines.append({"segments": segments, "answers": answers})
            total_choices += len(answers)

    if total_choices == 0:
        return None
    return lines


def build_passage_marking(body: str, answer_body: str, instruction: str = ""):
    """If exercise is an interactive passage underline / capitalize exercise
    (such as Scheda 4 Ex 01 'Sottolinea nel brano i nomi comuni e metti la lettera maiuscola...'),
    return a structured token list for interactive word clicking/underlining."""
    if not body or not answer_body:
        return None
    if not re.search(r"sottolinea\s+nel\s+brano", (instruction or "") + " " + (answer_body or ""), re.I):
        return None

    common_nouns = {
        "sindaco", "guida", "auto", "concittadini", "trasporto", "comune",
        "abitanti", "confine", "mesi", "autobus", "cantiere", "strada",
        "società", "linea", "servizio", "cittadino", "utenti", "fermata",
        "chilometri", "paese"
    }
    proper_nouns = {
        "drezzo": "Drezzo",
        "como": "Como",
        "svizzera": "Svizzera",
        "spt": "SPT",
        "lorenzo": "Lorenzo",
        "canepa": "Canepa",
        "fiat": "Fiat"
    }

    p_text = re.sub(r"\(da\s+«.*?».*?\)", "", body).strip()
    pattern = re.compile(r"([a-zA-ZàèéìòùÀÈÉÌÒÙ']+|[^\w\s]+|\s+)")
    tokens = []
    word_id = 0

    for m in pattern.finditer(p_text):
        s = m.group(1)
        if s.isspace() or re.match(r"^[^\w\s]+$", s):
            tokens.append({"t": "raw", "v": s})
        else:
            m_apo = re.match(r"^(dell'|l')(.*)$", s, re.I)
            if m_apo:
                tokens.append({"t": "raw", "v": m_apo.group(1)})
                word = m_apo.group(2)
            else:
                word = s
            clean_w = word.lower()
            if clean_w in common_nouns:
                tokens.append({"t": "word", "id": word_id, "v": word, "role": "common"})
                word_id += 1
            elif clean_w in proper_nouns:
                tokens.append({"t": "word", "id": word_id, "v": word, "role": "proper", "cap": proper_nouns[clean_w]})
                word_id += 1
            else:
                tokens.append({"t": "word", "id": word_id, "v": word, "role": "none"})
                word_id += 1

    total_target = len([t for t in tokens if t.get("role") in ("common", "proper")])
    if total_target == 0:
        return None

    return {
        "tokens": tokens,
        "totalItems": total_target,
    }


def build_matching(body: str, answer_body: str):
    """If `body` and `answer_body` represent a column-matching exercise
    (e.g. Scheda 3 Ex 02 'Unisci con una freccia ciascun nome...'),
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
        # 2 distinct matching groups (e.g. Primo gruppo, Secondo gruppo)
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


def build_mark_and_replace(body: str, answer_body: str):
    """If `body` (question) and `answer_body` (facit) line up 1:1, and lines
    require circling a word (e.g. partitive article) in the sentence and replacing
    it via a blank (e.g. '1. Per favore, dammi dei soldi... ___' ->
    '1. Per favore, dammi **dei** soldi... → **un po\' di soldi**'), return a
    structured representation with 'markable' and 'blank' segments."""
    if not body or not answer_body:
        return None
    q_lines = [l for l in body.split("\n") if l.strip() != ""]
    a_lines = [l for l in answer_body.split("\n") if l.strip() != ""]
    if len(q_lines) != len(a_lines):
        return None

    lines = []
    total = 0
    for q_line, a_line in zip(q_lines, a_lines):
        a_clean = re.sub(r"^[-\u2022]\s*", "", a_line.strip())
        parts = re.split(r"\s*(?:→|➜|->)\s*", a_clean)
        if len(parts) != 2:
            return None

        sentence_part, replace_part = parts[0], parts[1]
        m_bold = re.search(r"\*\*(.+?)\*\*", sentence_part)
        if not m_bold:
            return None
        target = m_bold.group(1).strip()
        clean_sentence = re.sub(r"\*\*", "", sentence_part).strip()

        clean_replace = re.sub(r"\*\*", "", replace_part).strip()
        m_unpo = re.match(r"^un\s*po\'\s*di\s+(.*)$", clean_replace, re.I)
        if m_unpo:
            noun = m_unpo.group(1).strip()
            prompt_prefix = " ➜ un po' di "
        else:
            noun = clean_replace
            prompt_prefix = " ➜ "

        m_num = re.match(r"^(\d+[\.\)]\s*)(.*)$", clean_sentence)
        num_prefix = m_num.group(1) if m_num else ""
        sentence_text = m_num.group(2) if m_num else clean_sentence

        segments = [
            {"t": "text", "v": num_prefix},
            {"t": "markable", "sentence": sentence_text, "target": target, "i": 0},
            {"t": "text", "v": prompt_prefix},
            {"t": "blank", "i": 0, "answers": [noun, clean_replace]},
        ]
        lines.append({"segments": segments, "answers": [target, noun]})
        total += 1

    if total == 0:
        return None
    return lines


def extract_word_bank(body: str):
    """Extract bullet-separated list of words (word bank) from body if present."""
    if not body:
        return None
    lines = [l.strip() for l in body.split("\n") if l.strip()]
    for l in lines:
        if "•" in l and not re.match(r"^\d+[\.\)]", l):
            words = [w.strip() for w in l.split("•") if w.strip()]
            if len(words) >= 3:
                return words
    return None


def clean_word_bank_lines(body: str, answer_body: str):
    """Remove word bank bullet line from body and Elenco header from answerBody."""
    if not body or not answer_body:
        return body, answer_body
    b_lines = [l for l in body.split("\n") if not ("•" in l and not re.match(r"^\d+[\.\)]", l.strip()))]
    a_lines = [l for l in answer_body.split("\n") if not l.strip().lower().startswith("elenco:")]
    return "\n".join(b_lines).strip(), "\n".join(a_lines).strip()


def build_interactive_items(body: str, answer_body: str):
    """Try building mark-and-replace items, fill-in-the-blank items, then choice items."""
    mark_items = build_mark_and_replace(body, answer_body)
    if mark_items is not None:
        return mark_items

    # Try standard blanks, or cleaned blanks if word bank present
    blanks = build_blanks(body, answer_body)
    if blanks is not None:
        return blanks

    clean_b, clean_a = clean_word_bank_lines(body, answer_body)
    blanks_clean = build_blanks(clean_b, clean_a)
    if blanks_clean is not None:
        return blanks_clean

    return build_choices(body, answer_body)


def build_blanks(body: str, answer_body: str):
    """If `body` (question) and `answer_body` (facit) line up 1:1, and every
    line's blanks can be resolved to answer words — either via '**bold**'
    words in the facit (one per '___'), or via the ' / '-separated
    same-line fallback (see try_slash_line_answers) — return a structured
    line-by-line representation suitable for rendering inline <input>
    fields and auto-grading them. Otherwise return None (the UI falls back
    to whole-block self-assessment for that exercise)."""
    if not body or not answer_body:
        return None
    q_lines = [l for l in body.split("\n") if l.strip() != ""]
    a_lines = [l for l in answer_body.split("\n") if l.strip() != ""]
    if len(q_lines) != len(a_lines):
        return None

    lines = []
    total_blanks = 0
    for q_line, a_line in zip(q_lines, a_lines):
        if re.search(r'\b(?:esempio|modello)\b', a_line, re.I) and not re.match(r'^\s*\d+[\.\)]', q_line):
            lines.append({"segments": [{"t": "text", "v": re.sub(r'^[-\u2022]\s*', '', a_line.strip())}], "answers": []})
            continue

        n_blanks = q_line.count("___")
        if n_blanks == 0:
            lines.append({"segments": [{"t": "text", "v": q_line}], "answers": []})
            continue

        # Handle (–) or (-) or **(–)** representing empty/no article needed
        a_line_norm = re.sub(r'\*?\*?\([–\-]\)\*?\*?', '**–**', a_line)
        bold_answers = BOLD_RE.findall(a_line_norm)
        if len(bold_answers) == n_blanks:
            answers = []
            accepted_list = []
            for a in bold_answers:
                a_clean = a.strip()
                if a_clean in ('–', '-'):
                    answers.append('–')
                    accepted_list.append(['–', '-', '', '(–)', 'nessuno', 'no', '/'])
                else:
                    answers.append(a_clean)
                    accepted_list.append([a_clean])
        else:
            answers = try_arrow_or_dash_line_answers(q_line, a_line, n_blanks)
            accepted_list = [[ans] for ans in answers] if answers else None
            if answers is None:
                answers = try_slash_line_answers(q_line, a_line, n_blanks)
                accepted_list = [[ans] for ans in answers] if answers else None
                if answers is None:
                    return None

        total_blanks += n_blanks
        parts = q_line.split("___")
        segments = []
        for i, part in enumerate(parts):
            if part:
                segments.append({"t": "text", "v": part})
            if i < len(parts) - 1:
                seg_blank = {"t": "blank", "i": i}
                if accepted_list and i < len(accepted_list):
                    seg_blank["answers"] = accepted_list[i]
                segments.append(seg_blank)
        lines.append({"segments": segments, "answers": answers})

    if total_blanks == 0:
        return None
    return lines


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def split_headings(text: str):
    """Return list of dicts: level, text, start, end (char offsets of the body,
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


# ---------------------------------------------------------------------------
# 1. Parse the 40 scheda*.md files
# ---------------------------------------------------------------------------

def parse_scheda_files():
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
                exercises.append({
                    "num": em.group(1),
                    "instruction": em.group(2).strip(),
                    "body": h["body"].strip(),
                })
            elif not exercises:
                # still in the theory part (before the first exercise heading)
                theory_parts.append("#" * h["level"] + " " + h["text"] + "\n" + h["body"])
            # headings appearing between exercises that aren't numbered
            # (shouldn't normally happen) are ignored for quiz purposes.

        schede.append({
            "id": num,
            "title": title or path.stem,
            "file": path.name,
            "theory": "\n\n".join(theory_parts).strip(),
            "exercises": exercises,
        })
    schede.sort(key=lambda s: s["id"])
    return schede


# ---------------------------------------------------------------------------
# 2. Parse the 8 soluzioni-*.md files into answer_map[scheda_num][exercise_num]
# ---------------------------------------------------------------------------

def parse_soluzioni_files():
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
                    answer_map.setdefault(current_scheda, {})[em.group(1)] = h["body"].strip()
    return answer_map


# ---------------------------------------------------------------------------
# 3. Parse the standalone "Esercizi ..." files (with/without a separate
#    answer-key file, or with answers embedded in the same file)
# ---------------------------------------------------------------------------

# (question_file, answer_file_or_None)
ESERCIZI_PAIRS = [
    ("36_esercizi_grammatica_C1 gerundio.md", None),
    ("75_esercizi_grammatica_B2.md", None),
    ("ED test_di_ammissione_M1.md", None),
    ("Esercizi 2 pronomen.md", "Esercizi 2 r\u00e4tt svar.md"),
    ("Esercizi gerundio participio.md", "Esercizi gerundio participio svar.md"),
    ("Esercizi lezione  1.md", None),
    ("Esercizi per il 16 marzo.md", "Esercizi per il 16 marzo con risposte.md"),
    ("Esercizi pronomi 1.md", "Esercizi pronomi 1 r\u00e4tt svar.md"),
    ("Esercizi verbi 1.md", "Esercizi verbi r\u00e4tt svar.md"),
    ("Esercizi verbi 4-6.md", None),
]

EMBEDDED_ANSWER_FILES = {
    "36_esercizi_grammatica_C1 gerundio.md",
    "75_esercizi_grammatica_B2.md",
}


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
            wb = extract_word_bank(h["body"].strip())
            sections.append({
                "heading": h["text"],
                "body": h["body"].strip(),
                "answerBody": ans,
                "blanks": build_interactive_items(h["body"].strip(), ans) if not matching else None,
                "matching": matching,
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


def main():
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
            wb = extract_word_bank(ex["body"])
            ex["matching"] = matching
            ex["passage"] = passage
            ex["wordBank"] = wb
            ex["blanks"] = build_interactive_items(ex["body"], ans) if not matching and not passage else None
            if ans:
                matched += 1
    print(f"Scheda exercises: {total}, matched with an answer: {matched}")

    esercizi = parse_esercizi_files()
    es_total = sum(len(e["sections"]) for e in esercizi)
    es_matched = sum(1 for e in esercizi for s in e["sections"] if s["answerBody"])
    print(f"Esercizi sections: {es_total}, matched with an answer: {es_matched}")

    data = {"schede": schede, "esercizi": esercizi}
    OUT_FILE.write_text(
        "window.QUIZ_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_FILE}")


if __name__ == "__main__":
    main()
