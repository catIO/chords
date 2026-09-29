"""Render the cadence column of every RCM source page for the audit page (npm run dev -> /audit.html).

Usage: python3 scripts/render_rcm_audit.py   (requires PyMuPDF)
"""
import json
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / 'reference' / 'royal-conservatory-technique.pdf'
OUT = ROOT / 'reference' / 'audit'
PAGE_OFFSET = 4  # printed page number -> 0-based PDF page index

curriculum = json.loads((ROOT / 'src' / 'data' / 'royal_conservatory_pwa_chords.json').read_text())
pages = sorted({p for scales in curriculum['grades'].values() for s in scales for p in s['sourcePages']})

OUT.mkdir(exist_ok=True)
doc = fitz.open(PDF)
for printed in pages:
    page = doc[printed - PAGE_OFFSET]
    r = page.rect
    clip = fitz.Rect(r.width * 0.55, r.height * 0.03, r.width * 0.95, r.height * 0.98)
    page.get_pixmap(dpi=150, clip=clip, colorspace=fitz.csGRAY).save(OUT / f'p{printed}.png')
print(f'rendered {len(pages)} pages to {OUT}')
