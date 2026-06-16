"""Adaptive reading exploratory analysis for pathologist viewing telemetry.

This script is intentionally self-contained: it reads the dated CSV export in
the repository root and regenerates all derived tables, SVG figures, the
Markdown report, and a lightweight companion notebook.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
ANALYSIS_DIR = ROOT / "analysis" / "adaptive_reading"
TABLE_DIR = ANALYSIS_DIR / "tables"
FIGURE_DIR = ANALYSIS_DIR / "figures"
INPUT_CSV = ROOT / "pathology_events_2026-06-16.csv"

TIMESTAMP_FORMAT = "%a %b %d %Y %H:%M:%S GMT%z (Coordinated Universal Time)"
LABEL_ORDER = ["non-neoplastic", "low-grade", "high-grade"]
ACTIVE_EVENTS = [
    "cell_click",
    "zoom_step",
    "arrow_pan",
    "back_step",
    "reset",
    "label_select",
    "slide_next",
]
PASSIVE_EVENTS = [
    "viewport_poll",
    "slide_load",
    "app_start",
    "idle_start",
    "idle_end",
]
REQUIRED_COLUMNS = {
    "ts_iso8601",
    "session_id",
    "user_id",
    "slide_id",
    "event",
    "zoom_level",
    "dzi_level",
    "click_x0",
    "click_y0",
    "center_x0",
    "center_y0",
    "vbx0",
    "vby0",
    "vtx0",
    "vty0",
    "container_w",
    "container_h",
    "dpr",
    "app_version",
    "label",
    "notes",
    "viewing_attempt",
    "ground_truth",
}


@dataclass(frozen=True)
class Metric:
    name: str
    value: object
    note: str


def pct(numerator: float, denominator: float) -> float:
    if denominator == 0 or pd.isna(denominator):
        return float("nan")
    return round(100.0 * numerator / denominator, 1)


def round_value(value: object, ndigits: int = 2) -> object:
    if value is None or pd.isna(value):
        return ""
    if isinstance(value, (int, str, bool)):
        return value
    return round(float(value), ndigits)


def fmt_num(value: object, ndigits: int = 1) -> str:
    if value is None or pd.isna(value):
        return "n/a"
    number = float(value)
    if number.is_integer():
        return f"{int(number):,}"
    return f"{number:,.{ndigits}f}"


def fmt_pct(value: object) -> str:
    if value is None or pd.isna(value):
        return "n/a"
    return f"{float(value):.1f}%"


def parse_timestamp(value: object) -> pd.Timestamp:
    if pd.isna(value) or value == "":
        return pd.NaT
    return pd.Timestamp(datetime.strptime(str(value), TIMESTAMP_FORMAT))


def safe_float(value: object) -> float:
    if value is None or value == "" or pd.isna(value):
        return float("nan")
    return float(value)


def csv_escape(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value)


def write_csv(path: Path, rows: Iterable[dict], fieldnames: list[str] | None = None) -> None:
    rows = list(rows)
    if fieldnames is None:
        fieldnames = list(rows[0].keys()) if rows else []
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({name: csv_escape(row.get(name)) for name in fieldnames})


def markdown_table(rows: Iterable[dict], columns: list[str]) -> str:
    rows = list(rows)
    if not rows:
        return "_No rows._"
    header = "| " + " | ".join(columns) + " |"
    separator = "| " + " | ".join(["---"] * len(columns)) + " |"
    body = []
    for row in rows:
        body.append("| " + " | ".join(str(row.get(column, "")) for column in columns) + " |")
    return "\n".join([header, separator, *body])


def load_events(input_csv: Path) -> pd.DataFrame:
    events = pd.read_csv(input_csv, dtype=str, keep_default_na=False)
    missing = sorted(REQUIRED_COLUMNS - set(events.columns))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    events = events.copy()
    events["row_order"] = range(len(events))
    events["ts"] = events["ts_iso8601"].map(parse_timestamp)
    if events["ts"].isna().any():
        bad = events.loc[events["ts"].isna(), "ts_iso8601"].head(5).tolist()
        raise ValueError(f"Could not parse one or more timestamps. Examples: {bad}")

    events["viewing_attempt"] = (
        pd.to_numeric(events["viewing_attempt"].replace("", "1"), errors="coerce")
        .fillna(1)
        .astype(int)
    )
    for column in [
        "zoom_level",
        "dzi_level",
        "click_x0",
        "click_y0",
        "center_x0",
        "center_y0",
        "vbx0",
        "vby0",
        "vtx0",
        "vty0",
        "container_w",
        "container_h",
        "dpr",
    ]:
        events[column] = pd.to_numeric(events[column].replace("", pd.NA), errors="coerce")

    events["has_label"] = events["label"].astype(str).str.len() > 0
    events["has_ground_truth"] = events["ground_truth"].astype(str).str.len() > 0
    events["is_active_event"] = events["event"].isin(ACTIVE_EVENTS)
    events["is_passive_event"] = events["event"].isin(PASSIVE_EVENTS)
    return events


def last_non_empty_label(group: pd.DataFrame) -> str:
    labels = group.loc[group["has_label"]].sort_values(["ts", "row_order"])
    if labels.empty:
        return ""
    return str(labels.iloc[-1]["label"])


def first_non_empty_label(group: pd.DataFrame) -> str:
    labels = group.loc[group["has_label"]].sort_values(["ts", "row_order"])
    if labels.empty:
        return ""
    return str(labels.iloc[0]["label"])


def idle_gap_seconds(group: pd.DataFrame) -> float:
    sorted_group = group.sort_values(["ts", "row_order"])
    idle_start: pd.Timestamp | None = None
    total = 0.0
    for _, row in sorted_group.iterrows():
        if row["event"] == "idle_start" and idle_start is None:
            idle_start = row["ts"]
        elif row["event"] == "idle_end" and idle_start is not None:
            total += max(0.0, (row["ts"] - idle_start).total_seconds())
            idle_start = None
    return total


def gap_capped_duration(group: pd.DataFrame, cap_seconds: int = 30) -> float:
    sorted_group = group.sort_values(["ts", "row_order"])
    if len(sorted_group) < 2:
        return 0.0
    timestamps = sorted_group["ts"].tolist()
    total = 0.0
    for left, right in zip(timestamps, timestamps[1:]):
        total += min(max(0.0, (right - left).total_seconds()), cap_seconds)
    return total


def derive_attempt_features(events: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict] = []
    group_cols = ["user_id", "session_id", "viewing_attempt"]
    for keys, group in events.groupby(group_cols, sort=False):
        user_id, session_id, viewing_attempt = keys
        sorted_group = group.sort_values(["ts", "row_order"])
        raw_duration = (sorted_group["ts"].iloc[-1] - sorted_group["ts"].iloc[0]).total_seconds()
        idle_gap = idle_gap_seconds(sorted_group)
        event_counts = sorted_group["event"].value_counts().to_dict()
        zoom_values = sorted_group["zoom_level"].dropna()
        rows.append(
            {
                "user_id": user_id,
                "session_id": session_id,
                "slide_id": sorted_group["slide_id"].iloc[0],
                "viewing_attempt": int(viewing_attempt),
                "ground_truth": sorted_group["ground_truth"].replace("", pd.NA).dropna().iloc[0]
                if sorted_group["ground_truth"].replace("", pd.NA).dropna().shape[0]
                else "",
                "first_event_at": sorted_group["ts"].iloc[0].isoformat(),
                "last_event_at": sorted_group["ts"].iloc[-1].isoformat(),
                "event_count": int(len(sorted_group)),
                "active_event_count": int(sorted_group["is_active_event"].sum()),
                "passive_event_count": int(sorted_group["is_passive_event"].sum()),
                "cell_click_count": int(event_counts.get("cell_click", 0)),
                "zoom_step_count": int(event_counts.get("zoom_step", 0)),
                "arrow_pan_count": int(event_counts.get("arrow_pan", 0)),
                "viewport_poll_count": int(event_counts.get("viewport_poll", 0)),
                "idle_start_count": int(event_counts.get("idle_start", 0)),
                "idle_end_count": int(event_counts.get("idle_end", 0)),
                "label_select_count": int(event_counts.get("label_select", 0)),
                "slide_next_count": int(event_counts.get("slide_next", 0)),
                "back_step_count": int(event_counts.get("back_step", 0)),
                "reset_count": int(event_counts.get("reset", 0)),
                "raw_duration_s": round(raw_duration, 3),
                "idle_gap_s": round(idle_gap, 3),
                "idle_adjusted_duration_s": round(max(0.0, raw_duration - idle_gap), 3),
                "gap_capped_duration_s": round(gap_capped_duration(sorted_group), 3),
                "max_zoom": round_value(zoom_values.max(), 2) if not zoom_values.empty else "",
                "median_zoom": round_value(zoom_values.median(), 2) if not zoom_values.empty else "",
                "max_dzi_level": int(sorted_group["dzi_level"].max())
                if not sorted_group["dzi_level"].dropna().empty
                else "",
                "final_attempt_label": last_non_empty_label(sorted_group),
            }
        )
    attempts = pd.DataFrame(rows)
    return attempts.sort_values(["user_id", "session_id", "viewing_attempt"]).reset_index(drop=True)


def derive_session_features(events: pd.DataFrame, attempts: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict] = []
    for keys, group in events.groupby(["user_id", "session_id"], sort=False):
        user_id, session_id = keys
        sorted_group = group.sort_values(["ts", "row_order"])
        attempt_subset = attempts[(attempts["user_id"] == user_id) & (attempts["session_id"] == session_id)]
        labels = sorted_group.loc[sorted_group["has_label"]].sort_values(["ts", "row_order"])["label"].tolist()
        final_label = labels[-1] if labels else ""
        first_label = labels[0] if labels else ""
        raw_duration = (sorted_group["ts"].iloc[-1] - sorted_group["ts"].iloc[0]).total_seconds()
        event_counts = sorted_group["event"].value_counts().to_dict()
        zoom_values = sorted_group["zoom_level"].dropna()
        ground_truth_values = sorted_group["ground_truth"].replace("", pd.NA).dropna()
        ground_truth = ground_truth_values.iloc[0] if len(ground_truth_values) else ""
        rows.append(
            {
                "user_id": user_id,
                "session_id": session_id,
                "slide_id": sorted_group["slide_id"].iloc[0],
                "ground_truth": ground_truth,
                "final_label": final_label,
                "first_label": first_label,
                "label_event_count": int(len(labels)),
                "label_changed_within_session": bool(first_label and final_label and first_label != final_label),
                "is_labelled": bool(final_label),
                "is_correct": bool(final_label and ground_truth and final_label == ground_truth),
                "first_event_at": sorted_group["ts"].iloc[0].isoformat(),
                "last_event_at": sorted_group["ts"].iloc[-1].isoformat(),
                "event_count": int(len(sorted_group)),
                "attempt_count": int(sorted_group["viewing_attempt"].nunique()),
                "active_event_count": int(sorted_group["is_active_event"].sum()),
                "passive_event_count": int(sorted_group["is_passive_event"].sum()),
                "cell_click_count": int(event_counts.get("cell_click", 0)),
                "zoom_step_count": int(event_counts.get("zoom_step", 0)),
                "arrow_pan_count": int(event_counts.get("arrow_pan", 0)),
                "viewport_poll_count": int(event_counts.get("viewport_poll", 0)),
                "idle_start_count": int(event_counts.get("idle_start", 0)),
                "idle_end_count": int(event_counts.get("idle_end", 0)),
                "label_select_count": int(event_counts.get("label_select", 0)),
                "slide_next_count": int(event_counts.get("slide_next", 0)),
                "raw_duration_s": round(raw_duration, 3),
                "idle_adjusted_duration_s": round(attempt_subset["idle_adjusted_duration_s"].sum(), 3),
                "gap_capped_duration_s": round(attempt_subset["gap_capped_duration_s"].sum(), 3),
                "max_zoom": round_value(zoom_values.max(), 2) if not zoom_values.empty else "",
                "median_zoom": round_value(zoom_values.median(), 2) if not zoom_values.empty else "",
                "reached_10x_plus": bool((zoom_values >= 10).any()) if not zoom_values.empty else False,
                "reached_20x_plus": bool((zoom_values >= 20).any()) if not zoom_values.empty else False,
                "reached_40x": bool((zoom_values >= 40).any()) if not zoom_values.empty else False,
                "never_above_5x": bool((zoom_values <= 5).all()) if not zoom_values.empty else False,
            }
        )
    sessions = pd.DataFrame(rows)
    return sessions.sort_values(["user_id", "session_id"]).reset_index(drop=True)


def select_focus_users(sessions: pd.DataFrame, events: pd.DataFrame) -> list[str]:
    session_counts = (
        sessions.groupby("user_id")
        .agg(
            labelled_sessions=("is_labelled", "sum"),
            sessions=("session_id", "nunique"),
        )
        .reset_index()
    )
    event_counts = events.groupby("user_id").size().rename("events").reset_index()
    overview = session_counts.merge(event_counts, on="user_id", how="left")
    overview = overview.sort_values(["labelled_sessions", "events"], ascending=[False, False])
    return overview.head(2)["user_id"].tolist()


def build_user_overview(sessions: pd.DataFrame, attempts: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    overview = (
        sessions.groupby("user_id")
        .agg(
            sessions=("session_id", "nunique"),
            slides=("slide_id", "nunique"),
            labelled_sessions=("is_labelled", "sum"),
            correct_sessions=("is_correct", "sum"),
            sessions_with_revisits=("attempt_count", lambda s: int((s > 1).sum())),
            label_changes_within_session=("label_changed_within_session", "sum"),
        )
        .reset_index()
    )
    attempt_counts = attempts.groupby("user_id").size().rename("attempts").reset_index()
    event_counts = events.groupby("user_id").size().rename("events").reset_index()
    overview = overview.merge(attempt_counts, on="user_id", how="left").merge(event_counts, on="user_id", how="left")
    overview["accuracy_pct"] = overview.apply(
        lambda row: pct(row["correct_sessions"], row["labelled_sessions"]), axis=1
    )
    overview = overview[
        [
            "user_id",
            "events",
            "sessions",
            "slides",
            "attempts",
            "labelled_sessions",
            "correct_sessions",
            "accuracy_pct",
            "sessions_with_revisits",
            "label_changes_within_session",
        ]
    ]
    return overview.sort_values(["labelled_sessions", "events"], ascending=[False, False]).reset_index(drop=True)


def summarize_focus_users(
    sessions: pd.DataFrame, attempts: pd.DataFrame, events: pd.DataFrame, focus_users: list[str]
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    focus_sessions = sessions[sessions["user_id"].isin(focus_users)].copy()
    focus_attempts = attempts[attempts["user_id"].isin(focus_users)].copy()
    focus_events = events[events["user_id"].isin(focus_users)].copy()

    rows = []
    for user_id, subset in focus_sessions.groupby("user_id"):
        labelled = subset[subset["is_labelled"]]
        rows.append(
            {
                "user_id": user_id,
                "sessions": int(len(subset)),
                "labelled_sessions": int(labelled.shape[0]),
                "correct_sessions": int(labelled["is_correct"].sum()),
                "accuracy_pct": pct(labelled["is_correct"].sum(), labelled.shape[0]),
                "median_max_zoom": round_value(labelled["max_zoom"].replace("", pd.NA).dropna().astype(float).median(), 1),
                "pct_never_above_5x": pct(labelled["never_above_5x"].sum(), labelled.shape[0]),
                "pct_reached_10x_plus": pct(labelled["reached_10x_plus"].sum(), labelled.shape[0]),
                "pct_reached_20x_plus": pct(labelled["reached_20x_plus"].sum(), labelled.shape[0]),
                "pct_reached_40x": pct(labelled["reached_40x"].sum(), labelled.shape[0]),
                "median_active_events": round_value(labelled["active_event_count"].median(), 1),
                "median_gap_capped_duration_s": round_value(labelled["gap_capped_duration_s"].median(), 1),
                "median_idle_adjusted_duration_s": round_value(labelled["idle_adjusted_duration_s"].median(), 1),
            }
        )
    focus_summary = pd.DataFrame(rows).sort_values("labelled_sessions", ascending=False)

    event_distribution = (
        focus_events.groupby(["user_id", "event"])
        .size()
        .rename("event_count")
        .reset_index()
        .sort_values(["user_id", "event_count"], ascending=[True, False])
    )
    totals = focus_events.groupby("user_id").size().rename("user_event_total").reset_index()
    event_distribution = event_distribution.merge(totals, on="user_id")
    event_distribution["event_pct"] = event_distribution.apply(
        lambda row: pct(row["event_count"], row["user_event_total"]), axis=1
    )

    attempt_summary_rows = []
    for (user_id, outcome), subset in focus_attempts.merge(
        focus_sessions[["user_id", "session_id", "is_labelled", "is_correct", "final_label"]],
        on=["user_id", "session_id"],
        how="left",
    ).groupby(["user_id", "is_correct"]):
        labelled_subset = subset[subset["is_labelled"]]
        if labelled_subset.empty:
            continue
        attempt_summary_rows.append(
            {
                "user_id": user_id,
                "outcome": "correct" if outcome else "incorrect",
                "attempts": int(labelled_subset.shape[0]),
                "median_gap_capped_duration_s": round_value(labelled_subset["gap_capped_duration_s"].median(), 1),
                "median_idle_adjusted_duration_s": round_value(labelled_subset["idle_adjusted_duration_s"].median(), 1),
                "median_active_events": round_value(labelled_subset["active_event_count"].median(), 1),
                "median_cell_clicks": round_value(labelled_subset["cell_click_count"].median(), 1),
                "median_zoom_steps": round_value(labelled_subset["zoom_step_count"].median(), 1),
                "median_viewport_polls": round_value(labelled_subset["viewport_poll_count"].median(), 1),
                "avg_active_events": round_value(labelled_subset["active_event_count"].mean(), 2),
            }
        )
    attempt_summary = pd.DataFrame(attempt_summary_rows).sort_values(["user_id", "outcome"])
    return focus_summary, event_distribution, attempt_summary


def build_zoom_tables(sessions: pd.DataFrame, events: pd.DataFrame, focus_users: list[str]) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    focus_sessions = sessions[(sessions["user_id"].isin(focus_users)) & (sessions["is_labelled"])].copy()
    rows = []
    for user_id, subset in focus_sessions.groupby("user_id"):
        rows.append(
            {
                "user_id": user_id,
                "cohort": "all_labelled",
                "sessions": int(subset.shape[0]),
                "median_max_zoom": round_value(subset["max_zoom"].replace("", pd.NA).dropna().astype(float).median(), 1),
                "pct_never_above_5x": pct(subset["never_above_5x"].sum(), subset.shape[0]),
                "pct_reached_10x_plus": pct(subset["reached_10x_plus"].sum(), subset.shape[0]),
                "pct_reached_20x_plus": pct(subset["reached_20x_plus"].sum(), subset.shape[0]),
                "pct_reached_40x": pct(subset["reached_40x"].sum(), subset.shape[0]),
            }
        )
    for (user_id, ground_truth), subset in focus_sessions.groupby(["user_id", "ground_truth"]):
        rows.append(
            {
                "user_id": user_id,
                "cohort": f"ground_truth={ground_truth}",
                "sessions": int(subset.shape[0]),
                "median_max_zoom": round_value(subset["max_zoom"].replace("", pd.NA).dropna().astype(float).median(), 1),
                "pct_never_above_5x": pct(subset["never_above_5x"].sum(), subset.shape[0]),
                "pct_reached_10x_plus": pct(subset["reached_10x_plus"].sum(), subset.shape[0]),
                "pct_reached_20x_plus": pct(subset["reached_20x_plus"].sum(), subset.shape[0]),
                "pct_reached_40x": pct(subset["reached_40x"].sum(), subset.shape[0]),
            }
        )
    zoom_summary = pd.DataFrame(rows)

    focus_events = events[events["user_id"].isin(focus_users) & events["zoom_level"].notna()].copy()
    bins = [
        ("fit_or_below_1x", lambda z: z < 1),
        ("low_1x_to_5x", lambda z: (z >= 1) & (z <= 5)),
        ("mid_10x", lambda z: z == 10),
        ("high_20x_40x", lambda z: z >= 20),
    ]
    event_bin_rows = []
    for user_id, subset in focus_events.groupby("user_id"):
        total = subset.shape[0]
        for label, predicate in bins:
            count = int(predicate(subset["zoom_level"]).sum())
            event_bin_rows.append(
                {
                    "user_id": user_id,
                    "zoom_bin": label,
                    "event_count": count,
                    "event_pct": pct(count, total),
                }
            )
    zoom_event_bins = pd.DataFrame(event_bin_rows)

    zoom_ground_truth = zoom_summary[zoom_summary["cohort"].str.startswith("ground_truth=")].copy()
    zoom_ground_truth["ground_truth"] = zoom_ground_truth["cohort"].str.replace("ground_truth=", "", regex=False)
    return zoom_summary, zoom_event_bins, zoom_ground_truth


def build_diagnosis_tables(sessions: pd.DataFrame, focus_users: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    labelled = sessions[(sessions["user_id"].isin(focus_users)) & sessions["is_labelled"] & (sessions["ground_truth"] != "")].copy()
    confusion = (
        labelled.groupby(["user_id", "ground_truth", "final_label"])
        .size()
        .rename("session_count")
        .reset_index()
        .sort_values(["user_id", "ground_truth", "final_label"])
    )
    rows = []
    for user_id, subset in labelled.groupby("user_id"):
        total = subset.shape[0]
        correct = int(subset["is_correct"].sum())
        rows.append(
            {
                "user_id": user_id,
                "label": "overall",
                "actual_n": total,
                "assigned_n": total,
                "true_positive_n": correct,
                "recall_pct": pct(correct, total),
                "precision_pct": pct(correct, total),
            }
        )
        for label in LABEL_ORDER:
            actual_n = int((subset["ground_truth"] == label).sum())
            assigned_n = int((subset["final_label"] == label).sum())
            true_positive_n = int(((subset["ground_truth"] == label) & (subset["final_label"] == label)).sum())
            rows.append(
                {
                    "user_id": user_id,
                    "label": label,
                    "actual_n": actual_n,
                    "assigned_n": assigned_n,
                    "true_positive_n": true_positive_n,
                    "recall_pct": pct(true_positive_n, actual_n),
                    "precision_pct": pct(true_positive_n, assigned_n),
                }
            )
    label_metrics = pd.DataFrame(rows)
    return confusion, label_metrics


def build_overlap_tables(sessions: pd.DataFrame, focus_users: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    if len(focus_users) != 2:
        raise ValueError("Overlap analysis expects exactly two focus users.")
    left_user, right_user = focus_users
    labelled = sessions[(sessions["user_id"].isin(focus_users)) & sessions["is_labelled"]].copy()
    left = labelled[labelled["user_id"] == left_user].copy()
    right = labelled[labelled["user_id"] == right_user].copy()
    overlap = left.merge(right, on="slide_id", suffixes=(f"__{left_user}", f"__{right_user}"))
    rows = []
    for _, row in overlap.iterrows():
        ground_truth = row.get(f"ground_truth__{left_user}") or row.get(f"ground_truth__{right_user}")
        left_label = row[f"final_label__{left_user}"]
        right_label = row[f"final_label__{right_user}"]
        left_correct = bool(left_label == ground_truth)
        right_correct = bool(right_label == ground_truth)
        if left_correct and right_correct:
            outcome = "both_correct"
        elif left_correct or right_correct:
            outcome = "one_correct"
        else:
            outcome = "neither_correct"
        rows.append(
            {
                "slide_id": row["slide_id"],
                "ground_truth": ground_truth,
                f"{left_user}_label": left_label,
                f"{right_user}_label": right_label,
                "pathologists_agree": bool(left_label == right_label),
                "outcome": outcome,
                f"{left_user}_correct": left_correct,
                f"{right_user}_correct": right_correct,
                f"{left_user}_event_count": int(row[f"event_count__{left_user}"]),
                f"{right_user}_event_count": int(row[f"event_count__{right_user}"]),
                f"{left_user}_active_events": int(row[f"active_event_count__{left_user}"]),
                f"{right_user}_active_events": int(row[f"active_event_count__{right_user}"]),
                f"{left_user}_gap_capped_duration_s": row[f"gap_capped_duration_s__{left_user}"],
                f"{right_user}_gap_capped_duration_s": row[f"gap_capped_duration_s__{right_user}"],
                f"{left_user}_max_zoom": row[f"max_zoom__{left_user}"],
                f"{right_user}_max_zoom": row[f"max_zoom__{right_user}"],
            }
        )
    overlap_detail = pd.DataFrame(rows).sort_values("slide_id").reset_index(drop=True)
    summary_rows = []
    total = overlap_detail.shape[0]
    agree = int(overlap_detail["pathologists_agree"].sum())
    summary_rows.append({"metric": "overlap_slides", "value": total})
    summary_rows.append({"metric": "pathologists_agree", "value": agree})
    summary_rows.append({"metric": "pathologists_disagree", "value": total - agree})
    summary_rows.append({"metric": "agreement_pct", "value": pct(agree, total)})
    for outcome in ["both_correct", "one_correct", "neither_correct"]:
        summary_rows.append({"metric": outcome, "value": int((overlap_detail["outcome"] == outcome).sum())})
    overlap_summary = pd.DataFrame(summary_rows)
    disagreements = overlap_detail[~overlap_detail["pathologists_agree"]].copy()
    return overlap_summary, disagreements


def build_duration_sensitivity(attempts: pd.DataFrame, sessions: pd.DataFrame, focus_users: list[str]) -> pd.DataFrame:
    joined = attempts.merge(
        sessions[["user_id", "session_id", "is_labelled", "is_correct"]],
        on=["user_id", "session_id"],
        how="left",
    )
    joined = joined[(joined["user_id"].isin(focus_users)) & joined["is_labelled"]].copy()
    rows = []
    for user_id, subset in joined.groupby("user_id"):
        rows.append(
            {
                "user_id": user_id,
                "attempts": int(subset.shape[0]),
                "attempts_with_idle_gap": int((subset["idle_gap_s"] > 0).sum()),
                "median_raw_duration_s": round_value(subset["raw_duration_s"].median(), 1),
                "avg_raw_duration_s": round_value(subset["raw_duration_s"].mean(), 2),
                "p90_raw_duration_s": round_value(subset["raw_duration_s"].quantile(0.9), 1),
                "median_idle_adjusted_duration_s": round_value(subset["idle_adjusted_duration_s"].median(), 1),
                "avg_idle_adjusted_duration_s": round_value(subset["idle_adjusted_duration_s"].mean(), 2),
                "p90_idle_adjusted_duration_s": round_value(subset["idle_adjusted_duration_s"].quantile(0.9), 1),
                "median_gap_capped_duration_s": round_value(subset["gap_capped_duration_s"].median(), 1),
                "avg_gap_capped_duration_s": round_value(subset["gap_capped_duration_s"].mean(), 2),
                "p90_gap_capped_duration_s": round_value(subset["gap_capped_duration_s"].quantile(0.9), 1),
            }
        )
    return pd.DataFrame(rows)


def svg_header(width: int, height: int) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<style>text{font-family:Arial,Helvetica,sans-serif;fill:#263238}.title{font-size:20px;font-weight:700}.subtitle{font-size:12px;fill:#54656f}.axis{font-size:11px;fill:#54656f}.label{font-size:12px}.value{font-size:11px;fill:#263238}.grid{stroke:#d8dee3;stroke-width:1}.axis-line{stroke:#9aa7b0;stroke-width:1}.note{font-size:10px;fill:#6b7880}</style>',
    ]


def write_grouped_bar_svg(
    path: Path,
    title: str,
    subtitle: str,
    categories: list[str],
    series: dict[str, list[float]],
    y_label: str,
    max_value: float | None = None,
    colors: list[str] | None = None,
) -> None:
    width, height = 920, 520
    left, right, top, bottom = 95, 40, 82, 85
    plot_w = width - left - right
    plot_h = height - top - bottom
    colors = colors or ["#2364aa", "#d98c00", "#4d9078", "#c44569"]
    max_value = max_value or max(max(values) for values in series.values())
    max_value = max(1.0, math.ceil(max_value / 10.0) * 10.0)
    lines = svg_header(width, height)
    lines.append(f'<text class="title" x="{left}" y="34">{html.escape(title)}</text>')
    lines.append(f'<text class="subtitle" x="{left}" y="55">{html.escape(subtitle)}</text>')
    for i in range(6):
        tick = max_value * i / 5
        y = top + plot_h - (tick / max_value) * plot_h
        lines.append(f'<line class="grid" x1="{left}" x2="{width-right}" y1="{y:.1f}" y2="{y:.1f}"/>')
        lines.append(f'<text class="axis" x="{left-10}" y="{y+4:.1f}" text-anchor="end">{tick:.0f}</text>')
    lines.append(f'<line class="axis-line" x1="{left}" x2="{left}" y1="{top}" y2="{top+plot_h}"/>')
    lines.append(f'<line class="axis-line" x1="{left}" x2="{width-right}" y1="{top+plot_h}" y2="{top+plot_h}"/>')
    lines.append(
        f'<text class="axis" transform="translate(22 {top + plot_h / 2:.1f}) rotate(-90)" text-anchor="middle">{html.escape(y_label)}</text>'
    )
    group_w = plot_w / max(1, len(categories))
    bar_gap = 5
    series_names = list(series)
    bar_w = min(36, (group_w - 22) / max(1, len(series_names)) - bar_gap)
    for c_idx, category in enumerate(categories):
        group_x = left + c_idx * group_w
        lines.append(
            f'<text class="axis" x="{group_x + group_w/2:.1f}" y="{top+plot_h+26}" text-anchor="middle">{html.escape(category)}</text>'
        )
        total_bars_w = len(series_names) * bar_w + (len(series_names) - 1) * bar_gap
        start_x = group_x + (group_w - total_bars_w) / 2
        for s_idx, name in enumerate(series_names):
            value = float(series[name][c_idx])
            bar_h = (value / max_value) * plot_h
            x = start_x + s_idx * (bar_w + bar_gap)
            y = top + plot_h - bar_h
            color = colors[s_idx % len(colors)]
            lines.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{bar_h:.1f}" fill="{color}"/>')
            lines.append(f'<text class="value" x="{x + bar_w/2:.1f}" y="{y-5:.1f}" text-anchor="middle">{value:.1f}</text>')
    legend_x = left
    legend_y = height - 28
    for idx, name in enumerate(series_names):
        x = legend_x + idx * 210
        lines.append(f'<rect x="{x}" y="{legend_y-11}" width="12" height="12" fill="{colors[idx % len(colors)]}"/>')
        lines.append(f'<text class="axis" x="{x+18}" y="{legend_y}">{html.escape(name)}</text>')
    lines.append("</svg>")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_single_bar_svg(
    path: Path,
    title: str,
    subtitle: str,
    rows: list[tuple[str, float]],
    x_label: str,
    color: str = "#2364aa",
) -> None:
    width, height = 900, 460
    left, right, top, bottom = 230, 45, 82, 55
    plot_w = width - left - right
    plot_h = height - top - bottom
    max_value = max(1.0, math.ceil(max(v for _, v in rows) / 10.0) * 10.0)
    bar_gap = 14
    bar_h = (plot_h - bar_gap * (len(rows) - 1)) / len(rows)
    lines = svg_header(width, height)
    lines.append(f'<text class="title" x="{left}" y="34">{html.escape(title)}</text>')
    lines.append(f'<text class="subtitle" x="{left}" y="55">{html.escape(subtitle)}</text>')
    for i in range(6):
        tick = max_value * i / 5
        x = left + (tick / max_value) * plot_w
        lines.append(f'<line class="grid" x1="{x:.1f}" x2="{x:.1f}" y1="{top}" y2="{top+plot_h}"/>')
        lines.append(f'<text class="axis" x="{x:.1f}" y="{top+plot_h+22}" text-anchor="middle">{tick:.0f}</text>')
    lines.append(f'<line class="axis-line" x1="{left}" x2="{width-right}" y1="{top+plot_h}" y2="{top+plot_h}"/>')
    for idx, (label, value) in enumerate(rows):
        y = top + idx * (bar_h + bar_gap)
        w = (value / max_value) * plot_w
        lines.append(f'<text class="label" x="{left-12}" y="{y + bar_h/2 + 4:.1f}" text-anchor="end">{html.escape(label)}</text>')
        lines.append(f'<rect x="{left}" y="{y:.1f}" width="{w:.1f}" height="{bar_h:.1f}" fill="{color}"/>')
        lines.append(f'<text class="value" x="{left+w+7:.1f}" y="{y + bar_h/2 + 4:.1f}">{value:.1f}</text>')
    lines.append(f'<text class="axis" x="{left + plot_w/2:.1f}" y="{height-12}" text-anchor="middle">{html.escape(x_label)}</text>')
    lines.append("</svg>")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_figures(
    focus_summary: pd.DataFrame,
    zoom_event_bins: pd.DataFrame,
    label_metrics: pd.DataFrame,
    attempt_summary: pd.DataFrame,
    overlap_summary: pd.DataFrame,
) -> list[dict]:
    chart_map: list[dict] = []
    users = focus_summary["user_id"].tolist()

    threshold_series = {
        "Never >5x": focus_summary["pct_never_above_5x"].astype(float).tolist(),
        "Reached 10x+": focus_summary["pct_reached_10x_plus"].astype(float).tolist(),
        "Reached 20x+": focus_summary["pct_reached_20x_plus"].astype(float).tolist(),
        "Reached 40x": focus_summary["pct_reached_40x"].astype(float).tolist(),
    }
    figure = FIGURE_DIR / "zoom_session_thresholds.svg"
    write_grouped_bar_svg(
        figure,
        "Maximum zoom reached per labelled slide",
        "Most sessions stay at or below 5x; high-resolution inspection is selective.",
        users,
        threshold_series,
        "% of labelled sessions",
        max_value=100,
    )
    chart_map.append(
        {
            "figure": figure.name,
            "section": "Low magnification dominates the viewing strategy",
            "question": "How often did pathologists move beyond low/mid magnification?",
            "chart_type": "grouped bar",
            "supports_claim": "About 63% of labelled sessions never went above 5x; only about 12% reached 20x+.",
        }
    )

    bins = ["fit_or_below_1x", "low_1x_to_5x", "mid_10x", "high_20x_40x"]
    bin_labels = ["<1x", "1x-5x", "10x", "20x-40x"]
    event_series = {}
    for user in users:
        subset = zoom_event_bins[zoom_event_bins["user_id"] == user].set_index("zoom_bin")
        event_series[user] = [float(subset.loc[bin_name, "event_pct"]) for bin_name in bins]
    figure = FIGURE_DIR / "zoom_event_bins.svg"
    write_grouped_bar_svg(
        figure,
        "Event-level zoom distribution",
        "Zoomed observations are overwhelmingly concentrated between 1x and 5x.",
        bin_labels,
        event_series,
        "% of events with zoom level",
        max_value=100,
        colors=["#2364aa", "#d98c00"],
    )
    chart_map.append(
        {
            "figure": figure.name,
            "section": "Low magnification dominates the viewing strategy",
            "question": "Where is event time concentrated across the magnification ladder?",
            "chart_type": "grouped bar",
            "supports_claim": "Roughly 72-74% of zoomed events sit in the 1x-5x band.",
        }
    )

    high_grade = label_metrics[label_metrics["label"] == "high-grade"].copy()
    high_grade_series = {
        "Recall": high_grade["recall_pct"].astype(float).tolist(),
        "Precision": high_grade["precision_pct"].astype(float).tolist(),
    }
    figure = FIGURE_DIR / "high_grade_precision_recall.svg"
    write_grouped_bar_svg(
        figure,
        "High-grade calls are conservative",
        "High-grade precision is high, but recall is low, pointing to undercalling.",
        high_grade["user_id"].tolist(),
        high_grade_series,
        "%",
        max_value=100,
        colors=["#c44569", "#2364aa"],
    )
    chart_map.append(
        {
            "figure": figure.name,
            "section": "High-grade undercalling is the sharpest diagnostic asymmetry",
            "question": "Are high-grade errors mostly false positives or false negatives?",
            "chart_type": "grouped bar",
            "supports_claim": "High-grade recall is about 40-44%, while precision is about 90-96%.",
        }
    )

    effort_rows = []
    for _, row in attempt_summary.sort_values(["user_id", "outcome"]).iterrows():
        effort_rows.append((f"{row['user_id']} - {row['outcome']}", float(row["median_active_events"])))
    figure = FIGURE_DIR / "active_events_by_outcome.svg"
    write_single_bar_svg(
        figure,
        "Median active events by diagnostic outcome",
        "Incorrect attempts show slightly heavier active navigation, especially for the complete 250-slide user.",
        effort_rows,
        "median active events per attempt",
        color="#4d9078",
    )
    chart_map.append(
        {
            "figure": figure.name,
            "section": "Effort and error move together, but the signal is modest",
            "question": "Do incorrect diagnoses have more active navigation?",
            "chart_type": "horizontal bar",
            "supports_claim": "Incorrect attempts have modestly higher median active-event counts.",
        }
    )

    overlap_counts = overlap_summary[overlap_summary["metric"].isin(["both_correct", "one_correct", "neither_correct"])]
    overlap_rows = [(str(row["metric"]).replace("_", " "), float(row["value"])) for _, row in overlap_counts.iterrows()]
    figure = FIGURE_DIR / "overlap_outcomes.svg"
    write_single_bar_svg(
        figure,
        "Outcomes on slides both focus pathologists labelled",
        "Shared mistakes are common enough to be an experimental-design object, not just noise.",
        overlap_rows,
        "overlap slides",
        color="#d98c00",
    )
    chart_map.append(
        {
            "figure": figure.name,
            "section": "Agreement is high, but shared wrongness is the useful anomaly",
            "question": "On overlap slides, how often are both observers correct or wrong?",
            "chart_type": "horizontal bar",
            "supports_claim": "Of 184 overlap slides, 109 are both-correct and 51 are neither-correct.",
        }
    )
    return chart_map


def build_headline_metrics(
    events: pd.DataFrame,
    user_overview: pd.DataFrame,
    focus_summary: pd.DataFrame,
    label_metrics: pd.DataFrame,
    overlap_summary: pd.DataFrame,
) -> pd.DataFrame:
    rows: list[Metric] = [
        Metric("input_csv_rows", int(events.shape[0]), "Rows read from pathology_events_2026-06-16.csv."),
        Metric("focus_users", ", ".join(focus_summary["user_id"].tolist()), "Top two users by labelled sessions."),
    ]
    for _, row in focus_summary.iterrows():
        user = row["user_id"]
        rows.extend(
            [
                Metric(f"{user}_labelled_sessions", int(row["labelled_sessions"]), "Derived from final non-empty label per user-slide."),
                Metric(f"{user}_accuracy_pct", row["accuracy_pct"], "Exact match between final label and ground_truth."),
                Metric(f"{user}_pct_never_above_5x", row["pct_never_above_5x"], "Share of labelled sessions whose max zoom is <=5x."),
                Metric(f"{user}_pct_reached_20x_plus", row["pct_reached_20x_plus"], "Share of labelled sessions reaching 20x or 40x."),
            ]
        )
        high_grade = label_metrics[(label_metrics["user_id"] == user) & (label_metrics["label"] == "high-grade")].iloc[0]
        rows.extend(
            [
                Metric(f"{user}_high_grade_recall_pct", high_grade["recall_pct"], "Recall against ground-truth high-grade slides."),
                Metric(f"{user}_high_grade_precision_pct", high_grade["precision_pct"], "Precision among high-grade assignments."),
            ]
        )
    for _, row in overlap_summary.iterrows():
        rows.append(Metric(f"overlap_{row['metric']}", row["value"], "Two-focus-user overlap analysis."))
    return pd.DataFrame([metric.__dict__ for metric in rows])


def build_validation_checks(
    events: pd.DataFrame,
    focus_users: list[str],
    user_overview: pd.DataFrame,
    overlap_summary: pd.DataFrame,
) -> pd.DataFrame:
    expected = {
        "input_csv_rows": 17354,
        "focus_users": ["muhammad.aslam", "ashish.bansal"],
        "muhammad.aslam_labelled_sessions": 250,
        "ashish.bansal_labelled_sessions": 184,
        "overlap_slides": 184,
        "pathologists_agree": 160,
        "both_correct": 109,
        "one_correct": 24,
        "neither_correct": 51,
    }
    checks = []

    def add_check(name: str, observed: object, expected_value: object) -> None:
        checks.append(
            {
                "check": name,
                "observed": observed,
                "expected": expected_value,
                "status": "pass" if observed == expected_value else "fail",
            }
        )

    add_check("input_csv_rows", int(events.shape[0]), expected["input_csv_rows"])
    add_check("focus_users", focus_users, expected["focus_users"])
    overview = user_overview.set_index("user_id")
    add_check(
        "muhammad.aslam_labelled_sessions",
        int(overview.loc["muhammad.aslam", "labelled_sessions"]),
        expected["muhammad.aslam_labelled_sessions"],
    )
    add_check(
        "ashish.bansal_labelled_sessions",
        int(overview.loc["ashish.bansal", "labelled_sessions"]),
        expected["ashish.bansal_labelled_sessions"],
    )
    overlap = overlap_summary.set_index("metric")["value"].to_dict()
    for key in ["overlap_slides", "pathologists_agree", "both_correct", "one_correct", "neither_correct"]:
        add_check(key, int(float(overlap[key])), expected[key])
    return pd.DataFrame(checks)


def write_report(
    focus_summary: pd.DataFrame,
    label_metrics: pd.DataFrame,
    overlap_summary: pd.DataFrame,
    attempt_summary: pd.DataFrame,
    duration_sensitivity: pd.DataFrame,
    validation_checks: pd.DataFrame,
    chart_map: list[dict],
) -> None:
    user_order = {user_id: index for index, user_id in enumerate(focus_summary["user_id"].tolist())}
    focus_rows = []
    for _, row in focus_summary.iterrows():
        focus_rows.append(
            {
                "Pathologist": row["user_id"],
                "Labelled slides": int(row["labelled_sessions"]),
                "Accuracy": fmt_pct(row["accuracy_pct"]),
                "Never >5x": fmt_pct(row["pct_never_above_5x"]),
                "Reached 20x+": fmt_pct(row["pct_reached_20x_plus"]),
                "Median active events": fmt_num(row["median_active_events"], 1),
                "Median active seconds": fmt_num(row["median_gap_capped_duration_s"], 1),
            }
        )
    high_grade_rows = []
    high_grade_metrics = label_metrics[label_metrics["label"] == "high-grade"].copy()
    high_grade_metrics["_user_order"] = high_grade_metrics["user_id"].map(user_order)
    high_grade_metrics = high_grade_metrics.sort_values("_user_order")
    for _, row in high_grade_metrics.iterrows():
        high_grade_rows.append(
            {
                "Pathologist": row["user_id"],
                "High-grade actual": int(row["actual_n"]),
                "High-grade assigned": int(row["assigned_n"]),
                "Recall": fmt_pct(row["recall_pct"]),
                "Precision": fmt_pct(row["precision_pct"]),
            }
        )
    overlap = overlap_summary.set_index("metric")["value"].to_dict()
    duration_rows = []
    duration_table = duration_sensitivity.copy()
    duration_table["_user_order"] = duration_table["user_id"].map(user_order)
    duration_table = duration_table.sort_values("_user_order")
    for _, row in duration_table.iterrows():
        duration_rows.append(
            {
                "Pathologist": row["user_id"],
                "Labelled attempts": int(row["attempts"]),
                "Attempts with idle": int(row["attempts_with_idle_gap"]),
                "Median raw s": fmt_num(row["median_raw_duration_s"], 1),
                "Avg raw s": fmt_num(row["avg_raw_duration_s"], 1),
                "Avg idle-adjusted s": fmt_num(row["avg_idle_adjusted_duration_s"], 1),
                "Avg gap-capped s": fmt_num(row["avg_gap_capped_duration_s"], 1),
            }
        )
    failed_checks = validation_checks[validation_checks["status"] != "pass"]
    validation_sentence = (
        "All scout-pass validation checks passed."
        if failed_checks.empty
        else f"{failed_checks.shape[0]} validation checks failed; inspect tables/validation_checks.csv."
    )
    chart_table = markdown_table(
        chart_map,
        ["figure", "section", "question", "chart_type", "supports_claim"],
    )

    report = f"""# Adaptive Reading Exploratory Analysis

