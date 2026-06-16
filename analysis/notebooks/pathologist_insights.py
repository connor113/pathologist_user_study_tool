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
# Two near-complete readers (`muhammad.aslam` 250 slides, `ashish.bansal` 185) grading
# colorectal slides (IMP-CRS-2024: non-neoplastic / low-grade / high-grade) in the
# constrained click-to-zoom study tool. Source: `analysis/data/pathology_events_2026-06-16.csv`.
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
    os.path.join(ANALYSIS, "data", "pathology_events_2026-06-16.csv"),
    os.path.join(os.path.dirname(ANALYSIS), "pathology_events_2026-06-16.csv"),
]
DATA = next((p for p in _DATA_CANDIDATES if os.path.exists(p)), _DATA_CANDIDATES[0])
if not os.path.exists(DATA):
    raise FileNotFoundError(
        "pathology_events_2026-06-16.csv not found (gitignored per repo convention). "
        "Place it in analysis/data/. Tried: " + " ; ".join(_DATA_CANDIDATES))
FIGDIR = os.path.join(ANALYSIS, "figures")
REPORTS = os.path.join(ANALYSIS, "reports")
sys.path.insert(0, SRC)

import load, labels, metrics, navigation, figures
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
# ## Anchor checks — fail loudly if the pipeline drifts

# %%
def approx(a, b, tol):  # noqa
    assert abs(a - b) <= tol, f"ANCHOR FAIL: {a} vs {b} (tol {tol})"

approx(accuracies["muhammad.aslam"], 0.648, 0.01)
approx(accuracies["ashish.bansal"], 0.691, 0.01)
assert thread1["muhammad.aslam"]["n_committed"] == 236, thread1["muhammad.aslam"]["n_committed"]
assert thread1["ashish.bansal"]["n_committed"] == 162, thread1["ashish.bansal"]["n_committed"]
assert thread1["muhammad.aslam"]["high_to_low_undergrade"] == [48, 78]
assert thread1["ashish.bansal"]["high_to_low_undergrade"] == [29, 51]
assert ir["n_shared"] == 151, ir["n_shared"]
assert ir["agree_ab"] == 133, ir["agree_ab"]
assert ir["both_correct"] == 91, ir["both_correct"]
assert ir["both_wrong_same"] == 42, ir["both_wrong_same"]
assert ir["n_high_shared"] == 47 and ir["both_under_high"] == 25
print("ALL ANCHORS OK ✓")

# %% [markdown]
# ## Persist results for the report / gbrain page

# %%
os.makedirs(REPORTS, exist_ok=True)
with open(os.path.join(REPORTS, "results.json"), "w") as f:
    json.dump(results, f, indent=2, default=lambda o: float(o) if isinstance(o, (np.floating,)) else int(o)
              if isinstance(o, (np.integer,)) else str(o))
print("wrote", os.path.join(REPORTS, "results.json"))
