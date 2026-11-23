param(
    [Parameter(Mandatory = $true)][string]$SillyTavernPath,
    [string]$UserHandle = 'default-user'
)
$ErrorActionPreference = 'Stop'
$tavernRoot = (Resolve-Path -LiteralPath $SillyTavernPath).Path
if (!(Test-Path -LiteralPath (Join-Path $tavernRoot 'server.js'))) { throw '请选择 SillyTavern 的根目录。' }
if ($UserHandle -notmatch '^[a-zA-Z0-9_-]+$') { throw '用户目录名称无效。' }
$extensionRoot = Join-Path $tavernRoot "data/$UserHandle/extensions/fictional-adventure-tavern"
if (Test-Path -LiteralPath $extensionRoot) {
    $backupRoot = Join-Path $tavernRoot "data/$UserHandle/backups/fictional-adventure-$(Get-Date -Format yyyyMMdd-HHmmss-fff)"
    Copy-Item -LiteralPath $extensionRoot -Destination $backupRoot -Recurse
    Write-Output "已备份现有扩展：$backupRoot"
}
New-Item -Path $extensionRoot -ItemType Directory -Force | Out-Null
$runtimeFiles = @('manifest.json', 'tavern-extension.js', 'tavern-extension.css', 'tavern-prompt.mjs', 'index.html', 'game.js', 'style.css')
foreach ($file in $runtimeFiles) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $extensionRoot $file) -Force }
foreach ($folder in @('js', 'css', 'assets', 'Music')) {
    $destination = Join-Path $extensionRoot $folder
    New-Item -Path $destination -ItemType Directory -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot $folder) | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
    }
}
Write-Output "已安装：$extensionRoot"
Write-Output '刷新酒馆，点击左下角「转生千金」。'
