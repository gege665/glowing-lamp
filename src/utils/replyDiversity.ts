/**
 * 多套方案差异化：检测近重复骨架，并替换为风格兜底，避免「换皮同句」。
 */

export type DiversifiableReply = {
  label: string;
  content: string;
  category?: string;
};

/** 去掉语气词/标点后的骨架，用于同质检测 */
export function normalizeReplySkeleton(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[哈哈呵呵嘿哈哦嗯呀啊呢吧嘛啦哇欸唉哈]+/g, '')
    .replace(/[～~\s！!？?。，、.…·「」""''（）()]/g, '')
    .replace(/^(我是|我叫|咱是)/, '');
}

/** 两条是否内容/角度过于相似（换皮同句） */
export function areRepliesNearDuplicate(a: string, b: string): boolean {
  const ta = a.trim();
  const tb = b.trim();
  if (!ta || !tb) return false;
  if (ta === tb) return true;

  const sa = normalizeReplySkeleton(ta);
  const sb = normalizeReplySkeleton(tb);
  if (!sa || !sb) return false;
  if (sa === sb) return true;

  // 仅当短句足够长且占长句大部分时，才视为子串换皮（避免「晚上有空吗」误杀扩展句）
  const shorter = sa.length <= sb.length ? sa : sb;
  const longer = sa.length <= sb.length ? sb : sa;
  if (
    shorter.length >= 8 &&
    longer.includes(shorter) &&
    shorter.length / longer.length >= 0.75
  ) {
    return true;
  }

  // 共享开场同质骨架（任一对命中即视为换皮）
  const sameAnglePatterns = [/昨晚加/, /打个招呼/, /想先打招呼/, /刚加的你/, /加你的那位/];
  if (sameAnglePatterns.some((p) => p.test(ta) && p.test(tb))) return true;

  // bigram overlap（提高阈值，降低误杀）
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = bigrams(sa);
  const B = bigrams(sb);
  if (A.size === 0 || B.size === 0) return false;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return inter / union >= 0.85;
}

/** 开场场景风格兜底 */
export const OPENING_DIVERSE_FALLBACKS: Record<string, string> = {
  自然: '哈哈可算加上了',
  暧昧: '聊天框里慢慢眼熟',
  高冷: '哦通过了有空再说',
  奶狗: '加上啦有点小紧张呀',
  爹系: '记住了有事直接说',
  痞帅: '头像挺有意思呀',
};

/**
 * 通用差异化兜底（任意场景）：角度互不相同，避免去重后只剩 1 条空白
 * 禁止开场专用句（可算加上了等），避免污染约饭/暧昧等场景
 */
export const GENERAL_DIVERSE_FALLBACKS: Record<string, string> = {
  自然: '行，那你怎么看',
  暧昧: '这么说我倒好奇了',
  高冷: '嗯，然后呢',
  奶狗: '别这样嘛，再说两句呀',
  爹系: '有事直说，我听着',
  痞帅: '就这？还能再狠点',
};

/** @deprecated 空对象已废弃；非开场改用 GENERAL_DIVERSE_FALLBACKS */
export const NEUTRAL_DIVERSE_FALLBACKS = GENERAL_DIVERSE_FALLBACKS;

/** @deprecated 使用 OPENING_DIVERSE_FALLBACKS；保留别名避免旧引用断裂 */
export const DIVERSE_STYLE_FALLBACKS = OPENING_DIVERSE_FALLBACKS;

/** 界面至少展示条数 */
export const MIN_DISPLAY_REPLIES = 3;

/** 与 aiService.finalizeReplyOptions 一致 */
export function resolveDiverseFallbacks(openingMode: boolean): Record<string, string> {
  return openingMode ? OPENING_DIVERSE_FALLBACKS : GENERAL_DIVERSE_FALLBACKS;
}

/**
 * 空槽/不足时用风格兜底补到至少 min 条，且互不近重复
 */
export function padRepliesToMinimum<T extends DiversifiableReply>(
  replies: T[],
  min = MIN_DISPLAY_REPLIES,
  fallbacks: Record<string, string> = GENERAL_DIVERSE_FALLBACKS
): T[] {
  const out = replies.map((r) => ({ ...r, content: r.content.trim() }));
  const used = () => out.map((r) => r.content).filter((c) => c.length >= 2);

  // 先按各风格 label 填空槽（尽量填满，不只停在 min）
  for (let i = 0; i < out.length; i++) {
    if (out[i].content) continue;
    const fb = fallbacks[out[i].label]?.trim();
    if (!fb) continue;
    if (used().some((c) => areRepliesNearDuplicate(c, fb))) continue;
    out[i] = { ...out[i], content: fb };
  }

  // 仍不足 min：跨风格池救急
  if (countDistinctReplies(out) < min) {
    const pool = Object.values(fallbacks).filter(Boolean);
    for (let i = 0; i < out.length; i++) {
      if (countDistinctReplies(out) >= min && out.every((r) => r.content)) break;
      if (out[i].content) continue;
      const pick = pool.find((fb) => !used().some((c) => areRepliesNearDuplicate(c, fb)));
      if (pick) out[i] = { ...out[i], content: pick };
    }
  }

  return out;
}

