import { describe, expect, it, vi } from 'vitest';
import { processSsePayload } from './aiService';

describe('processSsePayload', () => {
  it('appends delta chunks and reports accumulated content', () => {
    const onChunk = vi.fn();

    const first = processSsePayload({ type: 'chunk', delta: '你' }, { onChunk }, '');
    const second = processSsePayload({ type: 'chunk', delta: '好' }, { onChunk }, first ?? '');

    expect(first).toBe('你');
    expect(second).toBe('你好');
    expect(onChunk).toHaveBeenNthCalledWith(1, '你');
    expect(onChunk).toHaveBeenNthCalledWith(2, '你好');
  });

  it('does not emit the same completed content twice', () => {
    const onChunk = vi.fn();
    const onModelResolved = vi.fn();

    const content = processSsePayload(
      { type: 'done', content: '你好', model: 'fast-model' },
      { onChunk, onModelResolved },
      '你好'
    );

    expect(content).toBe('你好');
    expect(onChunk).not.toHaveBeenCalled();
    expect(onModelResolved).toHaveBeenCalledWith({
      model: 'fast-model',
      requestedModel: undefined,
      modelSwitched: undefined,
    });
  });

  it('still emits done content when no chunks arrived', () => {
    const onChunk = vi.fn();

    expect(
      processSsePayload({ type: 'done', content: '完整回复' }, { onChunk }, '')
    ).toBe('完整回复');
    expect(onChunk).toHaveBeenCalledOnce();
  });
});
