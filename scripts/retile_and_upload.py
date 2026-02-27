"""
Re-tile all 20 selected slides with full DZI pyramid, then upload to S3.
Run from repo root:
    python scripts/retile_and_upload.py

Requires: pyvips (or openslide), aws cli configured
"""

import csv
import subprocess
import sys
from pathlib import Path
from datetime import datetime

DATA_ROOT = Path(r"D:\Data\IMP-CRS-2024")
LABELS_CSV = DATA_ROOT / "selected_20_labels.csv"
TILES_OUTPUT = Path(r"tiles")
S3_BUCKET = "pathology-study-tiles"

def find_slide(slide_id: str) -> Path | None:
    """Find the .svs file across CRS1/CRS2 directories."""
    for crs in ["CRS1", "CRS2"]:
        slide_path = DATA_ROOT / crs / "slides" / f"{slide_id}.svs"
        if slide_path.exists():
            return slide_path
    # Also try .ndpi, .tiff extensions
    for crs in ["CRS1", "CRS2"]:
        for ext in [".ndpi", ".tiff", ".tif"]:
            slide_path = DATA_ROOT / crs / "slides" / f"{slide_id}{ext}"
            if slide_path.exists():
                return slide_path
    return None

def main():
    # Read slide IDs from CSV
    if not LABELS_CSV.exists():
        # Fallback: hardcoded list
        slide_ids = [
            'CRC_0170', 'CRC_0423', 'CRC_0645', 'CRC_0908', 'CRC_1459',
            'CRC_1472', 'CRC_2000', 'CRC_2103', 'CRC_2144', 'CRC_2198',
            'CRC_2341', 'CRC_2593', 'CRC_2696', 'CRC_2739', 'CRC_2749',
            'CRC_3060', 'CRC_3109', 'CRC_3138', 'CRC_3148', 'CRC_4240'
        ]
        print(f"Labels CSV not found at {LABELS_CSV}, using hardcoded list")
    else:
        slide_ids = []
        with open(LABELS_CSV, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Try common column names
                sid = row.get('slide_id') or row.get('Slide_ID') or row.get('slide') or list(row.values())[0]
                slide_ids.append(sid)
        print(f"Read {len(slide_ids)} slides from {LABELS_CSV}")

    print(f"\n{'='*60}")
    print(f"  RE-TILING {len(slide_ids)} SLIDES + UPLOADING TO S3")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    results = []
    
    for i, slide_id in enumerate(slide_ids):
        print(f"\n[{i+1}/{len(slide_ids)}] Processing {slide_id}...")
        
        # Find slide file
        slide_path = find_slide(slide_id)
        if not slide_path:
            print(f"  ❌ Could not find slide file for {slide_id}")
            results.append((slide_id, False, "File not found"))
            continue
        
        print(f"  Found: {slide_path}")
        
        # Output directory
        out_dir = TILES_OUTPUT / slide_id
        
        # Remove old tiles
        if out_dir.exists():
            import shutil
            print(f"  Removing old tiles...")
            shutil.rmtree(out_dir)
        
        # Run tiler
        print(f"  Tiling...")
        try:
            result = subprocess.run(
                [sys.executable, "-m", "src.tiler.wsi_tiler",
                 "--input", str(slide_path),
                 "--out", str(out_dir),
                 "--tile-size", "512"],
                check=True,
                capture_output=True,
                text=True
            )
            print(f"  ✅ Tiled successfully")
            
            # Count levels
            levels = [d for d in out_dir.iterdir() if d.is_dir() and d.name.isdigit()]
            print(f"  Levels: {len(levels)} (0-{max(int(d.name) for d in levels)})")
            
        except subprocess.CalledProcessError as e:
            print(f"  ❌ Tiling failed: {e.stderr[-500:] if e.stderr else 'no output'}")
            results.append((slide_id, False, "Tiling failed"))
            continue
        
        # Upload to S3
        print(f"  Uploading to S3...")
        try:
            # Upload tiles (exclude .dzi files, include everything else)
            subprocess.run(
                ["aws", "s3", "sync",
                 str(out_dir), f"s3://{S3_BUCKET}/slides/{slide_id}/",
                 "--exclude", "*.dzi",
                 "--quiet"],
                check=True
            )
            print(f"  ✅ Uploaded to s3://{S3_BUCKET}/slides/{slide_id}/")
            results.append((slide_id, True, "OK"))
        except subprocess.CalledProcessError as e:
            print(f"  ❌ Upload failed")
            results.append((slide_id, False, "Upload failed"))
            continue

    # Summary
    print(f"\n\n{'='*60}")
    print(f"  COMPLETE — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    
    success = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    
    for sid, ok, msg in results:
        print(f"  {'✅' if ok else '❌'} {sid}: {msg}")
    
    print(f"\n  {success} succeeded, {failed} failed")
    
    if failed:
        sys.exit(1)

if __name__ == "__main__":
    main()
