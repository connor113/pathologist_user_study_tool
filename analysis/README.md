---
updated: 2026-09-04
---

> **Current status:** September 4 reproduction passed all anchors, regenerated 15 figures and matched the saved results. The authoritative event count is **20,659**. Read [the dated audit](reports/2026-09-04-reproduction-and-comparison-audit.md) before interpreting historical hypotheses or planning human-AdaZoom comparison. Q7 and human-derived model work remain pending.

# Pathologist viewing-behaviour analysis

Exploratory analysis of the two complete readers (`muhammad.aslam`, `ashish.bansal`, 250
slides each) from the study event log, for the Project-B (AdaZoom-MIL extension) insight work.

**Read this first:** [`reports/pathologist-viewing-insights-2026-06-29.md`](reports/pathologist-viewing-insights-2026-06-29.md)
— the full-dataset insight memo (supersedes the 2026-06-16 memo, kept for provenance).

## Layout

```
data/      local ignored event export (pathology_events_2026-06-29.csv)
src/       load.py · labels.py · navigation.py · metrics.py · figures.py · saliency.py
notebooks/ pathologist_insights.py  (jupytext source) + .ipynb (executed)
figures/   01..15 PNGs
reports/   insight memos + results.json + the gbrain page copy
```

The notebook **asserts** every headline number (3-class acc 65/70%, binary detection 87/88%,
inter-rater binary κ=0.90 / 3-class κ=0.83 vs reader–GT κ 0.56–0.72, high→low 48/78 & 38/72,
attention-map CC 0.49 vs 0.05 null, …) so any pipeline drift fails loudly.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# fast path (script): regenerates figures/ + reports/results.json
.\.venv\Scripts\python.exe notebooks\pathologist_insights.py
# notebook path: execute in place with outputs embedded
.\.venv\Scripts\python.exe -m jupytext --to notebook notebooks\pathologist_insights.py
.\.venv\Scripts\python.exe -m nbconvert --to notebook --execute --inplace `
  --ExecutePreprocessor.kernel_name=python3 notebooks\pathologist_insights.ipynb
```

`notebooks/pathologist_insights.py` is the canonical source (diff-friendly); the `.ipynb` is the
executed artefact. Read-only w.r.t. the live DB; touches no app code.

## Data note

`data/pathology_events_2026-06-29.csv` is **not committed** — the repo `.gitignore` excludes
`pathology_events*.csv` (data exports stay local, and the file carries usernames + per-reader
performance). To reproduce, place the export at `analysis/data/` (the loader also falls back to the
repo-root copy). Everything else here is committed.
