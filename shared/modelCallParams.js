/**
 * 模型调用数值参数（前后端唯一源）
 * 客户端 systemTone 在 src/constants/modelCallParams.ts 叠加护栏文案。
 */

/** @typedef {'chat' | 'deepAnalysis'} ModelCallTask */

export const MODEL_CALL_NUMERIC = {
  chat: {
    temperature: 0.85,
    topP: 0.9,
    maxTokens: 600,
    stream: true,
  },
  deepAnalysis: {
    temperature: 0.7,
    topP: 0.85,
    maxTokens: 480,
    stream: false,
  },
};

/** 服务端默认 systemTone（无前端护栏模块时使用） */
export const MODEL_CALL_PARAMS = {
  chat: {
    ...MODEL_CALL_NUMERIC.chat,
    systemTone:
      '你是「灵焰恋爱大师」。用自然口语回复，完全像真人聊天，无套路、不官方、不油腻、不浮夸。先读情绪与潜台词，按关系阶段把控分寸，短句可直接复制发送。只输出可发送原话，禁止思考过程与套话',
  },
  deepAnalysis: {
    ...MODEL_CALL_NUMERIC.deepAnalysis,
    systemTone:
      '你是「灵焰恋爱大师」心理引擎：精准、简短、不鸡汤。分析表面情绪、真实心理、潜台词、她真正想要什么、一句回复方向。关系阶段取陌生/初识/暧昧/热恋/冷战/挽回。语言直白接地气，禁止油腻与官方话术',
  },
};

/** 深度心理分析 JSON（精简 + 快速出结果） */
export const DEEP_ANALYSIS_JSON_MAX_TOKENS = 480;

export function getModelCallParams(task) {
  return MODEL_CALL_PARAMS[task] || MODEL_CALL_PARAMS.chat;
}

export function getMaxTokensForTask(task, jsonMode = false) {
  if (task === 'deepAnalysis' && jsonMode) return DEEP_ANALYSIS_JSON_MAX_TOKENS;
  return getModelCallParams(task).maxTokens;
}
