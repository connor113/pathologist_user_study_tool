# ---
# jupyter:
#   jupytext:
#     text_representation:
#       extension: .py
#       format_name: percent
#   kernelspec:
#     display_name: Python 3
#     language: python
#     name: python3
# ---

# %% [markdown]
# # Pathologist Viewing-Behaviour — Exploratory Insight Analysis
#
# Two complete readers (`muhammad.aslam` 250 slides, `ashish.bansal` 250) grading
# colorectal slides (IMP-CRS-2024: non-neoplastic / low-grade / high-grade) in the
# constrained click-to-zoom study tool. Source: `analysis/data/pathology_events_2026-06-29.csv`.
#
# Three threads: **(1) label & convention structure**, **(2) navigation & trajectory**,
# **(3) behaviour ↔ diagnosis bridge** — then a synthesis. The notebook *asserts* the
# hand-computed anchor numbers so any pipeline drift fails loudly.
#
# Caveat carried throughout: viewport/cursor position is a *constrained-navigation
# attention proxy*, **not** eye-tracking; there are 2 readers (not 5) and no per-region
# ground truth.

# %%
import os, sys, json
import numpy as np
import pandas as pd

try:  # robust unicode on the Windows console (cp1252) and under nbconvert
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:
    HERE = os.path.abspath(".")
ANALYSIS = os.path.dirname(HERE)
SRC = os.path.join(ANALYSIS, "src")
# The CSV is gitignored (repo convention: *.csv data exports stay local). Look in
# analysis/data/ first, then fall back to the repo-root export.
_DATA_CANDIDATES = [
    os.path.join(ANALYSIS, "data", "pathology_events_2026-06-29.csv"),
    os.path.join(os.path.dirname(ANALYSIS), "pathology_events_2026-06-29.csv"),
]
DATA = next((p for p in _DATA_CANDIDATES if os.path.exists(p)), _DATA_CANDIDATES[0])
if not os.path.exists(DATA):
    raise FileNotFoundError(
        "pathology_events_2026-06-29.csv not found (gitignored per repo convention). "
        "Place it in analysis/data/. Tried: " + " ; ".join(_DATA_CANDIDATES))
FIGDIR = os.path.join(ANALYSIS, "figures")
REPORTS = os.path.join(ANALYSIS, "reports")
sys.path.insert(0, SRC)

import load, labels, metrics, navigation, figures, saliency
from load import TWO_READERS, GRADE_LABELS

READERS = TWO_READERS
results = {}  # accumulates everything for the report / gbrain page

# %% [markdown]
# ## 0. Load & descriptive overview

# %%
ev_all = load.load_events(DATA)
print("total events:", len(ev_all))
by_user = (ev_all.groupby("user_id")
           .agg(events=("event", "size"), slides=("slide_id", "nunique"))
           .sort_values("events", ascending=False))
print(by_user)
ev = load.reader_events(ev_all, READERS)

results["overview"] = {
    "total_events": int(len(ev_all)),
    "by_user": {u: {"events": int(r.events), "slides": int(r.slides)}
                for u, r in by_user.iterrows()},
    "event_type_counts": ev_all["event"].value_counts().to_dict(),
    "ground_truth_event_counts": ev_all["ground_truth"].value_counts().to_dict(),
}

# %% [markdown]
# ## Thread 1 — Label & convention structure  *(lead; serves B1)*
#
# Event-level committed diagnoses (every `slide_next` with a label) give the headline
# accuracy/confusion; this is the anchor granularity.

# %%
thread1 = {}
confusions, accuracies = {}, {}
for r in READERS:
    diag = labels.slide_next_diagnoses(ev[ev["user_id"] == r])
    cm = labels.confusion(diag)
    acc = float(diag["correct"].mean())
    confusions[r] = cm
    accuracies[r] = acc
    high_under = int(cm.loc["high-grade", "low-grade"])
    high_total = int(cm.loc["high-grade"].sum())
    thread1[r] = {
        "n_committed": int(len(diag)),
        "accuracy": acc,
        "balanced_accuracy": metrics.balanced_accuracy(cm),
        "per_class_recall": metrics.per_class_recall(cm).to_dict(),
        "high_to_low_undergrade": [high_under, high_total],
        "mean_signed_error": float(diag["signed_error"].mean()),
        "direction_counts": diag["direction"].value_counts().to_dict(),
        "confusion": cm.to_dict(),
    }
    print(f"\n=== {r} ===  n={len(diag)}  acc={acc:.1%}  "
          f"high→low {high_under}/{high_total}  mean signed err={diag['signed_error'].mean():+.2f}")
    print(cm)
