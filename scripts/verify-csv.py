#!/usr/bin/env python3
"""
verify-csv.py - Validate CSV export schema and data integrity

Usage:
    python verify-csv.py <csv_file> [--manifest <manifest.json>]

Validates:
- All required columns present (23 columns from spec)
- No missing critical values
- Timestamps in chronological order per session
- DZI level matches zoom level (using manifest mapping)
- Viewport bounds within slide dimensions
- Cell indices are valid integers
"""

import sys
import argparse
import json
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime


# Expected columns from spec
REQUIRED_COLUMNS = [
    'ts_iso8601', 'session_id', 'user_id', 'slide_id', 'event',
    'zoom_level', 'dzi_level', 'i', 'j', 'center_x0', 'center_y0',
    'vbx0', 'vby0', 'vtx0', 'vty0', 'container_w', 'container_h',
    'dpr', 'patch_px', 'tile_size', 'alignment_ok', 'app_version',
    'label', 'notes'
]

# Critical columns that must not be null
CRITICAL_COLUMNS = ['session_id', 'user_id', 'slide_id', 'event', 'zoom_level', 'dzi_level']

# Expected zoom to DZI level mapping (from spec)
ZOOM_TO_DZI = {
    2.5: 14,
    5: 15,
    10: 16,
    20: 17,
    40: 18
}

# Valid event types
VALID_EVENTS = {
    'app_start', 'slide_load', 'cell_click', 'zoom_step',
    'arrow_pan', 'back_step', 'reset', 'label_select', 'slide_next'
}


