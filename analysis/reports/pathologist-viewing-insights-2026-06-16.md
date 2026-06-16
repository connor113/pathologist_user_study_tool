# Pathologist Viewing-Behaviour — Exploratory Insights

**Date:** 2026-06-16 · **Data:** `pathology_events_2026-06-16.csv` (local at `analysis/data/`; gitignored
per repo convention — data exports stay local) ·
**Readers analysed:** `muhammad.aslam` (250 slides) and `ashish.bansal` (185) · **Task:** colorectal
grading, IMP-CRS-2024 classes `non-neoplastic / low-grade / high-grade`.
**Reproduce:** `analysis/notebooks/pathologist_insights.ipynb` (asserts every headline number).

> ⚠️ The viewport/cursor trail is a **constrained-navigation attention proxy, not eye-tracking**.
> There are **2 readers (not 5)**, **no per-region ground truth**, and **no model votes in this CSV**.

---

## Lead insight (one sentence, for Gary)

> **Two independent pathologists grading the same colorectal slides agree with *each other* far more
> than with the reference labels (κ = 0.81 vs 0.52–0.61; 88% vs 60%) and err in one consistent
> direction — reading high-grade as low-grade — so the dominant signal in this dataset is a
> *structured, shared inter-observer convention offset*, not random label noise to be averaged away.**

This both **scales up** the original 18-slide "Mo" label-noise finding (×8 slides, +1 reader) and
**reframes** it: with a second reader we can now separate *"the label is wrong"* from *"the humans
share a different convention,"* and the data points hard at the latter.

---

## Thread 1 — Label & convention structure  *(lead; serves B1)*

**Both readers under-grade, the same way.** Headline accuracy is modest and *balanced* accuracy is
worse because one class collapses:

| Reader | n | Accuracy | Balanced acc | **high-grade recall** | high→low | mean signed error |
|---|---|---|---|---|---|---|
| muhammad.aslam | 236 | 64.8% | 0.646 | **0.385** | 48/78 (62%) | −0.18 |
| ashish.bansal | 162 | 69.1% | 0.690 | **0.431** | 29/51 (57%) | −0.22 |

Both miss **>half of all high-grade slides**, almost always by calling them low-grade. Mean signed
ordinal error is negative for both → a one-directional **downward shift**, not scatter. *(Fig. 1
confusion; Fig. 2 signed-error.)*

**The disagreement is shared, not idiosyncratic.** On the **151 slides both graded**:

- readers agree **with each other 88%** (κ = **0.81**), but agree **with GT only 60%** (κ = **0.52 / 0.61**);
- of the **60** GT-disagreements, **42 (70%) are *concordant*** — both readers give the *same* wrong grade;
- of 47 shared high-grade slides, **25 (53%)** were undergraded to low-grade by **both** independently.

Inter-rater concordance **≫** concordance-with-labels is the signature of a **calibration/convention
offset** between these (UK) readers and the (Portuguese IMP-CRS) reference, not random noise or
individual error. *(Fig. 3.)* A fallback extraction (184 shared slides, recovering `label_select`-only
views) reproduces it: κ_AB = 0.81, both-correct 59%, 51 concordant errors.

---

## Thread 2 — Navigation & trajectory  *(serves B2)*

**Operating point: 5–10×.** Across 441 slide-views, examination peaks at 5–10× magnification; 40× is
rarely reached (aslam 8 views, bansal 3) and most *dwell* sits at 2.5–5×. Medians per view: ~18 s
(aslam) / ~29 s (bansal) active-dwell, **5 clicks, 10 zoom-steps**. *(Fig. 4.)*

**Navigation is a coarse-to-fine "rule-out then confirm" policy.** Within a view, zoom level rises
monotonically with time in **95% of views** (mean Spearman ρ = 0.45, Wilcoxon p ≈ 2×10⁻⁶⁸): readers
start wide and zoom inward.

**The order carries real signal — the B2 falsifier passes.** Next-magnification conditional entropy is
**1.00 bits** for the real click-to-zoom order vs **2.09 bits** when each view's rung sequence is
shuffled (Δ = 1.08 bits, permutation p < 0.005 over 200 shuffles). Knowing the current magnification
predicts the next far better than chance ordering → the "pyramid-video" temporal structure is real,
**not** a relabelled static saliency map. *(Fig. 7; example trails in Fig. 5.)*

---

## Thread 3 — Behaviour ↔ diagnosis bridge  *(the honest twist)*

The intuitive hypothesis — *under-grading happens because they didn't look hard enough* — **fails**:

