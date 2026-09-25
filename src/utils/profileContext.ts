import type { UserSettings, ChatMessage } from '../types';
import { buildSceneStylePromptBlock } from '../constants/coreReplyStyles';
import { buildChatMemoryBlock } from './chatMemory';

function hasContent(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/** 双资料卡 + 记忆 → AI 上下文块 */
export function buildProfileContextBlock(
  settings: UserSettings,
  messages: ChatMessage[] = []
): string {
  const parts: string[] = [];
  const mp = settings.myProfile;
  const op = settings.otherProfile;

  const myLines = [
    hasContent(mp.hobbies) && `爱好：${mp.hobbies.trim()}`,
    hasContent(mp.experiences) && `经历：${mp.experiences.trim()}`,
    hasContent(mp.strengths) && `闪光点：${mp.strengths.trim()}`,
    hasContent(mp.topics) && `擅长话题：${mp.topics.trim()}`,
  ].filter(Boolean);

  if (myLines.length) {
    parts.push(`【本人资料卡 · 自然穿插优势，勿刻意炫耀】\n${myLines.join('\n')}`);
  }

  const otherLines = [
    hasContent(op.likes) && `喜好：${op.likes.trim()}`,
    hasContent(op.dislikes) && `禁忌：${op.dislikes.trim()}`,
    hasContent(op.personality) && `性格：${op.personality.trim()}`,
    hasContent(op.habits) && `习惯：${op.habits.trim()}`,
    hasContent(op.experiences) && `经历：${op.experiences.trim()}`,
    hasContent(op.dreams) && `心愿：${op.dreams.trim()}`,
    hasContent(op.notes) && `备忘：${op.notes.trim()}`,
  ].filter(Boolean);

  if (otherLines.length) {
    parts.push(`【对方资料卡 · 抓取共同点，定制共鸣回复】\n${otherLines.join('\n')}`);
  }

  const memoryBlock = buildChatMemoryBlock(settings, messages);
  if (memoryBlock) parts.push(memoryBlock);

  const sceneBlock = buildSceneStylePromptBlock(settings);
  if (sceneBlock) parts.unshift(sceneBlock);

  return parts.length ? parts.join('\n\n') : '';
}