results["thread1_per_reader"] = thread1

# %% [markdown]
# ### Inter-rater: do the readers agree with *each other* more than with the labels?
# Slide-level (last committed diagnosis per (reader, slide)), `slide_next` only — anchor granularity.

# %%
slide_diag = metrics.slide_level_diagnoses(ev, use_fallback=False)
ir = metrics.interrater_summary(slide_diag, READERS[0], READERS[1])
print(json.dumps({k: v for k, v in ir.items()}, indent=2, default=float))
results["interrater"] = ir

# fallback version (recovers label_select-only views) for transparency
slide_diag_fb = metrics.slide_level_diagnoses(ev, use_fallback=True)
ir_fb = metrics.interrater_summary(slide_diag_fb, READERS[0], READERS[1])
results["interrater_with_fallback"] = ir_fb

# %% [markdown]
# **Shared-bias vs noise.** Of the disagreements-with-GT on shared slides, how many are
# *concordant* (both readers make the same wrong call = shared convention) vs idiosyncratic?

# %%
disagree = ir["n_shared"] - ir["both_correct"]
concordant_error = ir["both_wrong_same"]
print(f"shared slides={ir['n_shared']}  both-correct={ir['both_correct']} "
      f"({ir['both_correct_rate']:.0%})  readers-agree={ir['agree_ab']} ({ir['agree_ab_rate']:.0%})")
print(f"of {disagree} GT-disagreements, {concordant_error} are CONCORDANT (shared bias), "
      f"{ir['one_correct']} split")
print(f"high-grade shared slides={ir['n_high_shared']}, BOTH undergraded high→low={ir['both_under_high']}")
results["shared_bias"] = {
    "n_gt_disagreements": int(disagree),
    "concordant_errors": int(concordant_error),
    "split_errors": int(ir["one_correct"]),
    "concordant_fraction_of_errors": float(concordant_error / disagree) if disagree else None,
}

# %% [markdown]
# ### Figures 1–3

# %%
print(figures.fig_confusion(confusions, accuracies, FIGDIR))
print(figures.fig_signed_error(slide_diag, READERS, FIGDIR))
print(figures.fig_agreement(ir, READERS, FIGDIR))

# %% [markdown]
# ## Thread 2 — Navigation & trajectory  *(serves B2)*
# Build the per-slide-view feature table (behaviour + diagnosis).

# %%
feat = navigation.build_feature_table(ev)
print("slide-views:", len(feat))
print(feat.groupby("user_id")[["active_dwell_s", "raw_dwell_s", "n_clicks",
                               "n_zoom_step", "max_zoom"]].median())

results["behaviour_medians"] = {
    r: feat[feat["user_id"] == r][["active_dwell_s", "raw_dwell_s", "n_clicks",
                                   "n_zoom_step", "max_zoom", "frac_time_ge_10x"]].median().to_dict()
    for r in READERS
}

# %% [markdown]
# ### Coarse-to-fine: do views zoom *in* over time ("rule-out then confirm")?

# %%
ctf = feat["ctf_spearman"].dropna()
from scipy.stats import wilcoxon
ctf_stat = {
    "mean_rho": float(ctf.mean()),
    "median_rho": float(ctf.median()),
    "frac_positive": float((ctf > 0).mean()),
    "n_views_scored": int(len(ctf)),
    "wilcoxon_p_vs_0": float(wilcoxon(ctf)[1]) if len(ctf) > 10 else None,
}
print("coarse-to-fine:", ctf_stat)
results["coarse_to_fine"] = ctf_stat

# %% [markdown]
# ### B2 shuffle falsifier — does navigation *order* carry signal?

# %%
shuf = metrics.shuffle_falsifier(ev, n_shuffles=200, seed=0)
print({k: v for k, v in shuf.items() if k != "h_shuffled_samples"})
results["shuffle_falsifier"] = {k: v for k, v in shuf.items() if k != "h_shuffled_samples"}

# %% [markdown]
# ### Figures 4–5, 7 (zoom usage, example scanpaths, shuffle)

# %%
tmag = navigation.time_at_magnification_table(ev)
print(figures.fig_zoom_usage(feat, tmag, READERS, FIGDIR))

