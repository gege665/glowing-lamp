import { setCors, isServerApiKeyConfigured, isServerOpenRouterKeyConfigured } from '../server/handlers.js';

export default async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    serverKeyConfigured: isServerApiKeyConfigured(),
    openRouterFallback: isServerOpenRouterKeyConfigured(),
  });
}
