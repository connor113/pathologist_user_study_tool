# Data Verification Scripts

Python scripts for validating CSV export data from pathologist user study sessions.

## Installation

Install required dependencies:

```bash
pip install -r requirements-analysis.txt
```

Minimum requirements:
- Python 3.8+
- pandas
- numpy

## Scripts

### 1. verify-csv.py

Validates CSV schema and data integrity.

**Usage:**
```bash
python scripts/verify-csv.py pathology_events.csv
python scripts/verify-csv.py pathology_events.csv --manifest tiles/test_slide_files/manifest.json
```

**Checks:**
- All 23 required columns present
- No missing critical values (session_id, user_id, slide_id, event, zoom_level, dzi_level)
- Timestamps in chronological order per session
- DZI level matches zoom level (2.5×→14, 5×→15, 10×→16, 20×→17, 40×→18)
- Viewport bounds within slide dimensions (if manifest provided)
- Cell indices are valid non-negative integers
- Event types are from expected set

**Exit codes:**
- `0`: All checks passed
- `1`: Validation failed (errors found)

---

### 2. verify-alignment.py

Validates coordinate calculations and alignment correctness.

**Usage:**
```bash
python scripts/verify-alignment.py pathology_events.csv --manifest tiles/test_slide_files/manifest.json
```

**Checks:**
- Logged click positions fall within calculated cell bounds (validates patch extraction will work)
- Cell indices are within grid dimensions for each zoom level
- Viewport bounds contain center points
- Lattice math correctness (using spec formulas)

**Note:** This validates that the cell (i, j) logged for each click correctly identifies the patch that should be extracted. The click position (center_x0, center_y0) should fall within the bounds of cell (i, j).

**Requires:**
- Manifest JSON file (contains slide dimensions and patch_px)

**Exit codes:**
- `0`: All alignment checks passed
- `1`: Alignment validation failed

---

### 3. verify-sessions.py

Validates session completeness and event sequences.

**Usage:**
```bash
python scripts/verify-sessions.py pathology_events.csv
```

**Checks:**
- Each session has `app_start` event (first event)
- Each session has `slide_load` event
- Completed sessions have `slide_next` event with label
- Event sequences are logical
- Calculates per-session statistics:
  - Duration
  - Click counts
  - Unique cells visited
  - Zoom level distribution
  - Completion status

**Exit codes:**
- `0`: All session checks passed
- `1`: Session validation failed

---

## Example Workflow

1. **Export CSV from admin dashboard** (or from V1 local viewer)

2. **Run all three verification scripts:**

```bash
# Basic schema validation
python scripts/verify-csv.py pathology_events_2025-11-18.csv

# Alignment validation (requires manifest)
python scripts/verify-alignment.py pathology_events_2025-11-18.csv \
  --manifest tiles/test_slide_files/manifest.json

# Session completeness validation
python scripts/verify-sessions.py pathology_events_2025-11-18.csv
```

3. **Review output:**
   - Green checkmarks (✓) indicate passed checks
   - Yellow warnings (⚠) indicate potential issues (non-critical)
   - Red errors (✗) indicate validation failures

4. **Fix issues if found:**
   - CSV schema errors → check export logic
   - Alignment errors → check lattice math implementation
   - Session errors → check event logging logic

---

## Output Examples

### Successful Validation

```
============================================================
CSV Validation: pathology_events_2025-11-18.csv
============================================================

✓ Loaded CSV: 701 rows
✓ All 23 required columns present
✓ No null values in critical columns
✓ Event types valid:
  cell_click: 45
  zoom_step: 45
  arrow_pan: 12
  reset: 15
  ...
✓ Zoom/DZI level mapping correct
✓ Cell indices valid (45 cell_click events)
✓ Timestamps chronological (1 sessions)
✓ Viewport bounds valid (slide: 147184×49960)

============================================================
VALIDATION SUMMARY
============================================================

✓ ALL CHECKS PASSED

Summary:
  Total events: 701
  Sessions: 1
  Users: 1
  Slides: 1
```

### Failed Validation

```
============================================================
CSV Validation: pathology_events_corrupted.csv
============================================================

✓ Loaded CSV: 500 rows
✗ Missing required columns: {'notes'}
✗ Critical columns have null values:
  session_id: 5 null values
  event: 2 null values
✓ Event types valid: ...

============================================================
VALIDATION SUMMARY
============================================================

✗ ERRORS (2):
  Missing required columns: {'notes'}
  Critical columns have null values:
    session_id: 5 null values
    event: 2 null values

✗ VALIDATION FAILED
```

---

## Troubleshooting

**"Failed to load CSV"**
- Check file path is correct
- Check file encoding (should be UTF-8)
- Check CSV format is valid

**"Zoom/DZI level mismatches"**
- Check manifest magnification_levels mapping
- Verify tiler generated correct DZI levels
- Check viewer zoom calculation logic

**"Cell center misalignment"**
- Check lattice math implementation (cell_size calculation)
- Verify patch_px value in manifest
- Check for rounding errors in coordinate calculations

**"Viewport bounds invalid"**
- Check viewport calculation in viewer
- Verify slide dimensions in manifest
- Check for edge cases (viewport extending beyond slide)

---

## Integration with Analysis Pipeline

These verification scripts are the **first step** in the data analysis pipeline:

1. **Verification** (T-0009) ← You are here
   - `verify-csv.py`
   - `verify-alignment.py`
   - `verify-sessions.py`

2. **Visualization** (T-0011)
   - `generate_heatmap.py`
   - `visualize_scanning_path.py`
   - Jupyter notebooks for exploration

3. **Patch Extraction** (T-0012)
   - `extract_patches.py`
   - `calculate_visible_patches.py`

Only proceed to visualization and patch extraction after all verification checks pass!

---

## Contributing

When modifying verification logic:
1. Update the corresponding script
2. Update this README with new checks or usage
3. Test with both valid and invalid CSV data
4. Document new error messages in Troubleshooting section

