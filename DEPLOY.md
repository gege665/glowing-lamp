# 部署指南

仓库地址：**https://github.com/gege665/glowing-lamp**

## GitHub 推送

本地已与远程关联，日常更新：

```powershell
cd d:\OKnihenlihai
git add .
git commit -m "你的提交说明"
git push origin main
```

首次推送（新机器）：

```powershell
cd d:\OKnihenlihai
git remote add origin https://github.com/gege665/glowing-lamp.git
git push -u origin main
```

或使用脚本：

```powershell
.\scripts\setup-github.ps1 -RepoUrl "https://github.com/gege665/glowing-lamp.git"
```

## Vercel 部署（推荐）

### 1. 导入 GitHub 仓库

1. 登录 [vercel.com](https://vercel.com)
2. **Add New… → Project**
3. 选择 **gege665/glowing-lamp**
4. 确认以下设置（已写入 `vercel.json`，一般无需改）：

| 配置项 | 值 |
|--------|-----|
| Framework Preset | Vite |
| Root Directory | **留空**（不要填子目录） |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js Version | 20.x |

5. 点击 **Deploy**

### 2. 环境变量（Vercel → Project → Settings → Environment Variables）

至少配置 **一项** API Key，用户才可在网页内免填 Key 使用：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `JUHE_API_KEY` | 推荐 | 聚合 API Key，前端选「聚合 API」 |
| `AIYIWEI_API_KEY` | 可选 | 爱易威 Key（sk- 开头） |
| `OPENROUTER_API_KEY` | 可选 | OpenRouter 备用线路（sk-or- 开头） |
| `SITE_URL` | 推荐 | 生产域名，如 `https://glowing-lamp.vercel.app` |
| `API_ACCESS_TOKEN` | 强烈推荐 | 服务端访问令牌；配置后禁止仅靠 Origin 白嫖 |
| `VITE_API_ACCESS_TOKEN` | 强烈推荐 | **与上项同值**；构建期打进前端，请求自动带 `x-api-access-token` |
| `ALLOWED_ORIGINS` | 可选 | 自定义域名时追加，逗号分隔 |

> 配置服务端 Key 后，本站可免填用户 Key。生产请同时配置 `API_ACCESS_TOKEN` 与 `VITE_API_ACCESS_TOKEN`（值相同）并重新部署，否则前端不会带令牌。

### 3. 重新部署

环境变量修改后：**Deployments → 最新部署 → … → Redeploy**

### 4. CLI 部署（可选）

```powershell
npm run build
npx vercel login
npx vercel link    # 关联 gege665/glowing-lamp
npx vercel --prod
```

或：

```powershell
.\scripts\deploy-vercel.ps1
```

## 验证清单

- [ ] 首页可打开：`https://<你的域名>.vercel.app`
- [ ] 健康检查：`https://<你的域名>.vercel.app/api/health` → `{"status":"ok","serverKeyConfigured":true}`
- [ ] 设置里可配置 API Key 或直接分析
- [ ] AI 分析与话术生成正常

## 常见问题

### `ENOENT: package.json`

- **Root Directory** 必须留空
- 确认 GitHub 根目录有 `package.json`（本仓库已包含）

### API 403「未授权」

- 在 Vercel 配置 `SITE_URL` 为你的 `.vercel.app` 域名
- 或在网页「设置」中填写个人 API Key

### 分析/话术很慢

- 使用「智能模式」（默认走加速合并请求）
- 确保至少一个服务端 Key 已配置且有效

## API 路由

| 路径 | 说明 |
|------|------|
| `/api/chat` | AI 分析（非流式） |
| `/api/chat/stream` | AI 分析（流式 SSE） |
| `/api/health` | 健康检查 |
| `/api/verify-key` | Key 验证 |
| `/api/ocr` | 截图 OCR |
