function normalizeApiKey(apiKey) {
  if (!apiKey) return '';
  return String(apiKey).trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
}

const PROVIDER_LABELS = {
  aiyiwei: '爱易威 API',
  juhe: '聚合 API',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  siliconflow: 'SiliconFlow',
};

/** 根据 Key 前缀推断服务商；尊重用户已选的 juhe / siliconflow */
export function detectProviderFromKey(apiKey, currentProvider) {
  const key = normalizeApiKey(apiKey);
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('sk-')) {
    if (currentProvider === 'siliconflow') return 'siliconflow';
    if (currentProvider === 'juhe') return 'juhe';
    return 'aiyiwei';
  }
  return null;
}

/** 上游返回 Invalid token 等时的中文说明 */
export function humanizeInvalidTokenError(rawMsg, provider) {
  const msg = String(rawMsg || '').trim();
  if (!/invalid token|token无效|令牌无效|invalid api key|incorrect api key/i.test(msg)) {
    return null;
  }
  const label = PROVIDER_LABELS[provider] || provider || 'API';
  const hints = {
    aiyiwei: `${label} Key 无效或已过期。请前往 https://aiyiwei.vip 控制台完整复制 sk- 开头的 Key（勿含空格）`,
    juhe: `${label} Key 无效。请检查聚合平台 Key，或在设置中切换服务商后重新验证`,
    openrouter: `${label} Key 无效。请前往 https://openrouter.ai/keys 复制 sk-or- 开头的 Key`,
    groq: `${label} Key 无效。请前往 https://console.groq.com/keys 检查 gsk_ 开头的 Key`,
    siliconflow: `${label} Key 无效。请前往 SiliconFlow 控制台检查 Key`,
  };
  return hints[provider] || `${label} Key 无效（${msg}），请在设置中重新填写并验证`;
}

/** 请求前校验 Key 前缀与所选服务商一致，避免 sk- 聚合 Key 误打到爱易威 */
export function validateKeyForProvider(provider, apiKey) {
  const key = normalizeApiKey(apiKey);
  if (!key) return;

  if (provider === 'openrouter' && !key.startsWith('sk-or-')) {
    throw Object.assign(
      new Error(
        'Key 与服务商不匹配：OpenRouter 需 sk-or- 开头。请切换为 OpenRouter，或改用爱易威/聚合的 sk- Key'
      ),
      { status: 400 }
    );
  }
  if (provider === 'groq' && !key.startsWith('gsk_')) {
    throw Object.assign(
      new Error('Key 与服务商不匹配：Groq 需 gsk_ 开头'),
      { status: 400 }
    );
  }
  if (key.startsWith('sk-or-') && provider !== 'openrouter') {
    throw Object.assign(
      new Error(
        'Key 与服务商不匹配：这是 OpenRouter Key（sk-or-）。请在设置中将服务商切换为 OpenRouter'
      ),
      { status: 400 }
    );
  }
  if (key.startsWith('gsk_') && provider !== 'groq') {
    throw Object.assign(
      new Error('Key 与服务商不匹配：这是 Groq Key（gsk_）。请在设置中切换为 Groq'),
      { status: 400 }
    );
  }
}

export { normalizeApiKey };
