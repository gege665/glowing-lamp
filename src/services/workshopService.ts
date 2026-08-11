import type { UserSettings } from '../types';
import { loadSettings } from './storageService';
import {
  type WorkshopCategoryId,
  WORKSHOP_SYSTEM_PROMPT,
  buildWorkshopUserPrompt,
  pickWorkshopBank,
  getWorkshopCategory,
} from '../constants/workshopCategories';
import { buildToneModifierBlock, getReplyLengthCap, type ToneModifierId } from '../constants/toneModifiers';
import { assertApiKeyConfigured, postChatCompletion } from './clientChatApi';
import { extractJsonObject } from '../utils/extractJsonObject';

function extractLines(raw: string): string[] {
  const obj = extractJsonObject(raw);
  if (obj && Array.isArray(obj.lines)) {
    return obj.lines.map((l) => String(l).trim()).filter(Boolean);
  }
  return String(raw || '')
    .split('\n')
    .map((l) => l.replace(/^\d+[.)、]\s*/, '').replace(/^[-*•]\s*/, '').trim())
    .filter((l) => l && !l.startsWith('{') && !l.startsWith('```'))
    .slice(0, 5);
}

function sanitizeLines(lines: string[], maxLen: number): string[] {
  return lines
    .map((l) =>
      l
        .replace(/^【[^】]+】\s*/, '')
        .replace(/^(破冰|续聊|暧昧|推拉|邀约|表白|哄人|冷战|挽回|接梗|价值|反怼)[:：]\s*/, '')
        .trim()
    )
    .filter((l) => l.length >= 2)
    .map((l) => (l.length > maxLen ? l.slice(0, maxLen) : l))
    .slice(0, 5);
}

async function callWorkshopApi(
  cfg: UserSettings,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  return postChatCompletion({
    settings: cfg,
    systemPrompt: WORKSHOP_SYSTEM_PROMPT,
    userContent: userPrompt,
    signal,
    temperature: 0.85,
    maxTokens: 480,
  });
}

export interface WorkshopGenerateOptions {
  categoryId: WorkshopCategoryId;
  sceneNote?: string;
  toneModifiers?: ToneModifierId[];
  tonePreference?: string;
  lastOther?: string;
  /** 仅用本地库，不调 API */
  localOnly?: boolean;
  signal?: AbortSignal;
}

/** 生成 5 条工坊话术 */
export async function generateWorkshopLines(
  opts: WorkshopGenerateOptions,
  settings?: UserSettings
): Promise<{ lines: string[]; source: 'ai' | 'bank' }> {
  const cfg = settings ?? loadSettings();
  const maxLen = getReplyLengthCap(opts.toneModifiers ?? []);
  const toneNote = [
    buildToneModifierBlock(opts.toneModifiers ?? [], opts.tonePreference),
    opts.tonePreference?.trim(),
  ]
    .filter(Boolean)
    .join('\n');

  if (opts.localOnly) {
    return {
      lines: sanitizeLines(pickWorkshopBank(opts.categoryId, 5, opts.sceneNote), maxLen),
      source: 'bank',
    };
  }

  try {
    await assertApiKeyConfigured(cfg);
    const prompt = buildWorkshopUserPrompt({
      categoryId: opts.categoryId,
      sceneNote: opts.sceneNote,
      toneNote: toneNote || undefined,
      lastOther: opts.lastOther,
      myNickname: cfg.myNickname,
    });
    const raw = await callWorkshopApi(cfg, prompt, opts.signal);
    let lines = sanitizeLines(extractLines(raw), maxLen);
    if (lines.length < 3) {
      const bank = pickWorkshopBank(opts.categoryId, 5);
      lines = sanitizeLines([...lines, ...bank], maxLen).slice(0, 5);
    }
    while (lines.length < 5) {
      const bank = pickWorkshopBank(opts.categoryId, 5);
      lines.push(bank[lines.length % bank.length]);
    }
    return { lines: lines.slice(0, 5), source: 'ai' };
  } catch {
    return {
      lines: sanitizeLines(pickWorkshopBank(opts.categoryId, 5, opts.sceneNote), maxLen),
      source: 'bank',
    };
  }
}

/** 按用户修改意见微调单条或整批 */
export async function refineWorkshopLines(
  lines: string[],
  refineNote: string,
  categoryId: WorkshopCategoryId,
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<string[]> {
  const cfg = settings ?? loadSettings();
  const cat = getWorkshopCategory(categoryId);
  try {
    await assertApiKeyConfigured(cfg);
    const prompt = `【话术微调】分类：${cat.label}
【原话术】
${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}
【修改要求】${refineNote.trim() || '更自然一点'}

保持 5 条，可直接发送，只输出 JSON：{"lines":["...","...","...","...","..."]}`;
    const raw = await callWorkshopApi(cfg, prompt, signal);
    const next = sanitizeLines(extractLines(raw), 40);
    return next.length >= 3 ? next.slice(0, 5) : lines;
  } catch {
    return lines;
  }
}
