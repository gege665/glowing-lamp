import type { IceBreakerScenarioId } from './iceBreakerScenarios';
import { getIceBreakerScenario } from './iceBreakerScenarios';
import { LINGYAN_MASTER_IDENTITY } from './lingyanMaster';

export const ICE_BREAKER_SYSTEM_PROMPT = `${LINGYAN_MASTER_IDENTITY}

【灵焰破冰救场模式 · 最高优先级】
你正在帮男生打破沉默、开启或延续聊天。
若提供了双资料卡：开场白必须像本人说话，并贴合对方喜好、规避禁忌，禁止通用搭讪模板。
- 只输出一个 JSON：{"lines":["开场1","开场2",...],"topics":["续聊1","续聊2",...]}
- lines = 可直接发送的开场白；topics = 续聊话题提示（也可当下一句发送）
- 严禁思考过程、分析、润色说明、任务复述
- 每条口语 8～32 字，生活化、不尬不油、拒绝土味套路
- 禁止 markdown，直接以 { 开头`;

const SCENARIO_HINTS: Record<IceBreakerScenarioId, string> = {
  first_add:
    '新加好友第一句：像熟人偶遇的轻松感，点一个具体共同点或礼貌自报来意，不查户口、不土味撩',
  approach:
    '搭讪：生活化一句切入，像随口聊天不是搭讪文案；可轻幽默，忌「小姐姐刷到你」',
  reconnect:
    '复联：自然提起旧事或近况，不道德绑架（别说「你怎么不回」），给对方轻松接话点',
  cold_chat:
    '冷场：接上句或抛轻松新问题，别硬尬聊、别连环追问',
  silent_fight:
    '尴尬断联：先给台阶示好，不翻旧账不质问；短、稳、有温度',
  topic_end: '话题将尽：换新鲜小角度续上，别硬转大话题',
  first_meet: '初识：轻松有趣第一印象，降低防备',
  invite: '邀约：具体时间/地点二选一，不施压',
  fight_calm: '吵架后：先共情再沟通，温柔不卑微',
  ambiguous: '暧昧：留白半撩，不油腻不表白',
  morning: '早安：短暖一句，可带今日小钩子',
  night: '晚安：温柔收尾，可留明天聊的钩子',
  holiday: '节日：借势祝福，顺带拉近，不煽情',
};

export function buildIceBreakerUserPrompt(
  scenarioId: IceBreakerScenarioId,
  profileBlock: string,
  myNickname: string
): string {
  const scenario = getIceBreakerScenario(scenarioId);
  const hint = SCENARIO_HINTS[scenarioId] ?? scenario.desc;
  const lineCount = scenario.count;
  const topicCount = scenario.continueCount;

  return `【灵焰破冰救场】
【场景】${scenario.label}：${scenario.desc}
【要点】${hint}
【我是】${myNickname || '男生'}，对方是女生
【目标】高开启率 · 适配普通人社交 · 可直接复制发送 · 完美打破沉默

${profileBlock ? `${profileBlock}\n\n` : ''}请生成：
1. 恰好 ${lineCount} 条开场白 → JSON.lines
2. 恰好 ${topicCount} 条续聊话题（下一句可发的钩子）→ JSON.topics

硬性要求：
- 口语自然、生活化，像微信随手打的字
- 不尬不油、拒绝土味套路与客服腔
- 禁止：刷到你抖音/视频/动态、摄影爱好者、想请教、没别的事、小姐姐你好呀（空套）
- 输出：{"lines":["..."],"topics":["..."]}`;
}
