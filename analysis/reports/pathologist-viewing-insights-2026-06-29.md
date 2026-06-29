# Pathologist viewing-behaviour — full-dataset insight memo (2026-06-29)

**Data:** `analysis/data/pathology_events_2026-06-29.csv` (20,658 events).
**Readers:** `muhammad.aslam` (250 slides) and `ashish.bansal` (250 slides) — **both now
complete** (Bansal was 185 at the 2026-06-16 export). Three partial readers
(`iftikhar.rana` 20, `alistair.heath` 8, `admin` 2) are excluded from the headline.
**Task:** colorectal grading (non-neoplastic / low-grade / high-grade) on IMP-CRS-2024,
in the constrained click-to-zoom study tool.
**Supersedes:** `pathologist-viewing-insights-2026-06-16.md` (kept for provenance).

> **Caveat carried throughout:** viewport/cursor position is a *constrained-navigation
> attention proxy*, **NOT** eye-tracking. 2 readers (not 5); no per-region ground truth;
> navigation is constrained (no free pan, no mouse-wheel zoom).

**Extraction note.** Headline diagnoses use the **fallback** extraction (final `slide_next`
label, else last `label_select`) → full **250/250** coverage. The fail-loud anchors retain
the stricter `slide_next`-only granularity (Aslam n=236, Bansal n=222) for continuity with
the 06-16 analysis. Both are reported; they agree on every qualitative claim.

---

## Lead insight (one line)

On the complete two-reader set the 06-16 story **holds and strengthens**: the readers agree
with **each other** far more than with the Portuguese labels (binary κ=**0.90** / 96%,
3-class κ=**0.83** / 88%, vs reader–GT κ **0.56–0.72**); their disagreements with GT are
**structured and shared** (69% of errors concordant), they operate at **5–10×** (62% of
views never pass 5×), they **look at the same regions** (map correlation 0.49 vs 0.05 chance),
and their errors are **interpretive, not attentional** (under-called slides got *more* zoom,
not less).

---

## Q1 — Diagnostic accuracy vs Portuguese ground truth

**Binary (cancer detection: low-grade + high-grade = "cancer").**

| Reader | acc | sensitivity | specificity | precision | FP rate | FN rate | (tp/fp/fn/tn) |
|---|---|---|---|---|---|---|---|
| muhammad.aslam | 86.8% | 91.1% | 76.1% | 90.6% | 23.9% | 8.9% | 163/17/16/54 |
| ashish.bansal | 88.4% | 89.9% | 84.5% | 93.6% | 15.5% | 10.1% | 161/11/18/60 |

**The errors are about grading, not detection:** both readers detect cancer at ~87–88% but
3-class accuracy is only **65.2% (Aslam) / 70.4% (Bansal)** — the gap is the low-grade↔high-grade
boundary. (slide_next-only granularity: 64.8% / 71.2%.)

**3-class confusion (slide_next anchor granularity).** Both systematically under-grade
high-grade → low-grade: Aslam **48/78**, Bansal **38/72**.

**Concordant vs discordant.** Of the **95** slides where at least one reader disagrees with GT,
**66 (69%) are concordant** — both readers give the *same* wrong call (shared convention, not
noise); only 29 are split.

**Which slides are FP / FN, and are they shared?** Yes, heavily:
- **11 binary FPs are shared by both** (`CRC_0489, 0675, 0787, 1042, 1615, 2291, 2446, 2768, 3127, 3245, 3767`) — every one of Bansal's FPs is also Aslam's.
- **15 binary FNs are shared by both** (e.g. `CRC_0532, 0580, 0828, 1515, 1524, 1529, 2485, 2490, 2714, 2773, 3058, 3211, 3659, 3918, 3947`).

Figure: `08_binary_confusion.png`. Full slide lists in `results.json → q1_accuracy`.

## Q2 — Inter-pathologist agreement (250 shared slides)

| view | agreement | κ (reader×reader) | κ reader-A×GT | κ reader-B×GT |
|---|---|---|---|---|
| binary | **96.0%** | **0.904** | 0.674 | 0.723 |
| 3-class | **88.4%** | **0.830** | 0.560 | 0.634 |

Reader×reader is far higher than either reader vs GT — the "UK-vs-Portugal convention offset"
is the dominant structure. Reader×reader 3-class confusion (rows Aslam / cols Bansal): the mass
is on the diagonal (69 / 122 / 30); the few disagreements are **adjacent grades** (Aslam-low ×
Bansal-high 11; Aslam-high × Bansal-low 8; Aslam-low × Bansal-nonneo 9) — never a 2-step jump.
**Both** independently undergrade high→low on **40 of 84** shared high-grade slides (48%).
Figure: `09_reader_confusion.png`.

