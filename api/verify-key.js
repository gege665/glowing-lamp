import { handleVerifyKey, setCors } from '../server/handlers.js';

export default async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await handleVerifyKey(req);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.status || 400;
    const message = err instanceof Error ? err.message : '验证失败';
    return res.status(status).json({ ok: false, error: message });
  }
}
