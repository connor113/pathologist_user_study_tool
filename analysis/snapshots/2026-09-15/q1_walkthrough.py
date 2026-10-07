"""Scoped Q1 extension, run only after the snapshot comparison was reported.

Reads the separately dated diagnosis tables; verifies their underlying export
hashes and checks complete-reader Q1 values against the untouched saved results.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
sys.path.insert(0, str(ROOT / "analysis/src"))
import pandas as pd
import load
import metrics

COMPLETE = load.TWO_READERS
RANA = "iftikhar.rana"
NAMES = {COMPLETE[0]: "Aslam", COMPLETE[1]: "Bansal", RANA: "Rana"}


def summarize(diagnoses, user):
    d = diagnoses[diagnoses.user_id == user]
    assert not d.slide_id.duplicated().any()
    cm = pd.crosstab(d.ground_truth, d.label).reindex(
        index=load.GRADE_LABELS, columns=load.GRADE_LABELS, fill_value=0)
    binary = metrics.binary_metrics(d, user)
    exact = int((d.label == d.ground_truth).sum())
    # Direct arithmetic cross-checks the reusable helper, not a new estimate.
    direct_binary = int(((d.label == "non-neoplastic") ==
                         (d.ground_truth == "non-neoplastic")).sum())
    assert direct_binary == binary["tp"] + binary["tn"]
    assert len(d) == binary["n"] == int(cm.to_numpy().sum())
    assert exact == int(cm.to_numpy().trace())
    return {
        "n": len(d), "three_class_correct": exact,
        "three_class_accuracy": exact / len(d),
        "binary_correct": direct_binary, "binary": binary,
        "grade_disagreements_hidden_by_binary_collapse": direct_binary - exact,
        "confusion_order": load.GRADE_LABELS,
        "confusion_rows_reference_columns_reader": cm.to_numpy().tolist(),
        "reference_counts": {c: int((d.ground_truth == c).sum()) for c in load.GRADE_LABELS},
    }


def main():
    comparison = json.loads((OUT / "comparison.json").read_text(encoding="utf-8"))
    for info in comparison["snapshots"].values():
        assert hashlib.sha256((ROOT / info["file"]).read_bytes()).hexdigest() == info["sha256"]
    # Re-extract current labels and require exact equality with the comparison table.
    ev = load.load_events(str(ROOT / comparison["snapshots"]["2026-09-15"]["file"]))
    current = metrics.slide_level_diagnoses(ev, use_fallback=True)
    strict = metrics.slide_level_diagnoses(ev, use_fallback=False)
    saved_labels = pd.read_csv(OUT / "diagnoses-fallback-2026-09-15.csv")
    sort_keys = ["user_id", "slide_id"]
    pd.testing.assert_frame_equal(current.sort_values(sort_keys).reset_index(drop=True),
                                  saved_labels.sort_values(sort_keys).reset_index(drop=True))
    full = {u: summarize(current, u) for u in COMPLETE}
    partial = summarize(current, RANA)
    partial_strict = summarize(strict, RANA)
    subset = set(current[current.user_id == RANA].slide_id)
    matched = {u: summarize(current[current.slide_id.isin(subset)], u) for u in COMPLETE + [RANA]}
    saved = json.loads((ROOT / "analysis/reports/results.json").read_text(encoding="utf-8"))["q1_accuracy"]
    validations = []
    for user in COMPLETE:
        assert math.isclose(full[user]["three_class_accuracy"], saved["three_class_accuracy"][user], abs_tol=1e-12)
        for key, value in saved["binary"][user].items():
            assert math.isclose(full[user]["binary"][key], value, rel_tol=1e-12, abs_tol=1e-12), (user, key)
        validations.append(f"{user}: saved Q1 binary counts/rates and three-class accuracy match")
    result = {
        "snapshot": "2026-09-15",
        "question": "How often does a reader's slide-level diagnosis match the reference label?",
        "label_rule": "Existing metrics.slide_level_diagnoses(use_fallback=True)",
        "complete_readers_250_slides": full,
        "partial_reader_rana_180_slides": partial,
        "partial_reader_rana_strict_slide_next_sensitivity": partial_strict,
        "same_180_slides_descriptive_comparison": matched,
        "validation": validations,
        "limits": [
            "Reference-label agreement does not establish clinical truth or the reason for a disagreement.",
            "Binary labels combine low-grade and high-grade; this is a study coding convention, not a separately validated clinical cancer endpoint.",
            "Rana's results describe only his labelled subset; no estimate is imputed for the remaining 70 slides.",
            "The same-180 comparison equalizes slide membership but does not create a third complete reader or establish a general reader ranking.",
            "There are only two complete readers; shared slides and unresolved patient grouping limit independent-population inference.",
            "The strict sensitivity uses a different subset and cannot by itself attribute a difference to fallback-label quality.",
        ],
        "code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    }
    (OUT / "q1-results.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