## Executive Summary

- **The two focus pathologists provide enough telemetry for a behaviour-first paper spine.** `muhammad.aslam` completed 250 labelled slides and `ashish.bansal` labelled 184 slides, together contributing the large majority of exported events in `pathology_events_2026-06-16.csv`.
- **The strongest architecture signal is selective high-resolution use.** Both observers have a median maximum zoom of 5x; about 63% of labelled sessions never go above 5x, and only about 12% reach 20x or higher. This supports a coarse-to-fine/adaptive reading design rather than whole-slide full-resolution processing.
- **The sharpest diagnostic signal is high-grade undercalling.** High-grade precision is very high, but high-grade recall is low. When a pathologist calls high-grade they are usually right, but many ground-truth high-grade slides are called low-grade.
- **Observer agreement is high, but shared wrongness is the useful anomaly.** On 184 overlap slides, the two focus pathologists agree on 160, but both are wrong on 51. Those shared-error slides should be treated as an experimental object, not washed out as label noise.

## Data And Method

Source: `pathology_events_2026-06-16.csv`, used as the controlling source for this round. The live PostgreSQL database was intentionally not required.

Diagnosis is derived per user-slide session as the last non-empty label event in timestamp order. Timing and navigation intensity are derived per viewing attempt because the application keeps one session per user-slide and can record repeated openings through `viewing_attempt`.

