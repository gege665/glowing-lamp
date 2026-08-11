import {
  FLIRT_REPLY_STYLES,
  DAILY_REPLY_STYLES,
  INTIMATE_REPLY_STYLES,
} from '../constants/replyStylePrompts';
import { lineLooksLikeReasoningLeak, lineLooksLikeMetaInstruction } from './replyQuality';

const STYLE_LABELS = [
  ...new Set(
    [...FLIRT_REPLY_STYLES, ...DAILY_REPLY_STYLES, ...INTIMATE_REPLY_STYLES].map((s) => s.label)
  ),
];

const QUOTE_EXTRACTORS = [
  /例如[：:]\s*[「『]([^」』]+)[」』]/,
  /例如[：:]\s*[""]([^""]+)[""]/,
  /例如[：:]\s*['']([^'']+)['']/,
  /例如[：:]\s*([^。；\n]{6,50})/,
  /比如[：:]\s*[「『]([^」』]+)[」』]/,
  /比如[：:]\s*[""]([^""]+)[""]/,
  /比如[：:]\s*([^。；\n]{6,50})/,
];

/** 从「例如：xxx」或引号中抢救可发送原话 */
export function salvageReplyLine(raw: string): string {
  const line = raw.trim();
  if (!line) return '';

  for (const pattern of QUOTE_EXTRACTORS) {
    const m = line.match(pattern);
    if (m?.[1]) {
      const candidate = m[1].replace(/[。「」』""'']+$/, '').trim();
      if (candidate.length >= 6 && candidate.length <= 55) return candidate;
    }
  }

  const tailAfterRule = line.match(
    /(?:不能太长|注意每条|的元素)[。．]\s*([\u4e00-\u9fa5，？！～、\s]{8,55}[。．]?)$/
  );
  if (tailAfterRule?.[1]) {
    return tailAfterRule[1].replace(/[。．]+$/, '').trim();
  }

  if (/^第\s*\d+\s*条/.test(line) || /例如[：:]|比如[：:]/.test(line)) {
    const quoted = line.match(/[「『]([^」』]{6,50})[」』]/);
    if (quoted?.[1]) return quoted[1].trim();
    return '';
  }

  if (lineLooksLikeMetaInstruction(line)) {
    const quoted = line.match(/[「『""]([^」』""]{6,50})[」』""]/);
    if (quoted?.[1] && quoted[1].length < line.length * 0.65) {
      return quoted[1].trim();
    }
    return '';
  }

  return line;
}

/** 去掉行首编号、列表符、风格标签前缀（如「温柔：」） */
export function normalizeReplyLine(raw: string, expectedLabel?: string): string {
  let line = raw.trim();
  if (!line) return '';

  line = line.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '');

  if (expectedLabel) {
    line = line.replace(new RegExp(`^${expectedLabel}\\s*[：:]\\s*`), '');
  }

  for (const label of STYLE_LABELS) {
    line = line.replace(new RegExp(`^${label}\\s*[：:]\\s*`), '');
  }

  line = line.replace(/^第\s*\d+\s*条[：:\s]*/, '');
  line = line.replace(/^参考句[：:]\s*/, '');
  line = salvageReplyLine(line);

  if (!line || /例如[：:]|比如[：:]|表明来意|注意每条/.test(line)) return '';
  if (lineLooksLikeReasoningLeak(line) || lineLooksLikeMetaInstruction(line)) return '';
  if (line.length > 55) return '';

  return line.trim();
}
