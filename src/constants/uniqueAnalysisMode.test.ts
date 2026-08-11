import { describe, it, expect } from 'vitest';
import {
  UNIQUE_ANALYSIS_COACH_BRIEF,
  UNIQUE_ANALYSIS_COACH_DIRECTIVE,
  UNIQUE_ANALYSIS_PILLARS,
  COACHING_PATH_STEPS,
  UNIQUE_ANALYSIS_DEMO_SCENARIO,
  UNIQUE_ANALYSIS_POSITIONING,
} from './uniqueAnalysisMode';
import {
  UNIQUE_ANALYSIS_SYSTEM_PROMPT,
  UNIQUE_ANALYSIS_DEMO_ASSISTANT_OUTPUT,
} from './uniqueAnalysisSystemPrompt';

describe('uniqueAnalysisMode', () => {
  it('定位为沟通教练而非话术机', () => {
    expect(UNIQUE_ANALYSIS_POSITIONING.role).toBe('私人沟通教练');
    expect(UNIQUE_ANALYSIS_POSITIONING.mission).toContain('不取代用户');
    expect(UNIQUE_ANALYSIS_COACH_DIRECTIVE).toContain('不是话术生成器');
    expect(UNIQUE_ANALYSIS_COACH_DIRECTIVE).toContain('授人以渔');
    expect(UNIQUE_ANALYSIS_COACH_DIRECTIVE).toContain('她什么心思');
    expect(UNIQUE_ANALYSIS_COACH_DIRECTIVE).toContain('分析意图 → 核心策略 → 多套回复');
  });

  it('快路径简版教练纲显著短于完整版', () => {
    expect(UNIQUE_ANALYSIS_COACH_BRIEF).toContain('读心→策略→回复方向');
    expect(UNIQUE_ANALYSIS_COACH_BRIEF.length).toBeLessThan(
      UNIQUE_ANALYSIS_COACH_DIRECTIVE.length * 0.35
    );
  });

  it('三大功能齐全', () => {
    expect(UNIQUE_ANALYSIS_PILLARS.map((p) => p.id)).toEqual([
      'mind_read',
      'strategy_first',
      'multi_plan',
    ]);
  });

  it('教练路径三步', () => {
    expect(COACHING_PATH_STEPS).toHaveLength(3);
    expect(COACHING_PATH_STEPS[0].label).toContain('心思');
    expect(COACHING_PATH_STEPS[1].label).toContain('策略');
    expect(COACHING_PATH_STEPS[2].label).toContain('怎么回');
  });

  it('演示场景为诱惑表白型废物测试', () => {
    expect(UNIQUE_ANALYSIS_DEMO_SCENARIO.herMessage).toContain('对很多女生');
    expect(UNIQUE_ANALYSIS_DEMO_SCENARIO.mind).toContain('废物测试');
    expect(UNIQUE_ANALYSIS_DEMO_SCENARIO.sampleReplies).toHaveLength(4);
  });
});

describe('uniqueAnalysisSystemPrompt', () => {
  it('覆盖产品六条规则与强制结构', () => {
    expect(UNIQUE_ANALYSIS_SYSTEM_PROMPT).toContain('私人沟通教练');
    expect(UNIQUE_ANALYSIS_SYSTEM_PROMPT).toContain('不做话术生成器');
    expect(UNIQUE_ANALYSIS_SYSTEM_PROMPT).toContain('科技赋能情感');
    expect(UNIQUE_ANALYSIS_SYSTEM_PROMPT).toContain('分析意图');
    expect(UNIQUE_ANALYSIS_SYSTEM_PROMPT).toContain('核心策略');
    expect(UNIQUE_ANALYSIS_SYSTEM_PROMPT).toContain('多套回复');
    expect(UNIQUE_ANALYSIS_SYSTEM_PROMPT).toContain('诱惑表白型废物测试');
  });

  it('演示输出含判定与三步结构', () => {
    expect(UNIQUE_ANALYSIS_DEMO_ASSISTANT_OUTPUT).toContain('诱惑表白型废物测试');
    expect(UNIQUE_ANALYSIS_DEMO_ASSISTANT_OUTPUT).toContain('为什么这么回');
    expect(UNIQUE_ANALYSIS_DEMO_ASSISTANT_OUTPUT).toContain('【轻松幽默】');
  });
});
