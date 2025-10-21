"""
alignment_check.py - Verify grid lattice alignment correctness.

Samples multiple positions across the slide and verifies that the round-trip
indexOf(center(i,j)) == (i,j) holds for all samples.
"""

import random
from typing import Tuple, List
from . import lattice


def check_alignment(
    level0_width: int,
    level0_height: int,
    patch_px: int,
    num_samples: int = 10
) -> Tuple[bool, str]:
    """
    Verify lattice math correctness by sampling positions across the slide.
    
    At level-0 (40x), cell_size = patch_px (no scaling needed).
    Samples corner cells, center cell, and random cells, then verifies
    that indexOf(center(i,j)) returns the original (i,j).
    
    Args:
        level0_width: Slide width in level-0 pixels
        level0_height: Slide height in level-0 pixels
        patch_px: Patch size in pixels (e.g., 256 or 512)
        num_samples: Total number of samples to test (default: 10)
    
    Returns:
        (alignment_ok, report): Boolean pass/fail and human-readable report string
    """
    cell_size = float(patch_px)  # At 40x, cell_size = patch_px
    
    # Calculate grid dimensions (number of complete cells)
    max_i, max_j = lattice.grid_dimensions(level0_width, level0_height, cell_size)
    
    # Build report
    lines = []
    lines.append("=" * 80)
    lines.append("ALIGNMENT CHECK REPORT")
    lines.append("=" * 80)
    lines.append(f"Slide dimensions: {level0_width} x {level0_height} pixels (level-0)")
    lines.append(f"Patch size: {patch_px}px")
    lines.append(f"Cell size at level-0 (40x): {cell_size}px")
    lines.append(f"Grid dimensions: {max_i} x {max_j} complete cells")
    lines.append(f"Samples to test: {num_samples}")
    lines.append("")
    
    # Generate sample positions
    samples = _generate_samples(max_i, max_j, num_samples)
    
    # Test each sample
    lines.append("Sample Results:")
    lines.append("-" * 80)
    lines.append(f"{'#':<4} {'(i, j)':<12} {'center(x, y)':<20} {'indexOf(x,y)':<15} {'Status':<8}")
    lines.append("-" * 80)
    
    all_passed = True
    for idx, (i, j) in enumerate(samples, 1):
        # Forward: indices -> center
        x0, y0 = lattice.center(i, j, cell_size)
        
        # Backward: center -> indices
        i_back, j_back = lattice.indexOf(x0, y0, cell_size)
        
        # Verify round-trip
        passed = (i_back == i) and (j_back == j)
        status = "PASS" if passed else "FAIL"
        
        if not passed:
            all_passed = False
        
        lines.append(
            f"{idx:<4} ({i:4d}, {j:4d}) "
            f"({x0:8.1f}, {y0:8.1f})  "
            f"({i_back:4d}, {j_back:4d})  "
            f"{status:<8}"
        )
    
    lines.append("-" * 80)
    lines.append("")
    
    # Summary
    if all_passed:
        lines.append("[SUCCESS] All samples passed round-trip verification")
        lines.append(f"alignment_ok = TRUE")
    else:
        lines.append("[FAILURE] Some samples failed round-trip verification")
        lines.append(f"alignment_ok = FALSE")
    
    lines.append("=" * 80)
    
    report = "\n".join(lines)
    return (all_passed, report)


def _generate_samples(max_i: int, max_j: int, num_samples: int) -> List[Tuple[int, int]]:
    """
    Generate sample cell positions for testing.
    
    Includes:
    - 4 corner cells (if grid is large enough)
    - 1 center cell
    - Remaining samples are random valid cells
    
    Args:
        max_i: Maximum column index (exclusive)
        max_j: Maximum row index (exclusive)
        num_samples: Total number of samples to generate
    
    Returns:
        List of (i, j) tuples representing cell indices
    """
    samples = []
    
    # Ensure we have at least some cells to sample
    if max_i <= 0 or max_j <= 0:
        return samples
    
    # Add corner cells (if we have space and enough sample budget)
    if max_i >= 2 and max_j >= 2 and num_samples >= 5:
        samples.append((0, 0))                          # Top-left
        samples.append((max_i - 1, 0))                  # Top-right
        samples.append((0, max_j - 1))                  # Bottom-left
        samples.append((max_i - 1, max_j - 1))          # Bottom-right
    elif max_i >= 1 and max_j >= 1:
        # Small grid, just sample origin
        samples.append((0, 0))
    
    # Add center cell
    if max_i >= 1 and max_j >= 1:
        center_i = max_i // 2
        center_j = max_j // 2
        if (center_i, center_j) not in samples:
            samples.append((center_i, center_j))
    
    # Fill remaining with random samples
    random.seed(42)  # Deterministic for reproducibility
    attempts = 0
    max_attempts = num_samples * 10  # Prevent infinite loop
    
    while len(samples) < num_samples and attempts < max_attempts:
        i = random.randint(0, max_i - 1)
        j = random.randint(0, max_j - 1)
        
        if (i, j) not in samples:
            samples.append((i, j))
        
        attempts += 1
    
    return samples[:num_samples]


# Self-test / demonstration
if __name__ == "__main__":
    print("\nAlignment Check - Self Test\n")
    
    # Test case 1: Typical slide with patch_px=256
    print("Test Case 1: 10000x8000 slide, patch_px=256")
    alignment_ok, report = check_alignment(10000, 8000, 256, num_samples=10)
    print(report)
    print("\n")
    
    # Test case 2: Larger patches
    print("Test Case 2: 10000x8000 slide, patch_px=512")
    alignment_ok, report = check_alignment(10000, 8000, 512, num_samples=8)
    print(report)
    print("\n")
    
    # Test case 3: Very large slide
    print("Test Case 3: 100000x80000 slide, patch_px=256")
    alignment_ok, report = check_alignment(100000, 80000, 256, num_samples=12)
    print(report)

