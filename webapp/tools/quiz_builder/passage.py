# -*- coding: utf-8 -*-
"""Passage word marking / underline exercise builder."""
import re


def build_passage_marking(body: str, answer_body: str, instruction: str = ""):
    """If exercise is an interactive passage underline / capitalize exercise
    (such as Scheda 4 Ex 01 or Scheda 5 Ex 02), return structured token list for interactive word clicking/underlining."""
    if not body or not answer_body:
        return None
    full_text = (instruction or "") + " " + (answer_body or "")
    
    # Scheda 11 Ex04 – cancella i pronomi non necessari (markera ord som ska strykas)
    if "cancella" in (instruction or "").lower() and "pronom" in (instruction or "").lower():
        # 8 meningar, 10 pronomen att stryka (se soluzioni_del03)
        sentences = [
            (1, "Io sono italiano, e tu?", ["Io"]),
            (2, "Io avevo un gatto che si chiamava Ulisse e lui era rosso e bianco.", ["Io", "lui"]),
            (3, "Oggi io devo lavare i piatti.", ["io"]),
            (4, "Oggi devo lavare i piatti io.", []),
            (5, "Io ho portato il caffè a Stefano e lui mi ha ringraziata moltissimo.", ["Io", "lui"]),
            (6, "Noi abbiamo affittato una casa nuova e noi domani traslocheremo.", ["Noi", "noi"]),
            (7, "Se tu studi qualche ora oggi, tu domani sarai libero di andare alla partita.", ["tu", "tu"]),
            (8, "Non è lui che ha vinto la gara, ma quel ragazzo biondo che è seduto là.", []),
        ]
        # Bygg tokens för hela brödtexten (numrering som raw)
        p_text = body.strip()
        pattern = re.compile(r"([a-zA-ZàèéìòùÀÈÉÌÒÙ']+|[^\w\s]+|\s+)")
        tokens = []
        word_id = 0
        # För att matcha rätt förekomst vid upprepning – håll koll per mening
        sent_idx = 0
        # Dela upp body i rader för att veta vilken mening vi är i
        body_lines = [l.strip() for l in body.split("\n") if l.strip()]
        # Skapa mapping: för varje rad, vilka ord som ska markeras (i ordning)
        # Använder sentences-definitionen ovan – antar att body har samma 8 meningar i ordning
        for line in body_lines:
            # Extrahera numrering "1. " som raw
            m_num = re.match(r"^\s*(\d+[\.\)]\s*)(.*)$", line)
            if m_num:
                tokens.append({"t": "raw", "v": m_num.group(1)})
                line_content = m_num.group(2)
            else:
                line_content = line
            # Hitta målen för denna mening (baserat på ordning)
            target_words = []
            if sent_idx < len(sentences):
                # sentences är 1-indexerade, sent_idx 0-baserad
                target_words = [w.lower() for w in sentences[sent_idx][2]]
            # Räkna förekomster för att hantera upprepning (t.ex. två "tu" i mening 7)
            target_counts = {}
            for w in target_words:
                target_counts[w] = target_counts.get(w, 0) + 1
            seen_counts = {}
            for m in pattern.finditer(line_content):
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
                    # Avgör om detta ord ska strykas (role delete)
                    # Kolla om clean_w finns i target_words och vi inte redan markerat alla förekomster
                    is_target = False
                    if clean_w in target_counts:
                        seen = seen_counts.get(clean_w, 0)
                        if seen < target_counts[clean_w]:
                            # För meningar med samma ord två gånger (t.ex. "tu" i mening 7) – ta i ordning
                            is_target = True
                            seen_counts[clean_w] = seen + 1
                    role = "delete" if is_target else "none"
                    tokens.append({"t": "word", "id": word_id, "v": word, "role": role})
                    word_id += 1
            # Lägg till radbrytning mellan meningar
            tokens.append({"t": "raw", "v": "\n"})
            sent_idx += 1
        total_target = len([t for t in tokens if t.get("role") == "delete"])
        if total_target == 0:
            return None
        return {"tokens": tokens, "totalItems": total_target, "mode": "delete"}

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
