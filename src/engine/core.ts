// 1手の処理で使う共通の道具：記録・出来事・乱数・道具の名前と値段・強さの計算
import { itemDef, UNID_CATS, SEALS } from '../content/items';
import { monDef } from '../content/monsters';
import type { Rng } from './rng';
import type { GameEvent, Item, LogLine, Monster, Run } from './types';

export interface Ctx {
  run: Run;
  ev: GameEvent[];
  r: Rng;
  /** 距離の地図（プレイヤーからの）を1回の敵の手番でまとめて使う */
  fields: Map<string, Int16Array>;
}

export function makeCtx(run: Run): Ctx {
  return { run, ev: [], r: { s: run.rng }, fields: new Map() };
}

/** 乱数の状態を run に書き戻す */
export function closeCtx(ctx: Ctx) {
  ctx.run.rng = ctx.r.s;
}

export const MAX_LOG = 80;

export function log(ctx: Ctx, t: string, c?: LogLine['c']) {
  const lines = ctx.run.log;
  const last = lines[lines.length - 1];
  // 同じ文が続く時はまとめる
  const m = last && /^(.*?)(?: ×(\d+))?$/.exec(last.t);
  if (m && m[1] === t) {
    last.t = `${t} ×${(Number(m[2]) || 1) + 1}`;
  } else {
    lines.push(c ? { t, c } : { t });
    if (lines.length > MAX_LOG) lines.splice(0, lines.length - MAX_LOG);
  }
}

export function ev(ctx: Ctx, e: GameEvent) {
  ctx.ev.push(e);
}

export function newUid(run: Run): number {
  return run.nextUid++;
}

// ── 道具の名前・正体 ──

export function typeKnown(run: Run, id: string): boolean {
  const def = itemDef(id);
  return !UNID_CATS.includes(def.cat) || !!run.known[id];
}

export function itemName(run: Run, item: Item, opts: { plain?: boolean } = {}): string {
  const def = itemDef(item.id);
  if (def.cat === 'gold') return `${item.count ?? 0}文`;
  let name = def.name;
  if (!typeKnown(run, item.id)) {
    name = run.fake[item.id] ?? def.name;
    if (run.named[item.id]) name = `${run.named[item.id]}（${name}）`;
  }
  if (def.cat === 'arrow') return `${item.count ?? 0}本の${name}`;
  if (opts.plain) return name;
  if ((def.cat === 'weapon' || def.cat === 'armor') && item.known) {
    const plus = item.plus ?? 0;
    if (plus !== 0) name += plus > 0 ? `+${plus}` : `${plus}`;
  }
  if (def.cat === 'staff' && typeKnown(run, item.id) && item.known) name += `[${item.charges ?? 0}]`;
  if (def.cat === 'pot' && typeKnown(run, item.id) && item.known) name += `[${Math.max(0, (item.cap ?? 0) - (item.contents?.length ?? 0))}]`;
  return name;
}

/** 印（最初から付いているものを含む） */
export function sealsOf(item: Item | null | undefined): string[] {
  if (!item) return [];
  const def = itemDef(item.id);
  const out = def.seal ? [def.seal] : [];
  for (const s of item.seals ?? []) if (!out.includes(s)) out.push(s);
  return out;
}

export function sealSlots(item: Item): number {
  return itemDef(item.id).slots ?? 0;
}

export function sealText(item: Item): string {
  const seals = sealsOf(item);
  return seals.length ? `［${seals.join('')}］` : '';
}

export function sealDesc(seal: string): string {
  return SEALS[seal] ? `${SEALS[seal].name}：${SEALS[seal].desc}` : seal;
}

/** 店の買値 */
export function buyPrice(item: Item): number {
  const def = itemDef(item.id);
  let p = def.price;
  if (def.cat === 'weapon' || def.cat === 'armor') {
    p = Math.max(Math.round(def.price * 0.5), Math.round(def.price * (1 + 0.25 * (item.plus ?? 0)))) + 200 * (item.seals?.length ?? 0);
  } else if (def.cat === 'staff') {
    p = def.price + Math.round(def.price * 0.1) * (item.charges ?? 0);
  } else if (def.cat === 'pot') {
    p = def.price + 50 * (item.cap ?? 0);
  } else if (def.cat === 'arrow') {
    p = def.price * (item.count ?? 1);
  }
  return Math.max(1, p);
}

export function sellPrice(item: Item): number {
  return Math.max(1, Math.floor(buyPrice(item) / 2));
}

// ── 装備と強さ ──

export function equipped(run: Run, slot: 'weapon' | 'armor' | 'charm' | 'arrow'): Item | null {
  const uid = run.player.eq[slot];
  if (uid === undefined) return null;
  return run.player.inv.find((i) => i.uid === uid) ?? null;
}

export function isEquipped(run: Run, item: Item): boolean {
  const eq = run.player.eq;
  return eq.weapon === item.uid || eq.armor === item.uid || eq.charm === item.uid || eq.arrow === item.uid;
}

export function charmIs(run: Run, id: string): boolean {
  const charm = equipped(run, 'charm');
  return !!charm && charm.id === id;
}

export function hasSeal(run: Run, seal: string): boolean {
  return sealsOf(equipped(run, 'weapon')).includes(seal) || sealsOf(equipped(run, 'armor')).includes(seal);
}

/** レベルの必要経験値（そのレベルになるのに必要な合計） */
export function expFor(lv: number): number {
  return lv <= 1 ? 0 : Math.floor(10 * Math.pow(lv - 1, 2.1));
}

export function playerAttack(run: Run): number {
  const p = run.player;
  const weapon = equipped(run, 'weapon');
  const wp = weapon ? (itemDef(weapon.id).power ?? 0) + (weapon.plus ?? 0) : 0;
  const base = 3 + p.lv * 1.05;
  const strMul = 0.6 + 0.05 * Math.max(0, p.str);
  const buff = p.st.power ? p.st.powerK ?? 1.3 : 1;
  return Math.max(1, ((base + Math.max(0, wp)) * strMul + (charmIs(run, 'c_gouriki') ? 4 : 0)) * buff);
}

export function playerDefense(run: Run): number {
  const armor = equipped(run, 'armor');
  const ap = armor ? (itemDef(armor.id).power ?? 0) + (armor.plus ?? 0) : 0;
  return Math.max(0, ap + (charmIs(run, 'c_kongou') ? 4 : 0));
}

// ── 敵の強さ ──

export function monAtk(m: Monster): number {
  const def = monDef(m.id);
  let a = (m.atkV ?? def.atk * (m.scale ?? 1)) * (1 + 0.08 * (m.bonus ?? 0));
  if (m.st.weak) a *= 0.5;
  if (m.st.power) a *= m.st.powerK ?? 1.3;
  return Math.max(1, a);
}

export function monDefense(m: Monster): number {
  const def = monDef(m.id);
  return (m.defV ?? def.def * (m.scale ?? 1)) * (1 + 0.05 * (m.bonus ?? 0));
}

export function monName(m: Monster): string {
  return m.gname ?? monDef(m.id).name;
}

/** 打撃の計算：攻撃力 × ゆらぎ × 防御による軽減 */
export function damageRoll(atk: number, def: number, k: number, roll: number): number {
  return Math.max(1, Math.round(atk * (0.88 + roll * 0.24) * (k / (k + Math.max(0, def)))));
}