## Q3 — Resolution usage (operating point locked)

- **62.2%** of slide-views **never exceed 5×**; **37.8%** reach ≥10×; **11.6%** reach ≥20×;
  **2.6%** reach 40×.
- Median **31 events/view**, **24 s** active dwell, **5×** max magnification.
- The max-magnification distribution is **rung-quantized / multimodal** (GMM BIC drops sharply
  k=1→k≥2): mass piles at 5×, then 10×, with a thin tail to 20–40× — not a smooth continuum.

Figures: `04_zoom_usage.png`, `10_resolution_reach.png`.

## Q4 — Zoom strategy

**Characteristic action motif** (transition matrix P(next|current), viewport polls excluded):
`cell_click → zoom_step` **0.95** (a click commits a zoom-in); `zoom_step → zoom_step` 0.51 /
`→ cell_click` 0.39 (zoom in, recentre, zoom again); `arrow_pan → arrow_pan` **0.74** and
`back_step → back_step` **0.87** (panning and zooming-out both come in runs);
`label_select → slide_next` **0.84** (decide, then advance). So the canonical loop is
**low-power survey → click-to-zoom into a suspicious focus → pan to explore → settle → label →
next**, consistent with the coarse-to-fine result (Thread 2: 95% of views zoom in over time).

**Two navigation styles** (k-means; silhouette best at k=2 = 0.37):
- **C0 — shallow/fast (n=320):** below-average on every depth/effort feature.
- **C1 — deep/thorough (n=177):** above-average zoom, clicks, fixations, dwell, time-at-high-power.
- (k=3 isolates **2 marathon outlier views** with extreme panning/dwell.)

Readers examine **~3 distinct regions per view** (median n_fixations 3, p90 6).
Figures: `11_strategy_clusters.png`, `12_event_transitions.png`.

## Q5 — Attention overlap (do the two readers look at the same regions?)

Per-(slide, reader) coverage ("colour") maps were built by depositing +1 over every viewport
rectangle onto a 128-cell level-0 grid, then compared A-vs-B against a **null of mismatched-slide
pairs** (controls for the strong centre/area bias of constrained navigation).

| metric | real (same slide) | null (mismatched) | reading |
|---|---|---|---|
| **CC** (correlation) | **0.491** | 0.046 | readers attend the same regions ≫ chance |
| top-10% IoU | 0.21 | 0.12 | hottest regions overlap ~2× chance |
| KL divergence (bits) | 0.021 | 0.061 | maps are closer than chance |
| SIM (hist. intersection) | 0.954 | 0.929 | *saturated by centre bias — uninformative here* |

Real-vs-null CC: Mann–Whitney **p = 2×10⁻⁴²**, Cliff's δ = **0.75** (large). Over all **250**
shared slides. Figures: `13_colormaps.png` (example maps), `14_overlap_similarity.png`.
> Methodological note: SIM/histogram-intersection is near-ceiling even for mismatched slides
> because every map is dominated by the centred low-power viewport; **CC and top-k IoU are the
> discriminating metrics** and both show strong, real spatial agreement.

## Q6 — Resolution vs accuracy (descriptive, difficulty-confounded)

- Views reaching **≥20×** are **less** accurate (51.7%, n=58) than views staying **≤5×**
  (71.2%, n=309), Fisher p=0.005. This is **confounded by difficulty** — readers zoom deep
  *because* a slide is ambiguous, so depth is a marker of hard cases (consistent with Thread 3:
  errors take longer).
- **False negatives are not under-zoomed:** binary FN slides reached a **higher** median max
  magnification (**10×**, n=34) than slides overall (5×); FPs likewise (7.5×, n=28). Readers
  *looked harder* and still missed — the failure is interpretive, not attentional.

Figure: `15_resolution_accuracy.png`.

---

## New questions the event log can answer (beyond the original 8)

