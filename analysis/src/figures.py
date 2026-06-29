"""Figure generation. Pure-ish functions: take computed frames, save a PNG."""
from __future__ import annotations

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from load import GRADE_LABELS

plt.rcParams.update({"figure.dpi": 130, "savefig.dpi": 150, "font.size": 10,
                     "axes.spines.top": False, "axes.spines.right": False})

_SHORT = {"non-neoplastic": "non-neo", "low-grade": "low", "high-grade": "high"}


def _save(fig, figdir, name):
    os.makedirs(figdir, exist_ok=True)
    path = os.path.join(figdir, name)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def fig_confusion(confusions: dict, accuracies: dict, figdir) -> str:
    """Side-by-side row-normalised confusion heatmaps (rows=GT, cols=chosen)."""
    n = len(confusions)
    fig, axes = plt.subplots(1, n, figsize=(5.2 * n, 4.4))
    if n == 1:
        axes = [axes]
    for ax, (reader, cm) in zip(axes, confusions.items()):
        norm = cm.div(cm.sum(axis=1), axis=0).fillna(0)
        im = ax.imshow(norm.values, cmap="Blues", vmin=0, vmax=1)
        ax.set_xticks(range(3)); ax.set_xticklabels([_SHORT[c] for c in GRADE_LABELS])
        ax.set_yticks(range(3)); ax.set_yticklabels([_SHORT[c] for c in GRADE_LABELS])
        ax.set_xlabel("chosen label"); ax.set_ylabel("ground truth")
        ax.set_title(f"{reader}\nacc={accuracies[reader]:.1%}  (n={int(cm.values.sum())})")
        for i in range(3):
            for j in range(3):
                ax.text(j, i, f"{int(cm.values[i, j])}\n{norm.values[i, j]:.0%}",
                        ha="center", va="center",
                        color="white" if norm.values[i, j] > 0.5 else "black", fontsize=9)
        # Highlight the dominant high->low under-grade cell.
        ax.add_patch(plt.Rectangle((1 - .5, 2 - .5), 1, 1, fill=False, edgecolor="crimson", lw=2.5))
    fig.suptitle("Confusion: both readers undergrade high-grade -> low-grade (red box)", y=1.02)
    return _save(fig, figdir, "01_confusion.png")


def fig_signed_error(slide_diag: pd.DataFrame, readers, figdir) -> str:
    """Histogram of signed ordinal grade error (chosen - GT), per reader."""
    from labels import signed_grade_error
    fig, ax = plt.subplots(figsize=(7, 4))
    bins = np.arange(-2.5, 3.5, 1)
    width = 0.38
    for k, r in enumerate(readers):
        d = slide_diag[slide_diag["user_id"] == r]
        errs = [signed_grade_error(l, g) for l, g in zip(d["label"], d["ground_truth"])]
        errs = [e for e in errs if not pd.isna(e)]
        counts, edges = np.histogram(errs, bins=bins)
        centers = edges[:-1] + 0.5
        ax.bar(centers + (k - 0.5) * width, counts, width=width, label=r,
               color=["#3b6fb6", "#d98c3f"][k % 2])
    ax.axvline(0, color="grey", lw=1)
    ax.set_xticks([-2, -1, 0, 1, 2])
    ax.set_xticklabels(["-2\n(under x2)", "-1\nunder", "0\ncorrect", "+1\nover", "+2"])
    ax.set_xlabel("signed grade error  (chosen − ground truth)")
    ax.set_ylabel("slides")
    ax.set_title("Error is one-directional: mass sits left of 0 (systematic under-grading)")
    ax.legend()
    return _save(fig, figdir, "02_signed_error.png")


