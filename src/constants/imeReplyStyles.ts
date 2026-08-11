import type { ChatStyleType } from './chatStylePrompts';
import type { LovePersonaId } from './lovePersonas';

/** 输入法面板 9 宫格风格（对标产品示意） */
export type ImeStyleId =
  | 'spark'
  | 'rogue'
  | 'warm_guy'
  | 'topic'
  | 'ambiguous'
  | 'roast'
  | 'refuse'
  | 'humor'
  | 'master';

export interface ImeReplyStyle {
  id: ImeStyleId;
  label: string;
  emoji: string;
  chatStyle: ChatStyleType;
  lovePersona?: LovePersonaId;
  /** 叠在人设之上的额外指令 */
  directive: string;
}

export const IME_REPLY_STYLES: ImeReplyStyle[] = [
  {
    id: 'spark',
    label: '灵光乍现',
    emoji: '💡',
    chatStyle: 'all_in_one',
    directive:
      '风格：灵光乍现。给一条出其不意但自然的神回复，有小钩子、不油腻、像真人随口接的。',
  },
  {
    id: 'rogue',
    label: '浪子',
    emoji: '😈',
    chatStyle: 'push_pull',
    lovePersona: 'rogue',
    directive: '风格：浪子。话少有料、留白吊胃口，松弛拽酷，绝不卑微追问。',
  },
  {
    id: 'warm_guy',
    label: '阳光暖男',
    emoji: '😎',
    chatStyle: 'emotion_replace',
    lovePersona: 'warm_guy',
    directive: '风格：阳光暖男。先接情绪再给温度，阳光、稳、不跪舔不油。',
  },
  {
    id: 'topic',
    label: '话题延伸',
    emoji: '🥳',
    chatStyle: 'warm_up',
    lovePersona: 'rising',
    directive:
      '风格：话题延伸。顺着对方原话延展一个好接的新角度，带轻钩子，不查户口不尬转场。',
  },
  {
    id: 'ambiguous',
    label: '暧昧拉扯',
    emoji: '🥰',
    chatStyle: 'ambiguous',
    lovePersona: 'tease',
    directive: '风格：暧昧拉扯。半真半假、轻撩留想象，点到即止，不表白不土味。',
  },
  {
    id: 'roast',
    label: '怼一下',
    emoji: '🤨',
    chatStyle: 'frame_control',
    lovePersona: 'roast',
    directive: '风格：怼一下。轻度调侃反击，守住高价值，好笑但不凶不伤人。',
  },
  {
    id: 'refuse',
    label: '委婉拒绝',
    emoji: '🫣',
    chatStyle: 'emergency',
    directive:
      '风格：委婉拒绝。礼貌、清楚、留面子；不冷暴力、不羞辱对方，语气松弛有边界。',
  },
  {
    id: 'humor',
    label: '幽默爆梗',
    emoji: '🤣',
    chatStyle: 'push_pull',
    directive: '风格：幽默爆梗。短句好笑、有梗但不尬，像朋友斗嘴，不低俗不油。',
  },
  {
    id: 'master',
    label: '情场高手',
    emoji: '🏆',
    /** 与 boyfriend 人设一致，避免 applyModePatch 覆盖 chatStyle 后不一致 */
    chatStyle: 'intimate',
    lovePersona: 'boyfriend',
    directive:
      '风格：情场高手。高情商、有分寸、能推进关系；一条可直接发送的最优解。',
  },
];

export function getImeReplyStyle(id: ImeStyleId): ImeReplyStyle {
  return IME_REPLY_STYLES.find((s) => s.id === id) ?? IME_REPLY_STYLES[0];
}
