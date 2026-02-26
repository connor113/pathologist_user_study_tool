# tile_selected_20.ps1 - Tile the 20 selected slides for deployment
# Run from repo root: .\scripts\tile_selected_20.ps1

$OUT_DIR = "D:\Data\pathology_tiles"
$BASE = "D:\Data\IMP-CRS-2024"

$slides = @{
    "CRC_0645" = "CRS1"; "CRC_2749" = "CRS2"; "CRC_2144" = "CRS2"; "CRC_2593" = "CRS1"
    "CRC_2739" = "CRS2"; "CRC_2696" = "CRS2"; "CRC_3109" = "CRS1"; "CRC_2000" = "CRS2"
    "CRC_1472" = "CRS2"; "CRC_2341" = "CRS2"; "CRC_0170" = "CRS1"; "CRC_0908" = "CRS1"
    "CRC_2103" = "CRS2"; "CRC_3148" = "CRS2"; "CRC_3060" = "CRS2"; "CRC_1459" = "CRS1"
    "CRC_3138" = "CRS2"; "CRC_2198" = "CRS2"; "CRC_4240" = "CRS1"; "CRC_0423" = "CRS1"
}

New-Item -ItemType Directory -Force -Path $OUT_DIR | Out-Null

$count = 0
$total = $slides.Count

foreach ($slide_id in $slides.Keys) {
    $count++
    $split = $slides[$slide_id]
    $input = "$BASE\$split\slides\$slide_id.svs"
    
    if (Test-Path $input) {
        Write-Host "[$count/$total] Tiling: $slide_id ($split)" -ForegroundColor Green
        python -m src.tiler.wsi_tiler --input $input --out "$OUT_DIR\$slide_id"
    } else {
        Write-Host "[$count/$total] NOT FOUND: $input" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done! Tiles saved to $OUT_DIR" -ForegroundColor Cyan
Write-Host "Next: upload to S3 with deployment-prep/upload-tiles-to-s3.ps1"
