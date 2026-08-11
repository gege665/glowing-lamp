import dictJson from '../data/pinyinDict.json';

/** 拼音 → 候选汉字串（无声调） */
const SYLLABLE_DICT = dictJson as Record<string, string>;

/** 常用词（全拼无空格 → 词） */
const WORD_DICT: Record<string, string[]> = {
  nihao: ['你好'],
  shijie: ['世界'],
  zhongguo: ['中国'],
  women: ['我们'],
  nimen: ['你们'],
  tamen: ['他们', '她们'],
  shenme: ['什么'],
  zenme: ['怎么'],
  weishenme: ['为什么'],
  xihuan: ['喜欢'],
  xianzai: ['现在'],
  keyi: ['可以'],
  bushi: ['不是'],
  zhidao: ['知道'],
  xiang: ['想'],
  jintian: ['今天'],
  mingtian: ['明天'],
  zuotian: ['昨天'],
  pengyou: ['朋友'],
  nvhai: ['女孩'],
  nanhai: ['男孩'],
  keai: ['可爱'],
  gaoxing: ['高兴'],
  kaixin: ['开心'],
  shangxin: ['伤心'],
  yueliang: ['月亮'],
  taiyang: ['太阳'],
  dianhua: ['电话'],
  weixin: ['微信'],
  xiaoxi: ['消息'],
  huifu: ['回复'],
  liaotian: ['聊天'],
  zaijian: ['再见'],
  zaoshang: ['早上'],
  wanshang: ['晚上'],
  xiawu: ['下午'],
  shangwu: ['上午'],
  yixia: ['一下'],
  yidian: ['一点'],
  yihui: ['一会'],
  yihuir: ['一会儿'],
  meishi: ['没事'],
  meiwenti: ['没问题'],
  haode: ['好的'],
  haoba: ['好吧'],
  haha: ['哈哈'],
  hehe: ['呵呵'],
  baoqian: ['抱歉'],
  duibuqi: ['对不起'],
  meiguanxi: ['没关系'],
  xiexie: ['谢谢'],
  bukeqi: ['不客气'],
  qingwen: ['请问'],
  duoshao: ['多少'],
  nali: ['哪里', '那里'],
  zheli: ['这里'],
  nar: ['哪儿', '那儿'],
  zenmeyang: ['怎么样'],
  haihao: ['还好'],
  tinghao: ['挺好'],
  feichang: ['非常'],
  tebie: ['特别'],
  zhende: ['真的'],
  xiangxin: ['相信'],
  jide: ['记得'],
  wangji: ['忘记'],
  dengdeng: ['等等'],
  chifan: ['吃饭'],
  shuijiao: ['睡觉'],
  gongzuo: ['工作'],
  xuexi: ['学习'],
  lianai: ['恋爱'],
  aiqing: ['爱情'],
  xinqing: ['心情'],
  ganjue: ['感觉'],
  juede: ['觉得'],
  xiangfa: ['想法'],
  yisi: ['意思'],
  buhaoyisi: ['不好意思'],
  zaima: ['在吗'],
  shenmeshi: ['什么事'],
  ganma: ['干嘛', '干吗'],
  chile: ['吃了'],
  daole: ['到了'],
  haokan: ['好看'],
  piaoliang: ['漂亮'],
  shuaiqi: ['帅气'],
  wenrou: ['温柔'],
  baobao: ['宝宝'],
  baobei: ['宝贝'],
  xiangni: ['想你'],
  aini: ['爱你'],
  wanan: ['晚安'],
  zaoshanghao: ['早上好'],
  wanshanghao: ['晚上好'],
  chilema: ['吃了吗'],
  daojia: ['到家'],
  chumen: ['出门'],
  huijia: ['回家'],
  xiuxi: ['休息'],
  leile: ['累了'],
  youkong: ['有空'],
  meikong: ['没空'],
  dengwo: ['等我'],
  buyao: ['不要'],
  buyong: ['不用'],
  buxing: ['不行'],
  haoxiang: ['好像'],
  keneng: ['可能'],
  yinggai: ['应该'],
  bixu: ['必须'],
  xuyao: ['需要'],
  xiangyao: ['想要'],
  xihuanni: ['喜欢你'],
  yiqi: ['一起'],
};

