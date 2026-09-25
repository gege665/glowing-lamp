# Soul 聊天助手 - Git 初始化与 GitHub 推送脚本
# 用法: .\scripts\setup-github.ps1 -RepoUrl "https://github.com/用户名/soul-chat-assistant.git"

param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# 查找 Git
$Git = $null
foreach ($p in @(
    "C:\Program Files\Git\bin\git.exe",
    "$Root\.tools\git\cmd\git.exe"
)) {
    if (Test-Path $p) { $Git = $p; break }
}

if (-not $Git) {
    Write-Host "未找到 Git，请先安装: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

Set-Location $Root
Write-Host "使用 Git: $Git" -ForegroundColor Cyan

& $Git init
& $Git add .
& $Git status

$hasChanges = & $Git status --porcelain
if ($hasChanges) {
    & $Git commit -m "feat: Soul 聊天助手初始版本，支持 Vercel 部署"
} else {
    Write-Host "没有需要提交的更改" -ForegroundColor Yellow
}

& $Git branch -M main

$remotes = & $Git remote 2>$null
if ($remotes -notcontains "origin") {
    & $Git remote add origin $RepoUrl
} else {
    & $Git remote set-url origin $RepoUrl
}

Write-Host "推送到 $RepoUrl ..." -ForegroundColor Cyan
& $Git push -u origin main

Write-Host "GitHub 推送完成!" -ForegroundColor Green
