"""Statistics: accuracy, ordinal agreement (kappa), inter-rater decomposition,
the B2 shuffle falsifier, and behaviour->error effect sizes."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import cohen_kappa_score

from load import GRADE_ORDER, GRADE_LABELS
from navigation import magnification_sequence
from load import view_groups


# ----------------------------------------------------------------------------- accuracy
def balanced_accuracy(confusion: pd.DataFrame) -> float:
    """Mean per-class recall (rows = ground truth)."""
    recalls = [confusion.loc[c, c] / confusion.loc[c].sum()
               for c in GRADE_LABELS if confusion.loc[c].sum() > 0]
    return float(np.mean(recalls))


def per_class_recall(confusion: pd.DataFrame) -> pd.Series:
    return pd.Series(
        {c: (confusion.loc[c, c] / confusion.loc[c].sum() if confusion.loc[c].sum() else np.nan)
         for c in GRADE_LABELS}
    )


# ----------------------------------------------------------------- slide-level diagnoses
def slide_level_diagnoses(events: pd.DataFrame, use_fallback: bool = False) -> pd.DataFrame:
    """Last committed diagnosis per (user, slide).

    Default uses ``slide_next`` events only (matches the headline anchors);
    ``use_fallback`` additionally recovers views whose only label is a
    ``label_select``.
    """
    mask = (events["event"] == "slide_next") & events["label"].notna()
    if use_fallback:
        mask = mask | ((events["event"] == "label_select") & events["label"].notna())
    d = events[mask].sort_values("ts")
    last = d.groupby(["user_id", "slide_id"]).tail(1)
    return last[["user_id", "slide_id", "label", "ground_truth"]].reset_index(drop=True)


def kappa(a, b, weights="linear") -> float:
    """Cohen's kappa on ordinal grade labels."""
    ai = [GRADE_ORDER[x] for x in a]
    bi = [GRADE_ORDER[x] for x in b]
    return float(cohen_kappa_score(ai, bi, weights=weights))


def interrater_summary(slide_diag: pd.DataFrame, reader_a: str, reader_b: str) -> dict:
    """Compare two readers on the slides they both graded."""
    a = slide_diag[slide_diag["user_id"] == reader_a].set_index("slide_id")
    b = slide_diag[slide_diag["user_id"] == reader_b].set_index("slide_id")
    shared = a.index.intersection(b.index)
    al, bl = a.loc[shared, "label"], b.loc[shared, "label"]
    gt = a.loc[shared, "ground_truth"]  # ground truth identical across readers

    agree_ab = (al.values == bl.values)
    a_correct = (al.values == gt.values)
    b_correct = (bl.values == gt.values)
    both_correct = a_correct & b_correct
    both_wrong_same = agree_ab & ~a_correct          # concordant error = shared-bias signal
    one_correct = a_correct ^ b_correct

    high = gt.values == "high-grade"
    both_under_high = high & (al.values == "low-grade") & (bl.values == "low-grade")

    return {
        "n_shared": int(len(shared)),
        "agree_ab": int(agree_ab.sum()),
        "agree_ab_rate": float(agree_ab.mean()),
        "both_correct": int(both_correct.sum()),
        "both_correct_rate": float(both_correct.mean()),
        "both_wrong_same": int(both_wrong_same.sum()),
        "one_correct": int(one_correct.sum()),
        "n_high_shared": int(high.sum()),
        "both_under_high": int(both_under_high.sum()),
        "kappa_ab": kappa(al, bl),
        "kappa_a_gt": kappa(al, gt),
        "kappa_b_gt": kappa(bl, gt),
        "kappa_ab_unweighted": kappa(al, bl, weights=None),
        "kappa_a_gt_unweighted": kappa(al, gt, weights=None),
        "kappa_b_gt_unweighted": kappa(bl, gt, weights=None),
    }


# ------------------------------------------------------------------- B2 shuffle falsifier
def _conditional_entropy_of_transitions(sequences) -> float:
    """H(next magnification | current) over a collection of rung sequences (bits)."""
    trans: dict = {}
    for seq in sequences:
        for a, b in zip(seq[:-1], seq[1:]):
            trans.setdefault(a, {}).setdefault(b, 0)
            trans[a][b] += 1
    total = sum(sum(d.values()) for d in trans.values())
    if total == 0:
        return np.nan
    h = 0.0
    for a, d in trans.items():
        na = sum(d.values())
        pa = na / total
        ha = -sum((n / na) * np.log2(n / na) for n in d.values())
        h += pa * ha
    return float(h)


def shuffle_falsifier(events: pd.DataFrame, n_shuffles: int = 200, seed: int = 0) -> dict:
    """Is navigation *order* structured? Compare real next-magnification
    conditional entropy to within-view order shuffles.

    H_real << H_shuffled => the order carries signal (the 'pyramid video' has
    temporal structure); H_real ~= H_shuffled => it collapses to static saliency.
    """
    seqs = [magnification_sequence(g) for _, g in view_groups(events)]
    seqs = [s for s in seqs if len(s) >= 2]
    h_real = _conditional_entropy_of_transitions(seqs)
    rng = np.random.default_rng(seed)
    h_sh = []
    for _ in range(n_shuffles):
        shuffled = []
        for s in seqs:
            arr = s.copy()
            rng.shuffle(arr)
            shuffled.append(arr)
        h_sh.append(_conditional_entropy_of_transitions(shuffled))
    h_sh = np.array(h_sh)
    p = float((h_sh <= h_real).mean())  # permutation p: order no better than chance
    return {
        "h_real_bits": h_real,
        "h_shuffled_mean_bits": float(h_sh.mean()),
        "h_shuffled_std_bits": float(h_sh.std()),
        "entropy_reduction_bits": float(h_sh.mean() - h_real),
        "p_value": p,
        "n_views": len(seqs),
        "h_shuffled_samples": h_sh,
    }


# ------------------------------------------------------------------ behaviour vs outcome
def cliffs_delta(x, y) -> float:
    """Cliff's delta effect size (nonparametric)."""
    x = np.asarray(x, dtype=float); y = np.asarray(y, dtype=float)
    x = x[~np.isnan(x)]; y = y[~np.isnan(y)]
    if len(x) == 0 or len(y) == 0:
        return np.nan
    diff = np.sign(x[:, None] - y[None, :])
    return float(diff.sum() / (len(x) * len(y)))


def mann_whitney(x, y) -> dict:
    from scipy.stats import mannwhitneyu
    x = np.asarray(x, dtype=float); y = np.asarray(y, dtype=float)
    x = x[~np.isnan(x)]; y = y[~np.isnan(y)]
    if len(x) < 2 or len(y) < 2:
        return {"U": np.nan, "p": np.nan, "cliffs_delta": np.nan, "n_x": len(x), "n_y": len(y)}
    u, p = mannwhitneyu(x, y, alternative="two-sided")
    return {"U": float(u), "p": float(p), "cliffs_delta": cliffs_delta(x, y),
            "median_x": float(np.median(x)), "median_y": float(np.median(y)),
            "n_x": int(len(x)), "n_y": int(len(y))}