const MAX_CANDIDATES = 24;
const SYLLABLE_KEYS = Object.keys(SYLLABLE_DICT).sort((a, b) => b.length - a.length);

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

/** 从前往后贪心切分最长合法音节 */
export function segmentPinyin(input: string): { parts: string[]; rest: string } {
  const parts: string[] = [];
  let i = 0;
  while (i < input.length) {
    let matched = '';
    const maxLen = Math.min(6, input.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const slice = input.slice(i, i + len);
      if (SYLLABLE_DICT[slice]) {
        matched = slice;
        break;
      }
    }
    if (!matched) break;
    parts.push(matched);
    i += matched.length;
  }
  return { parts, rest: input.slice(i) };
}

/** 根据拼音缓冲给出汉字/词候选 */
export function getPinyinCandidates(raw: string): string[] {
  const input = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!input) return [];

  const out: string[] = [];

  // 1) 整词
  if (WORD_DICT[input]) out.push(...WORD_DICT[input]);
  for (const [py, words] of Object.entries(WORD_DICT)) {
    if (py.startsWith(input) && py !== input) out.push(...words);
  }

  // 2) 完整音节
  if (SYLLABLE_DICT[input]) {
    out.push(...SYLLABLE_DICT[input].split(''));
  }

  // 3) 多音节：每段取首字拼词 + 首段全部单字
  const { parts, rest } = segmentPinyin(input);
  if (parts.length >= 2 && !rest) {
    const firsts = parts.map((p) => SYLLABLE_DICT[p]?.[0] ?? '').join('');
    if (firsts) out.unshift(firsts);
    // 再给几组常见组合：每段前 2 字交叉（控制数量）
    if (parts.length === 2) {
      const a = SYLLABLE_DICT[parts[0]] ?? '';
      const b = SYLLABLE_DICT[parts[1]] ?? '';
      for (let i = 0; i < Math.min(3, a.length); i++) {
        for (let j = 0; j < Math.min(3, b.length); j++) {
          out.push(a[i] + b[j]);
        }
      }
    }
  }
  if (parts.length >= 1) {
    const first = SYLLABLE_DICT[parts[0]];
    if (first) out.push(...first.split(''));
  }

  // 4) 前缀：输入是某音节前缀时展示该音节汉字
  if (out.length < MAX_CANDIDATES) {
    for (const key of SYLLABLE_KEYS) {
      if (key.startsWith(input) && key !== input) {
        const chars = SYLLABLE_DICT[key];
        if (chars) out.push(...chars.slice(0, 4).split(''));
      }
      if (out.length >= MAX_CANDIDATES * 2) break;
    }
  }

  return uniq(out);
}

export function isPinyinLetter(ch: string): boolean {
  return /^[a-zA-Z]$/.test(ch);
}

/** 九键 T9：数字 → 字母 */
export const T9_KEY_LETTERS: Record<string, string> = {
  '2': 'abc',
  '3': 'def',
  '4': 'ghi',
  '5': 'jkl',
  '6': 'mno',
  '7': 'pqrs',
  '8': 'tuv',
  '9': 'wxyz',
};

const LETTER_TO_DIGIT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [digit, letters] of Object.entries(T9_KEY_LETTERS)) {
    for (const ch of letters) map[ch] = digit;
  }
  return map;
})();

export function encodePinyinToT9(py: string): string {
  return [...py.toLowerCase()].map((c) => LETTER_TO_DIGIT[c] ?? '').join('');
}

/** encode → 音节列表（同码如 ni/mi） */
const ENCODE_TO_SYLLABLES: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const py of SYLLABLE_KEYS) {
    const enc = encodePinyinToT9(py);
    if (!enc) continue;
    const list = map.get(enc) ?? [];
    list.push(py);
    map.set(enc, list);
  }
  return map;
})();

