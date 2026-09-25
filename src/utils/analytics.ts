export type AnalyticsEvent =
  | 'generate_start'
  | 'generate_success'
  | 'generate_fail'
  | 'analysis_degraded'
  | 'ocr_import'
  | 'bulk_import';

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

/** 轻量埋点：DEV 打日志；派发 CustomEvent 便于后续接第三方 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (import.meta.env.MODE === 'test') return;

  const detail = {
    event,
    t: Date.now(),
    ...props,
  };

  if (import.meta.env.DEV) {
    console.debug('[analytics]', detail);
  }

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('soul:analytics', { detail }));
    }
  } catch {
    /* ignore */
  }
}
