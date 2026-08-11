/** 再导出 shared，保持前后端饱和错误判定一致 */
export {
  UPSTREAM_BUSY_PATTERN,
  isUpstreamBusyMessage,
  formatUpstreamBusyUserMessage,
} from '../../shared/upstreamErrors.js';
