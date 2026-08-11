import { getDrillScenario, type DrillScenarioId } from './drillScenarios';
import type { DrillMessage } from '../types/drill';

export const DRILL_SYSTEM_PROMPT = `你是「灵焰恋爱大师」全场景模拟演练教练。
同时扮演两个角色：
1) 对方女生：用真实微信口语与真实情绪回应，短句、可冷可软可试探，绝不客服腔/剧本腔。
2) 恋爱教练：点评用户上一条，指出具体问题，并给出 2～3 条可直接发送的最优修正话术。

覆盖场景包括：搭讪、初识、暧昧升温、约会邀约、吵架道歉、哄对象、冷战修复、表白、挽回、应对试探、反套路。

铁律：
- 她的台词 8～40 字，带情绪与潜台词，根据用户表现动态升温或降温
- 点评必须具体可执行（点名哪里油/跪/查户口/答非所问），禁止空话
- 修正话术必须可复制发送，口语自然，贴合当前场景目标
- 只输出 JSON，不要 markdown，不要解释`;

export function buildDrillOpeningUserPrompt(
  scenarioId: DrillScenarioId,
  myNickname: string,
  profileHint?: string
): string {
  const s = getDrillScenario(scenarioId);
  return `【开场演练】场景：${s.label}（${s.desc}）
【目标】${s.goal}
【她的人设】${s.herPersona}
【情境】${s.openingCue}
【用户昵称】${myNickname}
${profileHint ? `【资料参考】${profileHint.slice(0, 200)}` : ''}

请以她的身份发出【第一句】，并给出初始教练提示（此时用户还没说话，problems 可空，betterReplies 给 2 条推荐开场方向供参考）。

严格输出 JSON：
{"herReply":"她的第一句口语","herEmotion":"当前情绪","score":0,"problems":[],"betterReplies":["推荐开场方向1","推荐开场方向2"],"tip":"本场景开场要点≤30字"}`;
}

export function buildDrillTurnUserPrompt(
  scenarioId: DrillScenarioId,
  history: DrillMessage[],
  userLine: string,
  myNickname: string
): string {
  const s = getDrillScenario(scenarioId);
  const hist = history
    .filter((m) => m.role === 'me' || m.role === 'her')
    .slice(-12)
    .map((m) => `${m.role === 'me' ? myNickname : '她'}：${m.content}`)
    .join('\n');

  return `【继续演练】场景：${s.label}
【目标】${s.goal}
【她的人设】${s.herPersona}
【易踩雷】${s.pitfalls.join('、')}
【对话记录】
${hist || '（刚开始）'}
【用户刚发】${userLine}

请：
1) 以她的真实语气回复下一句（接住用户这句话的情绪/内容）
2) 点评用户刚发的话：问题列表 + 2～3 条更优话术 + 简短 tip + score(0-100)

严格输出 JSON：
{"herReply":"她的下一句","herEmotion":"情绪","score":75,"problems":["具体问题1"],"betterReplies":["可发送修正1","可发送修正2"],"tip":"一句教练建议≤40字"}`;
}
