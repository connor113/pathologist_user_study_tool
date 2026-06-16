---
type: analysis
title: 'Two-Pathologist Viewing-Behaviour Analysis — 2026-06-16'
date: '2026-06-16T00:00:00.000Z'
status: processed
related:
  - '[[mo-disagreement-analysis-31mar|Mo label-noise analysis]]'
  - '[[2026-06-09-project-b-three-ideas|Project B — Three Ideas]]'
  - '[[concepts/pathologist-attention|Pathologist Attention]]'
  - '[[concepts/colorectal-cancer-grading|CRC grading]]'
tags:
  - phd
  - user-study
  - pathologist-attention
  - label-noise
  - convention-offset
  - final-project
  - analysis
---

# Two-Pathologist Viewing-Behaviour Analysis — 2026-06-16

Up: [[2026-06-09-project-b-three-ideas|Project B]] · extends [[mo-disagreement-analysis-31mar|Mo's 18-slide analysis]] · concept: [[concepts/pathologist-attention|Pathologist Attention]]
Artifacts: `pathologist_user_study/analysis/` (branch `claude/happy-williamson-e78e35`) — notebook + figures + `reports/results.json`. Source: `pathology_events_2026-06-16.csv` (gitignored per repo convention; local only). 2 near-complete readers: `muhammad.aslam` 250 slides, `ashish.bansal` 185.

> [!goal] Lead insight (one sentence)
> **Two independent pathologists agree with *each other* far more than with the reference labels
> (κ = 0.81 vs 0.52–0.61; 88% vs 60%) and undergrade high-grade → low-grade in lockstep — the dominant
> signal here is a *structured, shared inter-observer convention offset*, not random label noise to
> average away.** This scales [[mo-disagreement-analysis-31mar|Mo's finding]] ×8 slides / +1 reader, and
> the second reader lets us separate *"GT is wrong"* from *"the humans share a different convention"* —
> the data points at the latter.

> [!warning] Scope
> Cursor/viewport = constrained-navigation **attention proxy, NOT eye-tracking**. **2 readers, not 5.**
> **No per-region GT.** **No model votes in this CSV** (so the full human+model Mo-rule needs a join).

## Thread 1 — Label & convention structure (serves B1)

- Both undergrade: **high-grade recall 0.38 / 0.43**; high→low **48/78 (62%)** and **29/51 (57%)**; mean signed ordinal error **−0.18 / −0.22** (one-directional downward shift).
- On **151 slides both graded**: agree with each other **88% (κ=0.81)**, with GT only **60% (κ=0.52/0.61)**. Of **60** GT-disagreements, **42 (70%) are concordant** (same wrong grade); of 47 shared high-grade slides, **25** undergraded by both.
- Concordance-with-each-other ≫ concordance-with-labels ⇒ **convention/calibration offset**, not noise or incompetence. Fallback extraction (184 shared) reproduces it.

## Thread 2 — Navigation & trajectory (serves B2)

- **Operating point 5–10×** (40× rare: 8 / 3 views). Median per view ~18 s / ~29 s, **5 clicks, 10 zoom-steps**.
- **Coarse-to-fine "rule-out then confirm":** zoom rises with time in **95% of views** (mean ρ=0.45, Wilcoxon p≈2e-68).
- **B2 shuffle falsifier PASSES:** next-magnification conditional entropy **1.00 bits real vs 2.09 shuffled** (Δ=1.08, p<0.005). Order carries signal → the "pyramid-video" framing is real, not a static saliency map.

## Thread 3 — Behaviour ↔ diagnosis (the honest twist)

- *Under-grading is NOT an effort artifact.* On high-grade slides, under-graded views were examined **as much or more** than correct ones (no diff in dwell/zoom/clicks; under had *more* zoom-steps δ=−0.19 p=.05, *more* fixations δ=−0.21 p=.03).
- Behaviour barely predicts error (logistic: only active-dwell marginal, β=+0.27 — **errors take longer, not shorter**). e.g. aslam spent **237 s at 40×** and still called a high-grade slide low.
- ⇒ The offset **survives careful looking**; it's interpretive, not attentional. *(Mind-change n=9 and revisit n=8 are under-powered — don't lean on them.)*

## Implications for [[2026-06-09-project-b-three-ideas|Project B]]

- **B1 (lead):** direct hit on B1's own falsifier — shared one-directional disagreement means naïve consensus-correction **fits UK-convention bias**, not denoising. → **UK consensus is now non-optional**; prioritise the **42 concordant-error + 47 shared high-grade** slides for re-grading. **Reframe** "label denoising" → "**model a structured inter-observer offset**" (per-rater/convention head). Join the **6-model votes** to finish the Mo-rule at scale.
- **B2:** **green light** — coarse-to-fine + order-structure confirmed; falsifier passes. Action space / magnification prior centred on **5–10×**; short sparse trajectories → lightweight sequential forecaster with a **start-low-zoom-in** prior.
- **B3:** unblocked (**~130** disagreement cases vs 7), but key the disagreement predictor on **slide content + the high-grade convention pattern**, not navigation features; target abstention at high-grade.
- **Architecture:** sparse discrete telemetry (~38 events/view) ⇒ attention prior from **viewport coverage + clicks at 5–10×**, not dense fixations. Keeps human signal **auxiliary** — offset in the *label target* (B1), nav prior in the *zoom_priority* slot (B2), never the backbone.

## Decisive next step

Collect the **independent UK consensus** on the prioritised subset — it is the only reference that
separates *convention offset* from *label noise*, and it is the lever for B1's headline result.
