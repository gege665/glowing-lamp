import type { AnalysisResult, ChatMessage, UserSettings } from '../types';
import {
  DEFAULT_OTHER_PROFILE,
  DEFAULT_PARTNER_MEMORY,
  DEFAULT_SETTINGS,
} from '../types';
import type { PartnerArchive, RelationshipTrackingSnapshot } from '../types/partnerArchive';
import {
  buildTrackingFromAnalysis,
  createEmptyPartnerArchive,
} from '../types/partnerArchive';
import { loadAnalysis, loadMessages, loadSettings, saveAnalysis, saveMessages, saveSettings } from './storageService';
import {
  extractInterestKeywords,
  mergeInterestKeywords,
  normalizePartnerTags,
} from '../utils/partnerKeywords';

const ARCHIVES_KEY = 'soul_partner_archives_v1';
const ACTIVE_ID_KEY = 'soul_active_partner_id_v1';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    throw new Error('本地存储已满，请删除部分聊天对象后重试');
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeArchive(raw: Partial<PartnerArchive> & { id?: string }): PartnerArchive {
  const base = createEmptyPartnerArchive(raw.name || '聊天对象', raw.id);
  return {
    ...base,
    ...raw,
    id: raw.id || base.id,
    name: (raw.name || base.name).trim() || '聊天对象',
    note: typeof raw.note === 'string' ? raw.note : '',
    tags: normalizePartnerTags(raw.tags),
    interestKeywords: Array.isArray(raw.interestKeywords)
      ? raw.interestKeywords.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 24)
      : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    otherProfile: { ...DEFAULT_OTHER_PROFILE, ...(raw.otherProfile || {}) },
    partnerMemory: {
      ...DEFAULT_PARTNER_MEMORY,
      ...(raw.partnerMemory || {}),
    },
    temperatureHistory: Array.isArray(raw.temperatureHistory) ? raw.temperatureHistory : [],
    relationshipStages:
      Array.isArray(raw.relationshipStages) && raw.relationshipStages.length
        ? raw.relationshipStages
        : ['初识'],
    lastAnalysis: raw.lastAnalysis ?? null,
    tracking: raw.tracking ?? null,
    relationshipReport: raw.relationshipReport ?? null,
    createdAt: raw.createdAt || base.createdAt,
    updatedAt: raw.updatedAt || Date.now(),
  };
}

/** 首次迁移：把当前全局对话打成默认对象档案 */
function migrateLegacyIfNeeded(): PartnerArchive[] {
  const existing = safeParse<PartnerArchive[]>(safeGet(ARCHIVES_KEY), []);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing.map((a) => normalizeArchive(a));
  }

  const settings = loadSettings();
  const messages = loadMessages();
  const analysis = loadAnalysis();
  const name = settings.otherNickname?.trim() || '默认对象';
  const archive = createEmptyPartnerArchive(name);
  archive.messages = messages;
  archive.otherProfile = { ...DEFAULT_OTHER_PROFILE, ...settings.otherProfile };
  archive.partnerMemory = {
    ...DEFAULT_PARTNER_MEMORY,
    ...settings.partnerMemory,
  };
  archive.temperatureHistory = settings.temperatureHistory ?? [];
  archive.relationshipStages =
    settings.relationshipStages?.length > 0 ? [...settings.relationshipStages] : ['初识'];
  archive.lastAnalysis = analysis;
  archive.tracking = buildTrackingFromAnalysis(analysis);
  archive.updatedAt = Date.now();

  const list = [archive];
  safeSet(ARCHIVES_KEY, JSON.stringify(list));
  safeSet(ACTIVE_ID_KEY, archive.id);
  return list;
}

export function loadPartnerArchives(): PartnerArchive[] {
  return migrateLegacyIfNeeded();
}

export function savePartnerArchives(list: PartnerArchive[]): void {
  const normalized = list.map((a) => normalizeArchive(a));
  safeSet(ARCHIVES_KEY, JSON.stringify(normalized));
}

export function getActivePartnerId(): string {
  const list = loadPartnerArchives();
  const saved = safeGet(ACTIVE_ID_KEY);
  if (saved && list.some((a) => a.id === saved)) return saved;
  const id = list[0]?.id;
  if (id) safeSet(ACTIVE_ID_KEY, id);
  return id || '';
}

export function setActivePartnerId(id: string): void {
  safeSet(ACTIVE_ID_KEY, id);
}

export function getActivePartner(): PartnerArchive | null {
  const list = loadPartnerArchives();
  const id = getActivePartnerId();
  return list.find((a) => a.id === id) ?? list[0] ?? null;
}

export function upsertPartnerArchive(archive: PartnerArchive): PartnerArchive[] {
  const list = loadPartnerArchives();
  const next = normalizeArchive({ ...archive, updatedAt: Date.now() });
  const idx = list.findIndex((a) => a.id === next.id);
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  savePartnerArchives(list);
  return list;
}

export function deletePartnerArchive(id: string): PartnerArchive[] {
  let list = loadPartnerArchives().filter((a) => a.id !== id);
  if (list.length === 0) {
    list = [createEmptyPartnerArchive('新对象')];
  }
  savePartnerArchives(list);
  if (getActivePartnerId() === id) {
    setActivePartnerId(list[0].id);
  }
  return list;
}

