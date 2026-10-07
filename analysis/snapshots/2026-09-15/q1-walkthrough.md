# Q1, step by step: agreement with the reference diagnosis

**Snapshot:** September 15, 2026. Complete-reader results were checked against the
preserved June `results.json`; Rana is a separate partial-reader extension.

## 1. Purpose — what are we trying to find out?

For each reader, how often does the final extracted diagnosis match the dataset's
reference diagnosis? This describes label agreement. It does not explain why a
disagreement happened or decide which judgement is clinically correct.

There are two versions of the question:

- **Three classes:** did the reader select exactly non-neoplastic, low-grade or
  high-grade, matching the reference?
- **Binary:** did the reader distinguish non-neoplastic from the combined
  low-grade/high-grade category? The repository calls this “cancer detection”,
  but that name is a coding convention here, not a separately validated clinical
  endpoint.

## 2. Method — what gets counted?

One row represents **one labelled slide for one reader**. It does not represent
one interaction, one selected label, or one viewing attempt. Use the exact
existing slide-level helper described in [comparison.md](comparison.md).

Count matches and divide by that reader's number of labelled slides. Aslam and
Bansal each have 250; Rana has 180. Do not divide Rana's correct calls by 250:
the other 70 do not have an extracted diagnosis to score.

To make the arithmetic concrete, here is **Rana's partial 180-slide table**.
Rows are reference diagnoses; columns are his diagnoses:

| Reference ↓ / Rana → | Non-neoplastic | Low-grade | High-grade | Total |
|---|---:|---:|---:|---:|
| Non-neoplastic | **40** | 10 | 0 | 50 |
| Low-grade | 12 | **53** | 5 | 70 |
| High-grade | 1 | 26 | **33** | 60 |
| Total | 53 | 89 | 38 | **180** |

The diagonal contains exact matches: **40 + 53 + 33 = 126**.
Therefore three-class agreement is **126 / 180 = 70.0%**.

For the binary question, combine low-grade and high-grade in both the reference
and reader labels. The 26 high→low calls and five low→high calls now count as
matches: **126 + 26 + 5 = 157**, or **157 / 180 = 87.2%**.
The remaining 23 mismatches are 10 calls crossing from non-neoplastic to the
combined category, and 13 crossing in the opposite direction.

No diagnosis changed between those calculations. Only the question became less
specific about grade.

## 3. Result — what did we observe?

### Two complete readers: unchanged, 250 slides each

| Reader | Exact three-class matches | Binary matches |
|---|---:|---:|
| Aslam | 163/250 = **65.2%** | 217/250 = **86.8%** |
| Bansal | 176/250 = **70.4%** | 221/250 = **88.4%** |

The recalculated Q1 counts and rates match their saved June results. Q2-Q6 and
their figures were not regenerated.

### Rana: partial cohort, 180 labelled slides

**126/180 = 70.0%** exact three-class agreement; **157/180 = 87.2%** binary
agreement. These summarize his current subset and are not a third 250-slide
complete-reader result.

As a sensitivity check, retaining only his 166 slides with a labelled
`slide_next` gives **117/166 = 70.5%** exact agreement and **145/166 = 87.3%**
binary agreement. This changes which slides are included; it is not a controlled
test of fallback-label reliability. No duplicate diagnosis events were added in
the new export.

### Optional comparison on the same 180 slides

Restricting all readers to Rana's labelled slide IDs makes membership identical:

| Reader | Exact three-class matches | Binary matches |
|---|---:|---:|
| Aslam, restricted subset | 123/180 = 68.3% | 156/180 = 86.7% |
| Bansal, restricted subset | 128/180 = 71.1% | 158/180 = 87.8% |
| Rana, partial cohort | 126/180 = 70.0% | 157/180 = 87.2% |

This is descriptive. It is not evidence of a reliable reader ranking and does
not replace the complete-reader table. These are observations on shared slides,
not three independent slide samples.

## 4. Limitations — what cannot follow from this?

- A higher binary percentage partly follows from ignoring low/high-grade
  disagreements. It does not establish better grading performance.
- The reference labels may themselves reflect judgement and variation. These
  counts do not establish diagnostic convention differences or causes of errors.
- Rana's remaining 70 slides are unscored. His 180 may differ in difficulty from
  the full 250, even when their class proportions look similar.
- There are only two complete readers; patient grouping remains unresolved.
  These descriptive percentages do not establish population-wide performance,
  independent-patient inference, or clinical effectiveness.
- Label coverage is inferred from events; the CSV does not independently verify
  the database's completion status. The strict/fallback distinction stays visible.

**Understanding check:** explain in your own words why Rana can have 70.0% exact
agreement and 87.2% binary agreement without changing a single diagnosis. The
31 low/high-grade disagreements are the key.

## Verification and sources

`q1_walkthrough.py` re-extracted labels from the September export, checked them
against the comparison's slide table, and checked complete-reader Q1 against
`analysis/reports/results.json`. Independent count arithmetic agrees with the
existing binary metric helper and each confusion table sums to its denominator.
All results, including the two optional sensitivity tables, are in
`q1-results.json`.

`comparison-and-q1.ipynb` was executed sequentially using the existing Python
environment and in-process IPython; all three code cells passed and their outputs
are embedded. The standard nbconvert kernel launcher could not set Windows ACLs
on its connection file in the sandbox. `execute_companion.py` records the
alternative execution method and uses no kernel connection file or socket.
