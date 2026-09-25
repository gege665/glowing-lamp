import type { IceBreakerScenarioId } from './iceBreakerScenarios';
import { getIceBreakerScenario } from './iceBreakerScenarios';
import { DOUBAO_REPLY_SYSTEM } from './promptTemplates';

export const ICE_BREAKER_SYSTEM_PROMPT = `${DOUBAO_REPLY_SYSTEM}

【破冰专用 · 最高优先级】
- 只输出一个 JSON 对象：{"lines":["句1","句2",...]}
- 严禁输出思考过程、分析、润色说明、任务复述、Chain-of-Thought
- lines 里每条 ONLY 可发送的口语原话，15～35 字
- 禁止 markdown 代码块，直接以 { 开头`;

const SCENARIO_HINTS: Partial<Record<IceBreakerScenarioId, string>> = {
  first_add: '自然自我介绍或找共同话题，不查户口',
  cold_chat: '接上一话题或抛轻松新问题，别尬聊',
  topic_end: '换新鲜角度续聊，别硬转',
  silent_fight: '先示好降温，不翻旧账、不质问',
  first_meet: '轻松有趣第一印象，消除陌生感',
  invite: '具体但不施压的见面提议',
  fight_calm: '先共情再沟通，温柔不卑微',
  ambiguous: '留想象空间，不油腻',
  morning: '简短暖早安，别长篇',
  night: '温柔收尾，可留明天聊的钩子',
  holiday: '借势祝福，顺带拉近距离',
  reconnect: '自然提起旧事，不道德绑架',
};

export function buildIceBreakerUserPrompt(
  scenarioId: IceBreakerScenarioId,
  profileBlock: string,
  myNickname: string
): string {
  const scenario = getIceBreakerScenario(scenarioId);
  const hint = SCENARIO_HINTS[scenarioId] ?? scenario.desc;

  return `【场景】${scenario.label}：${scenario.desc}
【要点】${hint}
【我是】${myNickname || '男生'}，对方是女生

${profileBlock ? `${profileBlock}\n\n` : ''}请生成恰好 ${scenario.count} 条破冰/开场话术，放入 JSON 的 lines 数组。
要求：口语自然、不油腻、不套路、可直接复制发送。
禁止套话：刷到你抖音/视频/动态、摄影爱好者、想请教、没别的事。
输出格式：{"lines":["...","..."]}`;
}