def fig_agreement(interrater: dict, readers, figdir) -> str:
    """The headline bar: reader-reader vs reader-GT agreement, and kappas."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4.2))
    a, b = readers
    # left: raw agreement on shared slides
    rates = [interrater["agree_ab_rate"], interrater["both_correct_rate"]]
    ax1.bar(["readers agree\nwith each other", "both agree\nwith ground truth"],
            rates, color=["#2e7d32", "#b0581f"])
    for i, v in enumerate(rates):
        ax1.text(i, v + 0.01, f"{v:.0%}", ha="center", fontweight="bold")
    ax1.set_ylim(0, 1); ax1.set_ylabel("rate")
    ax1.set_title(f"On {interrater['n_shared']} slides graded by both")
    # right: kappa
    ks = [interrater["kappa_ab"], interrater["kappa_a_gt"], interrater["kappa_b_gt"]]
    ax2.bar([f"{a}\n× {b}", f"{a}\n× GT", f"{b}\n× GT"], ks,
            color=["#2e7d32", "#777", "#777"])
    for i, v in enumerate(ks):
        ax2.text(i, v + 0.01, f"{v:.2f}", ha="center", fontweight="bold")
    ax2.set_ylabel("Cohen's κ (linear-weighted)")
    ax2.set_title("Readers agree with each other > with the labels")
    fig.suptitle("Inter-observer concordance ≫ concordance with reference labels", y=1.02)
    return _save(fig, figdir, "03_agreement.png")


def fig_zoom_usage(feat: pd.DataFrame, tmag: pd.DataFrame, readers, figdir) -> str:
    """Max-magnification reached per view + total time spent at each rung."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.2))
    rungs = sorted(feat["max_zoom"].dropna().unique())
    x = np.arange(len(rungs)); width = 0.38
    for k, r in enumerate(readers):
        d = feat[feat["user_id"] == r]
        counts = [int((d["max_zoom"] == rg).sum()) for rg in rungs]
        ax1.bar(x + (k - 0.5) * width, counts, width=width, label=r,
                color=["#3b6fb6", "#d98c3f"][k % 2])
    ax1.set_xticks(x); ax1.set_xticklabels([f"{r:g}×" for r in rungs])
    ax1.set_xlabel("max magnification reached"); ax1.set_ylabel("slide-views")
    ax1.set_title("Peak power per view: examination lives at 5–10×")
    ax1.legend()

    # time at magnification (sum seconds), restricted to working rungs
    work = tmag[tmag["magnification"] >= 2.5]
    piv = work.groupby(["user_id", "magnification"])["seconds"].sum().unstack(0).fillna(0)
    mags = piv.index.tolist(); x2 = np.arange(len(mags))
    for k, r in enumerate(readers):
        if r in piv.columns:
            ax2.bar(x2 + (k - 0.5) * width, piv[r].values / 60.0, width=width, label=r,
                    color=["#3b6fb6", "#d98c3f"][k % 2])
    ax2.set_xticks(x2); ax2.set_xticklabels([f"{m:g}×" for m in mags])
    ax2.set_xlabel("magnification"); ax2.set_ylabel("total minutes spent")
    ax2.set_title("Dwell-time by magnification")
    ax2.legend()
    return _save(fig, figdir, "04_zoom_usage.png")


def fig_scanpaths(examples: list, figdir) -> str:
    """examples: list of (title, view_df). Plots viewport-centre trail + clicks."""
    n = len(examples)
    fig, axes = plt.subplots(1, n, figsize=(4.2 * n, 4.2))
    if n == 1:
        axes = [axes]
    for ax, (title, g) in zip(axes, examples):
        c = g.dropna(subset=["center_x0", "center_y0"])
        ax.plot(c["center_x0"], c["center_y0"], "-o", ms=3, lw=1, color="#3b6fb6", alpha=0.7)
        if len(c):
            ax.scatter(c["center_x0"].iloc[0], c["center_y0"].iloc[0], c="green", s=70, zorder=5, label="start")
            ax.scatter(c["center_x0"].iloc[-1], c["center_y0"].iloc[-1], c="black", s=70, marker="s", zorder=5, label="end")
        clk = g[(g["event"] == "cell_click")].dropna(subset=["click_x0", "click_y0"])
        ax.scatter(clk["click_x0"], clk["click_y0"], c="crimson", s=55, marker="X", zorder=6, label="click")
        ax.set_title(title, fontsize=9)
        ax.invert_yaxis(); ax.set_aspect("equal", adjustable="datalim")
        ax.set_xticks([]); ax.set_yticks([])
    axes[0].legend(loc="upper left", fontsize=7)
    fig.suptitle("Example scanpaths (viewport-centre trail; level-0 px) — NOT eye-tracking", y=1.02)
    return _save(fig, figdir, "05_scanpaths.png")


