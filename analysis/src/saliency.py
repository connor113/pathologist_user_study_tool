"""Spatial attention / coverage ("colour") maps from constrained-navigation trajectories.

Every logged event carries the level-0 viewport rectangle the reader was looking at,
``(vbx0,vby0)``–``(vtx0,vty0)``, and clicks additionally carry a focal point
``(click_x0,click_y0)``. Following Gary's method, we build one coverage map per
(slide, reader) by depositing ``+1`` over every viewport rectangle onto a downsampled
grid in level-0 pixel space (optionally adding a Gaussian bump at each click). Two
readers' maps are then compared with metrics borrowed from the saliency / scanpath
literature: CC (linear correlation), SIM (histogram intersection), KL divergence, and
top-k region IoU.

Caveat: this is a CONSTRAINED-NAVIGATION attention proxy, NOT eye-tracking.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.ndimage import gaussian_filter

_BOUND_COLS = ["vbx0", "vby0", "vtx0", "vty0"]


def slide_extent(slide_events: pd.DataFrame):
    """(x0, y0, x1, y1) level-0 bounding box for a slide = union of all viewport rects.

    The lowest-zoom viewport frames the whole slide; the origin is clamped at >=0
    (viewports can letterbox past the slide edge at minimum zoom). Returns None if no
    viewport bounds are present.
    """
    b = slide_events.dropna(subset=_BOUND_COLS)
    if not len(b):
        return None
    x0 = max(0.0, float(np.minimum(b["vbx0"], b["vtx0"]).min()))
    y0 = max(0.0, float(np.minimum(b["vby0"], b["vty0"]).min()))
    x1 = float(np.maximum(b["vbx0"], b["vtx0"]).max())
    y1 = float(np.maximum(b["vby0"], b["vty0"]).max())
    if x1 <= x0 or y1 <= y0:
        return None
    return (x0, y0, x1, y1)


def grid_shape(extent, grid: int = 128):
    """(gx, gy) grid: `grid` cells on the long side, short side scaled to aspect."""
    x0, y0, x1, y1 = extent
    W, H = max(x1 - x0, 1.0), max(y1 - y0, 1.0)
    if W >= H:
        return grid, max(1, int(round(grid * H / W)))
    return max(1, int(round(grid * W / H))), grid


def coverage_map(slide_events: pd.DataFrame, extent, grid: int = 128,
                 gaussian_clicks: bool = False, click_sigma_frac: float = 0.03):
    """Accumulate a coverage map for `slide_events` within `extent`.

    +1 over each event's (clipped) viewport rectangle. If ``gaussian_clicks``, add a
    Gaussian-smoothed click-density layer (scaled to the rectangle layer's peak) to
    emphasise focal points. Returns ``(map2d, (gx, gy))`` with shape (rows=gy, cols=gx).
    """
    x0, y0, x1, y1 = extent
    W, H = max(x1 - x0, 1.0), max(y1 - y0, 1.0)
    gx, gy = grid_shape(extent, grid)
    m = np.zeros((gy, gx), dtype=float)

    def to_col(x):
        return int(np.clip((x - x0) / W * gx, 0, gx - 1))

    def to_row(y):
        return int(np.clip((y - y0) / H * gy, 0, gy - 1))

    b = slide_events.dropna(subset=_BOUND_COLS)
    for vbx, vby, vtx, vty in b[_BOUND_COLS].itertuples(index=False):
        c0, c1 = to_col(min(vbx, vtx)), to_col(max(vbx, vtx))
        r0, r1 = to_row(min(vby, vty)), to_row(max(vby, vty))
        m[r0:r1 + 1, c0:c1 + 1] += 1.0

    if gaussian_clicks:
        clk = slide_events[slide_events["event"] == "cell_click"].dropna(
            subset=["click_x0", "click_y0"])
        if len(clk):
            cm = np.zeros_like(m)
            for cx, cy in clk[["click_x0", "click_y0"]].itertuples(index=False):
                cm[to_row(cy), to_col(cx)] += 1.0
            cm = gaussian_filter(cm, sigma=max(1.0, click_sigma_frac * grid))
            if cm.max() > 0 and m.max() > 0:
                m = m + cm / cm.max() * m.max()
    return m, (gx, gy)


def reader_slide_map(events: pd.DataFrame, slide_id: str, reader: str, extent=None,
                     grid: int = 128, **kw):
    """Coverage map for one reader on one slide (all that reader's events/attempts)."""
    se_all = events[events["slide_id"] == slide_id]
    if extent is None:
        extent = slide_extent(se_all)
    if extent is None:
        return None, None, None
    m, g = coverage_map(se_all[se_all["user_id"] == reader], extent, grid=grid, **kw)
    return m, g, extent


def _prob(m, eps=1e-9):
    m = np.asarray(m, dtype=float)
    s = m.sum()
    p = (m / s) if s > 0 else np.full(m.size, 1.0 / m.size).reshape(m.shape)
    p = p + eps
    return p / p.sum()


def _top_mask(m, frac):
    m = np.asarray(m, dtype=float)
    k = max(1, int(frac * m.size))
    thr = np.sort(m.ravel())[-k]
    return m >= thr if thr > 0 else m > 0


def map_distance(a, b, top_frac: float = 0.10) -> dict:
    """Similarity / distance between two coverage maps of identical shape.

    cc  : Pearson correlation of raw maps  ([-1, 1], higher = more similar)
    sim : histogram intersection of probability maps  ([0, 1], higher = more similar)
    kl  : KL(a || b) in bits  (>=0, lower = more similar)
    iou_top : IoU of each map's top-`top_frac` cells  ([0, 1], higher = more similar)
    """
    a = np.asarray(a, dtype=float); b = np.asarray(b, dtype=float)
    af, bf = a.ravel(), b.ravel()
    cc = float(np.corrcoef(af, bf)[0, 1]) if af.std() > 0 and bf.std() > 0 else np.nan
    pa, pb = _prob(a), _prob(b)
    sim = float(np.minimum(pa, pb).sum())
    kl = float(np.sum(pa * np.log2(pa / pb)))
    ma, mb = _top_mask(a, top_frac), _top_mask(b, top_frac)
    inter = int(np.logical_and(ma, mb).sum()); union = int(np.logical_or(ma, mb).sum())
    iou = float(inter / union) if union else np.nan
    return {"cc": cc, "sim": sim, "kl": kl, "iou_top": iou}


def shared_slide_overlap(events: pd.DataFrame, reader_a: str, reader_b: str,
                         grid: int = 128, gaussian_clicks: bool = False,
                         top_frac: float = 0.10) -> pd.DataFrame:
    """Per-slide A-vs-B coverage-map similarity over every slide both readers viewed.

    One row per shared slide with cc / sim / kl / iou_top plus the slide's ground truth.
    """
    a_slides = set(events[events["user_id"] == reader_a]["slide_id"])
    b_slides = set(events[events["user_id"] == reader_b]["slide_id"])
    shared = a_slides & b_slides
    rows = []
    for sid, se_all in events[events["slide_id"].isin(shared)].groupby("slide_id"):
        ext = slide_extent(se_all)
        if ext is None:
            continue
        ma, _ = coverage_map(se_all[se_all["user_id"] == reader_a], ext, grid=grid,
                             gaussian_clicks=gaussian_clicks)
        mb, _ = coverage_map(se_all[se_all["user_id"] == reader_b], ext, grid=grid,
                             gaussian_clicks=gaussian_clicks)
        if ma.sum() == 0 or mb.sum() == 0:
            continue
        d = map_distance(ma, mb, top_frac=top_frac)
        gt = se_all["ground_truth"].dropna()
        d.update({"slide_id": sid, "ground_truth": gt.iloc[0] if len(gt) else None})
        rows.append(d)
    return pd.DataFrame(rows)


def null_overlap(events: pd.DataFrame, reader_a: str, reader_b: str, grid: int = 128,
                 n: int = 200, seed: int = 0, gaussian_clicks: bool = False,
                 top_frac: float = 0.10) -> pd.DataFrame:
    """Null distribution: A-vs-B similarity for MISMATCHED slides (reader A on slide i
    vs reader B on a random different slide j). Tells us how much of the real overlap is
    above chance given the strong centre/area bias of constrained navigation.
    """
    a_slides = sorted(set(events[events["user_id"] == reader_a]["slide_id"]) &
                      set(events[events["user_id"] == reader_b]["slide_id"]))
    rng = np.random.default_rng(seed)
    # precompute each reader's per-slide maps once
    maps_a, maps_b, ext = {}, {}, {}
    for sid, se_all in events[events["slide_id"].isin(a_slides)].groupby("slide_id"):
        e = slide_extent(se_all)
        if e is None:
            continue
        ext[sid] = e
        maps_a[sid] = coverage_map(se_all[se_all["user_id"] == reader_a], e, grid=grid,
                                   gaussian_clicks=gaussian_clicks)[0]
        maps_b[sid] = coverage_map(se_all[se_all["user_id"] == reader_b], e, grid=grid,
                                   gaussian_clicks=gaussian_clicks)[0]
    valid = [s for s in a_slides if s in ext and maps_a[s].sum() > 0 and maps_b[s].sum() > 0]
    rows = []
    for _ in range(n):
        i, j = rng.choice(len(valid), size=2, replace=False)
        si, sj = valid[i], valid[j]
        # reproject B's map of slide sj onto slide si's grid by resizing (nearest)
        mb = _resize_to(maps_b[sj], maps_a[si].shape)
        rows.append(map_distance(maps_a[si], mb, top_frac=top_frac))
    return pd.DataFrame(rows)


def _resize_to(m, shape):
    """Nearest-neighbour resize of a 2-D map to `shape` (rows, cols)."""
    m = np.asarray(m, dtype=float)
    if m.shape == tuple(shape):
        return m
    r = (np.linspace(0, m.shape[0] - 1, shape[0])).round().astype(int)
    c = (np.linspace(0, m.shape[1] - 1, shape[1])).round().astype(int)
    return m[np.ix_(r, c)]
