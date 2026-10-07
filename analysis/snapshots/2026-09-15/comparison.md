# Export comparison: September 15 versus June 29, 2026

## Finding

The two complete readers are unchanged. Rana has **180 labelled slides out of 250
(72%)** under the existing slide-level analysis rule, compared with **19** in June.
He has opened 181 slides. The earlier memo's “20” counted slides encountered, not
slides with a usable diagnosis.

This report compares snapshots before selecting any research analyses to rerun.
Its script does not run Q1-Q6.

## Coverage and denominators

| Reader | Event rows, June → September | Slides encountered | Labelled, including fallback | Labelled slide_next only |
|---|---:|---:|---:|---:|
| Muhammad Aslam — complete | 8,341 → 8,341 | 250 → 250 | 250 → 250 | 236 → 236 |
| Ashish Bansal — complete | 9,757 → 9,757 | 250 → 250 | 250 → 250 | 222 → 222 |
| Iftikhar Rana — partial | 1,824 → 9,587 | 20 → 181 | 19 → 180 | 19 → 166 |
| Alistair Heath — partial | 503 → 503 | 8 → 8 | 7 → 7 | 6 → 6 |
| Admin — test data | 234 → 234 | 2 → 2 | 1 → 1 | 0 → 0 |

All 250 study slide IDs and their reference diagnoses are unchanged. No reader
loses a previously encountered or labelled slide.

For Rana:

- **166** slides have a labelled `slide_next`; **14** more have only the
  `label_select` fallback. These are distinct slides, not event counts.
- There are **161 additional labelled slides**: 160 first encountered after the
  June export, plus `CRC_3682`, already encountered but unlabelled in June.
  Only `CRC_3682` receives additional events among his original 20 slides (17 rows).
- `CRC_3610` is the one currently encountered but unlabelled slide. A further 69
  study slides have no Rana events. Thus 70 remain outside his labelled cohort.
- There are 192 slide-view attempts on 181 distinct slides: 181 labelled views,
  11 unlabelled views. `CRC_0828` has two labelled attempts, both non-neoplastic;
  it contributes only one slide-level diagnosis. Its first attempt has a fallback
  label and its second has `slide_next`. This explains why the per-view fallback
  count is 15 while the additional slide-level coverage is 14.

## What “labelled” and “completed” mean here

The app's actual completion condition is `sessions.completed_at IS NOT NULL`.
The completion endpoint writes that timestamp and the persisted session label.
Neither field is included in this event CSV. Also, the frontend logs `slide_next`
before requesting completion and can advance after that request fails. Therefore
this CSV verifies analysis label coverage, **not independently the database's
completed-session count**.

The existing analysis has two related implementations:

1. `labels.committed_label`: within `(user, slide, session, viewing_attempt)`, use
   the final nonempty `slide_next` label; otherwise use the final nonempty
   `label_select`; otherwise mark the view missing.
2. `metrics.slide_level_diagnoses(use_fallback=True)`: take the chronologically
   last labelled event among `slide_next` and `label_select` for each reader and
   slide, including attempts. This is the exact implementation used for the
   published full-cohort Q1/Q2 results. The strict version uses `slide_next` only.

These rules are not identical in every hypothetical history. They produce
identical slide diagnoses on both supplied exports when the per-view labels are
collapsed to the latest labelled view. No label is inferred from `slide_load`,
the existence of a session, or the nonexistent `label_submit` event. A new
unlabelled attempt does not erase an earlier labelled diagnosis.

The 250-slide denominator describes the observed study cohort. Confirming that
the live assigned queue still contains exactly these 250 slides would require a
current slide/session export; the event comparison itself does not query the app.

## Diagnosis comparison

**Zero existing diagnoses changed**, with either strict or fallback extraction.
This includes all 500 diagnoses from the complete readers and Rana's original
19 diagnoses. No reference labels changed.

| Reader | Non-neoplastic calls, June → September | Low-grade calls | High-grade calls |
|---|---:|---:|---:|
| Aslam | 70 → 70 | 142 → 142 | 38 → 38 |
| Bansal | 78 → 78 | 131 → 131 | 41 → 41 |
| Rana | 5 → 53 | 11 → 89 | 3 → 38 |
| Heath | 1 → 1 | 5 → 5 | 1 → 1 |
| Admin | 0 → 0 | 1 → 1 | 0 → 0 |

Rana's 180 labelled slides contain 50 non-neoplastic, 70 low-grade and 60
high-grade **reference** labels. The complete cohort contains 71, 95 and 84,
respectively. These are different denominators; an unadjusted ranking across
readers would also reflect which slides Rana has completed.

## Genuine additions versus export differences

