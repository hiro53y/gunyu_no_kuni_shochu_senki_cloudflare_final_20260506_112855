export { KNOWN_PORTRAIT_KEYS, normalizePortraitKey } from '../data/portraitKeys';
import { APP_ASSET_VERSION } from '../appVersion';

export function portraitUrl(key: string, ext: 'png' | 'jpg'): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/assets/portraits/${key}.${ext}?v=${APP_ASSET_VERSION}`;
}