# pick scanpath examples: a high-grade slide undergraded vs correctly graded (most viewport points)
def _example_views():
    out = []
    hg = feat[(feat["ground_truth"] == "high-grade") & feat["committed_label"].notna()].copy()
    hg = hg.sort_values("n_viewport_poll", ascending=False)
    under = hg[hg["committed_label"] == "low-grade"].head(1)
    corr = hg[hg["committed_label"] == "high-grade"].head(1)
    for tag, row in [("high-grade slide read as LOW", under), ("high-grade read CORRECTLY", corr)]:
        if len(row):
            rr = row.iloc[0]
            g = ev[(ev["session_id"] == rr["session_id"]) &
                   (ev["viewing_attempt"] == rr["viewing_attempt"])]
            out.append((f"{rr['user_id']} · {rr['slide_id']}\n{tag}\n"
                        f"{rr['active_dwell_s']:.0f}s, max {rr['max_zoom']:g}×", g))
    return out

print(figures.fig_scanpaths(_example_views(), FIGDIR))
print(figures.fig_shuffle(shuf, FIGDIR))

# %% [markdown]
# ## Thread 3 — Behaviour ↔ diagnosis bridge
#
# Lead hypothesis: on high-grade slides, *under-graded* views got **less** examination
# (lower zoom, shorter active-dwell, fewer clicks) than correctly-graded ones.

# %%
hg = feat[(feat["ground_truth"] == "high-grade") & feat["committed_label"].notna()].copy()
hg_under = hg[hg["committed_label"] == "low-grade"]
hg_corr = hg[hg["committed_label"] == "high-grade"]
bridge = {}
for col in ["active_dwell_s", "max_zoom", "n_clicks", "n_zoom_step", "frac_time_ge_10x", "n_fixations"]:
    bridge[col] = metrics.mann_whitney(hg_corr[col], hg_under[col])
print("High-grade: correct vs under-grade (Mann–Whitney, Cliff's δ):")
for k, v in bridge.items():
    print(f"  {k:18s} median corr={v['median_x']:.2f}  under={v['median_y']:.2f}  "
          f"δ={v['cliffs_delta']:+.2f}  p={v['p']:.3f}")
results["bridge_highgrade_correct_vs_under"] = bridge

# %% [markdown]
# ### Descriptive logistic model: predict an *error* from behaviour features

# %%
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

model_cols = ["active_dwell_s", "max_zoom", "n_clicks", "n_zoom_step",
              "frac_time_ge_10x", "path_len_px", "n_fixations", "label_switches"]
md = feat[feat["committed_label"].notna()].dropna(subset=model_cols + ["correct"]).copy()
X = StandardScaler().fit_transform(md[model_cols].values)
y = (~md["correct"].astype(bool)).astype(int).values  # 1 = error
clf = LogisticRegression(max_iter=1000).fit(X, y)
# bootstrap CIs
rng = np.random.default_rng(0)
boot = []
for _ in range(500):
    idx = rng.integers(0, len(y), len(y))
    if len(np.unique(y[idx])) < 2:
        continue
    boot.append(LogisticRegression(max_iter=1000).fit(X[idx], y[idx]).coef_[0])
boot = np.array(boot)
coef_tbl = pd.DataFrame({
    "feature": model_cols,
    "coef(std)": clf.coef_[0],
    "ci_lo": np.percentile(boot, 2.5, axis=0),
    "ci_hi": np.percentile(boot, 97.5, axis=0),
}).sort_values("coef(std)")
print(f"error-prediction logistic (n={len(y)}, errors={int(y.sum())}):")
print(coef_tbl.to_string(index=False))
results["error_logistic"] = {
    "n": int(len(y)), "n_errors": int(y.sum()),
    "coefficients": coef_tbl.to_dict(orient="records"),
}

# %% [markdown]
# ### Label-switching as an uncertainty signal

# %%
lab = feat[feat["committed_label"].notna()].copy()
lab["switched"] = lab["label_switches"] > 1
sw = lab.groupby("switched")["correct"].agg(["mean", "size"])
print("error rate by mind-change:\n", (1 - sw["mean"]).rename("error_rate"))
results["label_switching"] = {
    "n_switched": int(lab["switched"].sum()),
    "error_rate_switched": float(1 - sw["mean"].get(True, np.nan)),
    "error_rate_settled": float(1 - sw["mean"].get(False, np.nan)),
}

