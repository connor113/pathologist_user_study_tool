# September 15 snapshot

Read [comparison.md](comparison.md) first. It records the export changes before
the decision about rerunning analyses.

## Decision after reporting the comparison

The two complete readers' exact exported histories, extracted diagnoses and
reference labels are unchanged. The September 4 reproduction already established
the complete Q1-Q6 numerical baseline. **A full Q1-Q6 rerun is not required by this
export.** Preserve the June report, `results.json`, notebook and 15 figures.

The new analysis scope is a **separate, descriptive Rana extension**. Start with
Q1 (reference-label agreement) to explain the denominators and classification
counts. Recompute only that small slice for the two complete readers to check
against their saved Q1 values, and describe Rana separately on his 180 labelled
slides. A secondary same-180-slide table may help distinguish cohort membership
from reader differences; it does not replace the complete 250-slide results.

Q2-Q6 extensions to Rana can be considered one question at a time after Q1 is
understood. Before behavioural/spatial work, specify treatment of attempts,
duplicate-looking events and six new missing-coordinate rows. These extensions
have not been run here. Q7/AdaZoom still needs the prerequisites in the September
4 audit; this event update does not satisfy them.

## Files

- `compare_exports.py`, `comparison.json`, `comparison.md`: comparison and receipt.
- `q1_walkthrough.py`, `q1-results.json`, `q1-walkthrough.md`: the scoped Q1 extension.
- `comparison-and-q1.ipynb`: executable companion to the two source scripts.
- `execute_companion.py`: executes its cells in-process with IPython and embeds
  outputs, avoiding the sandbox's Windows kernel-connection-file ACL restriction.
- `preservation-before.json`, `preservation-after.json`: hashes of original artifacts.
- `diagnoses-*.csv`, `views-*.csv`: local, ignored audit tables; both dates labelled.

Raw snapshots stay separately named in `analysis/data/`, with the new copy at
`pathology_events_2026-09-15.csv`. The source file in Downloads is unchanged.
Nothing is published, committed or sent to the live database by these scripts.

From the repository root:

```powershell
& analysis/.venv/Scripts/python.exe analysis/snapshots/2026-09-15/compare_exports.py
& analysis/.venv/Scripts/python.exe analysis/snapshots/2026-09-15/q1_walkthrough.py
```

Run in that order if refreshing the derived tables. Only outputs inside this
dated directory are replaced. The comparison refuses to proceed if a protected
pre-existing artifact differs from its recorded hash.
