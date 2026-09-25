/** 客户端记录服务端模型自动切换事件（仅 console，不打断用户操作） */

export interface ModelSwitchLogEntry {
  requestedModel?: string;
  usedModel?: string;
  modelSwitched?: boolean;
}

export function logModelSwitchEvent(entry: ModelSwitchLogEntry): void {
  if (!entry.modelSwitched) return;
  const payload = {
    ts: new Date().toISOString(),
    event: 'model_switch',
    from: entry.requestedModel,
    to: entry.usedModel,
  };
  console.info(
    `[ModelFailover] 已自动切换模型: ${entry.requestedModel} → ${entry.usedModel}`
  );
  console.debug('[ModelFailover:json]', JSON.stringify(payload));
}
