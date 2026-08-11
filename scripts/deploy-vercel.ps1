# Soul 聊天助手 - Vercel 部署脚本
# 用法: .\scripts\deploy-vercel.ps1
# 仓库: https://github.com/gege665/glowing-lamp

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Soul 聊天助手 · Vercel 部署 ===" -ForegroundColor Cyan
Write-Host "GitHub: https://github.com/gege665/glowing-lamp" -ForegroundColor DarkGray

Write-Host "`n[1/3] 构建项目..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[2/3] 部署到 Vercel（首次需浏览器登录）..." -ForegroundColor Cyan
npx vercel --prod
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[3/3] 部署完成!" -ForegroundColor Green
Write-Host "请在 Vercel 控制台配置环境变量：" -ForegroundColor Yellow
Write-Host "  - JUHE_API_KEY 或 AIYIWEI_API_KEY 或 OPENROUTER_API_KEY" -ForegroundColor Yellow
Write-Host "  - SITE_URL = 你的 .vercel.app 域名" -ForegroundColor Yellow
Write-Host "`n验证: 访问 <你的域名>/api/health" -ForegroundColor Green