# %% [markdown]
# ### Speed vs accuracy, and revisits

# %%
speed = {}
for r in READERS:
    d = feat[(feat["user_id"] == r) & feat["committed_label"].notna()]
    speed[r] = metrics.mann_whitney(d[d["correct"] == True]["active_dwell_s"],
                                    d[d["correct"] == False]["active_dwell_s"])
    print(f"{r}: active-dwell correct vs error  "
          f"median {speed[r]['median_x']:.0f}s vs {speed[r]['median_y']:.0f}s  "
          f"δ={speed[r]['cliffs_delta']:+.2f} p={speed[r]['p']:.3f}")
results["speed_accuracy"] = speed

revisits = feat[feat["revisit"]]
rv = {"n_revisit_views": int(len(revisits)),
      "n_slides_revisited": int(revisits["slide_id"].nunique()),
      "revisit_accuracy": float(revisits["correct"].dropna().mean()) if len(revisits) else None}
print("revisits:", rv)
results["revisits"] = rv

# Figure 6 (behaviour by outcome)
print(figures.fig_behaviour_by_outcome(feat, FIGDIR))

# %% [markdown]
# # Research questions — full-dataset extension (Q1–Q6)
#
# Both readers now complete (250 slides each). Headline diagnoses use the
# **fallback** extraction (`slide_diag_fb`, recovers `label_select`-only views → full
# 250/250 coverage); `slide_diag` (slide_next-only) is shown alongside for continuity
# with the anchors above.

# %%
A, B = READERS

# %% [markdown]
# ## Q1 — Diagnostic accuracy vs Portuguese ground truth
# Binary cancer-detection (low+high = cancer) + 3-class + concordant/discordant errors.

# %%
q1 = {"binary": {}, "binary_slidesets": {}}
for r in READERS:
    bm = metrics.binary_metrics(slide_diag_fb, r)
    q1["binary"][r] = bm
    print(f"{r}: binary acc={bm['accuracy']:.1%} sens={bm['recall']:.1%} spec={bm['specificity']:.1%} "
          f"prec={bm['precision']:.1%} FPrate={bm['fp_rate']:.1%} FNrate={bm['fn_rate']:.1%} "
          f"(tp{bm['tp']} fp{bm['fp']} fn{bm['fn']} tn{bm['tn']})")
sets = {r: metrics.binary_slide_sets(slide_diag_fb, r) for r in READERS}
fp_shared = sorted(sets[A]["fp"] & sets[B]["fp"]); fn_shared = sorted(sets[A]["fn"] & sets[B]["fn"])
q1["binary_slidesets"] = {
    r: {"fp": sorted(sets[r]["fp"]), "fn": sorted(sets[r]["fn"])} for r in READERS}
q1["binary_shared"] = {"fp_shared": fp_shared, "fn_shared": fn_shared,
                       "n_fp_shared": len(fp_shared), "n_fn_shared": len(fn_shared)}
print(f"binary FP shared by both: {len(fp_shared)}  FN shared by both: {len(fn_shared)}")

# 3-class accuracy (fallback) + concordant/discordant split
ir_fb = metrics.interrater_summary(slide_diag_fb, A, B)  # recompute on full set
q1["three_class_accuracy"] = {r: float((slide_diag_fb[slide_diag_fb.user_id == r]["label"] ==
                                        slide_diag_fb[slide_diag_fb.user_id == r]["ground_truth"]).mean())
                              for r in READERS}
disagree_fb = ir_fb["n_shared"] - ir_fb["both_correct"]
q1["concordance"] = {"n_shared": ir_fb["n_shared"], "both_correct": ir_fb["both_correct"],
                     "concordant_errors": ir_fb["both_wrong_same"], "split_errors": ir_fb["one_correct"],
                     "concordant_fraction": float(ir_fb["both_wrong_same"] / disagree_fb)}
print(f"3-class acc: {q1['three_class_accuracy']}")
print(f"of {disagree_fb} GT-disagreements, {ir_fb['both_wrong_same']} concordant "
      f"({q1['concordance']['concordant_fraction']:.0%}), {ir_fb['one_correct']} split")
results["q1_accuracy"] = q1
print(figures.fig_binary_confusion(q1["binary"], FIGDIR))

# %% [markdown]
# ## Q2 — Inter-pathologist agreement (binary + 3-class + reader×reader confusion)

