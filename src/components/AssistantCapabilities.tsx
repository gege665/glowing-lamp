import { ASSISTANT_CAPABILITIES } from '../constants/assistantCapabilities';

interface AssistantCapabilitiesProps {
  compact?: boolean;
  className?: string;
}

export default function AssistantCapabilities({
  compact = false,
  className = '',
}: AssistantCapabilitiesProps) {
  return (
    <ul
      className={`space-y-1.5 text-left ${compact ? 'text-[11px]' : 'text-xs'} ${className}`.trim()}
    >
      {ASSISTANT_CAPABILITIES.map((item) => (
        <li key={item.id} className="flex gap-2 text-soul-400 leading-relaxed">
          <span className="text-green-400/90 shrink-0">✓</span>
          <span>
            <span className="text-soul-300">{item.title}</span>
            {'badge' in item && item.badge && (
              <span className="ml-1 tag bg-pink-500/20 text-pink-300 text-[9px]">{item.badge}</span>
            )}
            <span className="text-soul-500">：{item.summary}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
