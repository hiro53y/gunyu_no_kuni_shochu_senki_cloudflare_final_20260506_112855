// 保存：本陣（国盗り）・合戦の途中（毎手）・季節の始めの写し・設定。壊れたデータは読み込まない
import { REGIONS } from '../content/sengoku';
import { KINDS } from '../battle/kinds';
import { BATTLE_VERSION } from '../battle/engine';
import type { Battle } from '../battle/types';
import { CAMPAIGN_VERSION, DEFAULT_SETTINGS, type Campaign, type Settings } from '../campaign/state';

export const KEY_BATTLE = 'gunyu4:battle';
export const KEY_CAMPAIGN = 'gunyu4:campaign';
export const KEY_SNAPSHOT = 'gunyu4:turnstart';
export const KEY_SETTINGS = 'gunyu4:settings';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function store(): KV | null {
  try {
    return (globalThis as { localStorage?: KV }).localStorage ?? null;
  } catch {
    return null;
  }
}

const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n);

/** 読み込んだ合戦が、今の版で続けられる形か */
export function validBattle(value: unknown): value is Battle {
  const b = value as Battle;
  if (!b || b.v !== BATTLE_VERSION || !Array.isArray(b.units) || !b.units.length) return false;
  if (![b.time, b.limit, b.rng, b.gaugeAdj].every(num)) return false;
  return b.units.every((u) => !!KINDS[u.kind] && [u.troops, u.maxTroops, u.ap, u.next].every(num) && Array.isArray(u.skills));
}

export function deserializeBattle(text: string | null): Battle | null {
  if (!text) return null;
  try {
    const b = JSON.parse(text) as Battle;
    return validBattle(b) ? b : null;
  } catch {
    return null;
  }
}

export function validCampaign(value: unknown): value is Campaign {
  const c = value as Campaign;
  if (!c || c.v !== CAMPAIGN_VERSION) return false;
  if (!c.regions || REGIONS.some((r) => !c.regions[r.id]) || !c.gens || !c.factions || !c.gens.g_saku) return false;
  for (const n of [c.turn, c.ap, c.gold, c.rng]) if (!num(n)) return false;
  return Object.values(c.gens).every((g) => !!KINDS[g.kind] && num(g.troops) && num(g.lv));
}

export function deserializeCampaign(text: string | null): Campaign | null {
  if (!text) return null;
  try {
    const c = JSON.parse(text) as Campaign;
    if (!validCampaign(c)) return null;
    // 足りない項目は補う（版の中での追加）
    c.scenes ??= [];
    c.invasions ??= [];
    c.captives ??= [];
    c.flags ??= {};
    c.titles ??= {};
    c.news ??= [];
    return c;
  } catch {
    return null;
  }
}

function put(kv: KV | null, key: string, value: string | null) {
  if (!kv) return;
  try {
    if (value === null) kv.removeItem(key);
    else kv.setItem(key, value);
  } catch {
    // 容量不足などで保存できなくても遊びは続ける
  }
}

function get(kv: KV | null, key: string): string | null {
  if (!kv) return null;
  try {
    return kv.getItem(key);
  } catch {
    return null;
  }
}

export function saveBattle(b: Battle | null, kv: KV | null = store()) {
  put(kv, KEY_BATTLE, b ? JSON.stringify(b) : null);
}

export function loadBattle(kv: KV | null = store()): Battle | null {
  return deserializeBattle(get(kv, KEY_BATTLE));
}

export function saveCampaign(c: Campaign | null, kv: KV | null = store()) {
  put(kv, KEY_CAMPAIGN, c ? JSON.stringify(c) : null);
}

export function loadCampaign(kv: KV | null = store()): Campaign | null {
  return deserializeCampaign(get(kv, KEY_CAMPAIGN));
}

/** 季節の始めの写し（落城した時にやり直す） */
export function saveSnapshot(c: Campaign | null, kv: KV | null = store()) {
  put(kv, KEY_SNAPSHOT, c ? JSON.stringify(c) : null);
}

export function loadSnapshot(kv: KV | null = store()): Campaign | null {
  return deserializeCampaign(get(kv, KEY_SNAPSHOT));
}

export function saveSettings(s: Settings, kv: KV | null = store()) {
  put(kv, KEY_SETTINGS, JSON.stringify(s));
}

export function loadSettings(kv: KV | null = store()): Settings {
  try {
    const raw = get(kv, KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