const ENCODE_KEYS = [...ENCODE_TO_SYLLABLES.keys()].sort((a, b) => b.length - a.length);

/** 同码时抬常用拼音（汉字九键首选更像搜狗） */
const PINYIN_FREQ: Record<string, number> = {
  ni: 1,
  wo: 2,
  de: 3,
  shi: 4,
  bu: 5,
  le: 6,
  hao: 7,
  me: 8,
  yi: 9,
  zhi: 10,
  you: 11,
  zai: 12,
  guo: 13,
  ren: 14,
  ta: 15,
  men: 16,
  zhe: 17,
  ge: 18,
  zhong: 19,
  wei: 20,
  nihao: 1,
};

/** 九键数字串贪心切分为音节（每段取同码第一个拼音作代表） */
export function segmentT9(digits: string): { parts: string[]; rest: string } {
  const parts: string[] = [];
  let i = 0;
  while (i < digits.length) {
    let matched: string[] | null = null;
    let matchedLen = 0;
    const maxLen = Math.min(6, digits.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const slice = digits.slice(i, i + len);
      const syls = ENCODE_TO_SYLLABLES.get(slice);
      if (syls?.length) {
        matched = syls;
        matchedLen = len;
        break;
      }
    }
    if (!matched || !matchedLen) break;
    parts.push(matched[0]);
    i += matchedLen;
  }
  return { parts, rest: digits.slice(i) };
}

export function isT9Digit(ch: string): boolean {
  return /^[2-9]$/.test(ch);
}

export interface T9PinyinOption {
  /** 拼音（可含 ' 分节） */
  py: string;
  /** 该拼音下的汉字/词 */
  chars: string[];
}

export interface T9QueryResult {
  /** 汉字/词候选（未锁定拼音时的汇总） */
  candidates: string[];
  /** 可点选的拼音列表（汉字九键第一栏） */
  pinyinOptions: T9PinyinOption[];
  /** 匹配到的拼音提示（用于预览） */
  pinyinHints: string[];
}

function charsForPinyin(py: string): string[] {
  if (py.includes("'")) {
    const parts = py.split("'").filter(Boolean);
    const firsts = parts.map((p) => SYLLABLE_DICT[p]?.[0] ?? '').join('');
    const list: string[] = [];
    if (firsts) list.push(firsts);
    if (parts.length === 2) {
      const a = SYLLABLE_DICT[parts[0]] ?? '';
      const b = SYLLABLE_DICT[parts[1]] ?? '';
      for (let i = 0; i < Math.min(4, a.length); i++) {
        for (let j = 0; j < Math.min(4, b.length); j++) {
          list.push(a[i] + b[j]);
        }
      }
    }
    return uniq(list);
  }
  if (WORD_DICT[py]) {
    return uniq([...WORD_DICT[py], ...(SYLLABLE_DICT[py]?.split('') ?? [])]);
  }
  const chars = SYLLABLE_DICT[py];
  return chars ? chars.split('') : [];
}

/** 单段九键数字 → 拼音选项（无分词） */
function getT9CandidatesPlain(digits: string): T9PinyinOption[] {
  if (!digits) return [];
  const optionMap = new Map<string, string[]>();
  const addOption = (py: string, extra: string[] = []) => {
    if (!py) return;
    const prev = optionMap.get(py) ?? [];
    optionMap.set(py, uniq([...extra, ...charsForPinyin(py), ...prev]));
  };

  for (const [py, words] of Object.entries(WORD_DICT)) {
    const enc = encodePinyinToT9(py);
    if (!enc) continue;
    if (enc === digits || enc.startsWith(digits)) addOption(py, words);
  }

  const exact = ENCODE_TO_SYLLABLES.get(digits);
  if (exact) for (const py of exact) addOption(py);

  const { parts, rest } = segmentT9(digits);
  if (parts.length >= 2 && !rest) addOption(parts.join("'"));
  if (parts.length >= 1) {
    const firstEnc = encodePinyinToT9(parts[0]);
    for (const py of ENCODE_TO_SYLLABLES.get(firstEnc) ?? [parts[0]]) addOption(py);
  }

  for (const enc of ENCODE_KEYS) {
    if (enc.startsWith(digits) && enc !== digits) {
      for (const py of ENCODE_TO_SYLLABLES.get(enc) ?? []) addOption(py);
    }
    if (optionMap.size >= 16) break;
  }

  return [...optionMap.entries()].map(([py, chars]) => ({ py, chars }));
}

