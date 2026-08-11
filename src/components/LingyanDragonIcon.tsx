/** 灵焰小火龙吉祥物（对标产品悬浮球形象） */
export default function LingyanDragonIcon({
  className = '',
  title = '灵焰小火龙',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* 尾巴火焰（右侧） */}
      <path
        d="M44 34c7 1 11 8 10 15-3.5-1-7-3.5-9-7 0 5-2 9-6 12 2-4.5 1.5-8.5 0-11 3.5-1.5 5-4.5 5-9z"
        fill="#F97316"
      />
      <path
        d="M46 38c4.5 1 7 5.5 6.2 10-2-.7-4-2.2-5.2-4.5.4 3-.6 5.8-3.2 8 .9-3 .4-5.5-.6-7.5 2.2-.7 3.2-2.8 2.8-6z"
        fill="#FDE68A"
      />
      {/* 身体（圆滚） */}
      <ellipse cx="28.5" cy="36" rx="15.5" ry="14.5" fill="#FB923C" />
      <ellipse cx="28" cy="39" rx="9.5" ry="8" fill="#FFEDD5" />
      {/* 头（偏大，Q 版） */}
      <circle cx="29" cy="24" r="15" fill="#FB923C" />
      {/* 头顶深色斑点 */}
      <circle cx="23" cy="14" r="1.6" fill="#EA580C" opacity="0.55" />
      <circle cx="30" cy="12.5" r="1.2" fill="#EA580C" opacity="0.45" />
      {/* 大眼睛 */}
      <ellipse cx="24.5" cy="23" rx="4.2" ry="4.6" fill="#1C1917" />
      <ellipse cx="34.5" cy="23" rx="4.2" ry="4.6" fill="#1C1917" />
      <circle cx="25.6" cy="21.6" r="1.35" fill="#FFF" />
      <circle cx="35.6" cy="21.6" r="1.35" fill="#FFF" />
      <circle cx="23.4" cy="24.8" r="0.55" fill="#FFF" opacity="0.7" />
      <circle cx="33.4" cy="24.8" r="0.55" fill="#FFF" opacity="0.7" />
      {/* 微笑 */}
      <path
        d="M26.5 29.5c1.4 1.6 4.2 1.6 5.6 0"
        stroke="#9A3412"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      {/* 腮红 */}
      <ellipse cx="19.5" cy="27.5" rx="2.6" ry="1.5" fill="#FB7185" opacity="0.45" />
      <ellipse cx="38.5" cy="27.5" rx="2.6" ry="1.5" fill="#FB7185" opacity="0.45" />
    </svg>
  );
}
