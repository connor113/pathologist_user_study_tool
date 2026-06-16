"""Load and normalise the pathologist event log.

The export (``pathology_events_2026-06-16.csv``) is the denormalised ``events``
table joined to ``users.username`` (column ``user_id``), ``slides.slide_id`` and
``slides.ground_truth``. One row per logged interaction event.

Unit of analysis downstream is a **slide-view** = ``(session_id, viewing_attempt)``;
a ``session`` is unique per ``(user, slide)``, and ``viewing_attempt`` increments
when a reader re-opens a completed slide.
"""
from __future__ import annotations

import pandas as pd

# The two near-complete readers this study focuses on. The others
# (iftikhar.rana 11, alistair.heath 8, admin 2) are partial / testing.
TWO_READERS = ["muhammad.aslam", "ashish.bansal"]
PARTIAL_READERS = ["iftikhar.rana", "alistair.heath", "admin"]

# Ordinal colorectal grade scale (IMP-CRS-2024 classes).
GRADE_ORDER = {"non-neoplastic": 0, "low-grade": 1, "high-grade": 2}
GRADE_LABELS = ["non-neoplastic", "low-grade", "high-grade"]

_NUMERIC_COLS = [
    "zoom_level", "dzi_level", "click_x0", "click_y0", "center_x0", "center_y0",
    "vbx0", "vby0", "vtx0", "vty0", "container_w", "container_h", "dpr",
    "viewing_attempt",
]


def parse_ts(series: pd.Series) -> pd.Series:
    """Parse the JS ``Date.toString()`` timestamps to UTC datetimes.

    Format: ``Thu Mar 26 2026 15:25:05 GMT+0000 (Coordinated Universal Time)``.
    All rows are GMT+0000, so the trailing zone text is stripped and the rest
    parsed as UTC.
    """
    cleaned = series.str.replace(r" GMT.*$", "", regex=True)
    return pd.to_datetime(cleaned, format="%a %b %d %Y %H:%M:%S", utc=True)


def load_events(csv_path: str) -> pd.DataFrame:
    """Load the event log, parse timestamps, coerce numerics, sort chronologically."""
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    # Empty strings -> NA for the columns we treat as optional.
    df = df.replace({"": pd.NA})
    df["ts"] = parse_ts(df["ts_iso8601"])
    for col in _NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df["viewing_attempt"] = df["viewing_attempt"].fillna(1).astype(int)
    # Stable chronological order within each slide-view.
    df = df.sort_values(["user_id", "session_id", "viewing_attempt", "ts"]).reset_index(drop=True)
    return df


def reader_events(df: pd.DataFrame, readers=TWO_READERS) -> pd.DataFrame:
    """Subset to the chosen readers."""
    return df[df["user_id"].isin(readers)].copy()


def view_groups(df: pd.DataFrame):
    """Yield ``((user, slide, session, attempt), group_df)`` per slide-view, time-ordered."""
    keys = ["user_id", "slide_id", "session_id", "viewing_attempt"]
    for key, g in df.groupby(keys, sort=False):
        yield key, g.sort_values("ts")
