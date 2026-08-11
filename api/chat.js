import { handleChat, setCors } from '../server/handlers.js';

export default async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await handleChat(req);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    const message = err instanceof Error ? err.message : '服务器内部错误';
    console.error('[api/chat]', message);
    return res.status(status).json({ error: message });
  }
}
