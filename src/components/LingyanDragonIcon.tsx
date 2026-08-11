/** 灵焰小火龙吉祥物（原创造型，用于输入法悬浮球） */
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
      {/* 尾巴火焰 */}
      <path
        d="M48 38c6 2 10 8 9 14-4-1-7-3-9-6 1 5-1 9-5 12 1-5 0-9-2-12 4-1 6-4 7-8z"
        fill="#FB923C"
      />
      <path
        d="M50 42c4 2 6 6 5.5 10-2.5-.8-4.5-2.2-5.5-4.5.5 3.2-.5 6-3 8 .8-3.2.2-5.8-1-7.8 2.5-.6 3.8-2.8 4-5.7z"
        fill="#FDE68A"
      />
      {/* 身体 */}
      <ellipse cx="28" cy="36" rx="16" ry="14" fill="#F97316" />
      <ellipse cx="28" cy="38" rx="10" ry="8" fill="#FDBA74" opacity="0.85" />
      {/* 头 */}
      <circle cx="30" cy="22" r="14" fill="#FB923C" />
      {/* 嘴鼻 */}
      <ellipse cx="38" cy="24" rx="7" ry="5.5" fill="#FDBA74" />
      <ellipse cx="42" cy="24.5" rx="2.2" ry="1.6" fill="#EA580C" opacity="0.55" />
      {/* 眼睛 */}
      <circle cx="26" cy="20" r="3.2" fill="#1C1917" />
      <circle cx="27.1" cy="19" r="1.1" fill="#FFF" />
      <circle cx="34.5" cy="19.5" r="2.6" fill="#1C1917" />
      <circle cx="35.3" cy="18.7" r="0.9" fill="#FFF" />
      {/* 腮红 */}
      <ellipse cx="22" cy="25" rx="2.4" ry="1.5" fill="#FB7185" opacity="0.55" />
      {/* 头顶小角 */}
      <path d="M24 10l2.5 5.5H21.5L24 10z" fill="#EA580C" />
      <path d="M31 8l2 5h-4l2-5z" fill="#EA580C" />
      {/* 肚皮高光 */}
      <circle cx="22" cy="32" r="2" fill="#FED7AA" opacity="0.7" />
    </svg>
  );
}
