// 絵の読み込み：妖怪の PNG と描き足した SVG、武将の駒（立ち絵の顔）、兵（勢力の色で塗る）
import { ITEM_ART, MONSTER_ART, TRAP_ART } from '../art/monsters';
import { itemDef } from '../content/items';
import { monDef } from '../content/monsters';
import { soldierSprite } from './soldiers';

/** 立ち絵（駒と会話の絵）の名前 */
export const PORTRAITS = [
  'akatsuki_chikage', 'akatsuki_genba', 'akatsuki_saku', 'akatsuki_suzuran', 'generic_attacker', 'generic_commander', 'generic_defender', 'generic_gem',
  'generic_normal', 'generic_sniper', 'generic_strategist', 'generic_wild', 'honoo_kurenai', 'honoo_tomoshibi', 'kurogane_genbu', 'kurogane_hayato',
  'kurogane_narukami', 'rengein_kangetsu', 'rengein_tesshin', 'ronin_kagemaru', 'ronin_yuzuriha', 'shion_fuuko', 'shion_hazuki', 'shion_souji',
  'shirasagi_rin', 'shirasagi_shizune', 'shirasagi_toshiro', 'youma_gaou', 'youma_grunt', 'youma_guren', 'youma_kurobuchi',
];

export const ASSET_VERSION = '20261015';

export function bustUrl(portrait: string): string {
  return `/assets/busts/${portrait}.webp?v=${ASSET_VERSION}`;
}

export function tokenUrl(portrait: string): string {
  return `/assets/tokens/${portrait}.webp?v=${ASSET_VERSION}`;
}

const PNG = [
  'enemy-tanuki', 'enemy-kitsune', 'enemy-armor', 'enemy-onibi', 'enemy-kappa',
  'enemy-rust-armor', 'enemy-shadow', 'item-herb', 'item-food', 'item-weapon', 'item-armor', 'item-offense', 'item-support', 'stairs',
  'trap-spike', 'trap-net', 'trap-fire',
];
const VERSION = '20261014';
export const SPRITE_PX = 128;

const images = new Map<string, HTMLImageElement>();
const cache = new Map<string, HTMLCanvasElement>();
let loading: Promise<void> | null = null;

function loadImage(key: string, src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { images.set(key, img); resolve(); };
    img.onerror = () => resolve();
    img.src = src;
  });
}

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** すべての絵を読み込む（1回だけ） */
export function loadSprites(): Promise<void> {
  if (loading) return loading;
  const jobs: Promise<void>[] = [];
  for (const name of PNG) jobs.push(loadImage(name, `/assets/sprites/v2/${name}.png?v=${VERSION}`));
  for (const name of PORTRAITS) jobs.push(loadImage(`face-${name}`, tokenUrl(name)));
  for (const [name, svg] of Object.entries(MONSTER_ART)) { painted.add(name); jobs.push(loadImage(name, svgUrl(svg))); }
  for (const [name, svg] of Object.entries(ITEM_ART)) { painted.add(`item-${name}`); jobs.push(loadImage(`item-${name}`, svgUrl(svg))); }
  for (const [name, svg] of Object.entries(TRAP_ART)) jobs.push(loadImage(`trap-${name}`, svgUrl(svg)));
  loading = Promise.all(jobs).then(() => undefined);
  return loading;
}

/** 描き足した絵（SVG）は、元の絵に近づけるため陰影と質感を重ねる */
const painted = new Set<string>();

