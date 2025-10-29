# TWINLOGY IDN - Custom Domain Setup Script
# This script adds custom domain entries to Windows hosts file
# Must be run as Administrator

$HostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$Domains = @(
    "twinlogy-idn.local",
    "www.twinlogy-idn.local",
    "twinlogy-idn.com",
    "www.twinlogy-idn.com"
)

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       🌐 TWINLOGY IDN Domain Setup 🌐               ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then run:" -ForegroundColor Yellow
    Write-Host "   .\setup-domain.ps1" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "✓ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Backup hosts file
$BackupPath = "$HostsPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $HostsPath $BackupPath
Write-Host "✓ Hosts file backed up to: $BackupPath" -ForegroundColor Green
Write-Host ""

# Read current hosts file
$HostsContent = Get-Content $HostsPath

# Check if domains already exist
$UpdateNeeded = $false
foreach ($Domain in $Domains) {
    $Found = $HostsContent | Where-Object { $_ -match "127.0.0.1\s+$Domain" }
    if (-not $Found) {
        $UpdateNeeded = $true
        break
    }
}

if (-not $UpdateNeeded) {
    Write-Host "✓ All domains already configured in hosts file!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configured domains:" -ForegroundColor Cyan
    foreach ($Domain in $Domains) {
        Write-Host "  • https://$Domain" -ForegroundColor White
    }
    Write-Host ""
    pause
    exit 0
}

# Add domains to hosts file
Write-Host "📝 Adding domains to hosts file..." -ForegroundColor Yellow
Write-Host ""

$NewEntries = @()
$NewEntries += ""
$NewEntries += "# TWINLOGY IDN - Local Development Domains"
$NewEntries += "# Added on: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

foreach ($Domain in $Domains) {
    # Check if domain already exists
    $Exists = $HostsContent | Where-Object { $_ -match $Domain }
    if (-not $Exists) {
        $NewEntries += "127.0.0.1    $Domain"
        Write-Host "  ✓ Added: $Domain" -ForegroundColor Green
    } else {
        Write-Host "  - Exists: $Domain" -ForegroundColor Gray
    }
}

# Append new entries to hosts file
$NewEntries | Add-Content $HostsPath

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║            ✅ Setup Completed Successfully! ✅         ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "🌐 Your custom domains are now configured:" -ForegroundColor Cyan
Write-Host ""
foreach ($Domain in $Domains) {
    Write-Host "  🔐 https://$Domain:3443" -ForegroundColor White
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Generate SSL certificate with custom domain:" -ForegroundColor White
Write-Host "     npm run gen-cert" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Start the server:" -ForegroundColor White
Write-Host "     npm run start" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Access dashboard via custom domain:" -ForegroundColor White
Write-Host "     https://twinlogy-idn.local:3443" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Note: Browser will show security warning for self-signed cert." -ForegroundColor Gray
Write-Host "    Click 'Advanced' → 'Proceed to twinlogy-idn.local'" -ForegroundColor Gray
Write-Host ""

pause
