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
| `API_ACCESS_TOKEN` | **强烈推荐** | 防服务端 Key 被伪造 Origin/Referer 滥用；配置后须匹配 `x-api-access-token` 或用户自带 Key，Origin 不能绕过 |
| `VITE_API_ACCESS_TOKEN` | 与上配套 | 前端构建时写入，请求自动带上同值令牌（公开站点会暴露于 bundle，仍优于裸 Origin） |
| `UPSTASH_REDIS_REST_URL` | 推荐（生产） | [Upstash Redis](https://upstash.com/) REST URL，跨 Serverless 实例共享限流 |
| `UPSTASH_REDIS_REST_TOKEN` | 与上配套 | Upstash REST Token；未配置时回退进程内内存限流（多实例可被打穿） |
| `SERVER_SYSTEM_GUARD` | 可选 | 覆盖服务端强制 system 护栏文案 |
| `ALLOWED_ORIGINS` | 可选 | 自定义域名时追加，逗号分隔 |

> 配置 `SITE_URL` 后，本站访问 `/api/*` 无需用户在浏览器填 Key。

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