/**
 * 保证列表内至少有明显差异：近重复项替换为该风格兜底（若兜底仍撞车则清空）。
 * 不改变条数与 label 顺序，便于用户左右/上下切换查看。
 */
export function diversifyReplySuggestions<T extends DiversifiableReply>(
  replies: T[],
  fallbacks: Record<string, string> = DIVERSE_STYLE_FALLBACKS
): T[] {
  const out = replies.map((r) => ({ ...r, content: r.content.trim() }));
  const kept: string[] = [];

  for (let i = 0; i < out.length; i++) {
    const content = out[i].content;
    if (!content) {
      kept.push('');
      continue;
    }

    const dup = kept.some((prev) => prev && areRepliesNearDuplicate(prev, content));
    if (!dup) {
      kept.push(content);
      continue;
    }

    const fb = fallbacks[out[i].label]?.trim() || '';
    const fbOk =
      fb &&
      !kept.some((prev) => prev && areRepliesNearDuplicate(prev, fb)) &&
      !areRepliesNearDuplicate(content, fb);

    if (fbOk) {
      out[i] = { ...out[i], content: fb };
      kept.push(fb);
    } else {
      out[i] = { ...out[i], content: '' };
      kept.push('');
    }
  }

  // 第二轮：空槽用未占用的风格兜底填上，尽量凑满差异化选项
  const used = new Set(
    out.map((r) => normalizeReplySkeleton(r.content)).filter((s) => s.length >= 2)
  );
  for (let i = 0; i < out.length; i++) {
    if (out[i].content.trim()) continue;
    const fb = fallbacks[out[i].label]?.trim();
    if (!fb) continue;
    const sk = normalizeReplySkeleton(fb);
    if (sk && !used.has(sk)) {
      out[i] = { ...out[i], content: fb };
      used.add(sk);
    }
  }

  return out;
}

/** 有效且互不近重复的条数 */
export function countDistinctReplies(replies: { content: string }[]): number {
  const kept: string[] = [];
  for (const r of replies) {
    const c = r.content.trim();
    if (!c) continue;
    if (kept.some((p) => areRepliesNearDuplicate(p, c))) continue;
    kept.push(c);
  }
  return kept.length;
}

export type ScoredReply = DiversifiableReply & { content: string };

/**
 * 多套方案 3 条 + 智能推荐 1 条：
 * 前 3 条为差异化选项；第 4 条取前 3 中实战分最高者，标为「推荐」。
 */
export function arrangeMultiPlanWithRecommendation<T extends ScoredReply>(
  replies: T[],
  scoreFn: (content: string) => number
): T[] {
  const filled = replies
    .map((r, index) => ({ r, index, content: r.content.trim() }))
    .filter((x) => x.content.length >= 2);

  if (!filled.length) return replies;

  // 先按分数取差异化候选
  const ranked = [...filled].sort(
    (a, b) => scoreFn(b.content) - scoreFn(a.content) || a.index - b.index
  );

  const options: typeof filled = [];
  for (const item of ranked) {
    if (options.length >= MIN_DISPLAY_REPLIES) break;
    if (options.some((o) => areRepliesNearDuplicate(o.content, item.content))) continue;
    options.push(item);
  }

  // 不足 3 条时用原列表顺序补
  for (const item of filled) {
    if (options.length >= MIN_DISPLAY_REPLIES) break;
    if (options.some((o) => o.index === item.index)) continue;
    if (options.some((o) => areRepliesNearDuplicate(o.content, item.content))) continue;
    options.push(item);
  }

  if (!options.length) return replies;

  const best = [...options].sort(
    (a, b) => scoreFn(b.content) - scoreFn(a.content) || a.index - b.index
  )[0];

  const plan = options.slice(0, MIN_DISPLAY_REPLIES).map((x) => ({ ...x.r, content: x.content }));
  while (plan.length < MIN_DISPLAY_REPLIES) {
    plan.push({ ...best.r, content: best.content });
  }

  const recommended = {
    ...best.r,
    content: best.content,
    label: best.r.label?.startsWith('推荐') ? best.r.label : `推荐·${best.r.label || '优选'}`,
  } as T;

  // 固定 4 槽：3 方案 + 1 推荐
  const out: T[] = [...plan.slice(0, 3), recommended] as T[];
  return out;
}