# %%
q2 = {"binary_interrater": metrics.binary_interrater(slide_diag_fb, A, B),
      "three_class": {"kappa_ab": ir_fb["kappa_ab"], "agree_rate": ir_fb["agree_ab_rate"],
                      "n_shared": ir_fb["n_shared"], "agree_ab": ir_fb["agree_ab"]}}
rc = metrics.reader_confusion(slide_diag_fb, A, B, binary=False)
q2["reader_confusion"] = rc.to_dict()
print("binary:", {k: round(v, 3) if isinstance(v, float) else v for k, v in q2["binary_interrater"].items()})
print(f"3-class: agree {ir_fb['agree_ab_rate']:.1%}  kappa_ab {ir_fb['kappa_ab']:.3f}")
print("reader × reader (rows=%s, cols=%s):" % (A, B)); print(rc.to_string())
results["q2_interrater"] = q2
print(figures.fig_reader_confusion(rc, READERS, FIGDIR))

# %% [markdown]
# ## Q3 — Resolution usage (lock the operating-point numbers)

# %%
mz = feat["max_zoom"].dropna()
q3 = {"frac_le_5x": float((mz <= 5).mean()), "frac_ge_10x": float((mz >= 10).mean()),
      "frac_ge_20x": float((mz >= 20).mean()), "frac_ge_40x": float((mz >= 40).mean()),
      "n_le_5x": int((mz <= 5).sum()), "n_ge_20x": int((mz >= 20).sum()),
      "median_events": int(feat["n_events"].median()),
      "median_active_dwell_s": float(feat["active_dwell_s"].median()),
      "median_max_zoom": float(mz.median())}
from sklearn.mixture import GaussianMixture
_x = np.log2(mz.values).reshape(-1, 1)
q3["gmm_bic"] = {k: float(GaussianMixture(k, random_state=0).fit(_x).bic(_x)) for k in (1, 2, 3)}
print(f"never exceed 5x: {q3['frac_le_5x']:.1%} | reach >=20x: {q3['frac_ge_20x']:.1%} | "
      f"reach 40x: {q3['frac_ge_40x']:.1%}")
print(f"median events/view {q3['median_events']}  active-dwell {q3['median_active_dwell_s']:.0f}s  "
      f"max-zoom {q3['median_max_zoom']:g}x | GMM BIC k1/2/3 {[round(v) for v in q3['gmm_bic'].values()]} "
      f"(k>=2 << k=1 => rung-quantized, multimodal)")
results["q3_resolution"] = q3
print(figures.fig_resolution_reach(feat, READERS, FIGDIR))

# %% [markdown]
# ## Q4 — Zoom strategy: motifs, dwell, and navigation-style clusters

# %%
from collections import Counter
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# action-transition matrix P(next | current) over reader actions (polls excluded)
trans = Counter()
for _, g in load.view_groups(ev):
    s = navigation.action_sequence(g)
    for u, v in zip(s[:-1], s[1:]):
        trans[(u, v)] += 1
acts = navigation.ACTION_EVENTS
Pmat = pd.DataFrame(0.0, index=acts, columns=acts)
for (u, v), c in trans.items():
    Pmat.loc[u, v] = c
Pmat = Pmat.div(Pmat.sum(axis=1).replace(0, np.nan), axis=0).fillna(0)
print("action transition P(next|current):"); print(Pmat.round(2).to_string())

# strategy clusters on navigation features
clust_cols = ["max_zoom", "n_zoom_step", "n_clicks", "n_fixations", "active_dwell_s",
              "frac_time_ge_10x", "path_len_px", "n_arrow_pan", "ctf_spearman"]
cd = feat.dropna(subset=clust_cols).copy()
Z = StandardScaler().fit_transform(cd[clust_cols])
sil = {k: float(silhouette_score(Z, KMeans(k, random_state=0, n_init=10).fit_predict(Z))) for k in (2, 3, 4)}
km = KMeans(3, random_state=0, n_init=10).fit(Z)
cd["cluster"] = km.labels_
profz = (cd.groupby("cluster")[clust_cols].mean() - feat[clust_cols].mean()) / feat[clust_cols].std()
profz.index = [f"C{i} (n={int((cd.cluster == i).sum())})" for i in profz.index]
q4 = {"transition_matrix": Pmat.round(4).to_dict(), "silhouette": sil,
      "cluster_sizes": {f"C{i}": int((cd.cluster == i).sum()) for i in sorted(cd.cluster.unique())},
      "cluster_zprofile": profz.round(3).to_dict(),
      "regions_per_view_median": float(feat["n_fixations"].median()),
      "regions_per_view_p90": float(feat["n_fixations"].quantile(0.9))}
