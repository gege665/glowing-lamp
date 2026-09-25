/**
 * 聚合 API（Juhe）· OpenAI 兼容配置
 * 与 https://api.juheapi.com/v1/chat/completions 对接
 */
export const JUHE_API_BASE_URL = 'https://api.juheapi.com/v1';
export const JUHE_CHAT_COMPLETIONS_URL = `${JUHE_API_BASE_URL}/chat/completions`;
export const JUHE_DEFAULT_CHAT_MODEL = 'gpt-5.4-mini';

/** 浏览器内请走 /api/chat 代理，勿在前端硬编码 Key */
export const JUHE_CLIENT_FETCH_EXAMPLE = `// 推荐：使用项目内置 getSoulChatReplies（走 /api/chat 代理，Key 更安全）
import { getSoulChatReplies } from './services/aiService';

const replies = await getSoulChatReplies('对方说的话', '温柔一点');
// replies → string[] 共 5 条

// 原生 fetch（仅开发调试；生产请配置 JUHE_API_KEY 环境变量）
const API_BASE_URL = "${JUHE_API_BASE_URL}";
const res = await fetch(\`\${API_BASE_URL}/chat/completions\`, {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_JUHE_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "${JUHE_DEFAULT_CHAT_MODEL}",
    messages: [
      { role: "system", content: "你是 Soul 聊天心理助手…" },
      { role: "user", content: "对方说：…" },
    ],
    temperature: 0.85,
    max_tokens: 600,
  }),
});`;
