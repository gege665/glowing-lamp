import type { UserSettings, ChatMessage, MyProfileCard, OtherProfileCard } from '../types';
import { buildSceneStylePromptBlock } from '../constants/coreReplyStyles';
import {
  MY_PROFILE_DIMENSIONS,
  OTHER_PROFILE_DIMENSIONS,
  DUAL_PROFILE_CUSTOM_DIRECTIVE,
  countFilledFields,
} from '../constants/dualProfile';
import { buildChatMemoryBlock } from './chatMemory';
import { buildHighValuePromptBlock } from '../constants/highValueChat';
import { LINGYAN_SPEECH_GUARD_BRIEF } from '../constants/speechGuardrails';

/** 多对象隔离：AI 只服务当前聊天对象 */
export const LINGYAN_MULTI_PARTNER_DIRECTIVE = `【灵焰多对象独立管理模式 · 强制遵守】
- 当前会话仅对应「一个」聊天对象；其档案、记忆、关系数据、聊天记录均已隔离。
- 禁止引用、猜测或混入其他人物的信息；回复与推进策略必须只针对当前对方。
- 若对方称呼、资料卡或记忆有冲突，以当前工作区数据为准。`;

function hasContent(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function buildMyProfileLines(mp: MyProfileCard): string[] {
  return MY_PROFILE_DIMENSIONS.map((d) => {
    const v = mp[d.key as keyof MyProfileCard];
    return hasContent(v) ? `${d.label}：${String(v).trim()}` : '';
  }).filter(Boolean);
}

function buildOtherProfileLines(op: OtherProfileCard): string[] {
  return OTHER_PROFILE_DIMENSIONS.map((d) => {
    const v = op[d.key as keyof OtherProfileCard];
    return hasContent(v) ? `${d.label}：${String(v).trim()}` : '';
  }).filter(Boolean);
}

export function getDualProfileFillStats(settings: UserSettings): {
  myFilled: number;
  myTotal: number;
  otherFilled: number;
  otherTotal: number;
  active: boolean;
} {
  const myFilled = countFilledFields(
    settings.myProfile as unknown as Record<string, string>,
    MY_PROFILE_DIMENSIONS
  );
  const otherFilled = countFilledFields(
    settings.otherProfile as unknown as Record<string, string>,
    OTHER_PROFILE_DIMENSIONS
  );
  return {
    myFilled,
    myTotal: MY_PROFILE_DIMENSIONS.length,
    otherFilled,
    otherTotal: OTHER_PROFILE_DIMENSIONS.length,
    active: myFilled + otherFilled > 0,
  };
}

/** 双资料卡 + 记忆 → AI 上下文块（强制一对一定制） */
export function buildProfileContextBlock(
  settings: UserSettings,
  messages: ChatMessage[] = []
): string {
  const parts: string[] = [
    LINGYAN_MULTI_PARTNER_DIRECTIVE,
    LINGYAN_SPEECH_GUARD_BRIEF,
    buildHighValuePromptBlock(settings),
  ];
  const nickname = settings.otherNickname?.trim();
  if (nickname) {
    parts.push(`【当前聊天对象】${nickname}（仅此人；勿与其他对象混淆）`);
  }
  const myLines = buildMyProfileLines(settings.myProfile);
  const otherLines = buildOtherProfileLines(settings.otherProfile);
  const stats = getDualProfileFillStats(settings);

  if (stats.active) {
    parts.push(DUAL_PROFILE_CUSTOM_DIRECTIVE);
  }

  if (myLines.length) {
    parts.push(
      `【本人资料卡 · ${stats.myFilled}/${stats.myTotal} 项已填 · 严格模仿其人设与说话方式】\n${myLines.join('\n')}`
    );
  }

  if (otherLines.length) {
    parts.push(
      `【对方资料卡 · ${stats.otherFilled}/${stats.otherTotal} 项已填 · 规避禁忌、贴合喜好】\n${otherLines.join('\n')}`
    );
  }

  const memoryBlock = buildChatMemoryBlock(settings, messages);
  if (memoryBlock) parts.push(memoryBlock);

  const sceneBlock = buildSceneStylePromptBlock(settings);
  if (sceneBlock) parts.unshift(sceneBlock);

  return parts.length ? parts.join('\n\n') : '';
}