class CSVValidator:
    def __init__(self, csv_path, manifest_path=None):
        self.csv_path = Path(csv_path)
        self.manifest_path = Path(manifest_path) if manifest_path else None
        self.errors = []
        self.warnings = []
        self.df = None
        self.manifest = None
        
    def load_data(self):
        """Load CSV and optional manifest"""
        try:
            # Try multiple timestamp formats
            self.df = pd.read_csv(self.csv_path)
            print(f"[OK] Loaded CSV: {len(self.df)} rows")
            
            # Load manifest if provided
            if self.manifest_path and self.manifest_path.exists():
                with open(self.manifest_path) as f:
                    self.manifest = json.load(f)
                print(f"[OK] Loaded manifest: {self.manifest['slide_id']}")
            
            return True
        except Exception as e:
            self.errors.append(f"Failed to load CSV: {e}")
            return False
    
    def check_columns(self):
        """Validate all required columns present"""
        missing = set(REQUIRED_COLUMNS) - set(self.df.columns)
        if missing:
            self.errors.append(f"Missing required columns: {missing}")
            return False
        
        extra = set(self.df.columns) - set(REQUIRED_COLUMNS)
        if extra:
            self.warnings.append(f"Extra columns found: {extra}")
        
        print(f"[OK] All {len(REQUIRED_COLUMNS)} required columns present")
        return True
    
    def check_critical_nulls(self):
        """Check critical columns have no null values"""
        issues = []
        for col in CRITICAL_COLUMNS:
            null_count = self.df[col].isna().sum()
            if null_count > 0:
                issues.append(f"{col}: {null_count} null values")
        
        if issues:
            self.errors.append("Critical columns have null values:\n  " + "\n  ".join(issues))
            return False
        
        print(f"[OK] No null values in critical columns")
        return True
    
    def check_event_types(self):
        """Validate event types are from expected set"""
        invalid_events = set(self.df['event'].unique()) - VALID_EVENTS
        if invalid_events:
            self.errors.append(f"Invalid event types found: {invalid_events}")
            return False
        
        event_counts = self.df['event'].value_counts()
        print(f"[OK] Event types valid:")
        for event_type, count in event_counts.items():
            print(f"  {event_type}: {count}")
        return True
    
    def check_zoom_dzi_mapping(self):
        """Validate DZI level matches zoom level (if manifest provided)"""
        if not self.manifest:
            # Without manifest, we can't validate the mapping
            # But we can check that the mapping is consistent per slide
            self.warnings.append("Manifest not provided; checking DZI mapping consistency only")
            
            # Check that each slide has consistent zoom→dzi mapping
            issues = []
            for slide_id, group in self.df.groupby('slide_id'):
                # Build mapping for this slide
                slide_mapping = {}
                for idx, row in group.iterrows():
                    zoom = row['zoom_level']
                    dzi = row['dzi_level']
                    if pd.notna(zoom) and pd.notna(dzi):
                        if zoom in slide_mapping:
                            if slide_mapping[zoom] != dzi:
                                issues.append(
                                    f"Slide {slide_id}: Inconsistent mapping for {zoom}× "
                                    f"(seen both DZI {slide_mapping[zoom]} and {dzi})"
                                )
                        else:
                            slide_mapping[zoom] = dzi
            
            if issues:
                self.errors.append("DZI mapping inconsistencies:\n  " + "\n  ".join(issues))
                return False
            
            print(f"[OK] DZI level mapping consistent within each slide")
            return True
        
        # With manifest, validate against expected mapping
        issues = []
        mag_levels = self.manifest.get('magnification_levels', {})
        
        # Convert manifest mapping to numeric (e.g., "40x" -> 40)
        expected_mapping = {}
        for key, dzi_level in mag_levels.items():
            zoom = float(key.replace('x', ''))
            expected_mapping[zoom] = dzi_level
        
        for idx, row in self.df.iterrows():
            zoom = row['zoom_level']
            dzi = row['dzi_level']
            
            if pd.notna(zoom) and pd.notna(dzi):
                expected_dzi = expected_mapping.get(zoom)
                if expected_dzi is None:
                    issues.append(f"Row {idx}: Unknown zoom level {zoom}")
                elif dzi != expected_dzi:
                    issues.append(f"Row {idx}: Zoom {zoom}x expects DZI {expected_dzi}, got {dzi}")
        
        if issues:
            # Show first 5 issues
            self.errors.append("Zoom/DZI level mismatches:\n  " + "\n  ".join(issues[:5]))
            if len(issues) > 5:
                self.errors.append(f"  ... and {len(issues) - 5} more")
            return False
        
        print(f"[OK] Zoom/DZI level mapping correct (against manifest)")
        return True
    
    def check_viewport_bounds(self):
        """Validate viewport bounds within slide dimensions"""
        if not self.manifest:
            self.warnings.append("Manifest not provided, skipping viewport bounds check")
            return True
        
        slide_w = self.manifest['level0_width']
        slide_h = self.manifest['level0_height']
        issues = []
        
        for idx, row in self.df.iterrows():
            vbx0, vby0 = row['vbx0'], row['vby0']
            vtx0, vty0 = row['vtx0'], row['vty0']
            
            if pd.notna(vbx0) and pd.notna(vtx0):
                # Allow some tolerance for viewport extending beyond slide
                # (can happen with clamping logic)
                tolerance = 1000  # pixels
                
                if vtx0 < vbx0:
                    issues.append(f"Row {idx}: vtx0 ({vtx0}) < vbx0 ({vbx0})")
                if vty0 < vby0:
                    issues.append(f"Row {idx}: vty0 ({vty0}) < vby0 ({vby0})")
                
                # Check if completely outside slide (should not happen)
                if vbx0 > slide_w + tolerance or vtx0 < -tolerance:
                    issues.append(f"Row {idx}: Viewport X completely outside slide bounds")
                if vby0 > slide_h + tolerance or vty0 < -tolerance:
                    issues.append(f"Row {idx}: Viewport Y completely outside slide bounds")
        
        if issues:
            self.errors.append("Viewport bound issues:\n  " + "\n  ".join(issues[:5]))
            if len(issues) > 5:
                self.errors.append(f"  ... and {len(issues) - 5} more")
            return False
        
        print(f"[OK] Viewport bounds valid (slide: {slide_w}x{slide_h})")
        return True
    
    def check_cell_indices(self):
        """Validate cell indices are valid integers for cell_click events"""
        cell_clicks = self.df[self.df['event'] == 'cell_click']
        issues = []
        
        for idx, row in cell_clicks.iterrows():
            i, j = row['i'], row['j']
            
            if pd.isna(i) or pd.isna(j):
                issues.append(f"Row {idx}: cell_click event missing i or j")
            elif i < 0 or j < 0:
                issues.append(f"Row {idx}: Negative cell indices: ({i}, {j})")
            elif not (isinstance(i, (int, np.integer)) or i == int(i)):
                issues.append(f"Row {idx}: i is not an integer: {i}")
            elif not (isinstance(j, (int, np.integer)) or j == int(j)):
                issues.append(f"Row {idx}: j is not an integer: {j}")
        
        if issues:
            self.errors.append("Cell index issues:\n  " + "\n  ".join(issues[:5]))
            if len(issues) > 5:
                self.errors.append(f"  ... and {len(issues) - 5} more")
            return False
        
        print(f"[OK] Cell indices valid ({len(cell_clicks)} cell_click events)")
        return True
    
    def check_timestamp_order(self):
        """Check timestamps are chronological within each session"""
        issues = []
        
        for session_id, group in self.df.groupby('session_id'):
            timestamps = group['ts_iso8601'].tolist()
            
            # Try to parse timestamps (they might be in various formats)
            try:
                # Check if they're sortable as strings (ISO format should be)
                if timestamps != sorted(timestamps):
                    issues.append(f"Session {session_id}: Timestamps not in chronological order")
            except Exception as e:
                self.warnings.append(f"Session {session_id}: Could not validate timestamp order: {e}")
        
        if issues:
            self.errors.append("Timestamp ordering issues:\n  " + "\n  ".join(issues[:5]))
            if len(issues) > 5:
                self.errors.append(f"  ... and {len(issues) - 5} more")
            return False
        
        session_count = self.df['session_id'].nunique()
        print(f"[OK] Timestamps chronological ({session_count} sessions)")
        return True
    
    def run_all_checks(self):
        """Run all validation checks"""
        print(f"\n{'='*60}")
        print(f"CSV Validation: {self.csv_path.name}")
        print(f"{'='*60}\n")
        
        if not self.load_data():
            return False
        
        checks = [
            self.check_columns,
            self.check_critical_nulls,
            self.check_event_types,
            self.check_zoom_dzi_mapping,
            self.check_cell_indices,
            self.check_timestamp_order,
            self.check_viewport_bounds,
        ]
        
        all_passed = True
        for check in checks:
            if not check():
                all_passed = False
        
        return all_passed
    
    def print_summary(self):
        """Print validation summary"""
        print(f"\n{'='*60}")
        print("VALIDATION SUMMARY")
        print(f"{'='*60}")
        
        if self.warnings:
            print(f"\n[WARN] WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  {warning}")
        
        if self.errors:
            print(f"\n[ERROR] ERRORS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  {error}")
            print(f"\n[FAIL] VALIDATION FAILED")
            return False
        else:
            print(f"\n[OK] ALL CHECKS PASSED")
            
            # Print summary statistics
            print(f"\nSummary:")
            print(f"  Total events: {len(self.df)}")
            print(f"  Sessions: {self.df['session_id'].nunique()}")
            print(f"  Users: {self.df['user_id'].nunique()}")
            print(f"  Slides: {self.df['slide_id'].nunique()}")
            return True


def main():
    parser = argparse.ArgumentParser(
        description='Validate CSV export data integrity'
    )
    parser.add_argument('csv_file', help='Path to CSV file to validate')
    parser.add_argument('--manifest', help='Path to manifest.json for additional validation')
    
    args = parser.parse_args()
    
    validator = CSVValidator(args.csv_file, args.manifest)
    passed = validator.run_all_checks()
    validator.print_summary()
    
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()

