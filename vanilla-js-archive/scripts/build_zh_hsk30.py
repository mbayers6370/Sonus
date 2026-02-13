#!/usr/bin/env python3
import csv
import json
import os
from pathlib import Path
import re
from typing import Dict, List, Tuple, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = PROJECT_ROOT / "data" / "hsk30-expanded.csv"
OUT_DIR = PROJECT_ROOT / "data" / "zh"

# CC-CEDICT (English glosses)
# Preferred location: files/data/cedict_ts.u8
# Fallback (your current repo screenshot): files/data/cedict_ts.u8
CEDICT_PATH_PRIMARY = PROJECT_ROOT / "data" / "cedict_ts.u8"
CEDICT_PATH_FALLBACK = PROJECT_ROOT / "data" / "cedict_ts.u8"

# We will pull unit definitions from your tracks file by a simple JSON-like extraction:
# Since tracks-zh.js is JS, we keep it simple: you manually maintain units in tracks-zh.js,
# and we maintain a small parallel unit map here.
#
# If you want, later we can make this script parse tracks-zh.js directly.
BAND_UNITS = {
  "band1": [
    ("b1-tones", 0),
    ("b1-pronouns", 30), ("b1-verbs", 40), ("b1-questions", 20), ("b1-numbers", 20), ("b1-time", 20), ("b1-measure", 20),
    ("b1-family", 30), ("b1-food", 30), ("b1-school", 30), ("b1-locations", 30), ("b1-transport", 20), ("b1-routine", 30),
    ("b1-opinions", 30), ("b1-ability", 20), ("b1-comparison", 20), ("b1-directions", 20), ("b1-shopping", 20), ("b1-politeness", 20),
    ("b1-listening", 0), ("b1-speaking", 0),
  ],
  "band2": [
    ("b2-grammar", 80), ("b2-actions", 90), ("b2-time", 60), ("b2-home", 70), ("b2-food", 70), ("b2-shopping", 70),
    ("b2-travel", 60), ("b2-health", 60), ("b2-weather", 50), ("b2-social", 62), ("b2-directions", 50), ("b2-review", 50),
    ("b2-listening", 0), ("b2-speaking", 0),
  ],
  "band3": [
    ("b3-grammar", 90), ("b3-workstudy", 90), ("b3-social", 80), ("b3-food", 80), ("b3-health", 80), ("b3-travel", 80),
    ("b3-hobbies", 80), ("b3-media", 80), ("b3-feelings", 80), ("b3-story", 90), ("b3-problems", 73), ("b3-review", 70),
    ("b3-listening", 0), ("b3-speaking", 0),
  ],
  "band4": [
    ("b4-grammar", 110), ("b4-services", 80), ("b4-work", 90), ("b4-learning", 80), ("b4-travel", 90), ("b4-society", 80),
    ("b4-environment", 70), ("b4-tech", 80), ("b4-health", 70), ("b4-opinion", 90), ("b4-narrative", 80), ("b4-review", 80),
    ("b4-listening", 0), ("b4-speaking", 0),
  ],
  "band5": [
    ("b5-grammar", 120), ("b5-work", 90), ("b5-finance", 80), ("b5-services", 80), ("b5-culture", 80), ("b5-media", 80),
    ("b5-tech", 80), ("b5-lifestyle", 70), ("b5-relationships", 80), ("b5-society", 80), ("b5-nuance", 90), ("b5-writing", 71), ("b5-review", 70),
    ("b5-listening", 0), ("b5-speaking", 0),
  ],
  "band6": [
    ("b6-grammar", 130), ("b6-academic", 90), ("b6-work", 90), ("b6-negotiation", 90), ("b6-policy", 90), ("b6-news", 80),
    ("b6-science", 80), ("b6-tech", 80), ("b6-culture", 80), ("b6-health", 70), ("b6-abstract", 90), ("b6-idioms", 90), ("b6-review", 80),
    ("b6-listening", 0), ("b6-speaking", 0),
  ],
  "band7": [
    ("b7-academic", 170), ("b7-business", 160), ("b7-scitech", 160), ("b7-society", 160), ("b7-culture", 150), ("b7-formal", 150),
    ("b7-media", 150), ("b7-rhetoric", 170), ("b7-idioms", 150), ("b7-reading", 150), ("b7-writing", 160), ("b7-review", 170),
    ("b7-listening", 0), ("b7-speaking", 0),
  ],
  "band8": [
    ("b8-writing", 180), ("b8-speaking", 160), ("b8-business", 160), ("b8-academic", 160), ("b8-law", 150), ("b8-philosophy", 150),
    ("b8-literature", 160), ("b8-criticism", 150), ("b8-science", 150), ("b8-tech", 150), ("b8-idioms", 180), ("b8-review", 150),
    ("b8-listening", 0), ("b8-speakinglab", 0),
  ],
  "band9": [
    ("b9-nuance", 180), ("b9-specialized", 160), ("b9-reading", 160), ("b9-classical", 200), ("b9-debate", 170), ("b9-writing", 150),
    ("b9-academic", 150), ("b9-culture", 150), ("b9-scitech", 140), ("b9-ethics", 140), ("b9-humor", 120), ("b9-review", 116),
    ("b9-listening", 0), ("b9-speaking", 0),
  ],
}

