"""
Tile 200 selected user study slides from IMP-CRS-2024.

Reads slide IDs from the cross-model analysis selection, finds the SVS files,
and generates DeepZoom pyramids. S3 upload is separate (run from home).

Usage (from pathologist_user_study_tool repo root):
    python scripts/tile_200_slides.py

Or override paths:
    python scripts/tile_200_slides.py --slide_ids path/to/slide_ids.txt --data_root D:\Data\IMP-CRS-2024
"""

import argparse
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description="Tile selected slides for user study")
    p.add_argument("--slide_ids", type=str,
                    default=r"..\crc-research-engine\training\analysis\user_study_selection\slide_ids.txt",
                    help="Path to slide_ids.txt (one ID per line)")
    p.add_argument("--data_root", type=str, default=r"D:\Data\IMP-CRS-2024",
                    help="Root directory of IMP-CRS-2024 dataset")
    p.add_argument("--output_dir", type=str, default="tiles",
                    help="Output directory for DZI tiles")
    p.add_argument("--tile_size", type=int, default=512)
    p.add_argument("--resume", action="store_true",
                    help="Skip slides that already have tiles")
    return p.parse_args()


def find_slide(data_root: Path, slide_id: str) -> Path | None:
    """Find the WSI file across CRS1/CRS2/CRS_Test directories."""
    for crs in ["CRS1", "CRS2", "CRS_Test"]:
        for ext in [".svs", ".ndpi", ".tiff", ".tif"]:
            slide_path = data_root / crs / "slides" / f"{slide_id}{ext}"
            if slide_path.exists():
                return slide_path
    return None


def main():
    args = parse_args()
    data_root = Path(args.data_root)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Read slide IDs
    slide_ids_path = Path(args.slide_ids)
    if not slide_ids_path.exists():
        print(f"ERROR: slide_ids file not found: {slide_ids_path}")
        print("Run select_user_study_slides.py first in crc-research-engine repo")
        sys.exit(1)

    slide_ids = [line.strip() for line in open(slide_ids_path) if line.strip()]
    print(f"Loaded {len(slide_ids)} slide IDs from {slide_ids_path}")

    print(f"\n{'='*60}")
    print(f"  TILING {len(slide_ids)} SLIDES")
    print(f"  Output: {output_dir}")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    success = 0
    failed = 0
    skipped = 0
    total_time = 0

    for i, slide_id in enumerate(slide_ids):
        # Resume support: skip if tiles already exist
        out_dir = output_dir / slide_id
        if args.resume and out_dir.exists():
            # Check if it has actual tile directories
            levels = [d for d in out_dir.iterdir() if d.is_dir() and d.name.isdigit()] if out_dir.exists() else []
            if levels:
                print(f"[{i+1}/{len(slide_ids)}] {slide_id} — skipped (already tiled, {len(levels)} levels)")
                skipped += 1
                continue

        # Find slide file
        slide_path = find_slide(data_root, slide_id)
        if not slide_path:
            print(f"[{i+1}/{len(slide_ids)}] {slide_id} — ❌ FILE NOT FOUND")
            failed += 1
            continue

        # Tile
        start = time.time()
        print(f"[{i+1}/{len(slide_ids)}] {slide_id} — tiling from {slide_path.name}...", end=" ", flush=True)

        try:
            result = subprocess.run(
                [sys.executable, "-m", "src.tiler.wsi_tiler",
                 "--input", str(slide_path),
                 "--out", str(out_dir),
                 "--tile-size", str(args.tile_size)],
                check=True,
                capture_output=True,
                text=True,
                timeout=600,  # 10 min timeout per slide
            )
            elapsed = time.time() - start
            total_time += elapsed

            # Count levels
            levels = [d for d in out_dir.iterdir() if d.is_dir() and d.name.isdigit()]
            print(f"✅ {len(levels)} levels, {elapsed:.0f}s")
            success += 1

        except subprocess.CalledProcessError as e:
            elapsed = time.time() - start
            print(f"❌ FAILED ({elapsed:.0f}s)")
            if e.stderr:
                print(f"    {e.stderr[-200:]}")
            failed += 1

        except subprocess.TimeoutExpired:
            print(f"❌ TIMEOUT (>600s)")
            failed += 1

        # Progress estimate
        done = success + failed + skipped
        if success > 0:
            avg_time = total_time / success
            remaining = (len(slide_ids) - done) * avg_time
            print(f"    Progress: {done}/{len(slide_ids)} | "
                  f"Avg: {avg_time:.0f}s/slide | "
                  f"ETA: {remaining/60:.0f} min")

    # Summary
    print(f"\n{'='*60}")
    print(f"  COMPLETE — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    print(f"  ✅ Success: {success}")
    print(f"  ⏭️  Skipped: {skipped}")
    print(f"  ❌ Failed:  {failed}")
    print(f"  Total time: {total_time/60:.1f} min")
    if success > 0:
        print(f"  Avg per slide: {total_time/success:.0f}s")
    print(f"\n  Tiles saved to: {output_dir}")
    print(f"  Next step: upload to S3")


if __name__ == "__main__":
    main()
