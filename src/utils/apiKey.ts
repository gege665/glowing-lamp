/**
 * 再导出 shared 实现，避免前后端两套 normalize / Invalid token 文案漂移。
 */
export {
  normalizeApiKey,
  humanizeInvalidTokenError,
  detectProviderFromKey,
  validateKeyForProvider,
} from '../../shared/apiKeyRouting.js';