export function createPartner(name: string): PartnerArchive {
  const archive = createEmptyPartnerArchive(name || `对象${loadPartnerArchives().length + 1}`);
  upsertPartnerArchive(archive);
  setActivePartnerId(archive.id);
  return archive;
}
export function persistActivePartnerFromWorkspace(input: {
  messages: ChatMessage[];
  settings: UserSettings;
  analysis: AnalysisResult | null;
  tracking?: RelationshipTrackingSnapshot | null;
  relationshipReport?: import('../constants/relationshipReport').RelationshipDataReport | null;
}): PartnerArchive | null {
  const active = getActivePartner();
  if (!active) return null;

  const tracking =
    input.tracking !== undefined
      ? input.tracking
      : buildTrackingFromAnalysis(input.analysis) ?? active.tracking;

  const autoKeywords = extractInterestKeywords(input.messages);
  const next: PartnerArchive = {
    ...active,
    name: input.settings.otherNickname?.trim() || active.name,
    tags: normalizePartnerTags(active.tags),
    interestKeywords: mergeInterestKeywords(active.interestKeywords ?? [], autoKeywords),
    messages: input.messages,
    otherProfile: { ...DEFAULT_OTHER_PROFILE, ...input.settings.otherProfile },
    partnerMemory: {
      ...DEFAULT_PARTNER_MEMORY,
      ...input.settings.partnerMemory,
    },
    temperatureHistory: input.settings.temperatureHistory ?? [],
    relationshipStages:
      input.settings.relationshipStages?.length > 0
        ? [...input.settings.relationshipStages]
        : active.relationshipStages,
    lastAnalysis: input.analysis,
    tracking,
    relationshipReport:
      input.relationshipReport !== undefined
        ? input.relationshipReport
        : active.relationshipReport ?? null,
    updatedAt: Date.now(),
  };

  upsertPartnerArchive(next);
  return next;
}

/** 切换对象：先存当前，再加载目标到全局 workspace */
export function switchToPartner(targetId: string): {
  archive: PartnerArchive;
  settings: UserSettings;
} {
  // 调用方应先 persist 当前；此处只加载目标
  const list = loadPartnerArchives();
  const archive = list.find((a) => a.id === targetId);
  if (!archive) throw new Error('找不到该聊天对象');

  setActivePartnerId(archive.id);

  const currentSettings = loadSettings();
  const settings: UserSettings = {
    ...currentSettings,
    otherNickname: archive.name,
    otherProfile: { ...DEFAULT_OTHER_PROFILE, ...archive.otherProfile },
    partnerMemory: { ...DEFAULT_PARTNER_MEMORY, ...archive.partnerMemory },
    temperatureHistory: archive.temperatureHistory ?? [],
    relationshipStages:
      archive.relationshipStages?.length > 0
        ? [...archive.relationshipStages]
        : [...DEFAULT_SETTINGS.relationshipStages],
  };

  saveSettings(settings);
  saveMessages(archive.messages || []);
  saveAnalysis(archive.lastAnalysis);

  return { archive, settings };
}

export function renamePartner(id: string, name: string): PartnerArchive[] {
  const list = loadPartnerArchives();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) return list;
  list[idx] = {
    ...list[idx],
    name: name.trim() || list[idx].name,
    updatedAt: Date.now(),
  };
  savePartnerArchives(list);
  return list;
}

export function updateActivePartnerNote(note: string): PartnerArchive | null {
  const active = getActivePartner();
  if (!active) return null;
  const next = { ...active, note: note.trim(), updatedAt: Date.now() };
  upsertPartnerArchive(next);
  return next;
}

export function updateActivePartnerTags(tags: string[]): PartnerArchive | null {
  const active = getActivePartner();
  if (!active) return null;
  const next = {
    ...active,
    tags: normalizePartnerTags(tags),
    updatedAt: Date.now(),
  };
  upsertPartnerArchive(next);
  return next;
}

export function updateActivePartnerKeywords(keywords: string[]): PartnerArchive | null {
  const active = getActivePartner();
  if (!active) return null;
  const next = {
    ...active,
    interestKeywords: mergeInterestKeywords([], keywords),
    updatedAt: Date.now(),
  };
  upsertPartnerArchive(next);
  return next;
}

export function listPartnerSummaries(): Array<{
  id: string;
  name: string;
  note: string;
  tags: string[];
  interestKeywords: string[];
  messageCount: number;
  temperature: number | null;
  stage: string;
  updatedAt: number;
  memoryLines: number;
  hasReport: boolean;
}> {
  return loadPartnerArchives().map((a) => ({
    id: a.id,
    name: a.name,
    note: a.note || '',
    tags: normalizePartnerTags(a.tags),
    interestKeywords: Array.isArray(a.interestKeywords) ? a.interestKeywords : [],
    messageCount: a.messages?.length ?? 0,
    temperature: a.tracking?.temperature ?? (a.temperatureHistory?.length
      ? a.temperatureHistory[a.temperatureHistory.length - 1]?.temperature ?? null
      : null),
    stage:
      a.tracking?.progress ||
      a.relationshipStages?.[0] ||
      a.lastAnalysis?.relationshipMetrics?.stage ||
      '初识',
    updatedAt: a.updatedAt,
    memoryLines: (a.partnerMemory?.details || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean).length,
    hasReport: Boolean(a.relationshipReport?.summary || a.tracking),
  }));
}

export { buildTrackingFromAnalysis, createEmptyPartnerArchive };
export type { PartnerArchive, RelationshipTrackingSnapshot };
