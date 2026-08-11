import { useMemo, useState } from 'react';
import { UserRound, Heart, IdCard } from 'lucide-react';
import type { MyProfileCard, OtherProfileCard, PartnerMemory } from '../types';
import {
  MY_PROFILE_DIMENSIONS,
  OTHER_PROFILE_DIMENSIONS,
  countFilledFields,
} from '../constants/dualProfile';

interface ProfileCardsSectionProps {
  myProfile: MyProfileCard;
  otherProfile: OtherProfileCard;
  partnerMemory: PartnerMemory;
  onChange: (patch: {
    myProfile?: Partial<MyProfileCard>;
    otherProfile?: Partial<OtherProfileCard>;
    partnerMemory?: Partial<PartnerMemory>;
  }) => void;
  /** 紧凑：默认只展开一组 */
  compact?: boolean;
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

const MY_GROUPS = ['表达', '生活', '背景', '关系'] as const;

export default function ProfileCardsSection({
  myProfile,
  otherProfile,
  partnerMemory,
  onChange,
  compact = false,
}: ProfileCardsSectionProps) {
  const myFilled = countFilledFields(
    myProfile as unknown as Record<string, string>,
    MY_PROFILE_DIMENSIONS
  );
  const otherFilled = countFilledFields(
    otherProfile as unknown as Record<string, string>,
    OTHER_PROFILE_DIMENSIONS
  );

  const [expandAllMy, setExpandAllMy] = useState(!compact);
  const [openMyGroup, setOpenMyGroup] = useState<string>('表达');
  const [otherOpen, setOtherOpen] = useState(true);

  const groupedMy = useMemo(
    () =>
      MY_GROUPS.map((g) => ({
        group: g,
        items: MY_PROFILE_DIMENSIONS.filter((d) => d.group === g),
      })),
    []
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/40 to-amber-950/20 p-3">
        <div className="flex items-center gap-2 mb-1">
          <IdCard className="w-4 h-4 text-rose-300" />
          <p className="text-sm font-semibold text-rose-100">灵焰双资料卡定制模式</p>
        </div>
        <p className="text-[11px] text-soul-400 leading-relaxed">
          录入我的 20 项 + 对方 7 项。后续回复/话题/话术严格贴合你的人设与说话方式，规避对方禁忌、贴合喜好——一对一，不通用、不模板。
        </p>
        <div className="mt-2.5 flex gap-3 text-[11px]">
          <span className="text-sky-300">我的资料 {myFilled}/20</span>
          <span className="text-pink-300">对方专属 {otherFilled}/7</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-soul-900/80 overflow-hidden flex">
          <div
            className="h-full bg-sky-500/70 transition-all"
            style={{ width: `${(myFilled / 20) * 50}%` }}
          />
          <div
            className="h-full bg-pink-500/70 transition-all"
            style={{ width: `${(otherFilled / 7) * 50}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-sky-500/20 bg-sky-950/15 overflow-hidden">
        <div className="px-3 py-2.5 flex items-center gap-2 border-b border-sky-500/15">
          <UserRound className="w-4 h-4 text-sky-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sky-100">我的资料卡 · 20 项</p>
            <p className="text-[10px] text-soul-500">人设 · 性格 · 说话方式 · 生活背景</p>
          </div>
          <button
            type="button"
            onClick={() => setExpandAllMy((v) => !v)}
            className="text-[11px] text-sky-300/90 shrink-0 min-h-[36px] px-1"
          >
            {expandAllMy ? '分组收起' : '全部展开'} · {myFilled}/20
          </button>
        </div>
        <div className="p-2 space-y-1.5">
          {groupedMy.map(({ group, items }) => {
            const filled = items.filter((d) =>
              Boolean(myProfile[d.key as keyof MyProfileCard]?.trim())
            ).length;
            const visible = expandAllMy || openMyGroup === group;
            return (
              <div key={group} className="rounded-xl border border-soul-700/30 bg-soul-950/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (expandAllMy) {
                      setExpandAllMy(false);
                      setOpenMyGroup(group);
                    } else {
                      setOpenMyGroup((prev) => (prev === group ? '' : group));
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left min-h-[44px] touch-manipulation"
                >
                  <span className="text-xs font-medium text-soul-200">{group}</span>
                  <span className="text-[10px] text-soul-500">
                    {filled}/{items.length}
                    {visible ? ' · 收起' : ' · 展开'}
                  </span>
                </button>
                {visible && (
                  <div className="px-3 pb-3 space-y-2 border-t border-soul-700/20 pt-2">
                    {items.map((d) => (
                      <Field
                        key={d.key}
                        label={d.label}
                        value={myProfile[d.key as keyof MyProfileCard] ?? ''}
                        onChange={(v) =>
                          onChange({ myProfile: { ...myProfile, [d.key]: v } })
                        }
                        placeholder={d.placeholder}
                        rows={2}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-pink-500/20 bg-pink-950/15 overflow-hidden">
        <button
          type="button"
          onClick={() => setOtherOpen(!otherOpen)}
          className="w-full px-3 py-2.5 flex items-center gap-2 border-b border-pink-500/15 text-left min-h-[48px] touch-manipulation"
        >
          <Heart className="w-4 h-4 text-pink-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-pink-100">对方资料卡 · 7 项专属</p>
            <p className="text-[10px] text-soul-500">喜好贴合 · 禁忌规避 · 一对一定制</p>
          </div>
          <span className="text-[11px] text-pink-300 shrink-0">
            {otherOpen ? '收起' : '展开'} · {otherFilled}/7
          </span>
        </button>
        {otherOpen && (
          <div className="p-3 space-y-2">
            {OTHER_PROFILE_DIMENSIONS.map((d) => (
              <Field
                key={d.key}
                label={d.label}
                value={otherProfile[d.key as keyof OtherProfileCard] ?? ''}
                onChange={(v) =>
                  onChange({ otherProfile: { ...otherProfile, [d.key]: v } })
                }
                placeholder={d.placeholder}
                rows={d.key === 'dislikes' || d.key === 'notes' ? 3 : 2}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl border border-soul-700/30 bg-soul-900/30">
        <p className="text-sm font-medium text-soul-200 mb-1">聊天记忆</p>
        <p className="text-[11px] text-soul-500 mb-2">
          忌口、心愿、随口提过的小事（每行一条），与资料卡一起调用
        </p>
        <Field
          label="专属记忆"
          value={partnerMemory.details}
          onChange={(v) =>
            onChange({
              partnerMemory: { ...partnerMemory, details: v, updatedAt: Date.now() },
            })
          }
          placeholder={'不爱吃香菜\n下周要考试\n喜欢猫不喜欢狗…'}
          rows={4}
        />
      </div>
    </div>
  );
}
