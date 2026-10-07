"""Compare the June and September snapshots without running Q1-Q6 or changing them.

Run with analysis/.venv/Scripts/python.exe. All outputs stay beside this script;
slide-level tables are CSV and remain ignored under the repository data policy.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
sys.path.insert(0, str(ROOT / "analysis/src"))
import load
import labels
import metrics

DATES = ("2026-06-29", "2026-09-15")
PATHS = [ROOT / f"analysis/data/pathology_events_{date}.csv" for date in DATES]
VIEW_KEY = ["user_id", "slide_id", "session_id", "viewing_attempt"]
COORDS = ["center_x0", "center_y0", "vbx0", "vby0", "vtx0", "vty0"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def records(frame):
    return json.loads(frame.to_json(orient="records", date_format="iso"))


def count(series):
    return {str(k): int(v) for k, v in series.value_counts().sort_index().items()}


def fingerprint(rows, columns):
    return Counter(tuple(row[c] for c in columns) for row in rows)


def label_table(events, fallback):
    # Use the existing Q1/Q2 implementation, rather than silently replacing its rule.
    result = metrics.slide_level_diagnoses(events, use_fallback=fallback)
    result = result.sort_values(["user_id", "slide_id"]).reset_index(drop=True)
    return result


def build_snapshot(path, date):
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        raw = list(reader)
        columns = reader.fieldnames
    ev = load.load_events(str(path))
    strict, fallback = label_table(ev, False), label_table(ev, True)
    views = []
    for key, group in load.view_groups(ev):
        label, source = labels.committed_label(group)
        views.append(dict(zip(VIEW_KEY, key), label=label, label_source=source,
                          first_ts=group.ts.min(), last_ts=group.ts.max(),
                          n_events=len(group)))
    import pandas as pd
    view_df = pd.DataFrame(views)
    # Check the documented per-view rule against the actual slide-level helper.
    vd = (view_df[view_df.label.notna()].sort_values("last_ts")
          .groupby(["user_id", "slide_id"]).tail(1))
    policy_check = fallback.merge(vd, on=["user_id", "slide_id"], how="outer",
                                 suffixes=("_slide", "_view"))
    policy_differences = policy_check[policy_check.label_slide != policy_check.label_view]

    profiles = {}
    for user, group in ev.groupby("user_id"):
        rows = [row for row in raw if row["user_id"] == user]
        freq = fingerprint(rows, columns)
        st = strict[strict.user_id == user]
        fb = fallback[fallback.user_id == user]
        vs = view_df[view_df.user_id == user]
        blank_coords = group[COORDS].isna().any(axis=1)
        profiles[user] = {
            "events": len(group), "slides_seen": int(group.slide_id.nunique()),
            "views": len(vs), "strict_labelled_slides": len(st),
            "fallback_labelled_slides": len(fb),
            "fallback_only_slides": sorted(set(fb.slide_id) - set(st.slide_id)),
            "unlabelled_seen_slides": sorted(set(group.slide_id) - set(fb.slide_id)),
            "view_label_sources": count(vs.label_source),
            "views_by_attempt": count(vs.viewing_attempt),
            "labels": count(fb.label), "reference_labels": count(fb.ground_truth),
            "events_by_type": count(group.event),
            "duplicate_excess": sum(n - 1 for n in freq.values()),
            "duplicate_signatures": sum(n > 1 for n in freq.values()),
            "duplicate_excess_by_event": dict(sorted(Counter({
                event: sum(n - 1 for row, n in freq.items()
                           if row[columns.index("event")] == event)
                for event in sorted(set(group.event))
            }).items())),
            "missing_coordinate_rows": int(blank_coords.sum()),
            "missing_coordinates_by_event": count(group.loc[blank_coords, "event"]),
            "app_versions": count(group.app_version),
            "first_event_utc": group.ts.min().isoformat(),
            "last_event_utc": group.ts.max().isoformat(),
        }
    labelled_events = ev[ev.event.isin(["label_select", "slide_next"]) & ev.label.notna()]
    ties = labelled_events.groupby(VIEW_KEY + ["ts"]).label.nunique()
    # Export has seconds, not event IDs/subsecond ordering. Flag conflicting labels.
    ambiguous_ties = ties[ties > 1]
    profile = {
        "file": path.relative_to(ROOT).as_posix(), "sha256": sha(path),
        "bytes": path.stat().st_size, "rows": len(raw), "columns": columns,
        "readers": profiles, "slides": int(ev.slide_id.nunique()),
        "duplicate_excess": len(raw) - len(fingerprint(raw, columns)),
        "event_type_counts": count(ev.event),
        "reference_labels_per_slide": count(ev[["slide_id", "ground_truth"]]
                                            .drop_duplicates().ground_truth),
        "slide_reference_conflicts": int((ev.groupby("slide_id").ground_truth.nunique() > 1).sum()),
        "session_identity_conflicts": int((ev.groupby("session_id")["user_id"].nunique() > 1).sum()
                                          + (ev.groupby("session_id")["slide_id"].nunique() > 1).sum()),
        "user_slide_multiple_sessions": int((ev.groupby(["user_id", "slide_id"]).session_id.nunique() > 1).sum()),
        "invalid_nonempty_labels": sorted(set(ev.label.dropna()) - set(load.GRADE_LABELS)),
        "invalid_reference_labels": sorted(set(ev.ground_truth.dropna()) - set(load.GRADE_LABELS)),
        "missing_required": {c: int(ev[c].isna().sum()) for c in VIEW_KEY + ["event", "ts", "ground_truth"]},
        "invalid_nonempty_numeric_cells": {
            c: int(sum(bool(row[c]) for row in raw) - ev[c].notna().sum())
            for c in load._NUMERIC_COLS if c != "viewing_attempt"
        },
        "timestamp_formats": dict(Counter(row["ts_iso8601"].split("GMT")[-1] for row in raw)),
        "conflicting_label_timestamp_groups": len(ambiguous_ties),
        "conflicting_label_timestamp_details": records(ambiguous_ties.rename("distinct_labels").reset_index()),
        "documented_view_vs_actual_slide_label_differences": records(policy_differences),
    }
    strict.to_csv(OUT / f"diagnoses-strict-{date}.csv", index=False)
    fallback.to_csv(OUT / f"diagnoses-fallback-{date}.csv", index=False)
    view_df.to_csv(OUT / f"views-{date}.csv", index=False)
    return profile, raw, ev, strict, fallback


def main():
    baseline = json.loads((OUT / "preservation-before.json").read_text(encoding="utf-8"))
    modified = [p for p, v in baseline.items() if not (ROOT / p).exists() or sha(ROOT / p) != v["sha256"]]
    if modified:
        raise RuntimeError(f"Protected artifacts changed: {modified}")
    snapshots = [build_snapshot(path, date) for path, date in zip(PATHS, DATES)]
    (old_profile, old_raw, old_ev, old_strict, old_fb), (new_profile, new_raw, new_ev, new_strict, new_fb) = snapshots
    assert old_profile["columns"] == new_profile["columns"], "Review schema drift before comparing"
    columns = old_profile["columns"]
    old = fingerprint(old_raw, columns)
    new = fingerprint(new_raw, columns)
    added, removed = new - old, old - new
    added_rows = [dict(zip(columns, row)) for row, n in added.items() for _ in range(n)]
    added_ts = load.parse_ts(__import__("pandas").Series([r["ts_iso8601"] for r in added_rows]))
    comparison = {}
    for user in sorted(set(old_ev.user_id) | set(new_ev.user_id)):
        ro = [r for r in old_raw if r["user_id"] == user]
        rn = [r for r in new_raw if r["user_id"] == user]
        co, cn = fingerprint(ro, columns), fingerprint(rn, columns)
        eo, en = old_ev[old_ev.user_id == user], new_ev[new_ev.user_id == user]
        detail = {
            "raw_multiset_equal": co == cn, "raw_sequence_equal": ro == rn,
            "existing_row_relative_order_preserved": ro == [r for r in rn if tuple(r[c] for c in columns) in co],
            "canonical_loaded_sequence_equal": eo.reset_index(drop=True).equals(en.reset_index(drop=True)),
            "added_rows": sum((cn - co).values()), "removed_rows": sum((co - cn).values()),
            "newly_seen_slides": sorted(set(en.slide_id) - set(eo.slide_id)),
            "removed_seen_slides": sorted(set(eo.slide_id) - set(en.slide_id)),
            "added_rows_on_previously_seen_slides": sum(1 for r in added_rows if r["user_id"] == user and r["slide_id"] in set(eo.slide_id)),
            "previously_seen_slides_with_added_events": sorted({r["slide_id"] for r in added_rows if r["user_id"] == user and r["slide_id"] in set(eo.slide_id)}),
        }
        for mode, do, dn in [("strict", old_strict, new_strict), ("fallback", old_fb, new_fb)]:
            do, dn = do[do.user_id == user], dn[dn.user_id == user]
            joined = do.merge(dn, on=["user_id", "slide_id"], suffixes=("_old", "_new"))
            changes = joined[(joined.label_old != joined.label_new) | (joined.ground_truth_old != joined.ground_truth_new)]
            gained = set(dn.slide_id) - set(do.slide_id)
            detail[mode] = {
                "old_labelled": len(do), "new_labelled": len(dn), "shared_labelled": len(joined),
                "changed_existing_diagnoses": records(changes),
                "lost_labelled_slides": sorted(set(do.slide_id) - set(dn.slide_id)),
                "gained_labelled_slides": sorted(gained),
                "gained_labels_on_previously_seen_slides": sorted(gained & set(eo.slide_id)),
            }
        comparison[user] = detail
    old_gt = old_ev[["slide_id", "ground_truth"]].drop_duplicates()
    new_gt = new_ev[["slide_id", "ground_truth"]].drop_duplicates()
    gt_join = old_gt.merge(new_gt, on="slide_id", suffixes=("_old", "_new"))
    result = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Snapshot comparison only; Q1-Q6 not rerun by this script.",
        "snapshots": dict(zip(DATES, [old_profile, new_profile])),
        "delta": {
            "added_rows": sum(added.values()), "removed_rows": sum(removed.values()),
            "all_old_rows_preserved_with_multiplicity": not bool(removed),
            "new_distinct_exported_signatures": len(set(new) - set(old)),
            "increased_multiplicity_of_old_signatures": sum(n - old[k] for k, n in new.items() if k in old and n > old[k]),
            "duplicate_excess_among_additions": sum(added.values()) - len(added),
            "added_events_by_type": dict(sorted(Counter(r["event"] for r in added_rows).items())),
            "added_duplicate_excess_by_event": dict(sorted(Counter({e: sum(n-1 for row, n in added.items() if row[columns.index("event")] == e) for e in {r["event"] for r in added_rows}}).items())),
            "first_added_event_utc": added_ts.min().isoformat(),
            "last_added_event_utc": added_ts.max().isoformat(),
            "added_events_at_or_before_old_last_event": int((added_ts <= old_ev.ts.max()).sum()),
            "reference_label_changes": records(gt_join[gt_join.ground_truth_old != gt_join.ground_truth_new]),
        },
        "by_reader": comparison,
        "limits": [
            "The CSV omits event IDs, subsecond timestamps, sessions.completed_at and the persisted session label; distinct signatures are not guaranteed unique interactions.",
            "App completion requires sessions.completed_at; CSV label coverage is an operational proxy, not independent confirmation of database completion.",
            "The canonical slide helper takes the last labelled slide_next or label_select event. The per-view helper prioritizes slide_next, falling back to label_select. Both are checked here.",
            "Do not deduplicate real repeated events without event IDs or a justified rule; duplicate counts alone do not prove ingestion defects.",
            "Rana remains a partial reader; admin is test data. Do not pool either into the two complete-reader cohort.",
        ],
        "preservation": {"checked_files": len(baseline), "modified_files": modified},
        "code_sha256": {p.relative_to(ROOT).as_posix(): sha(p) for p in [Path(__file__), ROOT / "analysis/src/load.py", ROOT / "analysis/src/labels.py", ROOT / "analysis/src/metrics.py"]},
    }
    (OUT / "comparison.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"delta": result["delta"], "readers": {u: {
        "seen": [old_profile["readers"][u]["slides_seen"], new_profile["readers"][u]["slides_seen"]],
        "labelled": [v["fallback"]["old_labelled"], v["fallback"]["new_labelled"]],
        "strict": [v["strict"]["old_labelled"], v["strict"]["new_labelled"]],
        "raw_sequence_equal": v["raw_sequence_equal"],
        "changes": v["fallback"]["changed_existing_diagnoses"],
        "old_slides_with_new_events": v["previously_seen_slides_with_added_events"],
        "new_labels_on_old_slides": v["fallback"]["gained_labels_on_previously_seen_slides"],
    } for u, v in comparison.items()}, "preservation": result["preservation"]}, indent=2))


if __name__ == "__main__":
    main()