print(f"silhouette k2/3/4: {sil}")
print("cluster z-profile:"); print(profz.round(2).to_string())
print(f"regions/view (n_fixations) median {q4['regions_per_view_median']:g}  p90 {q4['regions_per_view_p90']:g}")
results["q4_strategy"] = q4
print(figures.fig_event_transitions(Pmat, FIGDIR))
print(figures.fig_strategy_clusters(profz, FIGDIR))

# %% [markdown]
# ## Q5 — Attention overlap: do the two readers look at the same regions?
# Per-(slide,reader) coverage ("colour") maps from viewport rectangles; compare A-vs-B
# against a null of mismatched-slide pairs (controls for the centre/area bias).

# %%
ov = saliency.shared_slide_overlap(ev, A, B, grid=128, gaussian_clicks=False)
nl = saliency.null_overlap(ev, A, B, grid=128, n=200, seed=0)
mw_cc = metrics.mann_whitney(ov["cc"], nl["cc"])
q5 = {"n_shared_maps": int(len(ov)),
      "real": {m: float(ov[m].median()) for m in ["cc", "sim", "kl", "iou_top"]},
      "null": {m: float(nl[m].median()) for m in ["cc", "sim", "kl", "iou_top"]},
      "real_cc_median": float(ov["cc"].median()), "null_cc_median": float(nl["cc"].median()),
      "cc_real_vs_null_p": float(mw_cc["p"]), "cc_cliffs_delta": float(mw_cc["cliffs_delta"]),
      "cc_by_gt": {g: float(ov[ov.ground_truth == g]["cc"].median())
                   for g in ov["ground_truth"].dropna().unique()}}
print(f"real (same slide) median cc {q5['real_cc_median']:.3f} vs null {q5['null_cc_median']:.3f} "
      f"(Mann-Whitney p={mw_cc['p']:.1e}, delta={mw_cc['cliffs_delta']:.2f})")
print("real medians:", {k: round(v, 3) for k, v in q5["real"].items()})
print("null medians:", {k: round(v, 3) for k, v in q5["null"].items()})
results["q5_overlap"] = q5
print(figures.fig_overlap_similarity(ov, nl, FIGDIR, metric="cc"))

# representative colour-map examples: slide nearest the median cc within a GT class
examples = []
for gt in ["high-grade", "non-neoplastic"]:
    sub = ov[ov.ground_truth == gt].copy()
    if len(sub):
        sub["d"] = (sub["cc"] - sub["cc"].median()).abs()
        sid = sub.sort_values("d").iloc[0]["slide_id"]
        se = ev[ev.slide_id == sid]; extent = saliency.slide_extent(se)
        mA, _ = saliency.coverage_map(se[se.user_id == A], extent, grid=128)
        mB, _ = saliency.coverage_map(se[se.user_id == B], extent, grid=128)
        examples.append((f"{sid}\n{gt} (cc={sub.sort_values('d').iloc[0]['cc']:.2f})", mA, mB))
print(figures.fig_colormaps(examples, READERS, FIGDIR))

# %% [markdown]
# ## Q6 — Resolution vs accuracy (descriptive; difficulty-confounded)

# %%
from scipy.stats import fisher_exact
d6 = feat[feat["committed_label"].notna()].copy()
hi = d6[d6["max_zoom"] >= 20]["correct"].astype(bool)
lo = d6[d6["max_zoom"] <= 5]["correct"].astype(bool)
_ct = [[int(hi.sum()), int((~hi).sum())], [int(lo.sum()), int((~lo).sum())]]
# binary FN/FP max-zoom (per-slide max across that reader's events)
slide_mz = feat.groupby(["user_id", "slide_id"])["max_zoom"].max().reset_index()
sd6 = slide_diag_fb.merge(slide_mz, on=["user_id", "slide_id"], how="left")
sd6["pb"] = sd6["label"].map(labels.to_binary); sd6["tb"] = sd6["ground_truth"].map(labels.to_binary)
fn6 = sd6[(sd6.pb == "non-cancer") & (sd6.tb == "cancer")]
fp6 = sd6[(sd6.pb == "cancer") & (sd6.tb == "non-cancer")]
q6 = {"acc_ge20x": float(hi.mean()), "n_ge20x": int(len(hi)),
      "acc_le5x": float(lo.mean()), "n_le5x": int(len(lo)),
      "fisher_p": float(fisher_exact(_ct)[1]),
      "fn_median_maxzoom": float(fn6["max_zoom"].median()), "n_fn": int(len(fn6)),
      "fp_median_maxzoom": float(fp6["max_zoom"].median()), "n_fp": int(len(fp6)),
      "all_median_maxzoom": float(sd6["max_zoom"].median())}
