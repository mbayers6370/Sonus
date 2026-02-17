# Sonus Data Archive

## Purpose
This directory contains archived language/data assets that support Sonus curriculum generation and historical reference.

The active application implementation is maintained in:
- `../sonus-react/` (current frontend)
- `../backend/` (current API)

## Contents

### Language Track Definitions
- `data/languages.js` - language metadata
- `data/tracks-zh.js` - HSK 3.0 track definitions
- `data/tracks-jp.js` - JLPT track definitions
- `data/tracks-kr.js` - TOPIK track definitions
- `data/tracks-fr.js` - CEFR track definitions

### Mandarin Vocabulary Data
- `data/zh/band1.json` ... `data/zh/band9.json` - band-organized Mandarin vocabulary

### Source Assets
- `data/cedict_ts.u8` - CC-CEDICT source
- `data/hsk30-expanded.csv` - HSK 3.0 source vocabulary

## Curriculum Model (Mandarin)
Mandarin data is organized in a hierarchical model:

`band -> unit -> lesson -> word`

Each word record can include:
- Simplified/Traditional forms
- Pinyin
- English gloss
- Part of speech
- Additional definitions/metadata

## Notes
- This directory is primarily archival/reference-oriented.
- Active product behavior and schema ownership live in the current app directories.

## License
- App code license: repository-level policy
- Dictionary source: CC-CEDICT (Creative Commons BY-SA 4.0)
