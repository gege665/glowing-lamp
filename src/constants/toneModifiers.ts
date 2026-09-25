/** 快捷语气微调 · 可多选叠加 */
export type ToneModifierId = 'more_flirt' | 'more_steady' | 'shorter';

export const TONE_MODIFIER_HINTS: {
  id: ToneModifierId;
  label: string;
  prompt: string;
}[] = [
  {
    id: 'more_flirt',
    label: '更撩一点',
    prompt: '轻微暧昧、留悬念，可夸细节或语气带点坏，但不表白、不油腻、不土味。',
  },
  {
    id: 'more_steady',
    label: '更稳一点',
    prompt: '松弛有框架，不舔不查户口，不急着解释目的，像见过世面的正常人。',
  },
  {
    id: 'shorter',
    label: '更短',
    prompt: '每条 8～18 字，能 6 字说完更好，禁止长句和客套铺垫。',
  },
];

export const DEFAULT_TONE_MODIFIERS: ToneModifierId[] = [
  'more_flirt',
  'more_steady',
  'shorter',
];

export function normalizeToneModifiers(raw: unknown): ToneModifierId[] {
  const valid = new Set(TONE_MODIFIER_HINTS.map((h) => h.id));
  if (!Array.isArray(raw)) return [...DEFAULT_TONE_MODIFIERS];
  return raw.filter(
    (id): id is ToneModifierId => typeof id === 'string' && valid.has(id as ToneModifierId)
  );
}

export function toggleToneModifier(
  current: ToneModifierId[],
  id: ToneModifierId
): ToneModifierId[] {
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
}

export function buildToneModifierBlock(
  modifiers: ToneModifierId[],
  legacyTone?: string
): string {
  const parts: string[] = [];
  for (const hint of TONE_MODIFIER_HINTS) {
    if (modifiers.includes(hint.id)) parts.push(`· ${hint.label}：${hint.prompt}`);
  }
  if (legacyTone?.trim()) parts.push(`· 额外要求：${legacyTone.trim()}`);
  if (!parts.length) return '';
  return `【语气微调】\n${parts.join('\n')}`;
}

/** 根据语气微调返回字数上限 */
export function getReplyLengthCap(modifiers: ToneModifierId[]): number {
  return modifiers.includes('shorter') ? 22 : 40;
}

export function getReplyLengthRule(modifiers: ToneModifierId[]): string {
  if (modifiers.includes('shorter')) {
    return '一句话口语原话，8～18 字为佳，最多不超过 22 字，像微信随手打';
  }
  return '一句话口语原话，约 15～35 字，可带～、？，像真人私信';
}
