import {
  MAI_DS_R1_ANALYSIS_TONE,
  DOUBAO_REPLY_TONE,
} from './promptTemplates';

export type ModelCallTask = 'chat' | 'deepAnalysis';

export interface ModelCallParams {
  temperature: number;
  topP: number;
  maxTokens: number;
  stream: boolean;
  /** 可叠加在风格 prompt 前的口语化基调 */
  systemTone: string;
}

export const MODEL_CALL_PARAMS: Record<ModelCallTask, ModelCallParams> = {
  chat: {
    temperature: 0.85,
    topP: 0.9,
    maxTokens: 600,
    stream: true,
    systemTone: DOUBAO_REPLY_TONE,
  },
  deepAnalysis: {
    temperature: 0.7,
    topP: 0.85,
    maxTokens: 480,
    stream: false,
    systemTone: MAI_DS_R1_ANALYSIS_TONE,
  },
};

/** 深度心理分析 JSON（精简 + 豆包快速出结果） */
export const DEEP_ANALYSIS_JSON_MAX_TOKENS = 480;

export function getModelCallParams(task: ModelCallTask): ModelCallParams {
  return MODEL_CALL_PARAMS[task];
}

export function getMaxTokensForTask(task: ModelCallTask, jsonMode = false): number {
  if (task === 'deepAnalysis' && jsonMode) return DEEP_ANALYSIS_JSON_MAX_TOKENS;
  return MODEL_CALL_PARAMS[task].maxTokens;
}

export function mergeSystemPrompt(tone: string, styleOrMainPrompt: string): string {
  const main = styleOrMainPrompt.trim();
  if (!tone.trim()) return main;
  if (main.includes(tone.trim())) return main;
  return `${tone.trim()}\n\n${main}`;
}
