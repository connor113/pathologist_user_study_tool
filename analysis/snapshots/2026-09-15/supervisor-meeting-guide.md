# Supervisor meeting guide — 15 September 2026

## Opening summary — read this aloud

“The completed analysis describes how two pathologists diagnosed and navigated
the same 250 colorectal slides. We have answered six main questions covering
diagnostic agreement, reader agreement, magnification, navigation, spatial
overlap and the relationship between zoom and diagnostic agreement. These
results were reproduced on September 4.

“The new export leaves both complete readers unchanged. Iftikhar Rana now has
180 labelled slides. We have added his diagnostic results separately; his
behavioural analyses have not yet been extended. The human–AdaZoom comparison
and training a model from the human viewing data remain unfinished.”

## What data are these answers based on?

- **Complete cohort:** Muhammad Aslam and Ashish Bansal, 250 labelled slides each.
- **New partial cohort:** Iftikhar Rana, 180/250 labelled slides. His results stay
  separate. Alistair Heath has seven labelled slides and is outside the headline analysis.
- Diagnoses use one final extracted label per reader and slide. Behavioural
  analyses use slide-view attempts, including some repeat attempts.
- Rana has opened 181 slides: 166 have a labelled advance event and 14 more use
  the existing label-selection fallback. One opened slide is unlabelled. The
  event export does not independently verify database completion timestamps.

## The six questions answered

### Q1. How often do the diagnoses match the reference labels?

**Method:** compare each reader's final diagnosis with the dataset reference,
first using all three grades, then combining low-grade and high-grade.

| Reader | Exact three-class match | Binary match |
|---|---:|---:|
| Aslam — complete, 250 slides | **65.2%** | **86.8%** |
| Bansal — complete, 250 slides | **70.4%** | **88.4%** |
| Rana — partial, 180 slides | **70.0%** | **87.2%** |

**Say:** “A substantial part of the disagreement concerns low versus high grade.
Binary agreement is higher because it ignores that distinction.”

For example, Rana matches exactly on 126/180 slides. Another 31 low/high-grade
disagreements become matches after combining those categories: 157/180.

### Q2. Do the two complete readers agree with each other?

**Method:** compare their diagnoses on the same 250 slides.

**Answer:** they agree on **88.4%** of exact grades and **96.0%** of binary calls.
Of the 95 slides where at least one reader differs from the reference, both give
the same differing diagnosis on **66**. They share 11 binary false positives and
15 binary false negatives, relative to the reference labels.

**Say:** “Their disagreements with the reference are often shared. That suggests
a pattern worth investigating, but does not establish its cause.”

### Q3. What magnification do they actually use?

**Method:** summarise the highest magnification reached and active viewing time
for each slide-view attempt.

**Answer:** **62.2%** of views never exceed **5×**; **37.8%** reach at least 10×,
and **11.6%** reach at least 20×. Median maximum magnification is 5×; median
estimated active viewing time is 24 seconds.

**Say:** “Most recorded viewing stays at relatively low magnification, with
higher magnification used for a smaller subset of views.”

### Q4. How do they navigate a slide?

**Method:** examine action sequences and group views by zoom, clicks, movement
and viewing time.

**Answer:** clicks are usually followed by zooming in; panning and zooming out
often occur in runs. The median view contains about **three estimated regions**.
Exploratory grouping identifies broadly shallow/shorter and deeper/longer views,
with a small number of extreme views.

**Say:** “The logs show recurring exploration patterns, but the interface itself
constrains the actions available. These are not established pathologist types.”

### Q5. Do the readers view similar parts of the same slide?

**Method:** turn recorded viewport rectangles into coverage maps and compare
same-slide reader pairs with a mismatched-slide baseline.

**Answer:** median map correlation is approximately **0.49** for the same slide
versus **0.05** for mismatched slides. The most frequently displayed regions also
overlap more for the same slide.

**Say:** “The readers display more similar regions on the same slide than on
mismatched slides. Viewport coverage is a proxy for what was displayed; it does
not tell us exactly where their eyes were looking.”

### Q6. Is using more magnification associated with better diagnostic agreement?

**Method:** compare label agreement between views reaching different maximum
magnifications.

**Answer:** views reaching **20× or more** have **51.7%** exact agreement
(58 views), versus **71.2%** among views staying at **5× or below** (309 views).
Binary false-negative views reach a median maximum of 10×, compared with 5×
overall.

**Say:** “Higher zoom is associated with lower agreement here. Difficult cases
may prompt more zoom, so this does not show that zoom causes errors or establish
that the errors are interpretive rather than attentional.”

## What changed with the September export?

- Event rows increased **20,659 → 28,422**; all **7,763** additions belong to Rana.
- Both complete readers' event histories and all existing diagnoses/reference
  labels are unchanged. Rana's usable diagnoses increased **19 → 180**; June's
  reported 20 referred to slides opened.
- The June data and results were preserved. New outputs are separately dated.
- Rana Q1 is now calculated, including a descriptive comparison restricted to
  the same 180 slides for all three readers. His Q2-Q6 extension is still pending.
- Before extending behavioural analyses, account for 187 identical-row excess
  copies in the added events and six new missing-coordinate events. The export
  does not provide enough information to automatically delete duplicate-looking rows.

## Questions still unanswered

1. **Q7: How do human viewing and predictions compare with AdaZoom on matched
   slides?** Not yet answered. The September 4 audit identified 248 eligible
   matches out of 250; two were excluded for missing low-magnification features.
   We still need predictions/routes from models that excluded each evaluated
   slide's fold, verified coordinate alignment and patient grouping.
2. **Q8: Can human viewing behaviour improve a model or teach it where to look?**
   Not yet demonstrated. It requires a defined prediction/training task and an
   evaluation that keeps training information separate from evaluated cases.
3. **Why do readers and reference labels disagree?** The pattern is measured;
   its cause is unresolved. Convention differences and interpretive/attention
   explanations remain hypotheses.

## Suggested discussion with supervisors

“The descriptive two-reader analysis is reproducible. I suggest we agree the
main question for the human–AdaZoom comparison, while deciding which of Rana's
partial behavioural analyses are worth extending. We should keep exploratory
observations separate from claims about causes or clinical performance.”

## Sources

- `analysis/reports/results.json`: saved Q1-Q6 numerical results.
- `analysis/reports/2026-09-04-reproduction-and-comparison-audit.md`: reproduction
  and interpretation limits, plus AdaZoom prerequisites.
- `analysis/snapshots/2026-09-15/comparison.md` and `comparison.json`: export audit.
- `analysis/snapshots/2026-09-15/q1-results.json` and `q1-walkthrough.md`: Rana Q1,
  complete-reader checks and matched-subset sensitivity.
