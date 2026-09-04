# -*- coding: utf-8 -*-
"""Constants and shared utilities for the quiz data builder."""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
ROOT = HERE.parent.parent  # ".../Italiensk grammatik"
MD_DIR = ROOT / "md"
OUT_FILE = HERE.parent / "data.js"

HEADING_RE = re.compile(r'^(#{1,4})\s+(.*?)\s*$', re.MULTILINE)
EXERCISE_HEADING_RE = re.compile(r'^(\d{2})\s*\u2022\s*(.*)$')  # "01 • Instruction"
LOOSE_NUM_HEADING_RE = re.compile(r'^(\d+)[\.\)]\s*(.*)$')       # "1. Instruction"
SCHEDA_NUM_IN_TITLE_RE = re.compile(r'Scheda\s+(\d+)', re.I)
LEADING_NUM_RE = re.compile(r'^\s*(\d+)')
BOLD_RE = re.compile(r'\*\*(.+?)\*\*')


def _norm_ws(s: str) -> str:
    """Normalize whitespace by collapsing multiple whitespace characters into one space."""
    return re.sub(r"\s+", " ", s.strip())
