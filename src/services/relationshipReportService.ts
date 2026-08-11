import type { AnalysisResult, ChatMessage, UserSettings } from '../types';
import { loadSettings } from './storageService';
import {
  RELATIONSHIP_REPORT_SYSTEM,
  LINGYAN_RELATIONSHIP_DATA_DIRECTIVE,
  computeChatMetrics,
  buildLocalRelationshipReport,
  buildRelationshipReportUserPrompt,
  parseRelationshipReport,
  type RelationshipDataReport,
} from '../constants/relationshipReport';
import { assertApiKeyConfigured, postChatCompletion } from './clientChatApi';

async function callReportApi(
  cfg: UserSettings,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  return postChatCompletion({
    settings: cfg,
    systemPrompt: `${RELATIONSHIP_REPORT_SYSTEM}\n${LINGYAN_RELATIONSHIP_DATA_DIRECTIVE}`,
    userContent: userPrompt,
    task: 'deepAnalysis',
    signal,
    temperature: 0.55,
    maxTokens: 900,
  });
}

/** 生成完整关系数据分析报告 */
export async function generateRelationshipDataReport(
  messages: ChatMessage[],
  settings?: UserSettings,
  analysis?: AnalysisResult | null,
  opts?: { localOnly?: boolean; signal?: AbortSignal }
): Promise<RelationshipDataReport> {
  const cfg = settings ?? loadSettings();
  const metrics = computeChatMetrics(messages, cfg, analysis);

  if (!messages.some((m) => m.content?.trim())) {
    return {
      ...buildLocalRelationshipReport(metrics, analysis),
      summary: '暂无聊天记录，先粘贴双方对话后再生成关系报告。',
      shortfalls: ['缺少聊天样本'],
      nextActions: ['在聊天页粘贴对方消息与你的回复', '积累数轮后再点生成报告'],
    };
  }

  if (opts?.localOnly) {
    return buildLocalRelationshipReport(metrics, analysis);
  }

  try {
    await assertApiKeyConfigured(cfg);
    const prompt = buildRelationshipReportUserPrompt(messages, cfg, metrics, analysis);
    const raw = await callReportApi(cfg, prompt, opts?.signal);
    const parsed = parseRelationshipReport(raw, metrics);
    if (parsed) {
      // 补齐空策略
      const local = buildLocalRelationshipReport(metrics, analysis);
      return {
        ...parsed,
        warmUpStrategy: parsed.warmUpStrategy.length
          ? parsed.warmUpStrategy
          : local.warmUpStrategy,
        improveDirections: parsed.improveDirections.length
          ? parsed.improveDirections
          : local.improveDirections,
        nextActions: parsed.nextActions.length ? parsed.nextActions : local.nextActions,
        bestTiming: parsed.bestTiming || local.bestTiming,
        summary: parsed.summary || local.summary,
      };
    }
    return buildLocalRelationshipReport(metrics, analysis);
  } catch {
    return buildLocalRelationshipReport(metrics, analysis);
  }
}