def fig_behaviour_by_outcome(feat: pd.DataFrame, figdir) -> str:
    """On high-grade slides: did undergraded views get less examination than correct ones?"""
    hg = feat[(feat["ground_truth"] == "high-grade") & feat["committed_label"].notna()].copy()
    hg["outcome"] = np.where(hg["committed_label"] == "high-grade", "correct\n(→high)",
                     np.where(hg["committed_label"] == "low-grade", "under\n(→low)", "other"))
    hg = hg[hg["outcome"] != "other"]
    metrics = [("active_dwell_s", "active dwell (s)"), ("max_zoom", "max magnification (×)"),
               ("n_clicks", "clicks"), ("frac_time_ge_10x", "frac. time ≥10×")]
    fig, axes = plt.subplots(1, 4, figsize=(14, 4))
    order = ["correct\n(→high)", "under\n(→low)"]
    for ax, (col, lbl) in zip(axes, metrics):
        data = [hg[hg["outcome"] == o][col].dropna().values for o in order]
        bp = ax.boxplot(data, tick_labels=order, showfliers=False, patch_artist=True, widths=0.6)
        for patch, c in zip(bp["boxes"], ["#2e7d32", "#b0581f"]):
            patch.set_facecolor(c); patch.set_alpha(0.6)
        # jittered points
        for i, d in enumerate(data):
            ax.scatter(np.random.default_rng(i).normal(i + 1, 0.06, len(d)), d, s=10, c="k", alpha=0.35)
        ax.set_ylabel(lbl)
        if col == "active_dwell_s":
            ax.set_ylim(0, np.nanpercentile(hg["active_dwell_s"], 95))
    fig.suptitle("High-grade slides: behaviour on correctly-graded vs under-graded views", y=1.02)
    return _save(fig, figdir, "06_behaviour_by_outcome.png")


def fig_shuffle(shuffle: dict, figdir) -> str:
    """Real next-magnification conditional entropy vs within-view order shuffles."""
    fig, ax = plt.subplots(figsize=(7, 4))
    samples = shuffle["h_shuffled_samples"]
    ax.hist(samples, bins=30, color="#bbb", label="shuffled order")
    ax.axvline(shuffle["h_real_bits"], color="crimson", lw=2.5,
               label=f"real order = {shuffle['h_real_bits']:.3f} bits")
    ax.set_xlabel("H(next magnification | current)  [bits]")
    ax.set_ylabel("shuffles")
    ax.set_title(f"Navigation order IS structured: real entropy below all shuffles "
                 f"(Δ={shuffle['entropy_reduction_bits']:.2f} bits, p={shuffle['p_value']:.3f})")
    ax.legend()
    return _save(fig, figdir, "07_shuffle_falsifier.png")


# ============================ research-question extensions (full dataset) ============

def fig_binary_confusion(bin_metrics: dict, figdir) -> str:
    """Per-reader cancer-detection (binary) confusion + sensitivity/specificity/FP/FN."""
    readers = list(bin_metrics)
    n = len(readers)
    fig, axes = plt.subplots(1, n, figsize=(4.7 * n, 4.3))
    if n == 1:
        axes = [axes]
    for ax, r in zip(axes, readers):
        m = bin_metrics[r]
        M = np.array([[m["tn"], m["fp"]], [m["fn"], m["tp"]]], float)
        norm = M / M.sum(axis=1, keepdims=True)
        ax.imshow(norm, cmap="Purples", vmin=0, vmax=1)
        ax.set_xticks([0, 1]); ax.set_xticklabels(["non-cancer", "cancer"])
        ax.set_yticks([0, 1]); ax.set_yticklabels(["non-cancer", "cancer"])
        ax.set_xlabel("reader call"); ax.set_ylabel("ground truth")
        for i in range(2):
            for j in range(2):
                ax.text(j, i, f"{int(M[i, j])}\n{norm[i, j]:.0%}", ha="center", va="center",
                        color="white" if norm[i, j] > 0.5 else "black")
        ax.set_title(f"{r}\nsens {m['recall']:.0%} · spec {m['specificity']:.0%} · "
                     f"prec {m['precision']:.0%}\nFP rate {m['fp_rate']:.0%} · FN rate {m['fn_rate']:.0%}",
                     fontsize=9)
    fig.suptitle("Cancer detection (low+high = cancer): errors are about grading, not detection", y=1.05)
    return _save(fig, figdir, "08_binary_confusion.png")