Canonical time metrics are `idle_adjusted_duration_s` and `gap_capped_duration_s`. Raw duration is retained for audit only because explicit idle spans show that breaks can inflate raw session time by minutes or hours.

## Cohort Snapshot

{markdown_table(focus_rows, ["Pathologist", "Labelled slides", "Accuracy", "Never >5x", "Reached 20x+", "Median active events", "Median active seconds"])}

## Low Magnification Dominates The Viewing Strategy

Most labelled sessions never exceed 5x, while 20x and 40x use is rare. That is exactly the kind of behavioural fact that can justify an architecture that first reasons at low/mid magnification, then selectively asks for high-resolution evidence only when needed.

![Maximum zoom reached per labelled slide](figures/zoom_session_thresholds.svg)

At the event level, the same pattern holds. The 1x-5x band contains the bulk of zoomed observations for both users; high-resolution observations are a small minority rather than the normal operating mode.

![Event-level zoom distribution](figures/zoom_event_bins.svg)

**Architecture implication:** use pathologist behaviour to constrain a coarse-to-fine model. A natural first experiment is to compare full-slide or dense patch baselines against a policy that imitates human zoom depth and only escalates selected regions.

## High-Grade Undercalling Is The Sharpest Diagnostic Asymmetry

{markdown_table(high_grade_rows, ["Pathologist", "High-grade actual", "High-grade assigned", "Recall", "Precision"])}