The log carries several untapped signals; candidates for the next pass:
1. **Idle/dwell micro-structure** — `idle_start/end` pauses by zoom level; do pauses precede label commits?
2. **Undo/uncertainty markers** — `back_step` (31) + `reset` (8) vs error.
3. **Label-commit timing** — time-to-first-label, label stability; early vs late deciders.
4. **First-impression accuracy / anchoring** — is the first `label_select` already correct?
5. **Scanpath recurrence** — do readers return to the same region (recurrence quantification)?
6. **Spatial coverage** — % slide area covered (from coverage maps) vs accuracy.
7. **Test–retest reliability** — `viewing_attempt>1` (10 revisit views): do diagnosis + trajectory repeat?
8. **Session drift / fatigue** — does behaviour/accuracy change across the 250-slide order?
9. **Magnification at decision** — zoom level when `label_select` fires; are correct calls made deeper?
10. **Human-derived difficulty score** — deep-zoom + long-dwell + label-switch → a curriculum /
    active-learning signal to weight slides for the model.

---

## Novelty positioning — FLAGGED FOR DECISION (not asserted)

A focused literature recon shows the strong claim ("no one has bundled WSI + pathologist
zoom/pan viewport trajectories + interface interactions as a dataset") is **not defensible as
written** — prior art exists. This section documents the landscape and options; the framing
decision is deferred (per instruction). **Do not ship the strong "first-ever" claim.**

**Prior art (verify + cite properly before any public use):**
- **PathoGaze1.0** (arXiv 2510.24653, 2025): eye-tracking + mouse + viewport navigation + zoom
  levels + diagnostic decisions, 19 pathologists × 397 WSIs, in a clinical-style testbed (PTAH).
  Most direct competitor; uses *free* navigation and reports no paired classifier on the slides.
- **Brunyé / Mercan et al.** (PMC9576972, 2022): viewport-coordinate + magnification + timestamp
  logging with zoom/pan variables; 32 pathologists (skin), and an 8-pathologist CRC-LN set.
- **DeepScope** (bioRxiv 2016): predicts WSI saliency from pathologist viewing — anticipates Q8.
- **Pathology-CoT** (arXiv 2510.04587, 2025) and a **Nature Communications 2025** paper
  (s41467-025-60307-1): learn from / quantify expert WSI viewing behaviour.
- Adjacent model work: **MMNavAgent** (multi-magnification WSI navigation agent), **DPAM-MIL**
  (arXiv 2403.07939, dynamic policy-driven adaptive MIL) — close in spirit to AdaZoom-MIL.

**Candidate (honest, narrower) differentiators to choose among:**
1. **Constrained, discretized action space** matching a multi-resolution MIL model's action space
   (click-to-zoom-in, right-click-zoom-out, 0.5× arrow-pan, no free pan / no wheel) — the human
   trajectories are directly usable as imitation targets without a free-gaze→action conversion.
2. **Paired with a public CRC grading benchmark (IMP-CRS-2024) and the matched AdaZoom-MIL model
   on the identical slides** — enabling apples-to-apples human-vs-model efficiency comparison.
3. **3-class dysplasia grading** (most viewport work is skin / prostate / CRC-LN detection).

Scanpath-comparison metrics for any future write-up: ScanMatch, MultiMatch, plus the
saliency metrics used here (CC / SIM / KL / IoU).

---

## Limitations
2 readers (not 5); no per-region tumour ground truth (so "did they look at the right region"
and "saliency vs tumour" cannot be answered yet); viewport trail is a **constrained-navigation
attention proxy, not eye-tracking**; constrained navigation aids the model-matched framing but
limits comparability to free-gaze studies; Q6's depth↔accuracy relation is difficulty-confounded
(descriptive only).

## Deferred to pass 2 (data exists; needs file paths)
- **Q7 — efficiency vs AdaZoom-MIL:** human zoom-budget vs the model's per-slide zoom steps +
  predicted labels (AdaZoom-MIL outputs confirmed available).
- **Q8 — saliency model:** 70/30 split on Aslam's 250 coverage maps; learn "where to look" from
  UNI 5× features (confirmed available). Saliency-vs-tumour needs per-region GT (unavailable).
- Formal, scite-cited literature review finalizing the chosen novelty framing.

## Figures (`analysis/figures/`)
`01_confusion` · `02_signed_error` · `03_agreement` · `04_zoom_usage` · `05_scanpaths` ·
`06_behaviour_by_outcome` · `07_shuffle_falsifier` · `08_binary_confusion` ·
`09_reader_confusion` · `10_resolution_reach` · `11_strategy_clusters` ·
`12_event_transitions` · `13_colormaps` · `14_overlap_similarity` · `15_resolution_accuracy`.
All headline numbers are asserted in the notebook (fail-loud) and persisted to
`analysis/reports/results.json`.
