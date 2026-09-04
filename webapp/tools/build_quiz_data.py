# -*- coding: utf-8 -*-
"""
Parses all transcribed .md files in ../../md/ into a single JSON data file
consumed by the static quiz webapp (../data.js).

Run with:  py build_quiz_data.py
(from this folder, or any folder - paths are computed relative to this file)
"""
import sys
from pathlib import Path

# Ensure local quiz_builder package is importable regardless of current working directory
HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from quiz_builder import main

if __name__ == "__main__":
    main()