def safe_int(x, default=None):
  try:
    return int(x)
  except Exception:
    return default

def normalize_hanzi(s: str) -> str:
  return (s or "").strip()

CEDICT_RE = re.compile(r"^(\S+)\s+(\S+)\s+\[(.+?)\]\s+/(.+)/$")

def load_cedict(path: Path) -> Dict[Tuple[str, str], List[str]]:
  """Load CC-CEDICT and return a map: (simp, trad) -> [english definitions]."""
  m: Dict[Tuple[str, str], List[str]] = {}
  with path.open("r", encoding="utf-8") as f:
    for raw in f:
      line = raw.strip()
      if not line or line.startswith("#"):
        continue
      mm = CEDICT_RE.match(line)
      if not mm:
        continue
      trad, simp, _pinyin, english = mm.groups()
      trad = normalize_hanzi(trad)
      simp = normalize_hanzi(simp)
      defs = [d for d in english.split("/") if d]
      if not simp or not trad or not defs:
        continue
      key = (simp, trad)
      if key not in m:
        m[key] = defs
      else:
        # merge unique, keep order
        seen = set(m[key])
        for d in defs:
          if d not in seen:
            m[key].append(d)
            seen.add(d)
  return m

def lookup_english(cedict_map: Dict[Tuple[str, str], List[str]], simp: str, trad: str) -> List[str]:
  simp = normalize_hanzi(simp)
  trad = normalize_hanzi(trad)
  if not cedict_map:
    return []
  # best match
  if (simp, trad) in cedict_map:
    return cedict_map[(simp, trad)]
  # sometimes your CSV might have empty/variant trad; try any entry with same simp or trad
  for (s, t), defs in cedict_map.items():
    if simp and s == simp:
      return defs
    if trad and t == trad:
      return defs
  return []

def read_hsk30_rows(path: Path, cedict_map: Optional[Dict[Tuple[str, str], List[str]]] = None):
  """
  Handles CSV that may or may not have a header.
  We assume a row pattern like:
    id, simplified, traditional, pinyin, pos, band, ...
  """
  with path.open("r", encoding="utf-8") as f:
    reader = csv.reader(f)
    rows = list(reader)

  # detect header
  first = rows[0]
  has_header = True
  if len(first) >= 6 and str(first[0]).startswith("L") and "-" in first[0]:
    has_header = False

  data_rows = rows[1:] if has_header else rows

  words = []
  for r in data_rows:
    if len(r) < 6:
      continue
    wid = r[0].strip()
    simp = r[1].strip()
    trad = r[2].strip()
    pinyin = r[3].strip()
    pos = r[4].strip()
    band = safe_int(r[5], None)
    if not band or band < 1 or band > 9:
      continue
    if not simp or not pinyin:
      continue
    defs = lookup_english(cedict_map or {}, simp, trad)
    words.append({
      "id": wid,
      "simp": simp,
      "trad": trad,
      "pinyin": pinyin,
      "pos": pos,
      "band": band,
      "en": defs[0] if defs else "",
      "defs": defs
    })
  return words

