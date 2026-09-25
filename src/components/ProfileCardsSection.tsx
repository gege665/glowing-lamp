import type { MyProfileCard, OtherProfileCard, PartnerMemory } from '../types';
import { OTHER_PROFILE_DIMENSIONS } from '../constants/productFeatures';

interface ProfileCardsSectionProps {
  myProfile: MyProfileCard;
  otherProfile: OtherProfileCard;
  partnerMemory: PartnerMemory;
  onChange: (patch: {
    myProfile?: Partial<MyProfileCard>;
    otherProfile?: Partial<OtherProfileCard>;
    partnerMemory?: Partial<PartnerMemory>;
  }) => void;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="text-xs text-soul-400 mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="input-field w-full resize-none text-sm"
      />
    </div>
  );
}

export default function ProfileCardsSection({
  myProfile,
  otherProfile,
  partnerMemory,
  onChange,
}: ProfileCardsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-soul-700/30 bg-soul-900/30">
        <p className="text-sm font-medium text-soul-200 mb-1">本人资料卡 · 魅力展示</p>
        <p className="text-[11px] text-soul-500 mb-3">AI 会自然穿插你的优势，低调展示魅力</p>
        <div className="space-y-2">
          <Field
            label="爱好兴趣"
            value={myProfile.hobbies}
            onChange={(v) => onChange({ myProfile: { ...myProfile, hobbies: v } })}
            placeholder="摄影、徒步、做饭…"
          />
          <Field
            label="经历故事"
            value={myProfile.experiences}
            onChange={(v) => onChange({ myProfile: { ...myProfile, experiences: v } })}
            placeholder="值得分享的经历…"
          />
          <Field
            label="闪光点 / 特长"
            value={myProfile.strengths}
            onChange={(v) => onChange({ myProfile: { ...myProfile, strengths: v } })}
            placeholder="细心、幽默、会倾听…"
          />
          <Field
            label="擅长话题"
            value={myProfile.topics}
            onChange={(v) => onChange({ myProfile: { ...myProfile, topics: v } })}
            placeholder="旅行、美食、电影…"
          />
        </div>
      </div>

      <div className="p-3 rounded-xl border border-pink-500/20 bg-pink-950/10">
        <p className="text-sm font-medium text-pink-200 mb-1">对方资料卡 · 聊天定制</p>
        <p className="text-[11px] text-soul-500 mb-3">7 维度记录 TA 的偏好，产出高度定制回复</p>
        <div className="space-y-2">
          {OTHER_PROFILE_DIMENSIONS.map(({ key, label }) => (
            <Field
              key={key}
              label={label}
              value={otherProfile[key]}
              onChange={(v) =>
                onChange({ otherProfile: { ...otherProfile, [key]: v } })
              }
              placeholder={`记录 TA 的${label}…`}
            />
          ))}
        </div>
      </div>

      <div className="p-3 rounded-xl border border-soul-700/30 bg-soul-900/30">
        <p className="text-sm font-medium text-soul-200 mb-1">聊天记忆</p>
        <p className="text-[11px] text-soul-500 mb-2">忌口、心愿、随口提过的小事（每行一条）</p>
        <Field
          label="专属记忆"
          value={partnerMemory.details}
          onChange={(v) =>
            onChange({ partnerMemory: { ...partnerMemory, details: v, updatedAt: Date.now() } })
          }
          placeholder={'不爱吃香菜\n下周要考试\n喜欢猫不喜欢狗…'}
          rows={4}
        />
      </div>
    </div>
  );
}
