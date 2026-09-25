/** 产品功能全景（营销 + UI 展示） */
export const PRODUCT_FEATURES = [
  {
    id: 'highEqReply',
    title: 'AI 高情商回复',
    badge: '核心主打',
    summary: '粘贴文字或上传截图，结合关系阶段生成多风格话术',
    detail:
      '自动识别文字、梳理上下文、判断情绪与潜台词；一次生成温柔、幽默、直球、理性、暧昧等多风格备选，避免尬聊、稳步推进关系。',
  },
  {
    id: 'iceBreaker',
    title: '一键破冰',
    summary: '初识开场 + 12 种冷场救场场景',
    detail: '初次加好友生成 3 条自然开场白；冷场、冷战、话题终结时随时重启对话。',
  },
  {
    id: 'profileCards',
    title: '双资料卡',
    summary: '本人魅力展示 + 对方偏好定制',
    detail: '本人资料卡录入闪光点，AI 自然穿插优势；对方资料卡 7 维度记录喜好，产出高度定制回复。',
  },
  {
    id: 'memory',
    title: '记忆功能',
    summary: '记住每个对象的细节与小事',
    detail: '存储忌口、心愿、随口提过的事，在合适时机提醒提及，回复不脱节。',
  },
  {
    id: 'antiScam',
    title: '反套路 / 反捞模式',
    summary: '恋爱反诈，随时守护',
    detail: '识别试探、索取物质、情绪压榨、敷衍养鱼等行为，给出风险提示与止损建议。',
  },
  {
    id: 'emotionRadar',
    title: '情绪雷达 + 语境分析',
    summary: '9 种隐藏情绪 + 潜台词解读',
    detail: '解析开心、抵触、敷衍、撒娇、生气、试探等情绪，标注关键节点，避免踩雷。',
  },
  {
    id: 'relationshipDash',
    title: '关系仪表盘',
    summary: '关系温度追踪与阶段判断',
    detail: '统计互动频率、话题深度、亲密度变化，输出改进建议与邀约时机。',
  },
  {
    id: 'replyWorkshop',
    title: '话术工坊',
    summary: '收藏编辑，积累专属话术库',
    detail: '收藏优质话术、手动修改 AI 文案，后续生成越来越像本人语气。',
  },
  {
    id: 'trainingCamp',
    title: '反套路训练营',
    summary: '模拟对练 + 打分纠错',
    detail: '模拟调侃、试探、灵魂拷问等场景人机对练，线下也能自主应对。',
    comingSoon: true,
  },
  {
    id: 'sceneSim',
    title: '场景对话模拟',
    summary: '约会邀约、表白、挽回等预演',
    detail: '针对高难度场景提前演练完整话术逻辑，临场不紧张。',
    comingSoon: true,
  },
  {
    id: 'screenshotOcr',
    title: '聊天截图识别',
    summary: '整段 OCR + 连贯分析',
    detail: '上传聊天记录截图，自动识别全部文字并批量生成后续策略。',
  },
] as const;

/** 8 种核心话术风格 */
export const CORE_REPLY_STYLE_LABELS = [
  '温柔',
  '幽默',
  '暧昧',
  '直球',
  '理性',
  '高冷',
  '走心',
  '可爱',
] as const;

/** 情绪雷达 9 种情绪 */
export const EMOTION_RADAR_TYPES = [
  '开心',
  '抵触',
  '敷衍',
  '撒娇',
  '生气',
  '试探',
  '期待',
  '失落',
  '好奇',
] as const;

/** 对方资料卡 7 维度 */
export const OTHER_PROFILE_DIMENSIONS = [
  { key: 'likes', label: '喜好兴趣' },
  { key: 'dislikes', label: '禁忌雷区' },
  { key: 'personality', label: '性格特点' },
  { key: 'habits', label: '生活习惯' },
  { key: 'experiences', label: '过往经历' },
  { key: 'dreams', label: '心愿目标' },
  { key: 'notes', label: '其他备忘' },
] as const;
