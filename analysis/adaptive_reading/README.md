# Adaptive Reading Analysis

This folder contains an analysis-only artifact set generated from
`../../pathology_events_2026-06-16.csv`.

Regenerate everything with:

```bash
python analysis/adaptive_reading/run_analysis.py
```

Outputs:

- `report.md` - concise reader-facing interpretation
- `adaptive_reading_analysis.ipynb` - lightweight reproducibility companion
- `tables/` - derived session, attempt, diagnosis, zoom, overlap, and validation tables
- `figures/` - static SVG figures used by the report

No app code, database schema, or migrations are modified.
