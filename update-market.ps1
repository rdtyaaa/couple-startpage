# Update market.json dengan data terbaru dari API Pegadaian
# Jalankan: .\update-market.ps1

$apiUrl = "https://logam-mulia-api.iamutaki.workers.dev/api/prices/pegadaian"
$outputFile = "$PSScriptRoot\data\market.json"

try {
    Write-Host "Fetching from API..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri $apiUrl -Method Get

    if (-not $response.success) {
        throw "API returned error"
    }

    $item = $response.data[0]

    $marketData = @{
        gold = @{
            sellPrice     = $item.sellPrice
            buybackPrice  = $item.buybackPrice
            weight        = $item.weight
            recordedDate  = $item.recordedDate
        }
        updatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    }

    $marketData | ConvertTo-Json -Depth 5 | Set-Content -Path $outputFile -Encoding UTF8

    Write-Host "market.json updated!" -ForegroundColor Green
    Write-Host "  Jual : Rp $([math]::Round($item.sellPrice / $item.weight))/gram"
    Write-Host "  Beli : Rp $([math]::Round($item.buybackPrice / $item.weight))/gram"
    Write-Host "  Date : $($item.recordedDate)"

} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