The diagnostic asymmetry is not a generic accuracy problem. Both focus users assign relatively few high-grade labels, and those high-grade assignments are usually correct. The failure mode is missing high-grade slides by calling them low-grade.

![High-grade precision and recall](figures/high_grade_precision_recall.svg)

**Experimental implication:** the next analysis should inspect whether undercalled high-grade slides show shallow zoom depth, short active exploration, low click coverage, or region choices that differ from correctly called high-grade slides.

## Effort And Error Move Together, But The Signal Is Modest

Incorrect attempts are somewhat more navigation-heavy, especially for the 250-slide pathologist. This does not prove uncertainty, but it is a useful candidate signal: active-event count, click count, zoom-step count, and capped active duration may help identify difficult slides or uncertain decisions before ground truth enters the analysis.

![Median active events by diagnostic outcome](figures/active_events_by_outcome.svg)

## Agreement Is High, But Shared Wrongness Is The Useful Anomaly

The two focus pathologists overlap on {int(overlap["overlap_slides"])} labelled slides. They agree on {int(overlap["pathologists_agree"])} slides ({fmt_pct(overlap["agreement_pct"])}). Within the overlap set, {int(overlap["both_correct"])} are both-correct, {int(overlap["one_correct"])} have exactly one correct observer, and {int(overlap["neither_correct"])} are neither-correct.

