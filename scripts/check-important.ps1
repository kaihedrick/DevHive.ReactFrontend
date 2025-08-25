$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "..\src"
$files = Get-ChildItem -Path $root -Recurse -Include *.css
$total = 0
foreach ($f in $files) {
  $matches = Select-String -Path $f.FullName -Pattern '!\s*important' -AllMatches
  if ($matches.Matches.Count -gt 0) {
    "{0}`t{1}" -f $matches.Matches.Count, $f.FullName
    $total += $matches.Matches.Count
  }
}
"TOTAL`t{0}" -f $total
if ($total -gt 0) { exit 1 } else { exit 0 }
