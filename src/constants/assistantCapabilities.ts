import { PRODUCT_FEATURES } from './productFeatures';

/** Soul 助手核心能力（prompt + UI 展示 · 与产品功能对齐） */
export const ASSISTANT_CAPABILITIES = PRODUCT_FEATURES.filter(
  (f) => !('comingSoon' in f && f.comingSoon)
).map((f) => ({
  id: f.id,
  title: f.title,
  summary: f.summary,
  badge: 'badge' in f ? f.badge : undefined,
}));

export function buildCapabilitiesPromptBlock(): string {
  const lines = ASSISTANT_CAPABILITIES.map(
    (item, index) => `${index + 1}.${item.title}：${item.summary}`
  );
  return `拥有以下核心能力：\n${lines.join('\n')}`;
}
