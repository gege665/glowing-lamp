import { describe, it, expect } from 'vitest';
import {
  lineLooksLikeOpeningCringe,
  buildSceneReplyGuideBlock,
} from '../constants/sceneReplyGuides';
import { isFriendApprovalMessage } from '../utils/targetedReply';
import { lineLooksTooOfficial } from '../utils/replyQuality';
import { CORE_EIGHT_STYLES } from '../constants/coreReplyStyles';

describe('sceneReplyGuides', () => {
  it('拦截刚加好友套路话术', () => {
    expect(lineLooksLikeOpeningCringe('终于等到你通过啦，差点以为我手机坏了～')).toBe(true);
    expect(lineLooksLikeOpeningCringe('加你好友就是想多了解你，别嫌我烦哈～')).toBe(true);
    expect(lineLooksLikeOpeningCringe('今天过得怎么样呀，有没有什么开心的事？')).toBe(true);
    expect(lineLooksLikeOpeningCringe('刚加好友先熟悉一下，有想聊的话题随时找我。')).toBe(true);
    expect(lineLooksLikeOpeningCringe('我叫阿宁，刚通过你这边')).toBe(true);
    expect(lineLooksLikeOpeningCringe('我是阿宁，刚加你想打个招呼')).toBe(true);
    expect(lineLooksLikeOpeningCringe('我叫阿宁，别急着拉黑我')).toBe(true);
    expect(lineLooksLikeOpeningCringe('通过了，我是来认识你的')).toBe(true);
    expect(lineLooksLikeOpeningCringe('我是刚加你的，想认真聊聊')).toBe(true);
    expect(lineLooksLikeOpeningCringe('你一问，我先自报家门了')).toBe(true);
    expect(lineLooksLikeOpeningCringe('嗨，我是刚加你的那位')).toBe(true);
    expect(lineLooksLikeOpeningCringe('我，刚通过你好友')).toBe(true);
    expect(lineLooksLikeOpeningCringe('嗨，可算加上了，我还以为手速太慢了😂')).toBe(false);
    expect(lineLooksLikeOpeningCringe('头像挺有意思，加上了')).toBe(false);
    expect(lineLooksLikeOpeningCringe('通过了，有点想认识你～')).toBe(true);
  });

  it('first_add 指南含严禁套话与开场铁律', () => {
    const block = buildSceneReplyGuideBlock('first_add', CORE_EIGHT_STYLES.slice(0, 5));
    expect(block).toContain('刚通过好友申请');
    expect(block).toContain('严禁套话');
    expect(block).toContain('终于等到你通过');
    expect(block).toContain('开场铁律');
    expect(block).toContain('自我介绍');
  });
});

describe('isFriendApprovalMessage', () => {
  it('识别通过好友类短消息', () => {
    expect(isFriendApprovalMessage('通过了')).toBe(true);
    expect(isFriendApprovalMessage('你好呀')).toBe(true);
    expect(isFriendApprovalMessage('你谁？什么事？')).toBe(false);
  });
});

describe('replyQuality · 官方套话扩展', () => {
  it('拦截加好友油腻句', () => {
    expect(lineLooksTooOfficial('加你好友就是想多了解你')).toBe(true);
    expect(lineLooksTooOfficial('嗨，可算加上了😂')).toBe(false);
  });
});
