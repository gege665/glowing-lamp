/** @typedef {'chat' | 'deepAnalysis'} ModelCallTask */

export const MODEL_CALL_PARAMS = {
  chat: {
    temperature: 0.85,
    topP: 0.9,
    maxTokens: 600,
    stream: true,
    systemTone:
      '用自然口语回复，完全像真人聊天，不官方、不油腻。先接住对方情绪，短句口语，共情优先。需要时可自然引导加微信。只输出可发送原话，禁止思考过程与套话',
  },
  deepAnalysis: {
    temperature: 0.8,
    topP: 0.9,
    maxTokens: 800,
    stream: false,
    systemTone:
      '你是女性心理穿透分析师，精准、简短、不鸡汤。分析表面情绪、真实心理状态、潜台词、她真正想要什么、一句回复方向。语言直白接地气，禁止油腻与官方话术',
  },
};

export const DEEP_ANALYSIS_JSON_MAX_TOKENS = 2800;

export function getModelCallParams(task) {
  return MODEL_CALL_PARAMS[task] || MODEL_CALL_PARAMS.chat;
}

export function getMaxTokensForTask(task, jsonMode = false) {
  if (task === 'deepAnalysis' && jsonMode) return DEEP_ANALYSIS_JSON_MAX_TOKENS;
  return getModelCallParams(task).maxTokens;
}
