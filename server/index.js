import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleChat, handleChatStream, handleVerifyKey, isServerApiKeyConfigured, isServerOpenRouterKeyConfigured, getAllowedSiteOrigins } from './handlers.js';
import { handleOcr } from './ocr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Only trust forwarded headers when the deployment explicitly runs behind a proxy.
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : 0);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      const allowed = getAllowedSiteOrigins();
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }
      // 生产：仅回显本站 Origin；无 Origin（curl 等）不设 ACAO，鉴权仍由 assertProductionApiAccess 负责
      if (origin && allowed.has(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-access-token'],
  })
);

if (
  process.env.NODE_ENV === 'production' &&
  isServerApiKeyConfigured() &&
  !process.env.SITE_URL &&
  !process.env.ALLOWED_ORIGINS
) {
  console.error('生产环境须配置 SITE_URL 或 ALLOWED_ORIGINS，否则 API 访问将被拒绝');
  process.exit(1);
}

if (
  process.env.NODE_ENV === 'production' &&
  isServerApiKeyConfigured() &&
  !process.env.API_ACCESS_TOKEN
) {
  console.warn(
    '[security] 已配置服务端 API Key 但未设置 API_ACCESS_TOKEN：仅靠 Origin/Referer 防护，易被伪造。建议设置 API_ACCESS_TOKEN，并在前端配置同值 VITE_API_ACCESS_TOKEN'
  );
}

if (
  process.env.NODE_ENV === 'production' &&
  !process.env.UPSTASH_REDIS_REST_URL
) {
  console.warn(
    '[security] 未配置 UPSTASH_REDIS_REST_URL：限流仅在单实例内存有效，Vercel 多实例下可被打穿'
  );
}
app.use(express.json({ limit: '5mb' }));

app.post('/api/chat/stream', async (req, res) => {
  await handleChatStream(req, res);
});

app.post('/api/chat', async (req, res) => {
  try {
    const result = await handleChat(req);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || '服务器内部错误' });
  }
});

app.post('/api/verify-key', async (req, res) => {
  try {
    const result = await handleVerifyKey(req);
    res.json(result);
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ ok: false, error: err.message || '验证失败' });
  }
});

app.post('/api/ocr', async (req, res) => {
  try {
    const result = await handleOcr(req);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || '截图识别失败' });
  }
});

app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    // Boolean capability flag is needed by the client to decide whether a user key is required.
    serverKeyConfigured: isServerApiKeyConfigured(),
    openRouterFallback: isServerOpenRouterKeyConfigured(),
  });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API 路由不存在' });
});

const distPath = path.join(__dirname, '..', 'dist');
const indexHtml = path.join(distPath, 'index.html');

app.use(express.static(distPath));

app.get('*', (_req, res) => {
  if (!fs.existsSync(indexHtml)) {
    return res.status(503).send('前端未构建，请先执行 npm run build');
  }
  res.sendFile(indexHtml, (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('无法加载页面');
    }
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Soul 聊天助手运行在 http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用`);
  } else {
    console.error('服务器启动失败:', err);
  }
  process.exit(1);
});
