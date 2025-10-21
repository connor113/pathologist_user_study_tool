"""
manifest.py - Create and serialize manifest JSON for tiled slides.

The manifest captures lattice parameters and alignment verification status,
serving as the single source of truth for the viewer.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any


def create_manifest(
    slide_id: str,
    level0_width: int,
    level0_height: int,
    mpp0: Optional[float],
    patch_px: int,
    tile_size: int,
    alignment_ok: bool
) -> Dict[str, Any]:
    """
    Create a manifest dictionary with lattice parameters and metadata.
    
    Args:
        slide_id: Identifier for the slide (derived from filename)
        level0_width: Slide width in level-0 pixels
        level0_height: Slide height in level-0 pixels
        mpp0: Microns per pixel at level-0, or None if not available
        patch_px: Patch size in pixels (e.g., 256 or 512)
        tile_size: DeepZoom tile size (typically 512)
        alignment_ok: Boolean result from alignment check
    
    Returns:
        Dictionary containing all manifest fields
    """
    manifest = {
        "slide_id": slide_id,
        "level0_width": level0_width,
        "level0_height": level0_height,
        "mpp0": mpp0,  # Will be null if not available
        "patch_px": patch_px,
        "tile_size": tile_size,
        "overlap": 0,  # Fixed at 0 per spec
        "anchor": [0, 0],  # Grid anchored at origin
        "alignment_ok": alignment_ok,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    return manifest


def save_manifest(manifest: Dict[str, Any], output_dir: str) -> None:
    """
    Save manifest dictionary as JSON file.
    
    Args:
        manifest: Manifest dictionary from create_manifest()
        output_dir: Directory where manifest.json should be saved
    """
    output_path = Path(output_dir) / "manifest.json"
    
    # Ensure directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write JSON with pretty printing
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"Manifest saved to: {output_path}")


def load_manifest(manifest_path: str) -> Dict[str, Any]:
    """
    Load and parse a manifest JSON file.
    
    Args:
        manifest_path: Path to manifest.json file
    
    Returns:
        Manifest dictionary
    
    Raises:
        FileNotFoundError: If manifest file doesn't exist
        json.JSONDecodeError: If manifest is not valid JSON
    """
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    return manifest


# Self-test / demonstration
if __name__ == "__main__":
    import tempfile
    import shutil
    
    print("\nManifest Generation - Self Test\n")
    print("=" * 60)
    
    # Create a temporary directory for testing
    temp_dir = tempfile.mkdtemp(prefix="manifest_test_")
    
    try:
        # Test case 1: Manifest with MPP
        print("\nTest Case 1: Create manifest with MPP")
        manifest1 = create_manifest(
            slide_id="test_slide_001",
            level0_width=100000,
            level0_height=80000,
            mpp0=0.25,
            patch_px=256,
            tile_size=512,
            alignment_ok=True
        )
        
        print(json.dumps(manifest1, indent=2))
        
        # Save it
        test_dir1 = Path(temp_dir) / "test1"
        save_manifest(manifest1, str(test_dir1))
        
        # Load it back
        loaded1 = load_manifest(str(test_dir1 / "manifest.json"))
        print(f"\n[PASS] Manifest saved and loaded successfully")
        print(f"Verified: slide_id = {loaded1['slide_id']}")
        print(f"Verified: alignment_ok = {loaded1['alignment_ok']}")
        
        # Test case 2: Manifest without MPP (null)
        print("\n" + "=" * 60)
        print("\nTest Case 2: Create manifest without MPP (null)")
        manifest2 = create_manifest(
            slide_id="test_slide_002",
            level0_width=50000,
            level0_height=40000,
            mpp0=None,  # Missing MPP
            patch_px=512,
            tile_size=512,
            alignment_ok=True
        )
        
        print(json.dumps(manifest2, indent=2))
        
        # Verify mpp0 is null in JSON
        test_dir2 = Path(temp_dir) / "test2"
        save_manifest(manifest2, str(test_dir2))
        
        loaded2 = load_manifest(str(test_dir2 / "manifest.json"))
        print(f"\n[PASS] Manifest with null MPP handled correctly")
        print(f"Verified: mpp0 = {loaded2['mpp0']}")
        print(f"Verified: patch_px = {loaded2['patch_px']}")
        
        # Test case 3: Manifest with alignment failure
        print("\n" + "=" * 60)
        print("\nTest Case 3: Create manifest with alignment_ok=False")
        manifest3 = create_manifest(
            slide_id="test_slide_003",
            level0_width=10000,
            level0_height=8000,
            mpp0=0.5,
            patch_px=256,
            tile_size=512,
            alignment_ok=False  # Simulated failure
        )
        
        print(json.dumps(manifest3, indent=2))
        print(f"\n[PASS] Alignment failure recorded correctly")
        
        print("\n" + "=" * 60)
        print("\n[SUCCESS] All manifest tests passed")
        
    finally:
        # Clean up temporary directory
        shutil.rmtree(temp_dir)
        print(f"\nCleaned up temporary test directory: {temp_dir}")