def build_band_files(words):
  OUT_DIR.mkdir(parents=True, exist_ok=True)

  # group by band
  by_band = {b: [] for b in range(1, 10)}
  for w in words:
    by_band[w["band"]].append(w)

  # stable ordering: keep file order; if you want frequency-based later, we can sort
  for band in range(1, 10):
    band_id = f"band{band}"
    band_words = by_band[band]
    unit_defs = BAND_UNITS.get(band_id, [])

    target_total = sum(t for _, t in unit_defs if t and t > 0)
    if target_total > len(band_words):
      print(f"Warning: band {band_id} unit targets ({target_total}) exceed available words ({len(band_words)})")
    elif target_total < len(band_words):
      print(f"Warning: band {band_id} unit targets ({target_total}) less than available words ({len(band_words)}); leftover {len(band_words) - target_total}")

    # allocate sequentially into units by target count
    units_out = {}
    cursor = 0

    # pick a review-like unit id if one exists (used for overflow)
    review_unit_id = None
    for uid, _t in unit_defs:
      if "review" in uid:
        review_unit_id = uid
        break

    for unit_id, target in unit_defs:
      if not target or target <= 0:
        units_out[unit_id] = {"targetWords": 0, "allocatedWords": 0, "words": []}
        continue

      chunk = band_words[cursor:cursor + target]
      cursor += len(chunk)

      units_out[unit_id] = {
        "targetWords": target,
        "allocatedWords": len(chunk),
        "words": [
          {
            "id": w["id"],
            "simp": w["simp"],
            "trad": w["trad"],
            "pinyin": w["pinyin"],
            "pos": w["pos"],
            "en": w.get("en", ""),
            "defs": w.get("defs", [])
          }
          for w in chunk
        ]
      }

      # stop early if we ran out of words for this band
      if cursor >= len(band_words):
        break

    # If any words remain after filling targets, push them into a review unit if it exists;
    # otherwise expose them under a reserved unit id so we don't lose them.
    if cursor < len(band_words):
      leftovers = band_words[cursor:]
      if review_unit_id and review_unit_id in units_out:
        units_out[review_unit_id]["words"].extend([
          {
            "id": w["id"],
            "simp": w["simp"],
            "trad": w["trad"],
            "pinyin": w["pinyin"],
            "pos": w["pos"],
            "en": w.get("en", ""),
            "defs": w.get("defs", [])
          }
          for w in leftovers
        ])
        units_out[review_unit_id]["allocatedWords"] = len(units_out[review_unit_id]["words"])
      else:
        units_out["_unallocated"] = {
          "targetWords": 0,
          "allocatedWords": len(leftovers),
          "words": [
            {
              "id": w["id"],
              "simp": w["simp"],
              "trad": w["trad"],
              "pinyin": w["pinyin"],
              "pos": w["pos"],
              "en": w.get("en", ""),
              "defs": w.get("defs", [])
            }
            for w in leftovers
          ]
        }
      cursor = len(band_words)

    out = {
      "language": "zh",
      "source": "hsk3.0",
      "bandId": band_id,
      "band": band,
      "wordCount": cursor,
      "availableWords": len(band_words),
      "unallocatedWords": 0,
      "units": units_out
    }

    out_path = OUT_DIR / f"{band_id}.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
      f"Wrote {out_path} (target {target_total}; allocated {cursor}; available {len(band_words)}; unallocated 0)"
    )

def main():
  if not CSV_PATH.exists():
    raise SystemExit(f"CSV not found: {CSV_PATH}")

  cedict_path = CEDICT_PATH_PRIMARY if CEDICT_PATH_PRIMARY.exists() else CEDICT_PATH_FALLBACK
  cedict_map = {}
  if cedict_path.exists():
    print(f"Loading CC-CEDICT: {cedict_path}")
    cedict_map = load_cedict(cedict_path)
    print(f"Loaded {len(cedict_map)} CEDICT entries")
  else:
    print("CC-CEDICT not found (cedict_ts.u8). Continuing without English glosses.")

  words = read_hsk30_rows(CSV_PATH, cedict_map)
  if not words:
    raise SystemExit("No words parsed. Check CSV format/columns.")
  build_band_files(words)

if __name__ == "__main__":
  main()