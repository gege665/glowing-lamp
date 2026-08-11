import { describe, it, expect } from 'vitest';
import { parseAnalysisJsonObject, extractFirstJsonObject } from './analysisJsonParse';

describe('analysisJsonParse', () => {
  it('解析纯 JSON', () => {
    const obj = parseAnalysisJsonObject('{"summary":"你好","emotion":{"primary":"平静"}}');
    expect(obj.summary).toBe('你好');
  });

  it('解析 markdown 代码块', () => {
    const raw = '```json\n{"summary":"测试"}\n```';
    expect(parseAnalysisJsonObject(raw).summary).toBe('测试');
  });

  it('JSON 在 think 标签之前时不被误删', () => {
    const raw = '{"summary":"通过了","emotion":{"primary":"平静"}}后续思考文字';
    expect(parseAnalysisJsonObject(raw).summary).toBe('通过了');
  });

  it('移除 think 块后解析 JSON', () => {
    const raw = '先想想\n{"summary":"ok"}';
    expect(parseAnalysisJsonObject(raw).summary).toBe('ok');
  });

  it('提取嵌套 JSON', () => {
    const raw = '说明文字 {"summary":"ok","strategy":{"nextMove":"hi"}} 尾部';
    const slice = extractFirstJsonObject(raw);
    expect(JSON.parse(slice).summary).toBe('ok');
  });
});