/** 九键数字序列 → 拼音选项 + 汉字候选（汉字九键；支持 ' 分词） */
export function getT9Candidates(rawDigits: string, lockedPinyin?: string | null): T9QueryResult {
  const raw = rawDigits.replace(/[^2-9']/g, '');
  if (!raw.replace(/'/g, '')) return { candidates: [], pinyinOptions: [], pinyinHints: [] };

  // 分词：64'426 → 分段匹配后拼接
  const segments = raw.split("'").filter((s) => s.length > 0);
  const digits = segments.join('') || raw.replace(/'/g, '');
  if (!digits) return { candidates: [], pinyinOptions: [], pinyinHints: [] };

  let optionMap = new Map<string, string[]>();
  if (segments.length > 1) {
    const head = segments.slice(0, -1);
    const last = segments[segments.length - 1];
    const headPys = head.map((seg) => {
      const opts = getT9CandidatesPlain(seg);
      const exact = opts.find((o) => encodePinyinToT9(o.py.replace(/'/g, '')) === seg);
      return exact?.py ?? opts[0]?.py ?? '';
    });
    const lastOpts = getT9CandidatesPlain(last);
    for (const opt of lastOpts) {
      const combinedPy = [...headPys, opt.py].filter(Boolean).join("'");
      const headChars = headPys.map((p) => charsForPinyin(p)[0] ?? '').join('');
      const combinedChars = opt.chars.map((c) => headChars + c);
      optionMap.set(combinedPy, uniq(combinedChars));
    }
  }

  if (optionMap.size === 0) {
    for (const opt of getT9CandidatesPlain(digits)) {
      optionMap.set(opt.py, opt.chars);
    }
  }

  let pinyinOptions: T9PinyinOption[] = [...optionMap.entries()].map(([py, chars]) => ({
    py,
    chars,
  }));

  // 精确码优先 → 常用拼音 → 短拼音
  pinyinOptions.sort((a, b) => {
    const aBase = a.py.replace(/'/g, '');
    const bBase = b.py.replace(/'/g, '');
    const ae = encodePinyinToT9(aBase);
    const be = encodePinyinToT9(bBase);
    const aExact = ae === digits ? 0 : 1;
    const bExact = be === digits ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const af = PINYIN_FREQ[a.py] ?? PINYIN_FREQ[a.py.split("'")[0]] ?? 500;
    const bf = PINYIN_FREQ[b.py] ?? PINYIN_FREQ[b.py.split("'")[0]] ?? 500;
    if (af !== bf) return af - bf;
    return a.py.length - b.py.length;
  });
  pinyinOptions = pinyinOptions.slice(0, 12);

  const pinyinHints = pinyinOptions.map((o) => o.py);

  // 汉字九键：默认锁定首选拼音，只展示该拼音下汉字；用户点其他拼音再切换
  const activePy = lockedPinyin ?? pinyinOptions[0]?.py ?? null;
  if (activePy) {
    const locked =
      pinyinOptions.find((o) => o.py === activePy) ??
      ({ py: activePy, chars: charsForPinyin(activePy) } satisfies T9PinyinOption);
    return {
      pinyinOptions,
      pinyinHints,
      candidates: uniq(locked.chars).slice(0, MAX_CANDIDATES),
    };
  }

  return {
    pinyinOptions,
    pinyinHints,
    candidates: [],
  };
}