- Rows increase **20,659 → 28,422**, a net **7,763**. Every added row belongs to
  Rana. The export retains the same 23 columns.
- An exact parsed-row multiset comparison retains **all 20,659 old rows with the
  same multiplicities**, with no removals, replaced rows, or increased copies of
  any old row. Old rows also retain their relative order.
- Aslam, Bansal, Heath and admin have identical per-reader row sequences, not
  merely identical counts. All exported fields, including labels, coordinates,
  attempts, notes and reference labels, participate in that comparison.
- Added event timestamps run from **July 2, 2026, 13:44:41 UTC** to **September 7,
  2026, 11:00:28 UTC**. There is no added event at or before the last timestamp in
  the June export. “September 15” is the file's export date, not its last activity.

| Added event type | Rows |
|---|---:|
| zoom_step | 3,003 |
| viewport_poll | 2,556 |
| cell_click | 1,443 |
| arrow_pan | 211 |
| slide_load | 170 |
| label_select | 163 |
| slide_next | 147 |
| idle_start | 30 |
| idle_end | 22 |
| app_start | 9 |
| back_step | 8 |
| reset | 1 |
| **Total** | **7,763** |

The additions contain **7,576 distinct full-row signatures plus 187 identical-row
excess copies**. Those excess copies comprise 182 `zoom_step`, three
`viewport_poll`, one `cell_click` and one `idle_start`. None are `label_select` or
`slide_next`. Across the whole file, identical-row excess increases **257 → 444**.

These are genuine additions to the exported history, rather than a re-export
duplicating June rows. They are not proof of 7,763 independent physical actions:
event IDs are absent, and the exported timestamps have only whole-second
precision. Identical rows could reflect repeated instrumentation, retried
uploads, or separate same-second events with the same state. The evidence does
not distinguish these mechanisms. No rows were deduplicated or removed. Before
interpreting Rana's event frequency or event-weighted coverage maps, assess
sensitivity to these duplicate-looking events.

## Integrity checks and implications

- No missing reader/slide/session/attempt/event/time/reference fields; no
  unexpected nonempty diagnosis values, numeric parsing failures in the checked
  measurement columns, session identity conflicts or multiple sessions for the
  same reader/slide. App version remains `1.0.0-alpha` throughout.
- Six newly added Rana events have missing viewport coordinates: five
  `viewport_poll`, one `back_step`. The ten already known Bansal events remain
  unchanged, so the total becomes **16**. This affects spatial analysis input,
  not the diagnosis denominator. Use the existing event-aware handling.
- One same-second pair of conflicting label selections persists unchanged:
  Aslam on `CRC_1083` selects low-grade and non-neoplastic at 13:34:36 UTC on
  May 7. A later `slide_next` at 13:34:37 commits non-neoplastic, so this tie does
  not make the final diagnosis ambiguous. Subsecond action order is unavailable.
- The June audit's interpretation limits still apply: viewport occupancy is a
  display proxy; the event log does not establish eye fixation, causes of errors,
  patient independence, or completion of a human–AdaZoom comparison.

The material issues are denominator wording and potential event weighting in
future Rana behaviour analyses. The comparison finds no changed input requiring
replacement of the complete readers' results.

## Preservation and reproducibility

The June export matches the September 4 audit's SHA-256 and size exactly:
`6a63efa8ec8529353ea196dfbca0a0c29485012154260a582c75be12d001db92`, 6,035,688 bytes.
The September export is 8,328,948 bytes, SHA-256
`264c9397d7849bb85a22137e727681c0ffa5763cd8afcaf5700e9f5f9dce8d2a`.

The new file was copied byte-for-byte from Downloads into
`analysis/data/pathology_events_2026-09-15.csv`; both dated exports remain ignored
by Git. All new results live under `analysis/snapshots/2026-09-15/`.

`preservation-before.json` hashes 58 pre-existing analysis/guidance artifacts,
including the June data, saved results, source, notebook, figures and September 4
audit. The comparison verified all 58 unchanged. Existing uncommitted guidance
and the audit were preserved.

From the repository root, rerun only this comparison with:

```powershell
& analysis/.venv/Scripts/python.exe analysis/snapshots/2026-09-15/compare_exports.py
```

Evidence: `comparison.json`; `diagnoses-{strict,fallback}-{date}.csv` and
`views-{date}.csv` beside this report; the original `analysis/src/load.py`,
`labels.py`, `metrics.py`; `backend/src/routes/admin.ts` (CSV export),
`backend/src/routes/slides.ts` (completion), and `src/viewer/main.ts` (confirm flow).
Slide-level evidence CSVs remain local and ignored.
