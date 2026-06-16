# Pathologist viewing-behaviour analysis

Exploratory analysis of the two near-complete readers (`muhammad.aslam`, `ashish.bansal`)
from the study event log, for the Project-B (AdaZoom-MIL extension) insight work.

**Read this first:** [`reports/pathologist-viewing-insights-2026-06-16.md`](reports/pathologist-viewing-insights-2026-06-16.md)
— the synthesised insight memo (also published to gbrain as
`phd/user-study/two-pathologist-analysis-2026-06-16`).

## Layout

```
data/      committed event export (pathology_events_2026-06-16.csv)
src/       load.py · labels.py · navigation.py · metrics.py · figures.py
notebooks/ pathologist_insights.py  (jupytext source) + .ipynb (executed)
figures/   01..07 PNGs
reports/   insight memo + results.json + the gbrain page copy
```

The notebook **asserts** every headline number (accuracy 64.8/69.1%, inter-rater 88% vs 60%,
high→low 48/78 & 29/51, …) so any pipeline drift fails loudly.

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

`data/pathology_events_2026-06-16.csv` is **not committed** — the repo `.gitignore` excludes
`pathology_events*.csv` (data exports stay local, and the file carries usernames + per-reader
performance). To reproduce, place the export at `analysis/data/` (the loader also falls back to the
repo-root copy). Everything else here is committed.