![Overlap outcomes](figures/overlap_outcomes.svg)

**Experimental implication:** shared-error slides are likely more informative than ordinary error slides. They may indicate genuinely hard visual evidence, mismatch between study labels and practical diagnostic criteria, or systematic under-inspection of key regions.

## Timing Caveat

{markdown_table(duration_rows, ["Pathologist", "Labelled attempts", "Attempts with idle", "Median raw s", "Avg raw s", "Avg idle-adjusted s", "Avg gap-capped s"])}

Raw duration should not be used as a primary effort metric. Idle events reveal substantial break artifacts, including attempts where the raw duration is much larger than active viewing time. The safer timing features are idle-adjusted duration and 30-second gap-capped duration.

## Recommended Next Experiments

1. Build a slide-level difficulty table: both-correct, one-correct, neither-correct, disagreement, high-grade undercalled, and low/high zoom depth.
2. Compare correctly called versus undercalled high-grade slides on max zoom, active duration, click count, viewport count, and approximate clicked-region spread.
3. Convert click and viewport centers into candidate patch supervision: human-selected patches, high-zoom escalations, and low-magnification context windows.
4. Train or simulate an adaptive-reading baseline that first reads low/mid magnification and selectively requests 10x/20x crops; compare it against dense patch selection.
5. Treat shared wrongness as a label-quality and experiment-design signal: inspect those slides manually before deciding whether to use them as hard examples, exclusions, or uncertainty labels.

