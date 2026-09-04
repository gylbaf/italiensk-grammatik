# -*- coding: utf-8 -*-
"""Parsing and building interactive fill-in-the-blank and choice exercises."""
import re
from .constants import BOLD_RE, _norm_ws


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
    facit line."""
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
    """If body and answer_body line up 1:1, and lines have slash-separated choices
    with facit bolded, return structured choice segments."""
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
                    # Last part is always "<article> <noun>" (e.g. "il esercito", "i articoli")
                    # Take first word as option, rest as suffix
                    optN = words[0]
                    suffix = pN[len(optN):]

            q_parts = q_line.split(" / ")
            if len(q_parts) == len(parts):
                q_pN = q_parts[-1]
                # Use word-boundary search to avoid matching inside noun (e.g. "i" in "articoli", "le" in "generale")
                m_q = re.search(r'(^|\s)' + re.escape(optN) + r'(\s|$)', q_pN)
                if m_q:
                    # suffix is everything after the option word in q_pN
                    opt_end = m_q.start() + len(m_q.group(0).rstrip()) if m_q.group(0).strip() == optN else q_pN.find(optN) + len(optN)
                    # simpler: find first occurrence with boundary
                    idx = q_pN.find(optN)
                    # ensure boundary
                    while idx != -1:
                        before_ok = idx == 0 or q_pN[idx-1].isspace()
                        after_ok = idx + len(optN) == len(q_pN) or q_pN[idx+len(optN)].isspace()
                        if before_ok and after_ok:
                            suffix = q_pN[idx + len(optN):]
                            break
                        idx = q_pN.find(optN, idx + 1)

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


def build_mark_and_replace(body: str, answer_body: str):
    """If body and answer_body line up 1:1, and lines require circling a word
    and replacing via blank, return markable + blank segments."""
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


def build_blanks(body: str, answer_body: str):
    """If body and answer_body line up 1:1, resolve blanks to answer words."""
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


def build_interactive_items(body: str, answer_body: str):
    """Try building mark-and-replace items, fill-in-the-blank items, then choice items."""
    mark_items = build_mark_and_replace(body, answer_body)
    if mark_items is not None:
        return mark_items

    blanks = build_blanks(body, answer_body)
    if blanks is not None:
        return blanks

    clean_b, clean_a = clean_word_bank_lines(body, answer_body)
    blanks_clean = build_blanks(clean_b, clean_a)
    if blanks_clean is not None:
        return blanks_clean

    return build_choices(body, answer_body)
