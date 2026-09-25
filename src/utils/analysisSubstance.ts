import type { AnalysisResult } from '../types';

type AnalysisCore = Omit<AnalysisResult, 'replies' | 'topReplies'>;

/** 空壳 / 占位分析：几乎没有可用洞察 */
export function isThinAnalysisResult(result: AnalysisCore): boolean {
  const summary = (result.summary || '').trim();
  const placeholderSummary =
    !summary ||
    summary === '分析完成' ||
    summary === '未知' ||
    summary.startsWith('【本地摘要】');

  let substance = 0;
  if (summary && !placeholderSummary && summary.length >= 4) substance += 2;
  if (result.emotion?.primary && result.emotion.primary !== '未知') substance += 1;
  if (result.psychology?.subtext?.trim()) substance += 1;
  if (result.psychology?.emotionalState?.trim()) substance += 1;
  if (result.strategy?.nextMove?.trim()) substance += 1;
  if (result.femalePsychology?.scenarioTip?.trim()) substance += 1;
  if (result.deepReport?.trim()) substance += 1;
  if (result.intentInsight?.trim()) substance += 1;
  if ((result.strategyCards?.length ?? 0) > 0) substance += 1;
  return substance < 2;
}