def fig_reader_confusion(cm, readers, figdir) -> str:
    """Reader-A label (rows) vs reader-B label (cols) on shared slides."""
    a, b = readers
    vals = cm.values.astype(float)
    fig, ax = plt.subplots(figsize=(5.2, 4.6))
    ax.imshow(vals, cmap="Greens")
    ax.set_xticks(range(len(cm.columns))); ax.set_xticklabels([_SHORT.get(c, c) for c in cm.columns])
    ax.set_yticks(range(len(cm.index))); ax.set_yticklabels([_SHORT.get(c, c) for c in cm.index])
    ax.set_xlabel(f"{b} call"); ax.set_ylabel(f"{a} call")
    for i in range(vals.shape[0]):
        for j in range(vals.shape[1]):
            ax.text(j, i, int(vals[i, j]), ha="center", va="center",
                    color="white" if vals[i, j] > vals.max() * 0.5 else "black")
    ax.set_title(f"Reader × reader (n={int(vals.sum())} shared)\noff-diagonal = where they disagree")
    return _save(fig, figdir, "09_reader_confusion.png")


def fig_resolution_reach(feat, readers, figdir) -> str:
    """Fraction of slide-views whose max magnification reaches each rung."""
    rungs = [2.5, 5, 10, 20, 40]
    x = np.arange(len(rungs)); width = 0.38
    fig, ax = plt.subplots(figsize=(7, 4))
    for k, r in enumerate(readers):
        d = feat[feat["user_id"] == r]["max_zoom"].dropna()
        frac = [float((d >= rg).mean()) for rg in rungs]
        ax.bar(x + (k - 0.5) * width, frac, width=width, label=r,
               color=["#3b6fb6", "#d98c3f"][k % 2])
    ax.set_xticks(x); ax.set_xticklabels([f"≥{g:g}×" for g in rungs])
    ax.set_ylim(0, 1); ax.set_ylabel("fraction of slide-views")
    ax.set_title("Zoom depth per view: most never pass 5×; a minority reach 20×")
    ax.legend()
    return _save(fig, figdir, "10_resolution_reach.png")


def fig_strategy_clusters(cluster_profile, figdir) -> str:
    """Heatmap: z-scored mean of each navigation feature per strategy cluster."""
    P = cluster_profile
    fig, ax = plt.subplots(figsize=(1.0 * len(P.columns) + 2, 0.7 * len(P.index) + 2))
    im = ax.imshow(P.values, cmap="RdBu_r", vmin=-1.5, vmax=1.5, aspect="auto")
    ax.set_xticks(range(len(P.columns))); ax.set_xticklabels(P.columns, rotation=40, ha="right", fontsize=8)
    ax.set_yticks(range(len(P.index))); ax.set_yticklabels(P.index, fontsize=9)
    for i in range(P.shape[0]):
        for j in range(P.shape[1]):
            ax.text(j, i, f"{P.values[i, j]:+.1f}", ha="center", va="center", fontsize=7,
                    color="white" if abs(P.values[i, j]) > 0.9 else "black")
    fig.colorbar(im, ax=ax, label="z-scored cluster mean", fraction=0.025)
    ax.set_title("Navigation strategies: standardized feature profile per cluster")
    return _save(fig, figdir, "11_strategy_clusters.png")


