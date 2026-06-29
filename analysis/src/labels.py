"""Diagnosis extraction and error coding.

A reader commits a diagnosis per slide-view. The committed label is taken from
the view's final ``slide_next`` event (which carries the label the reader had
selected when advancing); if that is missing we fall back to the last
``label_select`` in the view. Views with neither are flagged ``missing`` and
excluded from accuracy (but kept for behaviour).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from load import GRADE_ORDER, GRADE_LABELS

# Binary "cancer-detection" view of the task: non-neoplastic -> non-cancer,
# low-grade + high-grade -> cancer (the positive class).
BINARY_MAP = {"non-neoplastic": "non-cancer", "low-grade": "cancer", "high-grade": "cancer"}
BINARY_LABELS = ["non-cancer", "cancer"]


def to_binary(label):
    """Collapse a 3-class grade to binary cancer / non-cancer (nan-safe)."""
    return BINARY_MAP.get(label, np.nan)


def committed_label(view_df: pd.DataFrame):
    """Return (label, source) for a single slide-view's committed diagnosis."""
    sn = view_df[(view_df["event"] == "slide_next") & view_df["label"].notna()]
    if len(sn):
        return sn.iloc[-1]["label"], "slide_next"
    ls = view_df[(view_df["event"] == "label_select") & view_df["label"].notna()]
    if len(ls):
        return ls.iloc[-1]["label"], "label_select_fallback"
    return None, "missing"


def label_switches(view_df: pd.DataFrame) -> int:
    """Number of *distinct* labels the reader selected in this view (mind-changes).

    1 = settled immediately; >1 = changed their mind between grades.
    """
    ls = view_df[(view_df["event"] == "label_select") & view_df["label"].notna()]
    return int(ls["label"].nunique()) if len(ls) else 0


def signed_grade_error(committed: str, ground_truth: str):
    """Signed ordinal distance committed - GT.

    <0 = under-grade (read as less severe than the reference),
    >0 = over-grade, 0 = exact.
    """
    if committed not in GRADE_ORDER or ground_truth not in GRADE_ORDER:
        return np.nan
    return GRADE_ORDER[committed] - GRADE_ORDER[ground_truth]


def error_direction(signed) -> str:
    if pd.isna(signed):
        return "missing"
    if signed == 0:
        return "correct"
    return "under" if signed < 0 else "over"


def slide_next_diagnoses(events: pd.DataFrame) -> pd.DataFrame:
    """Event-level committed diagnoses: every ``slide_next`` with a label.

    This is the granularity of the headline accuracy / confusion anchors
    (one row per advance, including re-views).
    """
    sn = events[(events["event"] == "slide_next") & events["label"].notna()].copy()
    sn["correct"] = sn["label"] == sn["ground_truth"]
    sn["signed_error"] = [
        signed_grade_error(l, g) for l, g in zip(sn["label"], sn["ground_truth"])
    ]
    sn["direction"] = sn["signed_error"].map(error_direction)
    return sn


def confusion(diagnoses: pd.DataFrame) -> pd.DataFrame:
    """3x3 confusion (rows = ground truth, cols = chosen), ordered by severity."""
    return (
        pd.crosstab(diagnoses["ground_truth"], diagnoses["label"])
        .reindex(index=GRADE_LABELS, columns=GRADE_LABELS, fill_value=0)
    )