print(f">=20x acc {q6['acc_ge20x']:.1%} (n={q6['n_ge20x']}) vs <=5x acc {q6['acc_le5x']:.1%} "
      f"(n={q6['n_le5x']}) Fisher p={q6['fisher_p']:.3f}")
print(f"binary FN median max-zoom {q6['fn_median_maxzoom']:g}x (n={q6['n_fn']}) vs FP "
      f"{q6['fp_median_maxzoom']:g}x (n={q6['n_fp']}) vs all {q6['all_median_maxzoom']:g}x "
      f"=> errors are NOT under-zoomed (interpretive, not attentional)")
results["q6_resolution_accuracy"] = q6
print(figures.fig_resolution_accuracy(feat, FIGDIR))

# %% [markdown]
# ## Anchor checks — fail loudly if the pipeline drifts

# %%
def approx(a, b, tol):  # noqa
    assert abs(a - b) <= tol, f"ANCHOR FAIL: {a} vs {b} (tol {tol})"

approx(accuracies["muhammad.aslam"], 0.648, 0.01)
approx(accuracies["ashish.bansal"], 0.712, 0.01)
assert thread1["muhammad.aslam"]["n_committed"] == 236, thread1["muhammad.aslam"]["n_committed"]
assert thread1["ashish.bansal"]["n_committed"] == 222, thread1["ashish.bansal"]["n_committed"]
assert thread1["muhammad.aslam"]["high_to_low_undergrade"] == [48, 78]
assert thread1["ashish.bansal"]["high_to_low_undergrade"] == [38, 72]
assert ir["n_shared"] == 209, ir["n_shared"]
assert ir["agree_ab"] == 186, ir["agree_ab"]
assert ir["both_correct"] == 131, ir["both_correct"]
assert ir["both_wrong_same"] == 55, ir["both_wrong_same"]
assert ir["n_high_shared"] == 67 and ir["both_under_high"] == 33

# --- full-dataset research-question anchors (Q1–Q6, fallback extraction) ---
assert q1["binary"]["muhammad.aslam"]["tp"] == 163 and q1["binary"]["muhammad.aslam"]["fn"] == 16, q1["binary"]["muhammad.aslam"]
assert q1["binary"]["ashish.bansal"]["tp"] == 161 and q1["binary"]["ashish.bansal"]["fp"] == 11, q1["binary"]["ashish.bansal"]
assert q1["binary_shared"]["n_fp_shared"] == 11 and q1["binary_shared"]["n_fn_shared"] == 15
assert ir_fb["n_shared"] == 250 and ir_fb["both_correct"] == 155 and ir_fb["both_wrong_same"] == 66
assert q2["binary_interrater"]["n_agree"] == 240, q2["binary_interrater"]["n_agree"]
approx(q3["frac_le_5x"], 0.622, 0.01); approx(q3["frac_ge_20x"], 0.116, 0.01)
assert q5["n_shared_maps"] == 250, q5["n_shared_maps"]
approx(q5["real_cc_median"], 0.491, 0.03); assert q5["null_cc_median"] < 0.2, q5["null_cc_median"]
assert q6["n_ge20x"] == 58 and q6["n_le5x"] == 309, (q6["n_ge20x"], q6["n_le5x"])
approx(q6["acc_ge20x"], 0.517, 0.02); approx(q6["acc_le5x"], 0.712, 0.02)
print("ALL ANCHORS OK ✓")

# %% [markdown]
# ## Persist results for the report / gbrain page

# %%
os.makedirs(REPORTS, exist_ok=True)
with open(os.path.join(REPORTS, "results.json"), "w") as f:
    json.dump(results, f, indent=2, default=lambda o: float(o) if isinstance(o, (np.floating,)) else int(o)
              if isinstance(o, (np.integer,)) else str(o))
print("wrote", os.path.join(REPORTS, "results.json"))
