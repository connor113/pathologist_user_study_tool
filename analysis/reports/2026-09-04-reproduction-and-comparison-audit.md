---
created: 2026-09-04
updated: 2026-09-04
status: reproduced-analysis-comparison-pending
---
# Analysis reproduction and AdaZoom compatibility

## Verified locally on September 4

- Canonical export: `../data/pathology_events_2026-06-29.csv`, **20,659 rows**, 6,035,688 bytes. SHA-256: `6a63efa8ec8529353ea196dfbca0a0c29485012154260a582c75be12d001db92`. The older prose count 20,658 is superseded; the saved results already use 20,659.
- Analysis source: `../notebooks/pathologist_insights.py`, SHA-256 `70451200f642343d6cedd68396f8e29f2dd6ee8c997537eaa5c6593ee8c9ec69`.
- Re-executed this source with only the figure/report destinations redirected in memory to a recovery directory, using the repository's existing environment. No analysis formula, export, source, saved report or figure was overwritten.
- All notebook anchors passed; 15 figures regenerated. A recursive comparison with the saved `results.json`, using a tight floating-point tolerance, found **zero differences**.
- The log covers 250 unique slides. Two readers have 250 labelled slides each; the partial-reader coverage remains separately reported. Do not use a nonexistent `label_submit` event: the source derives a committed diagnosis from `slide_next`, with its documented `label_select` fallback for views.

## Compatibility with current AdaZoom data

A direct slide-ID join against `adazoom-mil/data/splits/crc/internal_cv_4398.csv` matches **248 of 250** study slides, with fold counts **50, 41, 51, 51, 55** for folds 0-4. All 250 are development members; none is a held-out test member. Only membership was used for the held-out check, not performance. The existing `exclusions.csv` explicitly lists `CRC_0492` and `CRC_0564`, both with reason `missing_2.5x_feature` (fold 1). Keep the descriptive study denominator at 250; use the declared 248 eligible slides for the matched model comparison and report the two exclusions. Their current feature availability was not independently checked on campus.

Viewport centre/bounds, zoom level, timestamps and slide IDs exist. Centre and viewport-bound fields are nonempty in 20,649 events; ten missing-coordinate events need the existing event-type-aware treatment. Availability of fields is not proof that coordinate transforms to each patch grid are correct.

Neither the export nor the internal-CV membership file contains a patient key. Patient independence cannot yet be established. Find the cohort patient/slide grouping on the owning machine or explicitly state the limitation before claiming a leakage-safe evaluation.

## Completed versus remaining

Existing descriptive/behavioural analyses (the Q1-Q6 work) have a reproducible numerical base. This does not complete Q7/human-AdaZoom comparison or a model trained from human data.

Next: obtain development OOF predictions and spatial routes from the campus machine, identify the model that excluded each matched slide's fold, verify coordinate units/dimensions, and join on the shared eligible cohort. Freeze the comparison question and denominator before interpretation. Include subjectivity and reader coverage as limitations.

For training, group every event and reader record for the same slide/patient together; build human targets and choose preprocessing on training folds only. Do not use the evaluated slide's viewport target, class outcome or route to train its own predictor. A blanket fresh 20% holdout cannot erase the prior full-dataset exploratory analysis. Explain exploratory versus confirmatory evidence honestly.

## Interpretation corrections

The historical viewing-insights memo contains hypotheses about diagnostic conventions and whether errors are interpretive rather than attentional. The reproduced observational statistics do **not** establish either causal explanation. Keep them as hypotheses for discussion, and label viewport occupancy as a proxy for displayed/viewed regions rather than direct eye tracking. Partial reader records do not supply additional independent full cohorts.

## Receipt and next action

The raw recovery receipt is outside Git at `C:/Users/conno/AppData/Local/Temp/codex-repo-audit-20260904-rvfb6bff/pathologist-reproduction/verification.json`; durable findings and source hashes are recorded here. The working export stays ignored. Open the candidate Chapter 7 outline for Monday and resolve the OOF/coordinate/patient-grouping dependencies with the campus receipt. No new model, clinical conclusion or app deployment is claimed.