## Validation Notes

{validation_sentence}

The report is generated by `run_analysis.py`; rerunning the script regenerates all tables, figures, this report, and the companion notebook. The notebook is a lightweight reproducibility companion and may require Jupyter tooling to execute interactively.

## Supporting Tables

- `tables/user_overview.csv`
- `tables/focus_summary.csv`
- `tables/session_features.csv`
- `tables/attempt_features.csv`
- `tables/zoom_summary.csv`
- `tables/zoom_event_bins.csv`
- `tables/confusion_matrix.csv`
- `tables/label_metrics.csv`
- `tables/attempt_summary_by_outcome.csv`
- `tables/overlap_summary.csv`
- `tables/overlap_disagreements.csv`
- `tables/duration_sensitivity.csv`
- `tables/headline_metrics.csv`
- `tables/validation_checks.csv`
- `tables/chart_map.csv`
"""
    (ANALYSIS_DIR / "report.md").write_text(report, encoding="utf-8")


def write_notebook() -> None:
    notebook = {
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    "# Adaptive Reading Exploratory Analysis\n",
                    "\n",
                    "This notebook is a reproducible companion to `report.md`. It reruns the generator script and previews the key derived tables.\n",
                ],
            },
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    "## Context & Methods\n",
                    "\n",
                    "- Source: `../../pathology_events_2026-06-16.csv`.\n",
                    "- Diagnosis per user-slide is the last non-empty label event in timestamp order.\n",
                    "- Timing and navigation intensity are computed per viewing attempt.\n",
                    "- Canonical time metrics are idle-adjusted and 30-second gap-capped duration.\n",
                ],
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "from pathlib import Path\n",
                    "import subprocess\n",
                    "import sys\n",
                    "\n",
                    "analysis_dir = Path.cwd()\n",
                    "subprocess.run([sys.executable, 'run_analysis.py'], cwd=analysis_dir, check=True)\n",
                ],
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "import pandas as pd\n",
                    "\n",
                    "tables = analysis_dir / 'tables'\n",
                    "focus_summary = pd.read_csv(tables / 'focus_summary.csv')\n",
                    "label_metrics = pd.read_csv(tables / 'label_metrics.csv')\n",
                    "overlap_summary = pd.read_csv(tables / 'overlap_summary.csv')\n",
                    "focus_summary\n",
                ],
            },
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    "## Results\n",
                    "\n",
                    "The generated report is `report.md`; figures are in `figures/`; audit tables are in `tables/`.\n",
                ],
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "label_metrics[label_metrics['label'].isin(['overall', 'high-grade'])]\n",
                ],
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "overlap_summary\n",
                ],
            },
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {
                "name": "python",
                "pygments_lexer": "ipython3",
            },
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    (ANALYSIS_DIR / "adaptive_reading_analysis.ipynb").write_text(
        json.dumps(notebook, indent=2), encoding="utf-8"
    )


def write_readme() -> None:
    readme = """# Adaptive Reading Analysis

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
"""
    (ANALYSIS_DIR / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate adaptive reading analysis artifacts.")
    parser.add_argument("--input", type=Path, default=INPUT_CSV, help="CSV export to analyze.")
    args = parser.parse_args()

    TABLE_DIR.mkdir(parents=True, exist_ok=True)
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)

    events = load_events(args.input)
    attempts = derive_attempt_features(events)
    sessions = derive_session_features(events, attempts)
    focus_users = select_focus_users(sessions, events)

    user_overview = build_user_overview(sessions, attempts, events)
    focus_summary, event_distribution, attempt_summary = summarize_focus_users(
        sessions, attempts, events, focus_users
    )
    zoom_summary, zoom_event_bins, zoom_ground_truth = build_zoom_tables(sessions, events, focus_users)
    confusion, label_metrics = build_diagnosis_tables(sessions, focus_users)
    overlap_summary, overlap_disagreements = build_overlap_tables(sessions, focus_users)
    duration_sensitivity = build_duration_sensitivity(attempts, sessions, focus_users)
    headline_metrics = build_headline_metrics(events, user_overview, focus_summary, label_metrics, overlap_summary)
    validation_checks = build_validation_checks(events, focus_users, user_overview, overlap_summary)
    chart_map = write_figures(
        focus_summary, zoom_event_bins, label_metrics, attempt_summary, overlap_summary
    )

    # Add final session-level labels and correctness onto attempt features for auditability.
    attempts_out = attempts.merge(
        sessions[["user_id", "session_id", "final_label", "is_labelled", "is_correct"]],
        on=["user_id", "session_id"],
        how="left",
        suffixes=("", "_session"),
    )
    attempts_out["session_final_label"] = attempts_out["final_label"]
    attempts_out = attempts_out.drop(columns=["final_label"])

    tables = {
        "user_overview.csv": user_overview,
        "focus_summary.csv": focus_summary,
        "session_features.csv": sessions,
        "attempt_features.csv": attempts_out,
        "event_distribution.csv": event_distribution,
        "attempt_summary_by_outcome.csv": attempt_summary,
        "zoom_summary.csv": zoom_summary,
        "zoom_event_bins.csv": zoom_event_bins,
        "zoom_by_ground_truth.csv": zoom_ground_truth,
        "confusion_matrix.csv": confusion,
        "label_metrics.csv": label_metrics,
        "overlap_summary.csv": overlap_summary,
        "overlap_disagreements.csv": overlap_disagreements,
        "duration_sensitivity.csv": duration_sensitivity,
        "headline_metrics.csv": headline_metrics,
        "validation_checks.csv": validation_checks,
        "chart_map.csv": pd.DataFrame(chart_map),
    }
    for filename, table in tables.items():
        table.to_csv(TABLE_DIR / filename, index=False)

    write_report(
        focus_summary,
        label_metrics,
        overlap_summary,
        attempt_summary,
        duration_sensitivity,
        validation_checks,
        chart_map,
    )
    write_notebook()
    write_readme()

    if not validation_checks["status"].eq("pass").all():
        failed = validation_checks[validation_checks["status"] != "pass"]
        raise SystemExit(f"Validation checks failed:\n{failed.to_string(index=False)}")

    print(
        json.dumps(
            {
                "status": "ok",
                "input_rows": int(events.shape[0]),
                "focus_users": focus_users,
                "output_dir": str(ANALYSIS_DIR),
                "tables": sorted(tables),
                "figures": sorted(path.name for path in FIGURE_DIR.glob("*.svg")),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
