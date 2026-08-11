/**
 * 客户端模型调用参数：数值来自 shared，systemTone 仅保留短基调。
 * 完整人设/教练/实战细则已在 COMPACT_* system 与 user 上下文中，避免重复堆叠拖慢首包。
 * 修改 temperature / maxTokens 时请同步 shared/modelCallParams.js。
 */
import {
  MODEL_CALL_NUMERIC,
  DEEP_ANALYSIS_JSON_MAX_TOKENS as SHARED_JSON_MAX,
  getMaxTokensForTask as sharedGetMaxTokens,
} from '../../shared/modelCallParams.js';
import {
  MAI_DS_R1_ANALYSIS_TONE,
  DOUBAO_REPLY_TONE,
} from './promptTemplates';
import { LINGYAN_SPEECH_GUARD_BRIEF } from './speechGuardrails';

export type ModelCallTask = 'chat' | 'deepAnalysis';

export interface ModelCallParams {
  temperature: number;
  topP: number;
  maxTokens: number;
  stream: boolean;
  /** 可叠加在风格 prompt 前的口语化基调 */
  systemTone: string;
}

export const DEEP_ANALYSIS_JSON_MAX_TOKENS = SHARED_JSON_MAX;

/**
 * 精简 systemTone：COMPACT_REPLY / COMPACT_ANALYSIS 已含完整规则，
 * 此处只补短基调 + 净语摘要，显著削减每次请求的 input tokens。
 */
export const MODEL_CALL_PARAMS: Record<ModelCallTask, ModelCallParams> = {
  chat: {
    ...MODEL_CALL_NUMERIC.chat,
    systemTone: `${DOUBAO_REPLY_TONE}\n\n${LINGYAN_SPEECH_GUARD_BRIEF}`,
  },
  deepAnalysis: {
    ...MODEL_CALL_NUMERIC.deepAnalysis,
    systemTone: `${MAI_DS_R1_ANALYSIS_TONE}\n\n${LINGYAN_SPEECH_GUARD_BRIEF}`,
  },
};

export function getModelCallParams(task: ModelCallTask): ModelCallParams {
  return MODEL_CALL_PARAMS[task];
}

export function getMaxTokensForTask(task: ModelCallTask, jsonMode = false): number {
  return sharedGetMaxTokens(task, jsonMode);
}

export function mergeSystemPrompt(tone: string, styleOrMainPrompt: string): string {
  const main = styleOrMainPrompt.trim();
  if (!tone.trim()) return main;
  if (main.includes(tone.trim())) return main;
  return `${tone.trim()}\n\n${main}`;
}

/** 估算 chat systemTone 字符数（性能回归守卫） */
export function estimateChatSystemToneChars(): number {
  return MODEL_CALL_PARAMS.chat.systemTone.length;
}

/** 估算分析 systemTone 字符数（性能回归守卫） */
export function estimateAnalysisSystemToneChars(): number {
  return MODEL_CALL_PARAMS.deepAnalysis.systemTone.length;
}
