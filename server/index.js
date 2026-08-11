import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
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

app.use(
  cors({
    origin(origin, callback) {
      const allowed = getAllowedSiteOrigins();
      if (!origin || allowed.has(origin)) {
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
  res.json({
    status: 'ok',
    timestamp: Date.now(),
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
