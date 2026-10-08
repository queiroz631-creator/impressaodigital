# Run as administrator with the PUBLIC certificate beside this script.
# Never place private-key.pem or qz.env on Windows.
param([string]$Certificado = "$PSScriptRoot\digital-certificate.txt")
$ErrorActionPreference = 'Stop'
$admin = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Abra o PowerShell como administrador.' }
if (Get-Process -Name 'qz-tray' -ErrorAction SilentlyContinue) { throw 'Encerre o QZ Tray pelo ícone da bandeja antes de instalar.' }
$pasta = Join-Path $env:ProgramFiles 'QZ Tray'
if (-not (Test-Path (Join-Path $pasta 'qz-tray.exe'))) { throw 'QZ Tray não encontrado em Program Files. Instale o QZ Tray 2.1 ou superior.' }
if (-not (Test-Path $Certificado)) { throw 'Coloque o certificado público digital-certificate.txt junto deste script.' }
$texto = Get-Content -Raw $Certificado
if ($texto -match 'PRIVATE KEY' -or $texto -notmatch 'BEGIN CERTIFICATE') { throw 'Arquivo inválido. Use somente o certificado público.' }
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($Certificado)
if ($cert.NotAfter -lt (Get-Date)) { throw 'Certificado expirado.' }
$hash = [System.Security.Cryptography.SHA256]::Create()
$impressao = ([BitConverter]::ToString($hash.ComputeHash($cert.RawData))).Replace('-', ':')
Write-Host "Certificado: $($cert.Subject)"
Write-Host "SHA-256: $impressao"
Write-Host "Validade: $($cert.NotAfter)"
if ((Read-Host 'Compare com o SHA-256 mostrado na VPS. Digite SIM para confiar') -cne 'SIM') { throw 'Instalação cancelada.' }
$destino = Join-Path $pasta 'override.crt'
if (Test-Path $destino) {
  if ((Get-FileHash $destino).Hash -eq (Get-FileHash $Certificado).Hash) { Write-Host 'Este certificado já está instalado.'; exit 0 }
  throw 'Já existe outro override.crt. Não foi substituído; consulte o responsável antes de mudar a confiança.'
}
Copy-Item $Certificado $destino
Write-Host 'Confiança instalada. Abra o QZ Tray, acesse o site e autorize o certificado identificado uma vez com Remember this decision.'
