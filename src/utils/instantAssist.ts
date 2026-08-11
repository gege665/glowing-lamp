import { inferChatScene } from './situationContext';
import type { ChatMessage } from '../types';
import { getChatScene } from '../constants/coreReplyStyles';
import { getSceneCardsForMode } from '../constants/loveScenes';
import { LINGYAN_STAGE_GUIDANCE } from '../constants/lingyanMaster';
import { instantRiskScan } from '../constants/riskControl';
import { detectMessageIntent } from './targetedReply';

export interface InstantAssistResult {
  sceneId: string;
  sceneLabel: string;
  sceneTip: string;
  toneTips: string[];
  continueTopics: string[];
  riskAlerts: string[];
  stageTip: string;
}

/** 即时本地辅助：不调 API，粘贴即出场景 / 避雷 / 续聊 / 语气 */
export function buildInstantAssist(
  text: string,
  messages: ChatMessage[],
  opts?: {
    appMode?: 'social' | 'love';
    stages?: string[];
  }
): InstantAssistResult {
  const core = text.trim();
  const intent = detectMessageIntent(core);
  const identityVerify = intent.asksIdentity || intent.asksPurpose || intent.isWary;
  const sceneId = inferChatScene(messages, core) || (core ? 'cold_chat' : 'first_add');
  const scene = getChatScene(sceneId);
  const cards = getSceneCardsForMode(opts?.appMode === 'social' ? 'social' : 'love');
  const card = cards.find((c) => c.id === sceneId);

  const stage = opts?.stages?.[0] || '暧昧';
  const stageTip = LINGYAN_STAGE_GUIDANCE[stage] || LINGYAN_STAGE_GUIDANCE['暧昧'];
  const risk = instantRiskScan(core);

  return {
    sceneId,
    sceneLabel: identityVerify
      ? '核实身份/来意'
      : card?.title || scene?.label || '自动适配',
    sceneTip: identityVerify
      ? '先答身份+来源+来意，再带轻钩子；别空接「嗯然后呢」。'
      : scene?.prompt || '自然接话，短句口语。',
    toneTips: buildToneTips(core, sceneId, stage, identityVerify),
    continueTopics: buildContinueTopics(core, sceneId, identityVerify),
    riskAlerts: risk.alerts.slice(0, 3),
    stageTip,
  };
}

function buildToneTips(
  core: string,
  sceneId: string,
  stage: string,
  identityVerify = false
): string[] {
  const tips: string[] = [];
  if (identityVerify) {
    tips.push('先答身份/来意，再轻松接一句');
    tips.push('短句说清来源，不装熟不跪舔');
  } else if (/生气|烦|无语|滚|别烦|讨厌/.test(core)) {
    tips.push('先认情绪，别急着讲道理');
    tips.push('短句安抚，少解释');
  } else if (/嗯|哦|好|行|哈哈|呵呵/.test(core) && core.length <= 6) {
    tips.push('别追问连环弹幕');
    tips.push('丢一个轻松具体话题');
  } else if (/喜欢|想你|抱抱|心动/.test(core)) {
    tips.push('半接半留白，别一次表白到位');
  } else if (sceneId === 'first_add') {
    tips.push('干净轻快，别查户口');
  } else if (sceneId === 'invite') {
    tips.push('邀约给选项，不施压');
  }

  if (stage === '冷战' || stage === '挽回') {
    tips.push('有担当但不卑微');
  }
  if (stage === '陌生' || stage === '初识') {
    tips.push('克制分寸，少撩多稳');
  }
  if (tips.length === 0) {
    tips.push('像微信随手回，短句口语');
    tips.push('先接她的话，再轻轻延伸');
  }
  if (tips.length < 3) {
    tips.push('可侧面带出一点生活切片，不装不炫');
  }
  tips.push('禁油腻套路，像普通人微信随手回');
  return tips.slice(0, 3);
}

function buildContinueTopics(core: string, sceneId: string, identityVerify = false): string[] {
  if (!core) {
    return ['从她主页/瞬间找一个具体点聊聊', '问一个轻松二选一', '分享一件今天刚发生的小事'];
  }
  if (identityVerify) {
    return [
      '先说清你是谁、怎么加上的',
      '补一句轻松来意，别查户口',
      '答完身份再抛一个轻钩子',
    ];
  }
  if (sceneId === 'angry' || sceneId === 'make_up') {
    return ['给她台阶下', '问她现在想怎样就怎样', '改口承诺一件具体小事'];
  }
  if (sceneId === 'invite') {
    return ['给两个时间选项', '提一个轻松地点', '先约短局降低压力'];
  }
  if (sceneId === 'perfunctory' || sceneId === 'cold_chat') {
    return ['换一个她可能感兴趣的具体点', '自嘲一下冷场再抛新话题', '提她之前提过的小事'];
  }
  if (sceneId === 'test_feelings') {
    return ['用半真半假接住', '反问一句轻试探', '留白等她再进一步'];
  }

  const snippet = core.replace(/[？?！!。.~～]/g, '').slice(0, 12);
  return [
    `顺着「${snippet || '她刚说的'}」再问一个细节`,
    '分享你类似的一次经历（短）',
    '抛一个轻松二选一续上',
  ];
}
