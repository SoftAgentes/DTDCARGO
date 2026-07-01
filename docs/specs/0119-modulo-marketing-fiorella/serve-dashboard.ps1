# serve-dashboard.ps1 — variante Windows del launcher del dashboard maestro.
# Equivale a serve-dashboard.sh (que usa lsof/open de macOS, no portables a Windows).
# El dashboard.html usa fetch() para leer dashboard-data.json, y los navegadores
# bloquean fetch desde file:// — por eso hace falta servirlo por HTTP.
#
# Uso (desde la carpeta del dashboard):
#   powershell -ExecutionPolicy Bypass -File .\serve-dashboard.ps1
# Detener: Ctrl+C.

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# Buscar puerto libre 8765-8800
$port = 8765
while ($port -le 8800) {
  $inUse = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if (-not $inUse) { break }
  $port++
}
if ($port -gt 8800) {
  Write-Host "No encontre puerto libre entre 8765-8800. Cierra algun servidor previo." -ForegroundColor Red
  exit 1
}

$url = "http://localhost:$port/dashboard.html"
Write-Host "Levantando servidor en puerto $port..."
Write-Host "Sirviendo: $((Get-Location).Path)"
Write-Host "Dashboard: $url"
Write-Host "Para detener: Ctrl+C"
Write-Host ""

# Abrir navegador a los 2s (en background) y servir en foreground
Start-Job -ScriptBlock { Start-Sleep -Seconds 2; Start-Process $using:url } | Out-Null

# python o python3, lo que exista
$py = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $py) { $py = (Get-Command python3 -ErrorAction SilentlyContinue) }
if (-not $py) {
  Write-Host "No encontre Python en PATH. Instala Python 3 o sirve la carpeta con otro server estatico." -ForegroundColor Red
  exit 1
}
& $py.Source -m http.server $port
