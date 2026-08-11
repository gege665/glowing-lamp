/**
 * 联系人兴趣关键词提取（高精度规则，优先低误报）
 * 目标：误识别率 < 5% —— 只在强模式命中时收录
 */
import type { ChatMessage } from '../types';
import { getMessageContentForAnalysis } from './targetedReply';

export const PARTNER_TAG_PRESETS = ['女1', '女2', '女3', '暧昧', '追求中', '冷淡', '重要'] as const;
export type PartnerTagPreset = (typeof PARTNER_TAG_PRESETS)[number];

const MAX_KEYWORDS = 24;
const MAX_KW_LEN = 16;

/** 强置信兴趣/特征模式（须含明确态度词，避免闲聊噪声） */
const INTEREST_PATTERNS: Array<{ re: RegExp; toKeyword: (m: RegExpMatchArray) => string | null }> = [
  {
    re: /(?:很|超|特别|挺|真的)?喜欢(?:上)?([^，。！？\n、]{2,10})/,
    toKeyword: (m) => {
      const t = clean(m[1]);
      if (!t || STOP.has(t)) return null;
      return `喜欢${t}`;
    },
  },
  {
    re: /(?:爱|热爱)(?:上)?([^，。！？\n、]{2,8})/,
    toKeyword: (m) => {
      const t = clean(m[1]);
      if (!t || STOP.has(t) || /你|他|她/.test(t)) return null;
      return `爱${t}`;
    },
  },
  {
    re: /不(?:太)?喜欢([^，。！？\n、]{2,10})/,
    toKeyword: (m) => {
      const t = clean(m[1]);
      if (!t || STOP.has(t)) return null;
      return `不喜欢${t}`;
    },
  },
  {
    re: /(?:平时|经常|总是)?(?:爱|喜欢)?(?:唱|听)歌/,
    toKeyword: () => '爱唱歌',
  },
  {
    re: /喜欢(?:没事|发呆|宅家|待着)/,
    toKeyword: (m) => (m[0].includes('没事') ? '喜欢没事' : clean(m[0])),
  },
  {
    re: /喜欢(?:运动|跑步|健身|打球|游泳|瑜伽)/,
    toKeyword: (m) => clean(m[0]) || '喜欢运动',
  },
  {
    re: /(?:养|有)(?:了)?(?:一|两|三)?(?:只|条|个)?(猫|狗|宠物)/,
    toKeyword: (m) => `有${m[1]}`,
  },
  {
    re: /(?:是|做)(.{0,4}?)(?:老师|护士|设计师|程序员|学生)/,
    toKeyword: (m) => {
      const full = m[0].replace(/^(?:是|做)/, '');
      return clean(full);
    },
  },
];

const STOP = new Set([
  '这样',
  '那样',
  '什么',
  '你',
  '我',
  '啊',
  '呀',
  '呢',
  '的',
  '了',
  '嘛',
  '哈哈',
  '呵呵',
  '东西',
  '这个',
  '那个',
]);

function clean(s: string): string {
  return s
    .trim()
    .replace(/[的得地了啊呀呢嘛哦嗯哈嘿]+$/g, '')
    .replace(/\s+/g, '')
    .slice(0, MAX_KW_LEN);
}

function normalizeKey(k: string): string {
  return k.trim().toLowerCase();
}

/** 从对方发言提取兴趣关键词 */
export function extractInterestKeywords(messages: ChatMessage[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (kw: string | null) => {
    if (!kw) return;
    const t = kw.trim().slice(0, MAX_KW_LEN);
    if (t.length < 2) return;
    const key = normalizeKey(t);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  for (const msg of messages) {
    if (msg.role !== 'other' || !msg.content?.trim()) continue;
    const core = getMessageContentForAnalysis(msg.content);
    // 过短闲聊不提取，降误报
    if (core.length < 4) continue;
    for (const { re, toKeyword } of INTEREST_PATTERNS) {
      const m = core.match(re);
      if (m) push(toKeyword(m));
    }
  }

  return out.slice(0, MAX_KEYWORDS);
}

/** 合并关键词（去重保序） */
export function mergeInterestKeywords(existing: string[], additions: string[]): string[] {
  const lines = [...(existing ?? [])].map((s) => s.trim()).filter(Boolean);
  const seen = new Set(lines.map(normalizeKey));
  for (const raw of additions) {
    const t = raw.trim().slice(0, MAX_KW_LEN);
    if (t.length < 2) continue;
    const key = normalizeKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(t);
  }
  return lines.slice(0, MAX_KEYWORDS);
}

/** 规范化标签列表 */
export function normalizePartnerTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const s = String(t ?? '').trim().slice(0, 12);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.slice(0, 8);
}
