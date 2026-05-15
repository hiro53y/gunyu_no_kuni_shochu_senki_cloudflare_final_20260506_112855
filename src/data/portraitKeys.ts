import type { General, GenericTrait } from '../types/game';
import { UNIQUE_GENERAL_TEMPLATES } from './generals';

const GENERIC_KEYS: Record<GenericTrait, string> = {
  normal: 'generic_normal',
  attacker: 'generic_attacker',
  defender: 'generic_defender',
  strategist: 'generic_strategist',
  commander: 'generic_commander',
  sniper: 'generic_sniper',
  wild: 'generic_wild',
  gem: 'generic_gem',
};

const UNIQUE_KEYS = new Map(UNIQUE_GENERAL_TEMPLATES.map((g) => [g.id, g.portraitKey]));

export const KNOWN_PORTRAIT_KEYS = new Set<string>([
  ...UNIQUE_GENERAL_TEMPLATES.map((g) => g.portraitKey),
  ...Object.values(GENERIC_KEYS),
  'youma_grunt',
]);

export function normalizePortraitKey(general: Pick<General, 'id' | 'portraitKey' | 'trait' | 'factionId' | 'homeFactionId'>): string {
  const uniqueKey = UNIQUE_KEYS.get(general.id);
  if (uniqueKey) return uniqueKey;
  if (general.factionId === 'youma' || general.homeFactionId === 'youma') return 'youma_grunt';
  if (KNOWN_PORTRAIT_KEYS.has(general.portraitKey)) return general.portraitKey;
  return GENERIC_KEYS[general.trait] ?? 'generic_normal';
}