- On high-grade slides, **under-graded views were examined as much or *more* than correct ones**: no
  difference in active-dwell, max-zoom, clicks or time-at-high-power; if anything under-graded views
  had slightly **more** zoom-steps (Cliff's δ = −0.19, p = 0.05) and **more** fixations (δ = −0.21,
  p = 0.03). *(Fig. 6.)*
- A descriptive logistic model predicting *error* from 8 behaviour features is weak — only active-dwell
  is marginal (β = +0.27, 95% CI 0.005–0.60), i.e. **errors take *longer*, not shorter** (echoed
  per-reader: aslam's errors median 21 s vs 17 s correct, p = 0.015).
- Worked example (Fig. 5): aslam spent **237 s and zoomed to 40×** on a high-grade slide and still
  called it low-grade.

**Reading:** the under-grading **survives careful examination** — it is interpretive/convention, not
attention or effort. You cannot close it by "looking harder," and a model cannot close it by zooming
more. *(Cautions: the mind-change signal is n = 9, too small to lean on; revisits n = 8 — both
under-powered here.)*

---

## Ranked one-sentence insight candidates

1. **(strongest) Convention offset, not noise.** *Readers agree with each other (κ 0.81) far more than
   with the labels (κ 0.52–0.61) and undergrade high-grade in lockstep — a structured, predictable
   inter-observer offset.*
2. **Forecastable coarse-to-fine policy.** *Whole-slide navigation is a near-universal low→high "rule-out
   then confirm" trajectory whose magnification order is non-random (1 bit below chance) — a learnable
   control signal, not a saliency heatmap.*
3. **The offset is interpretive, not attentional.** *Under-graded slides get equal-or-more examination;
   behaviour barely predicts error — so the disagreement persists through careful looking.*

---

## Implications for Project B

**B1 — consensus-corrected labels (lead idea).** The finding is a *direct hit on B1's own falsifier*
(*"if consensus-CE improves accuracy on original GT but drops it on UK-consensus → you fit shared bias,
not correction"*). Because the two readers' disagreement is **shared and one-directional**, naïve
human+model consensus-correction risks **encoding a UK-convention bias** rather than denoising. Concretely:

- **Collect the UK consensus** — it is now *non-optional*; it is the only reference that can separate
  "GT wrong" from "convention offset." Prioritise the **42 concordant-error slides** and the **47 shared
  high-grade slides** as the decisive subset to send for re-grading first.
- **Reframe B1** from "label denoising" → "**modelling a structured, predictable inter-observer
  offset**" (a per-rater / per-convention label head). Arguably stronger, more novel framing.
- **Join the 6-model votes** (not in this CSV) to complete the Mo-rule (human+models vs GT) at n≈250.

**B2 — trajectory-as-pyramid-video.** **Green light.** Coarse-to-fine monotonicity and order-structure
are confirmed on real volume; the shuffle falsifier passes. Design notes: centre the action space /
magnification prior on **5–10×** (40× rare); trajectories are **short and sparse** (~10 zoom-steps),
favouring a lightweight sequential forecaster with a strong **start-low-then-zoom-in** inductive prior.

**B3 — disagreement triage.** Unblocked: **~130 disagreement cases** now (vs ~7). But since errors
barely correlate with navigation, a disagreement predictor should key on **slide content + the
high-grade convention pattern**, not navigation features alone; abstention should target the high-grade
class specifically.

**Architecture / constraints.** Telemetry is **discrete and sparse** (button nav, ~38 events/view) →
the pathologist-attention prior should be built from **viewport coverage + click points at 5–10×**, not
dense fixation maps (cursor ≠ gaze). This keeps the human signal **auxiliary, not load-bearing**: the
convention offset lives in the *label target* (B1) and the navigation prior in the *zoom_priority slot*
(B2), never in the backbone.

---

## What the data can and cannot support

| Can support | Cannot (yet) support |
|---|---|
| Convention offset is structured, shared, one-directional (2 readers) | That GT is *wrong* — needs the independent **UK consensus** |
| Navigation is coarse-to-fine and order-structured (B2 signal real) | Generalisation across **5 readers** (have 2) |
| Operating magnification is 5–10× | **Per-region** attention↔grade links (no per-region GT) |
| Under-grading is not an effort artifact | Dense **gaze** behaviour (cursor is a constrained proxy) |
| Human–human consensus at scale | Human–**model** consensus at scale (model votes not in this CSV) |

## Figures
`analysis/figures/` — 01 confusion · 02 signed-error · 03 inter-rater agreement/κ · 04 zoom usage ·
05 example scanpaths · 06 behaviour-by-outcome · 07 shuffle falsifier.
