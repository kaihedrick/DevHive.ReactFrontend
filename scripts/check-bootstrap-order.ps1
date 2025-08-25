$ErrorActionPreference = "Stop"
$bad = Get-ChildItem -Recurse -Path (Join-Path $PSScriptRoot "..\src") -Include *.ts,*.tsx |
  Where-Object { (Get-Content $_.FullName) -match "bootstrap(\.min)?\.css" } |
  Where-Object { $_.FullName -notmatch "src\\(main|App)\.tsx?$" }
if ($bad) {
  "Bootstrap CSS must be imported only in main.tsx/App.tsx. Offenders:"
  $bad | ForEach-Object { $_.FullName }
  exit 1
}
