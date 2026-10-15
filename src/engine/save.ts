// 保存：本陣（国盗り）・出陣中の冒険（毎ターン）・ターンの始めの写し・設定。壊れたデータは読み込まない
import { ITEM_BY_ID } from '../content/items';
import { MON_BY_ID } from '../content/monsters';
import { REGIONS } from '../content/sengoku';
import { CAMPAIGN_VERSION, DEFAULT_SETTINGS, type Campaign, type Settings } from '../campaign/state';
import { RUN_VERSION } from './run';
import type { Item, Run } from './types';

export const KEY_RUN = 'gunyu3:run';
export const KEY_CAMPAIGN = 'gunyu3:campaign';
export const KEY_SNAPSHOT = 'gunyu3:turnstart';
export const KEY_SETTINGS = 'gunyu3:settings';

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

function validItems(items: unknown): boolean {
  if (!Array.isArray(items)) return false;
  return items.every((i) => {
    const item = i as Item;
    return item && typeof item.uid === 'number' && typeof item.id === 'string' && !!ITEM_BY_ID[item.id] && (!item.contents || validItems(item.contents));
  });
}

/** 読み込んだ冒険が、今の版で遊べる形か */
export function validRun(value: unknown): value is Run {
  const run = value as Run;
  if (!run || run.v !== RUN_VERSION) return false;
  if (!run.player || !run.floor || !Array.isArray(run.monsters) || !Array.isArray(run.log) || !run.gens || !Array.isArray(run.party)) return false;
  const f = run.floor;
  if (!Array.isArray(f.tiles) || f.tiles.length !== f.w * f.h || !Array.isArray(f.seen) || f.seen.length !== f.tiles.length) return false;
  if (!validItems(run.player.inv) || !validItems(f.items.map((fi) => fi.item))) return false;
  if (!run.monsters.every((m) => !!MON_BY_ID[m.id] && (!m.gen || !!run.gens[m.gen]))) return false;
  for (const n of [run.player.hp, run.player.maxHp, run.player.lv, run.player.hunger, run.rng, run.turn, run.floorNo]) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return false;
  }
  return true;
}

export function deserializeRun(text: string | null): Run | null {
  if (!text) return null;
  try {
    const run = JSON.parse(text) as Run;
    return validRun(run) ? run : null;
  } catch {
    return null;
  }
}

export function validCampaign(value: unknown): value is Campaign {
  const c = value as Campaign;
  if (!c || c.v !== CAMPAIGN_VERSION) return false;
  if (!c.regions || REGIONS.some((r) => !c.regions[r.id]) || !c.gens || !c.lord || !c.factions) return false;
  if (!validItems(c.store)) return false;
  for (const n of [c.turn, c.ap, c.gold, c.rng, c.lord.lv, c.lord.maxHp]) if (typeof n !== 'number' || !Number.isFinite(n)) return false;
  return true;
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

export function saveRun(run: Run | null, kv: KV | null = store()) {
  put(kv, KEY_RUN, run ? JSON.stringify(run) : null);
}

export function loadRun(kv: KV | null = store()): Run | null {
  return deserializeRun(get(kv, KEY_RUN));
}

export function saveCampaign(c: Campaign | null, kv: KV | null = store()) {
  put(kv, KEY_CAMPAIGN, c ? JSON.stringify(c) : null);
}

export function loadCampaign(kv: KV | null = store()): Campaign | null {
  return deserializeCampaign(get(kv, KEY_CAMPAIGN));
}

/** ターンの始めの写し（負けた時にやり直す） */
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
