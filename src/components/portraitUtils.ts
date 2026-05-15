export { KNOWN_PORTRAIT_KEYS, normalizePortraitKey } from '../data/portraitKeys';

export function portraitUrl(key: string, ext: 'png' | 'jpg'): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/assets/portraits/${key}.${ext}`;
}
