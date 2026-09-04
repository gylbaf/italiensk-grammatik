# -*- coding: utf-8 -*-
"""Passage word marking / underline exercise builder."""
import re


def build_passage_marking(body: str, answer_body: str, instruction: str = ""):
    """If exercise is an interactive passage underline / capitalize exercise
    (such as Scheda 4 Ex 01 or Scheda 5 Ex 02), return structured token list for interactive word clicking/underlining."""
    if not body or not answer_body:
        return None
    full_text = (instruction or "") + " " + (answer_body or "")
    
    # Check if it's Scheda 5 Ex 02 (masculine/feminine gender identification)
    is_scheda5_ex2 = "(M)" in answer_body or "(F)" in answer_body or ("aeroporto" in body.lower() and "cairo" in body.lower()) or ("il genere del nome" in (instruction or "").lower() or "genere del nome" in (instruction or "").lower() or "corsivo" in body.lower() or "blu" in (instruction or "").lower() or "rosso" in (instruction or "").lower())

    if is_scheda5_ex2:
        masculine_nouns = {
            "incidente", "aeroporto", "cammello", "pilota", "aereo", "carrello",
            "velivolo", "danni", "animale", "investimento", "traffico"
        }
        feminine_nouns = {
            "pista", "sabbia", "pancia", "ruote", "vittime", "carovana",
            "manovra", "emergenza", "ore"
        }

        p_text = re.sub(r"\(adattato.*?\)", "", body).strip()
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
                if clean_w in masculine_nouns:
                    tokens.append({"t": "word", "id": word_id, "v": word, "role": "masculine"})
                    word_id += 1
                elif clean_w in feminine_nouns:
                    tokens.append({"t": "word", "id": word_id, "v": word, "role": "feminine"})
                    word_id += 1
                else:
                    tokens.append({"t": "word", "id": word_id, "v": word, "role": "none"})
                    word_id += 1

        total_target = len([t for t in tokens if t.get("role") in ("masculine", "feminine")])
        if total_target == 0:
            return None

        return {
            "tokens": tokens,
            "totalItems": total_target,
            "mode": "gender"
        }

    # Only for Scheda 4 Ex 01 – guard on instruction to avoid false positives
    # (e.g. Scheda 1 Ex 01 contains "strada" but is a blanks exercise, not passage)
    instr_l = (instruction or "").lower()
    body_l = (body or "").lower()
    if "sottolinea" not in instr_l and "nomi comuni" not in instr_l and "nomi propri" not in instr_l and "brano" not in instr_l:
        # also check body for passage-specific markers
        if "sindaco" not in body_l and "drezzo" not in body_l:
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
