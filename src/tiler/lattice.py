"""
lattice.py - Pure grid math functions for zoom-level-fixed patch alignment.

All coordinates are in level-0 (40x magnification) pixel space.
Grid cells are anchored at (0,0) with no rotation.
"""

import math
from typing import Tuple


def indexOf(x0: float, y0: float, cell_size: float) -> Tuple[int, int]:
    """
    Convert level-0 coordinates to grid cell indices.
    
    Args:
        x0: X coordinate in level-0 pixels
        y0: Y coordinate in level-0 pixels
        cell_size: Cell size in level-0 pixels (e.g., patch_px for 40x)
    
    Returns:
        (i, j): Grid cell indices (column, row)
    
    Example:
        >>> indexOf(512.5, 768.3, 256)
        (2, 3)
    """
    i = math.floor(x0 / cell_size)
    j = math.floor(y0 / cell_size)
    return (i, j)


def center(i: int, j: int, cell_size: float) -> Tuple[float, float]:
    """
    Get the center coordinates of a grid cell in level-0 pixels.
    
    Args:
        i: Column index
        j: Row index
        cell_size: Cell size in level-0 pixels
    
    Returns:
        (x0, y0): Center coordinates in level-0 pixels
    
    Example:
        >>> center(2, 3, 256)
        (640.0, 896.0)
    """
    x0 = (i + 0.5) * cell_size
    y0 = (j + 0.5) * cell_size
    return (x0, y0)


def is_edge_cell(
    i: int, 
    j: int, 
    level0_width: int, 
    level0_height: int, 
    cell_size: float
) -> bool:
    """
    Check if a grid cell is a partial edge cell (crosses slide boundaries).
    
    Args:
        i: Column index
        j: Row index
        level0_width: Slide width in level-0 pixels
        level0_height: Slide height in level-0 pixels
        cell_size: Cell size in level-0 pixels
    
    Returns:
        True if the cell extends beyond slide boundaries (partial cell)
    
    Example:
        >>> is_edge_cell(0, 0, 10000, 8000, 256)
        False
        >>> is_edge_cell(39, 31, 10000, 8000, 256)  # 39*256=9984, 40*256=10240 > 10000
        True
    """
    # Calculate cell boundaries
    cell_left = i * cell_size
    cell_right = (i + 1) * cell_size
    cell_top = j * cell_size
    cell_bottom = (j + 1) * cell_size
    
    # Check if cell extends beyond slide boundaries
    if cell_right > level0_width or cell_bottom > level0_height:
        return True
    
    return False


def grid_dimensions(level0_width: int, level0_height: int, cell_size: float) -> Tuple[int, int]:
    """
    Calculate the number of complete grid cells that fit in the slide.
    
    Args:
        level0_width: Slide width in level-0 pixels
        level0_height: Slide height in level-0 pixels
        cell_size: Cell size in level-0 pixels
    
    Returns:
        (num_cols, num_rows): Number of complete cells in each dimension
    
    Example:
        >>> grid_dimensions(10000, 8000, 256)
        (39, 31)  # floor(10000/256), floor(8000/256)
    """
    num_cols = math.floor(level0_width / cell_size)
    num_rows = math.floor(level0_height / cell_size)
    return (num_cols, num_rows)


# Self-test / demonstration
if __name__ == "__main__":
    print("Lattice Grid Math - Round-Trip Tests\n")
    print("=" * 60)
    
    # Test configuration
    cell_size = 256.0  # patch_px at 40x
    test_cases = [
        (0, 0),
        (5, 10),
        (100, 50),
        (1, 1),
        (999, 999),
    ]
    
    print(f"Cell size: {cell_size}px (at level-0)\n")
    
    all_passed = True
    for i, j in test_cases:
        # Forward: indices -> center
        x0, y0 = center(i, j, cell_size)
        
        # Backward: center -> indices
        i_back, j_back = indexOf(x0, y0, cell_size)
        
        # Verify round-trip
        passed = (i_back == i) and (j_back == j)
        status = "PASS" if passed else "FAIL"
        
        print(f"[{status}] ({i:4d}, {j:4d}) -> center({x0:10.1f}, {y0:10.1f}) -> ({i_back:4d}, {j_back:4d})")
        
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    
    # Test edge cell detection
    print("\nEdge Cell Detection Test:")
    print(f"Slide: 10000 x 8000 pixels, Cell size: {cell_size}px\n")
    
    max_i, max_j = grid_dimensions(10000, 8000, cell_size)
    print(f"Grid dimensions: {max_i} x {max_j} complete cells\n")
    
    edge_test_cases = [
        (0, 0, False, "Corner cell (complete)"),
        (max_i - 1, max_j - 1, False, "Last complete cell"),
        (max_i, 0, True, "First column edge cell"),
        (0, max_j, True, "First row edge cell"),
        (max_i, max_j, True, "Corner edge cell"),
    ]
    
    for i, j, expected_edge, description in edge_test_cases:
        is_edge = is_edge_cell(i, j, 10000, 8000, cell_size)
        status = "PASS" if is_edge == expected_edge else "FAIL"
        edge_str = "EDGE" if is_edge else "OK  "
        print(f"[{status}] ({i:3d}, {j:3d}) [{edge_str}] - {description}")
    
    print("\n" + "=" * 60)
    
    if all_passed:
        print("\n[SUCCESS] All round-trip tests PASSED")
    else:
        print("\n[FAILURE] Some tests FAILED")

