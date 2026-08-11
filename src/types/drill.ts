/** 全场景模拟演练 · 类型 */

export type DrillMsgRole = 'me' | 'her' | 'system';

export interface DrillMessage {
  id: string;
  role: DrillMsgRole;
  content: string;
  timestamp: number;
}

export interface DrillCoachFeedback {
  score: number;
  herEmotion: string;
  problems: string[];
  betterReplies: string[];
  tip: string;
}

export const EMPTY_DRILL_FEEDBACK: DrillCoachFeedback = {
  score: 0,
  herEmotion: '',
  problems: [],
  betterReplies: [],
  tip: '',
};
