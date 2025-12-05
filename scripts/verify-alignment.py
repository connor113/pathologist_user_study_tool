#!/usr/bin/env python3
"""
verify-alignment.py - Validate alignment and coordinate calculations

Usage:
    python verify-alignment.py <csv_file> --manifest <manifest.json>

Validates:
- Logged click positions fall within cell bounds (for patch extraction)
- Cell indices are within grid dimensions for each zoom level
- Viewport bounds contain center points
- Lattice math correctness using spec formulas
"""

import sys
import argparse
import json
from pathlib import Path
import pandas as pd
import numpy as np


class AlignmentValidator:
    def __init__(self, csv_path, manifest_path):
        self.csv_path = Path(csv_path)
        self.manifest_path = Path(manifest_path)
        self.df = None
        self.manifest = None
        self.errors = []
        self.warnings = []
        
    def load_data(self):
        """Load CSV and manifest"""
        try:
            self.df = pd.read_csv(self.csv_path)
            print(f"[OK] Loaded CSV: {len(self.df)} rows")
            
            with open(self.manifest_path) as f:
                self.manifest = json.load(f)
            print(f"[OK] Loaded manifest: {self.manifest['slide_id']}")
            
            return True
        except Exception as e:
            self.errors.append(f"Failed to load data: {e}")
            return False
    
    def cell_size_for_zoom(self, zoom_level, patch_px):
        """
        Calculate cell size in level-0 coordinates for a given zoom level.
        
        From spec:
        cell_size_level0(Z) = patch_px * (40 / Z)
        
        Examples:
        - At 40×: cell_size = patch_px * 1 = 256px
        - At 20×: cell_size = patch_px * 2 = 512px
        - At 10×: cell_size = patch_px * 4 = 1024px
        - At 5×:  cell_size = patch_px * 8 = 2048px
        - At 2.5×: cell_size = patch_px * 16 = 4096px
        """
        return patch_px * (40.0 / zoom_level)
    
    def cell_center(self, i, j, cell_size):
        """
        Calculate center of cell (i, j) in level-0 coordinates.
        
        From spec:
        center(i,j,Z) = ((i+0.5)*cell_size_level0(Z), (j+0.5)*cell_size_level0(Z))
        """
        center_x = (i + 0.5) * cell_size
        center_y = (j + 0.5) * cell_size
        return center_x, center_y
    
    def grid_dimensions(self, slide_w, slide_h, cell_size):
        """
        Calculate number of complete cells in slide.
        
        From spec:
        numCols = floor(slide_width / cell_size)
        numRows = floor(slide_height / cell_size)
        """
        num_cols = int(slide_w / cell_size)
        num_rows = int(slide_h / cell_size)
        return num_cols, num_rows
    
    def check_click_within_cell_bounds(self):
        """Verify logged click position falls within the cell bounds that will be extracted"""
        patch_px = self.manifest['patch_px']
        manifest_slide_id = self.manifest['slide_id']
        
        # Filter to only cell_clicks for this slide
        cell_clicks = self.df[
            (self.df['event'] == 'cell_click') & 
            (self.df['slide_id'] == manifest_slide_id)
        ].copy()
        
        if len(cell_clicks) == 0:
            self.warnings.append(f"No cell_click events found for slide '{manifest_slide_id}'")
            return True
        
        total_cell_clicks = len(self.df[self.df['event'] == 'cell_click'])
        if total_cell_clicks > len(cell_clicks):
            self.warnings.append(
                f"CSV contains {total_cell_clicks} cell_clicks but only validating "
                f"{len(cell_clicks)} for slide '{manifest_slide_id}' (other slides ignored)"
            )
        
        issues = []
        
        for idx, row in cell_clicks.iterrows():
            i = int(row['i'])
            j = int(row['j'])
            zoom = row['zoom_level']
            click_x = row['center_x0']
            click_y = row['center_y0']
            
            # Skip if center not logged (shouldn't happen for cell_click)
            if pd.isna(click_x) or pd.isna(click_y):
                issues.append(f"Row {idx}: cell_click missing center coordinates")
                continue
            
            # Calculate cell bounds (this is what would be extracted as a patch)
            cell_size = self.cell_size_for_zoom(zoom, patch_px)
            cell_left = i * cell_size
            cell_top = j * cell_size
            cell_right = cell_left + cell_size
            cell_bottom = cell_top + cell_size
            
            # Check if click falls within cell bounds
            if not (cell_left <= click_x < cell_right and cell_top <= click_y < cell_bottom):
                issues.append(
                    f"Row {idx}: Cell ({i},{j}) at {zoom}x: "
                    f"Click ({click_x:.1f}, {click_y:.1f}) outside cell bounds "
                    f"[({cell_left:.1f}, {cell_top:.1f}) to ({cell_right:.1f}, {cell_bottom:.1f})]"
                )
        
        if issues:
            self.errors.append(
                f"Click position outside cell bounds ({len(issues)}/{len(cell_clicks)} clicks):\n  " +
                "\n  ".join(issues[:5])
            )
            if len(issues) > 5:
                self.errors.append(f"  ... and {len(issues) - 5} more")
            return False
        
        print(f"[OK] All {len(cell_clicks)} clicks fall within their cell bounds")
        return True
    
    def check_viewport_contains_center(self):
        """Verify viewport bounds contain the center point for all events"""
        manifest_slide_id = self.manifest['slide_id']
        
        # Filter to only events for this slide
        slide_events = self.df[self.df['slide_id'] == manifest_slide_id]
        
        issues = []
        
        for idx, row in slide_events.iterrows():
            center_x = row['center_x0']
            center_y = row['center_y0']
            vbx0, vby0 = row['vbx0'], row['vby0']
            vtx0, vty0 = row['vtx0'], row['vty0']
            
            # Skip if any value is null
            if any(pd.isna(v) for v in [center_x, center_y, vbx0, vby0, vtx0, vty0]):
                continue
            
            # Check if center is within viewport
            # Note: viewport coordinates can extend beyond slide (negative or > slide size)
            # But center should generally be within viewport
            if not (vbx0 <= center_x <= vtx0 and vby0 <= center_y <= vty0):
                # Allow small tolerance for edge cases
                tolerance = 10
                if not (vbx0 - tolerance <= center_x <= vtx0 + tolerance and 
                       vby0 - tolerance <= center_y <= vty0 + tolerance):
                    issues.append(
                        f"Row {idx} ({row['event']}): Center ({center_x:.1f}, {center_y:.1f}) "
                        f"outside viewport [({vbx0:.1f}, {vby0:.1f}) to ({vtx0:.1f}, {vty0:.1f})]"
                    )
        
        if issues:
            self.warnings.append(
                f"Center outside viewport ({len(issues)} events):\n  " +
                "\n  ".join(issues[:5])
            )
            if len(issues) > 5:
                self.warnings.append(f"  ... and {len(issues) - 5} more")
            # This is a warning, not an error (can happen with certain navigation patterns)
            return True
        
        print(f"[OK] All centers within viewport bounds")
        return True
    
    def check_cell_indices_in_bounds(self):
        """Verify cell indices are within grid dimensions for that zoom level"""
        patch_px = self.manifest['patch_px']
        slide_w = self.manifest['level0_width']
        slide_h = self.manifest['level0_height']
        manifest_slide_id = self.manifest['slide_id']
        
        # Filter to only cell_clicks for this slide
        cell_clicks = self.df[
            (self.df['event'] == 'cell_click') & 
            (self.df['slide_id'] == manifest_slide_id)
        ]
        issues = []
        
        for idx, row in cell_clicks.iterrows():
            i = int(row['i'])
            j = int(row['j'])
            zoom = row['zoom_level']
            
            # Calculate grid dimensions for this zoom level
            cell_size = self.cell_size_for_zoom(zoom, patch_px)
            num_cols, num_rows = self.grid_dimensions(slide_w, slide_h, cell_size)
            
            # Check if indices within bounds
            if i < 0 or i >= num_cols:
                issues.append(
                    f"Row {idx}: Column index {i} out of bounds [0, {num_cols}) at {zoom}×"
                )
            if j < 0 or j >= num_rows:
                issues.append(
                    f"Row {idx}: Row index {j} out of bounds [0, {num_rows}) at {zoom}×"
                )
        
        if issues:
            self.errors.append(
                f"Cell indices out of bounds:\n  " + "\n  ".join(issues[:5])
            )
            if len(issues) > 5:
                self.errors.append(f"  ... and {len(issues) - 5} more")
            return False
        
        print(f"[OK] All cell indices within grid bounds ({len(cell_clicks)} clicks)")
        return True
    
    def print_grid_dimensions(self):
        """Print grid dimensions for each zoom level"""
        patch_px = self.manifest['patch_px']
        slide_w = self.manifest['level0_width']
        slide_h = self.manifest['level0_height']
        
        print(f"\nGrid dimensions (slide: {slide_w}x{slide_h}, patch: {patch_px}px):")
        
        for zoom in [2.5, 5, 10, 20, 40]:
            cell_size = self.cell_size_for_zoom(zoom, patch_px)
            num_cols, num_rows = self.grid_dimensions(slide_w, slide_h, cell_size)
            print(f"  {zoom:4.1f}x: {num_cols:4d} cols x {num_rows:4d} rows "
                  f"(cell size: {cell_size:6.1f}px)")
    
    def run_all_checks(self):
        """Run all alignment validation checks"""
        print(f"\n{'='*60}")
        print(f"Alignment Validation: {self.csv_path.name}")
        print(f"{'='*60}\n")
        
        if not self.load_data():
            return False
        
        self.print_grid_dimensions()
        print()
        
        checks = [
            self.check_click_within_cell_bounds,
            self.check_cell_indices_in_bounds,
            self.check_viewport_contains_center,
        ]
        
        all_passed = True
        for check in checks:
            if not check():
                all_passed = False
        
        return all_passed
    
    def print_summary(self):
        """Print validation summary"""
        print(f"\n{'='*60}")
        print("ALIGNMENT VALIDATION SUMMARY")
        print(f"{'='*60}")
        
        if self.warnings:
            print(f"\n[WARN] WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  {warning}")
        
        if self.errors:
            print(f"\n[ERROR] ERRORS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  {error}")
            print(f"\n[FAIL] ALIGNMENT VALIDATION FAILED")
            return False
        else:
            print(f"\n[OK] ALL ALIGNMENT CHECKS PASSED")
            
            # Print summary statistics
            cell_clicks = len(self.df[self.df['event'] == 'cell_click'])
            print(f"\nValidated:")
            print(f"  {cell_clicks} cell_click events")
            print(f"  {len(self.df)} total events")
            return True


def main():
    parser = argparse.ArgumentParser(
        description='Validate alignment and coordinate calculations'
    )
    parser.add_argument('csv_file', help='Path to CSV file to validate')
    parser.add_argument('--manifest', required=True, help='Path to manifest.json')
    
    args = parser.parse_args()
    
    validator = AlignmentValidator(args.csv_file, args.manifest)
    passed = validator.run_all_checks()
    validator.print_summary()
    
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()

