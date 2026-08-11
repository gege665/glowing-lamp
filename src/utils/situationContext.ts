import type { ChatMessage, UserSettings } from '../types';
import type { ChatSceneId } from '../constants/coreReplyStyles';
import { getChatScene } from '../constants/coreReplyStyles';
import {
  detectMessageIntent,
  getMessageContentForAnalysis,
  isFriendApprovalMessage,
} from './targetedReply';

export function getLastOtherMessage(
  messages: ChatMessage[],
  targetMessage?: string
): string {
  if (targetMessage?.trim()) return targetMessage.trim();
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'other') return messages[i].content.trim();
  }
  return '';
}

/** 根据对话内容推断场景（用户未手动选场景时） */
export function inferChatScene(
  messages: ChatMessage[],
  lastOther: string
): ChatSceneId | '' {
  const core = getMessageContentForAnalysis(lastOther);

  if (!core) {
    const hasOther = messages.some((m) => m.role === 'other' && m.content.trim());
    return hasOther ? '' : 'first_add';
  }

  if (isFriendApprovalMessage(lastOther)) return 'first_add';

  const intent = detectMessageIntent(lastOther);

  if (/生气|烦死了|讨厌你|滚|无语了|别烦|拉黑/.test(core)) return 'angry';
  if (/^(嗯|哦|好|行|哈哈|呵呵|😂|🙂|👌)[。!！?？~～…]*$/u.test(core)) return 'perfunctory';
  if (/见面|出来玩|有空吗|约|喝.*(咖啡|奶茶)|一起吃/.test(core)) return 'invite';
  if (/喜欢我|对我有意思|是不是.*(喜欢|对我)|试探/.test(core)) return 'test_feelings';
  if (/和好|别生气|对不起|刚才.*(不对|冲动)/.test(core)) return 'make_up';
  if (intent.asksIdentity || intent.asksPurpose || intent.isWary) return 'first_add';

  const recent = messages.filter((m) => m.content.trim()).slice(-4);
  if (
    recent.length >= 3 &&
    recent.filter((m) => m.content.trim().length <= 8).length >= 2
  ) {
    return 'cold_chat';
  }

  if (/想你|抱抱|心动|暧昧|靠近|聊得.*开心/.test(core)) return 'closer';

  return '';
}

/** 是否走「刚加好友开场」指南（有实质质问时不走） */
export function shouldUseOpeningGuide(lastOther: string, chatScene?: string): boolean {
  if (chatScene !== 'first_add' && !isFriendApprovalMessage(lastOther)) return false;
  const intent = detectMessageIntent(lastOther);
  return !intent.asksIdentity && !intent.asksPurpose && !intent.isWary;
}

/** 近期对话摘要 · 供话术接上文 */
export function buildRecentChatSnippet(
  messages: ChatMessage[],
  settings: UserSettings,
  limit = 8
): string {
  const trimmed = messages.filter((m) => m.content.trim());
  if (trimmed.length < 2) return '';

  return trimmed
    .slice(-limit)
    .map((m) => {
      const name = m.role === 'me' ? settings.myNickname : settings.otherNickname;
      return `${name}：${m.content.trim()}`;
    })
    .join('\n');
}

/** 合并手动场景 + 自动推断 */
export function resolveSituationSettings(
  settings: UserSettings,
  messages: ChatMessage[],
  targetMessage?: string
): UserSettings {
  const lastOther = getLastOtherMessage(messages, targetMessage);
  const inferred = inferChatScene(messages, lastOther);
  if (settings.chatScene || !inferred) return settings;
  return { ...settings, chatScene: inferred };
}

/** 界面展示 · 当前识别到的情况 */
export function describeSituation(
  settings: UserSettings,
  messages: ChatMessage[],
  targetMessage?: string
): string {
  const effective = resolveSituationSettings(settings, messages, targetMessage);
  const lastOther = getLastOtherMessage(messages, targetMessage);
  const scene = getChatScene(effective.chatScene);
  const intent = lastOther ? detectMessageIntent(lastOther) : null;

  if (!lastOther) {
    return scene ? `${scene.label} · 开场话术` : '根据场景生成开场';
  }
  if (intent?.asksIdentity) return '对方在问你是谁 · 先答身份';
  if (intent?.asksPurpose) return '对方在问什么事 · 直接说目的';
  if (intent?.isWary) return '对方有防备 · 先稳再聊';
  if (isFriendApprovalMessage(lastOther)) return '刚通过好友 · 发第一条';
  if (scene) return `${scene.label} · 接「${getMessageContentForAnalysis(lastOther).slice(0, 12)}${lastOther.length > 12 ? '…' : ''}」`;
  return `接对方最后一句 · ${getMessageContentForAnalysis(lastOther).slice(0, 16)}${lastOther.length > 16 ? '…' : ''}`;
}

/** 话术生成用 · 情况说明块 */
export function buildSituationContextBlock(
  settings: UserSettings,
  messages: ChatMessage[],
  targetMessage?: string
): string {
  const effective = resolveSituationSettings(settings, messages, targetMessage);
  const lastOther = getLastOtherMessage(messages, targetMessage);
  const snippet = buildRecentChatSnippet(messages, effective);
  const scene = getChatScene(effective.chatScene);
  const lines: string[] = ['【根据情况回复 · 最高优先级】'];

  if (scene) {
    lines.push(`· 当前情况：${scene.label} — ${scene.prompt}`);
  } else if (lastOther) {
    lines.push('· 当前情况：日常接话，紧扣对方最后一句');
  } else {
    lines.push('· 当前情况：无对方消息，按场景写开场第一句');
  }

  if (snippet) {
    lines.push(`· 近期对话（须接上文，禁止突兀换话题）：\n${snippet}`);
  }

  if (lastOther && !shouldUseOpeningGuide(lastOther, effective.chatScene)) {
    lines.push('· 须正面回应她最后一句里的问题/情绪，禁止套话和答非所问');
  }

  return lines.join('\n');
}
