# 国内访问部署指南

> 现象：`*.vercel.app` 在国内浏览器显示「无法访问此页面」，无红色报错（页面根本没加载）。
> 原因：网络无法连通 Vercel 默认域名，不是代码问题。

提供 **两套方案**，任选其一。

---

## 方案 A：Cloudflare 自定义域名 + Vercel（推荐，有域名时）

用你自己的域名走 Cloudflare CDN，国内访问成功率远高于 `*.vercel.app`。

### 前置条件

- 有一个域名（阿里云/腾讯云/Namesilo 等，约 ¥30–80/年）
- Vercel 项目已部署（你已有：`glowing-lamp-psi.vercel.app`）

### 步骤 1：域名接入 Cloudflare

1. 注册 [Cloudflare](https://dash.cloudflare.com/sign-up)
2. **Add a site** → 输入你的域名（如 `example.com`）
3. 选择 **Free** 计划
4. 按提示把域名 DNS 服务器改为 Cloudflare 提供的 NS 地址（在域名注册商处修改）

### 步骤 2：Vercel 绑定域名

1. 打开 [Vercel Dashboard](https://vercel.com/dashboard) → 你的项目 `glowing-lamp`
2. **Settings → Domains**
3. 添加域名，例如：
   - `chat.example.com`（推荐子域名）
   - 或 `example.com`
4. Vercel 会显示需要添加的 DNS 记录（通常是 CNAME）

### 步骤 3：Cloudflare DNS 配置

在 Cloudflare → **DNS → Records** 添加：

| 类型 | 名称 | 内容 | 代理 |
|------|------|------|------|
| CNAME | `chat` | `cname.vercel-dns.com` | 已代理（橙色云） |

> 具体 CNAME 值以 Vercel Domains 页面显示为准。

### 步骤 4：Cloudflare SSL 设置

**SSL/TLS → Overview** → 选择 **Full**

### 步骤 5：Vercel 环境变量

Vercel → **Settings → Environment Variables** 添加：

| 变量 | 值 |
|------|-----|
| `SITE_URL` | `https://chat.example.com` |

重新 **Deploy** 一次。

### 步骤 6：验证

```bash
curl -I https://chat.example.com/api/health
```

应返回 `200` 和 `{"status":"ok"}`。

---

## 方案 B：国内云服务器 Docker 部署（最稳定）

适合：有阿里云/腾讯云轻量服务器（约 ¥50–100/年），国内访问最快。

### 前置条件

- 一台 Linux 服务器（Ubuntu 22.04 推荐）
- 已安装 Docker（[官方安装文档](https://docs.docker.com/engine/install/)）

### 步骤 1：上传代码到服务器

```bash
# 本地（Git 已安装）
cd d:\OKnihenlihai
git push origin main

# 服务器上
git clone https://github.com/gege665/glowing-lamp.git
cd glowing-lamp
```

### 步骤 2：配置域名（可选）

若已有域名，在 DNS 添加 **A 记录** 指向服务器公网 IP：

| 类型 | 名称 | 值 |
|------|------|-----|
| A | `chat` | `你的服务器IP` |

### 步骤 3：启动 Docker

```bash
# 设置站点 URL（改成你的域名或 IP）
export SITE_URL=https://chat.example.com

# 构建并启动（监听 80 端口）
docker compose up -d --build

# 查看日志
docker compose logs -f
```

### 步骤 4：验证

```bash
curl http://localhost/api/health
# 或浏览器访问 http://你的服务器IP
```

### 步骤 5：配置 HTTPS（推荐）

```bash
# 安装 Caddy 自动 HTTPS（需域名已解析到服务器）
sudo apt install -y caddy

# /etc/caddy/Caddyfile
chat.example.com {
    reverse_proxy localhost:3000
}

sudo systemctl reload caddy
```

### Windows 本地 Docker 测试

```powershell
cd d:\OKnihenlihai
docker compose up --build
# 访问 http://localhost
```

---

## 方案对比

| | Cloudflare + Vercel | 国内 Docker |
|--|---------------------|-------------|
| 成本 | 域名费 + Vercel 免费 | 域名 + 云服务器 |
| 国内速度 | 较好 | 最好 |
| 维护难度 | 低 | 中 |
| 需要服务器 | 否 | 是 |

---

## 临时方案：本地使用

无需部署，在本机运行：

```powershell
cd d:\OKnihenlihai
npm run dev
# 浏览器打开 http://localhost:5173
```

---

## 常见问题

**Q：Cloudflare 配好了还是打不开？**  
A：检查 DNS 是否生效（`ping chat.example.com`），SSL 是否为 Full，等待 5–30 分钟传播。

**Q：Docker 启动后 API 报错？**  
A：确认 `SITE_URL` 环境变量已设置，OpenRouter Key 在浏览器设置里配置。

**Q：服务器需要开放哪些端口？**  
A：安全组放行 **80**（HTTP）和 **443**（HTTPS）。
