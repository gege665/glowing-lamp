/** 爱易威模型路由后缀（与 shared/aiyiweiRouting.js 保持一致） */
const SUFFIX_PATTERN = /:(floor|nitro|stable)$/i;

export function stripAiyiweiRoutingSuffix(modelId: string | undefined | null): string {
  return String(modelId || '').replace(SUFFIX_PATTERN, '');
}
