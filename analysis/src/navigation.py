"""Per-slide-view navigation & behaviour features, plus trajectory analyses.

All coordinates are level-0 (full-resolution) pixels. Cursor/viewport position
is a *constrained-navigation attention proxy*, NOT eye-tracking.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.cluster import DBSCAN

from load import view_groups
from labels import committed_label, label_switches, signed_grade_error, error_direction


def _idle_seconds(view_df: pd.DataFrame) -> float:
    """Total idle time = sum of paired idle_start -> idle_end spans."""
    ts = view_df.set_index(view_df["event"])["ts"]
    starts = view_df[view_df["event"] == "idle_start"]["ts"].tolist()
    ends = view_df[view_df["event"] == "idle_end"]["ts"].tolist()
    total = 0.0
    for s, e in zip(starts, ends):  # pair in order; trailing unmatched start ignored
        if pd.notna(s) and pd.notna(e) and e > s:
            total += (e - s).total_seconds()
    return total


def _time_at_magnification(view_df: pd.DataFrame) -> dict:
    """Seconds spent at each magnification rung (interval attributed to its start zoom)."""
    z = view_df[["ts", "zoom_level"]].copy()
    z["zoom_level"] = z["zoom_level"].ffill()
    z = z.dropna(subset=["zoom_level"])
    out: dict = {}
    if len(z) < 2:
        return out
    ts = z["ts"].values
    zoom = z["zoom_level"].values
    dt = (ts[1:] - ts[:-1]) / np.timedelta64(1, "s")
    for d, mag in zip(dt, zoom[:-1]):
        if d >= 0:
            out[float(mag)] = out.get(float(mag), 0.0) + float(d)
    return out


def _scanpath(view_df: pd.DataFrame):
    """Ordered viewport-centre trail and derived geometry."""
    c = view_df.dropna(subset=["center_x0", "center_y0"])[["center_x0", "center_y0"]]
    pts = c.to_numpy(dtype=float)
    if len(pts) < 2:
        return pts, 0.0, max(len(pts), 0)
    steps = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    path_len = float(steps.sum())
    # Fixation clusters: eps = half the median viewport width in this view.
    vp = view_df.dropna(subset=["vbx0", "vtx0"])
    vp_w = float((vp["vtx0"] - vp["vbx0"]).abs().median()) if len(vp) else 0.0
    eps = vp_w * 0.5 if vp_w > 0 else 1.0
    n_fix = int(len(np.unique(DBSCAN(eps=eps, min_samples=2).fit_predict(pts))))
    return pts, path_len, n_fix


def _coarse_to_fine(view_df: pd.DataFrame) -> float:
    """Spearman corr of zoom_level vs event order. >0 => zooms in over the view."""
    z = view_df.dropna(subset=["zoom_level"])["zoom_level"].to_numpy(dtype=float)
    if len(z) < 4 or np.ptp(z) == 0:
        return np.nan
    rho, _ = spearmanr(np.arange(len(z)), z)
    return float(rho)


def magnification_sequence(view_df: pd.DataFrame) -> list:
    """Ordered sequence of magnification rungs actually visited (collapsing repeats).

    Used by the B2 shuffle falsifier.
    """
    z = view_df.dropna(subset=["zoom_level"])["zoom_level"].round(2).tolist()
    out = []
    for v in z:
        if not out or out[-1] != v:
            out.append(v)
    return out


# Reader *actions* (excludes periodic viewport polls / idle / load markers) — used
# for event-sequence / strategy motif analysis (Q4).
ACTION_EVENTS = ["cell_click", "zoom_step", "arrow_pan", "back_step", "label_select", "slide_next"]


def action_sequence(view_df: pd.DataFrame, events=ACTION_EVENTS, collapse_repeats: bool = False) -> list:
    """Ordered list of action-event types in a view (viewport polls / idle excluded)."""
    s = view_df[view_df["event"].isin(events)]["event"].tolist()
    if collapse_repeats:
        s = [e for i, e in enumerate(s) if i == 0 or e != s[i - 1]]
    return s


def view_features(key, view_df: pd.DataFrame) -> dict:
    user, slide, session, attempt = key
    ev = view_df["event"]
    ground_truth = view_df["ground_truth"].dropna().iloc[0] if view_df["ground_truth"].notna().any() else None

    raw_dwell = (view_df["ts"].max() - view_df["ts"].min()).total_seconds()
    idle = _idle_seconds(view_df)
    active_dwell = max(raw_dwell - idle, 0.0)

    tmag = _time_at_magnification(view_df)
    active_for_mag = sum(tmag.values()) or 1.0
    frac_ge_10x = sum(s for m, s in tmag.items() if m >= 10) / active_for_mag
    max_zoom = float(view_df["zoom_level"].max()) if view_df["zoom_level"].notna().any() else np.nan
    n_distinct_mag = int(view_df["zoom_level"].dropna().round(2).nunique())

    _, path_len, n_fix = _scanpath(view_df)
    label, label_src = committed_label(view_df)
    signed = signed_grade_error(label, ground_truth) if label else np.nan

    return {
        "user_id": user, "slide_id": slide, "session_id": session, "viewing_attempt": int(attempt),
        "ground_truth": ground_truth,
        "committed_label": label, "label_source": label_src,
        "signed_error": signed, "direction": error_direction(signed),
        "correct": (label == ground_truth) if label else np.nan,
        "revisit": int(attempt) > 1,
        "n_events": int(len(view_df)),
        "n_viewport_poll": int((ev == "viewport_poll").sum()),
        "n_zoom_step": int((ev == "zoom_step").sum()),
        "n_clicks": int((ev == "cell_click").sum()),
        "n_arrow_pan": int((ev == "arrow_pan").sum()),
        "n_back_step": int((ev == "back_step").sum()),
        "n_idle": int((ev == "idle_start").sum()),
        "raw_dwell_s": float(raw_dwell),
        "active_dwell_s": float(active_dwell),
        "max_zoom": max_zoom,
        "n_distinct_mag": n_distinct_mag,
        "frac_time_ge_10x": float(frac_ge_10x),
        "path_len_px": float(path_len),
        "n_fixations": n_fix,
        "ctf_spearman": _coarse_to_fine(view_df),
        "label_switches": label_switches(view_df),
    }


def build_feature_table(events: pd.DataFrame) -> pd.DataFrame:
    """One row per slide-view with behaviour + diagnosis features."""
    rows = [view_features(key, g) for key, g in view_groups(events)]
    return pd.DataFrame(rows)


def time_at_magnification_table(events: pd.DataFrame) -> pd.DataFrame:
    """Long-format seconds-at-magnification per view (for the zoom-ladder figure)."""
    recs = []
    for key, g in view_groups(events):
        user, slide, session, attempt = key
        for mag, secs in _time_at_magnification(g).items():
            recs.append({"user_id": user, "session_id": session,
                         "viewing_attempt": attempt, "magnification": mag, "seconds": secs})
    return pd.DataFrame(recs)