def fig_event_transitions(P, figdir) -> str:
    """Action-to-action transition probability matrix P(next | current)."""
    fig, ax = plt.subplots(figsize=(6.6, 5.2))
    im = ax.imshow(P.values, cmap="Blues", vmin=0, vmax=1)
    ax.set_xticks(range(len(P.columns))); ax.set_xticklabels(P.columns, rotation=40, ha="right", fontsize=8)
    ax.set_yticks(range(len(P.index))); ax.set_yticklabels(P.index, fontsize=8)
    for i in range(P.shape[0]):
        for j in range(P.shape[1]):
            if P.values[i, j] > 0.005:
                ax.text(j, i, f"{P.values[i, j]:.2f}", ha="center", va="center", fontsize=7,
                        color="white" if P.values[i, j] > 0.5 else "black")
    ax.set_xlabel("next action"); ax.set_ylabel("current action")
    fig.colorbar(im, ax=ax, label="P(next | current)", fraction=0.046)
    ax.set_title("Action transition matrix (viewport polls excluded)")
    return _save(fig, figdir, "12_event_transitions.png")


def fig_colormaps(examples, readers, figdir) -> str:
    """examples: list of (title, mapA, mapB). Columns: reader A, reader B, overlay."""
    n = len(examples)
    fig, axes = plt.subplots(n, 3, figsize=(9, 3.0 * n))
    if n == 1:
        axes = axes.reshape(1, 3)
    a, b = readers
    for row, (title, mA, mB) in enumerate(examples):
        for col, (m, name, cmap) in enumerate([(mA, a, "Reds"), (mB, b, "Blues")]):
            ax = axes[row, col]
            ax.imshow(m, cmap=cmap); ax.set_xticks([]); ax.set_yticks([])
            if row == 0:
                ax.set_title(name, fontsize=9)
            if col == 0:
                ax.set_ylabel(title, fontsize=8)
        ax = axes[row, 2]
        rgb = np.zeros((*mA.shape, 3))
        rgb[..., 0] = mA / mA.max() if mA.max() > 0 else mA
        rgb[..., 2] = mB / mB.max() if mB.max() > 0 else mB
        ax.imshow(rgb); ax.set_xticks([]); ax.set_yticks([])
        if row == 0:
            ax.set_title("overlay (red=A, blue=B, purple=both)", fontsize=8)
    fig.suptitle("Attention coverage maps (constrained-navigation proxy, NOT eye-tracking)", y=1.0)
    return _save(fig, figdir, "13_colormaps.png")


def fig_overlap_similarity(real, null, figdir, metric="cc") -> str:
    """Real (same slide, both readers) vs null (mismatched slides) map-similarity."""
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.hist(null[metric].dropna(), bins=25, color="#bbb", alpha=0.85, density=True,
            label="null (mismatched slides)")
    ax.hist(real[metric].dropna(), bins=25, color="#2e7d32", alpha=0.55, density=True,
            label="real (same slide)")
    ax.axvline(real[metric].median(), color="#2e7d32", lw=2, ls="--")
    ax.axvline(null[metric].median(), color="#555", lw=2, ls="--")
    ax.set_xlabel(f"coverage-map similarity ({metric})"); ax.set_ylabel("density")
    ax.set_title(f"Readers attend the same regions above chance "
                 f"(median {metric} {real[metric].median():.2f} vs null {null[metric].median():.2f})")
    ax.legend()
    return _save(fig, figdir, "14_overlap_similarity.png")


def fig_resolution_accuracy(feat, figdir) -> str:
    """3-class accuracy by the max magnification reached in the view (descriptive)."""
    d = feat[feat["committed_label"].notna()].copy()

    def bucket(z):
        if pd.isna(z):
            return None
        if z <= 5:
            return "≤5×"
        if z < 20:
            return "10×"
        return "≥20×"

    d["zbucket"] = d["max_zoom"].map(bucket)
    order = ["≤5×", "10×", "≥20×"]
    acc = d.groupby("zbucket")["correct"].agg(["mean", "size"]).reindex(order)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.bar(range(len(order)), acc["mean"].values, color="#3b6fb6")
    for i, (m, nn) in enumerate(zip(acc["mean"], acc["size"])):
        if not pd.isna(m):
            ax.text(i, m + 0.01, f"{m:.0%}\n(n={int(nn)})", ha="center", fontsize=9)
    ax.set_xticks(range(len(order))); ax.set_xticklabels(order)
    ax.set_ylim(0, 1); ax.set_ylabel("3-class accuracy")
    ax.set_xlabel("max magnification reached in the view")
    ax.set_title("Deeper zoom vs correctness (descriptive, not causal)")
    return _save(fig, figdir, "15_resolution_accuracy.png")
