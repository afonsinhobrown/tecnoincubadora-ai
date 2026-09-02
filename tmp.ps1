$files = Get-ChildItem -Path "src/modules" -Recurse -Filter "routes.js"
foreach($f in $files){
  $p = $f.FullName
  $t = [System.IO.File]::ReadAllText($p)
  if ($t.Contains("registrarAuditoria")) { continue }
  # add import
  if ($t.Contains("import { verificarAcesso")) {
    $t = $t.Replace("import { verificarAcesso, registrarUsoPrompt } from", "import { registrarAuditoria } from ''../../auditoria/index.js'';`nimport { verificarAcesso, registrarUsoPrompt } from")
    # fix the quotes: the above has doubled single quotes due to escaping, correct it
    $t = $t.Replace("''../../auditoria/index.js''", "../../auditoria/index.js")
    # Actually the replace above is messy, do a simpler: just insert line
  }
}
