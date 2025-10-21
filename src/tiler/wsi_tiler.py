"""
wsi_tiler.py - Convert WSI (SVS/NDPI/TIFF) to DeepZoom pyramid with alignment manifest.

Usage:
    python -m src.tiler.wsi_tiler --input slide.svs --out tiles/slide_id --patch-px 256
"""

import argparse
import sys
from pathlib import Path
from typing import Dict, Any

try:
    import openslide
    from openslide.deepzoom import DeepZoomGenerator
except ImportError:
    print("Error: openslide-python is required. Install with: pip install openslide-python")
    sys.exit(1)

from . import lattice, alignment_check, manifest


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Convert WSI to DeepZoom pyramid with alignment manifest",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m src.tiler.wsi_tiler --input slide/test.svs --out tiles/test
  python -m src.tiler.wsi_tiler --input slide/test.svs --out tiles/test --patch-px 512 --quality 85
        """
    )
    
    parser.add_argument(
        '--input',
        required=True,
        help='Path to input WSI file (SVS, NDPI, TIFF, etc.)'
    )
    
    parser.add_argument(
        '--out',
        required=True,
        help='Output directory for tiles and manifest'
    )
    
    parser.add_argument(
        '--patch-px',
        type=int,
        default=256,
        choices=[256, 512],
        help='Patch size in pixels (default: 256)'
    )
    
    parser.add_argument(
        '--tile-size',
        type=int,
        default=512,
        help='DeepZoom tile size (default: 512)'
    )
    
    parser.add_argument(
        '--quality',
        type=int,
        default=80,
        help='JPEG quality 1-100 (default: 80)'
    )
    
    return parser.parse_args()


def extract_mpp(slide: openslide.OpenSlide) -> float | None:
    """
    Extract microns-per-pixel from slide metadata.
    
    Args:
        slide: OpenSlide object
    
    Returns:
        MPP value as float, or None if not available
    """
    # Try standard property
    mpp_x = slide.properties.get('openslide.mpp-x')
    
    if mpp_x is not None:
        try:
            return float(mpp_x)
        except (ValueError, TypeError):
            pass
    
    return None


def calculate_magnification_levels(dz: DeepZoomGenerator) -> Dict[str, int]:
    """
    Calculate which DZI levels correspond to 2.5x, 5x, 10x, 20x, 40x magnifications.
    
    Assumes slide is scanned at 40x native magnification.
    DZI levels are numbered 0 (smallest) to N (largest/full resolution).
    
    Args:
        dz: DeepZoomGenerator object
    
    Returns:
        Dictionary mapping magnification strings to DZI level indices
        Example: {"2.5x": 11, "5x": 12, "10x": 13, "20x": 14, "40x": 15}
    """
    max_level = dz.level_count - 1
    
    # At max_level: downsample = 1 (40x)
    # At max_level - 1: downsample = 2 (20x)
    # At max_level - 2: downsample = 4 (10x)
    # At max_level - 3: downsample = 8 (5x)
    # At max_level - 4: downsample = 16 (2.5x)
    
    return {
        "40x": max_level,
        "20x": max_level - 1,
        "10x": max_level - 2,
        "5x": max_level - 3,
        "2.5x": max_level - 4
    }


def generate_tiles(
    dz: DeepZoomGenerator,
    output_dir: Path,
    quality: int
) -> None:
    """
    Generate all DeepZoom tiles and save as JPEG.
    
    Args:
        dz: DeepZoomGenerator object
        output_dir: Base directory for tiles
        quality: JPEG quality (1-100)
    """
    print(f"\nGenerating tiles...")
    print(f"Total levels: {dz.level_count}")
    
    for level in range(dz.level_count):
        level_dir = output_dir / str(level)
        level_dir.mkdir(parents=True, exist_ok=True)
        
        cols, rows = dz.level_tiles[level]
        tile_count = cols * rows
        
        print(f"  Level {level:2d}/{dz.level_count - 1}: {cols:4d} x {rows:4d} = {tile_count:6d} tiles", end='')
        
        for col in range(cols):
            for row in range(rows):
                tile = dz.get_tile(level, (col, row))
                tile_path = level_dir / f"{col}_{row}.jpeg"
                tile.save(tile_path, "JPEG", quality=quality)
        
        print(" [DONE]")
    
    print(f"\nAll tiles generated successfully!")


def main():
    """Main entry point for the tiler CLI."""
    args = parse_args()
    
    # Validate input file
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    # Derive slide_id from input filename
    slide_id = input_path.stem
    
    # Create output directory
    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 80)
    print("WSI TILER - OpenSlide DeepZoom Generator")
    print("=" * 80)
    print(f"Input:     {input_path}")
    print(f"Output:    {output_dir}")
    print(f"Slide ID:  {slide_id}")
    print(f"Patch px:  {args.patch_px}")
    print(f"Tile size: {args.tile_size}")
    print(f"Quality:   {args.quality}")
    print("=" * 80)
    
    # Open slide
    print("\nOpening slide...")
    try:
        slide = openslide.OpenSlide(str(input_path))
    except openslide.OpenSlideError as e:
        print(f"Error: Could not open slide with OpenSlide: {e}")
        sys.exit(1)
    
    # Extract metadata
    level0_width, level0_height = slide.dimensions
    mpp0 = extract_mpp(slide)
    
    print(f"  Dimensions: {level0_width} x {level0_height} pixels (level-0)")
    
    if mpp0 is not None:
        print(f"  MPP: {mpp0:.4f} microns/pixel")
    else:
        print(f"  MPP: Not available in metadata (will be recorded as null)")
        print(f"  Warning: Assuming slide is scanned at 40x native magnification")
    
    # Create DeepZoom generator
    print(f"\nCreating DeepZoom generator (tile_size={args.tile_size}, overlap=0)...")
    dz = DeepZoomGenerator(slide, tile_size=args.tile_size, overlap=0)
    
    print(f"  DZI levels: {dz.level_count} (level 0 = smallest, level {dz.level_count - 1} = full resolution)")
    
    # Calculate magnification level mapping
    mag_levels = calculate_magnification_levels(dz)
    print(f"\nMagnification to DZI level mapping:")
    for mag in ["2.5x", "5x", "10x", "20x", "40x"]:
        dzi_level = mag_levels[mag]
        cols, rows = dz.level_tiles[dzi_level]
        print(f"  {mag:4s} -> DZI level {dzi_level:2d} ({cols:4d} x {rows:4d} tiles)")
    
    # Generate tiles
    generate_tiles(dz, output_dir, args.quality)
    
    # Close slide (no longer needed)
    slide.close()
    
    # Run alignment check
    print("\n" + "=" * 80)
    print("RUNNING ALIGNMENT CHECK")
    print("=" * 80)
    
    alignment_ok, report = alignment_check.check_alignment(
        level0_width=level0_width,
        level0_height=level0_height,
        patch_px=args.patch_px,
        num_samples=10
    )
    
    print(report)
    
    # Create manifest
    print("\n" + "=" * 80)
    print("CREATING MANIFEST")
    print("=" * 80)
    
    manifest_data = manifest.create_manifest(
        slide_id=slide_id,
        level0_width=level0_width,
        level0_height=level0_height,
        mpp0=mpp0,
        patch_px=args.patch_px,
        tile_size=args.tile_size,
        alignment_ok=alignment_ok
    )
    
    # Add DZI-specific fields
    manifest_data['dzi_level_count'] = dz.level_count
    manifest_data['magnification_levels'] = mag_levels
    
    # Save manifest
    manifest.save_manifest(manifest_data, str(output_dir))
    
    # Print summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Slide ID:         {slide_id}")
    print(f"Dimensions:       {level0_width} x {level0_height} pixels")
    print(f"MPP:              {mpp0 if mpp0 is not None else 'null'}")
    print(f"Patch size:       {args.patch_px}px")
    print(f"DZI levels:       {dz.level_count}")
    print(f"Alignment check:  {'PASSED' if alignment_ok else 'FAILED'}")
    print(f"Output directory: {output_dir.absolute()}")
    print(f"Manifest:         {output_dir.absolute() / 'manifest.json'}")
    print("=" * 80)
    
    if alignment_ok:
        print("\n[SUCCESS] Tiling completed successfully!")
    else:
        print("\n[WARNING] Tiling completed but alignment check FAILED!")
        print("Please review the alignment report above.")
    
    print()


if __name__ == "__main__":
    main()