function paint(g: CanvasRenderingContext2D) {
  const S = SPRITE_PX;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const shade = g.createLinearGradient(0, 0, S * 0.3, S);
  shade.addColorStop(0, 'rgba(255,236,200,0.16)');
  shade.addColorStop(0.55, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(24,10,30,0.42)');
  g.fillStyle = shade;
  g.fillRect(0, 0, S, S);
  // 筆の跡のような細かいまだら
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  g.restore();
}

/** 絵（色違いを含む）を 128px のキャンバスで返す */
export function sprite(key: string, hue = 0, tone = 1): HTMLCanvasElement | null {
  const ck = `${key}|${hue}|${tone}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const img = images.get(key);
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE_PX;
  const g = c.getContext('2d')!;
  if (hue || tone !== 1) g.filter = `hue-rotate(${hue}deg) brightness(${tone}) saturate(${hue ? 1.15 : 1})`;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, SPRITE_PX, SPRITE_PX);
  g.filter = 'none';
  if (painted.has(key)) paint(g);
  cache.set(ck, c);
  return c;
}

export function monsterSprite(id: string, color = '#8a6a4a', mon = '兵'): HTMLCanvasElement | null {
  const def = monDef(id);
  if (def.soldier) return soldierSprite(def.sprite, def.tier, color, mon);
  return sprite(def.sprite, def.hue, def.tone);
}

/** 武将の駒：顔を丸く切り抜き、勢力の色の枠を付ける */
export function tokenSprite(portrait: string, ring: string, kind: 'ally' | 'enemy' | 'boss' | 'lord'): HTMLCanvasElement | null {
  const key = `token|${portrait}|${ring}|${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const img = images.get(`face-${portrait}`) ?? null;
  const S = SPRITE_PX;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = S / 2 - 6;
  // 影
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.arc(S / 2 + 2, S / 2 + 4, r + 4, 0, Math.PI * 2); g.fill();
  // 枠
  g.fillStyle = ring;
  g.beginPath(); g.arc(S / 2, S / 2, r + 4, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, r - 4, 0, Math.PI * 2); g.clip();
  if (img) g.drawImage(img, S / 2 - r, S / 2 - r, r * 2, r * 2);
  else {
    // 絵が読めなかった時は「将」の字の駒にする
    g.fillStyle = '#2a1d18';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#f4ead8';
    g.font = `900 ${Math.round(r)}px serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('将', S / 2, S / 2 + 2);
  }
  // 上からの光
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, 'rgba(255,240,210,0.10)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  g.restore();
  g.strokeStyle = kind === 'boss' || kind === 'lord' ? '#f0cf6a' : 'rgba(255,255,255,0.55)';
  g.lineWidth = kind === 'boss' ? 5 : 3;
  g.beginPath(); g.arc(S / 2, S / 2, r - 3, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#120c08';
  g.lineWidth = 3;
  g.beginPath(); g.arc(S / 2, S / 2, r + 4, 0, Math.PI * 2); g.stroke();
  cache.set(key, c);
  return c;
}

const CAT_SPRITE: Record<string, string> = {
  weapon: 'item-weapon', armor: 'item-armor', grass: 'item-herb', food: 'item-food', scroll: 'item-offense', charm: 'item-support',
  staff: 'item-staff', pot: 'item-pot', arrow: 'item-arrow', gold: 'item-gold',
};

/** 種類ごとの色合い（同じ絵でも見分けやすく） */
const CAT_HUE: Record<string, number> = { weapon: 0, armor: 0, grass: 0, food: 0, scroll: 0, charm: 0, staff: 0, pot: 0, arrow: 0, gold: 0 };

export function itemSprite(id: string): HTMLCanvasElement | null {
  const def = itemDef(id);
  if (id === 's_seiiki') return sprite('item-sanctuary');
  return sprite(CAT_SPRITE[def.cat] ?? 'item-support', CAT_HUE[def.cat] ?? 0);
}

const TRAP_SPRITE: Record<string, string> = {
  pit: 'trap-net', bear: 'trap-spike', mine: 'trap-fire', arrow: 'trap-arrow', poison: 'trap-poison', warp: 'trap-warp', spin: 'trap-spin',
  sleep: 'trap-sleep', rust: 'trap-rust', hunger: 'trap-hunger', summon: 'trap-summon', gust: 'trap-gust', slow: 'trap-slow', curse: 'trap-curse',
};

export function trapSprite(id: string): HTMLCanvasElement | null {
  return sprite(TRAP_SPRITE[id] ?? 'trap-net');
}

export function playerSprite(): HTMLCanvasElement | null {
  return tokenSprite('akatsuki_saku', '#c84a4a', 'lord');
}

/** 図鑑やメニュー用の画像URL（キャンバスから作る） */
export function spriteUrl(c: HTMLCanvasElement | null): string {
  return c ? c.toDataURL('image/png') : '';
}
