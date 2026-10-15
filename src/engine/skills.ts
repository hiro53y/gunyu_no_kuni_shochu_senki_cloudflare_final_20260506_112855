// 武将の技：味方（朔と部隊）も敵の将も同じ仕組みで使う
import { skillDef, type SkillDef } from '../content/skills';
import { isYoukai } from '../content/monsters';
import { chance, next, range } from './rng';
import { at, cheb, cornerOk, inside, isWall, lineDir, monsterAt, visibleFrom } from './geo';
import { damageRoll, ev, log, monAtk, monDefense, monName, playerAttack, playerDefense, type Ctx } from './core';
import { hostile, hurtMonster, hurtPlayer } from './actors';
import { confusePlayer, scorch, sleepPlayer } from './combat';
import { DX, DY, type Dir, type Monster, type Pos, type Run } from './types';

export const LORD = 'g_saku';

/** 技を使う者：朔（'player'）か駒 */
type User = 'player' | Monster;
/** 技の当たる相手 */
type Target = 'player' | Monster;

const posOf = (run: Run, t: Target): Pos => (t === 'player' ? run.player : t);
const isParty = (u: User) => u === 'player' || !!u.ally;

function userName(run: Run, u: User): string {
  return u === 'player' ? '朔' : run.gens[u.gen ?? '']?.short ?? monName(u);
}

function userAtk(run: Run, u: User): number {
  return u === 'player' ? playerAttack(run) : monAtk(u);
}

/** 技を使う武将の駒（朔なら 'player'）。いなければ null */
export function userOf(run: Run, who: string): User | null {
  if (who === LORD) return run.end ? null : 'player';
  return run.monsters.find((m) => m.gen === who && !m.dead) ?? null;
}

/** その武将が今使える技の一覧 */
export function skillsOf(run: Run, who: string): string[] {
  if (who === LORD) return run.lordSkills ?? [];
  return run.gens[who]?.skills ?? [];
}

export function cooldown(run: Run, who: string, skill: string): number {
  return run.scd[who]?.[skill] ?? 0;
}

/** 相手方（技の当たる側） */
function foes(run: Run, u: User): Target[] {
  if (isParty(u)) return run.monsters.filter((m) => hostile(m) && !m.disguise && m !== u);
  const out: Target[] = [];
  if (!run.end) out.push('player');
  for (const m of run.monsters) if (m.ally && !m.dead) out.push(m);
  return out;
}

/** 味方（部隊の技の当たる側） */
function friends(run: Run, u: User): Target[] {
  if (isParty(u)) {
    const out: Target[] = ['player'];
    for (const m of run.monsters) if (m.ally && !m.dead) out.push(m);
    return out;
  }
  const me = u as Monster;
  return run.monsters.filter((m) => !m.dead && !m.ally && hostile(m) && cheb(m, me) <= 5);
}

function sightSet(run: Run, u: User): Set<number> {
  const p = posOf(run, u);
  return visibleFrom(run.floor, p.x, p.y);
}

function visibleFoes(run: Run, u: User): Target[] {
  const vis = sightSet(run, u);
  // 部隊の技は、朔から見えている相手にも届く
  const vis2 = isParty(u) && u !== 'player' ? visibleFrom(run.floor, run.player.x, run.player.y) : null;
  return foes(run, u).filter((t) => {
    const p = posOf(run, t);
    const i = at(run.floor, p.x, p.y);
    return vis.has(i) || !!vis2?.has(i);
  });
}

/** 一直線に並んだ相手のいる向き（いちばん近い相手） */
function aimDir(run: Run, u: User, maxRange: number, prefer?: Dir): Dir | null {
  const from = posOf(run, u);
  const list = foes(run, u)
    .map((t) => ({ t, line: lineDir(from, posOf(run, t)) }))
    .filter((x) => x.line && x.line.dist <= maxRange && pathClear(run, from, x.line.dir, x.line.dist))
    .sort((a, b) => (a.line!.dir === prefer ? -1 : 0) - (b.line!.dir === prefer ? -1 : 0) || a.line!.dist - b.line!.dist);
  return list.length ? list[0].line!.dir : null;
}

/** from から dir へ n マス先まで、壁と角に遮られないか（途中の者は数えない） */
function pathClear(run: Run, from: Pos, dir: Dir, n: number): boolean {
  let x = from.x, y = from.y;
  for (let i = 0; i < n; i++) {
    if (!cornerOk(run.floor, x, y, dir)) return false;
    x += DX[dir]; y += DY[dir];
    if (!inside(run.floor, x, y) || isWall(run.floor, x, y)) return false;
  }
  return true;
}

/** 一直線上の相手（壁で止まる） */
function lineTargets(run: Run, u: User, dir: Dir, n: number, pierce: boolean): { hits: Target[]; end: Pos; path: Pos[] } {
  const from = posOf(run, u);
  const fs = new Set(foes(run, u));
  const hits: Target[] = [];
  const path: Pos[] = [];
  let x = from.x, y = from.y;
  let end = { x, y };
  for (let i = 0; i < n; i++) {
    if (!cornerOk(run.floor, x, y, dir)) break;
    const nx = x + DX[dir], ny = y + DY[dir];
    if (!inside(run.floor, nx, ny) || isWall(run.floor, nx, ny)) break;
    x = nx; y = ny;
    end = { x, y };
    path.push(end);
    const t: Target | null = run.player.x === x && run.player.y === y ? 'player' : monsterAt(run, x, y);
    if (t && fs.has(t)) {
      hits.push(t);
      if (!pierce) break;
    } else if (t && !pierce) break;
  }
  return { hits, end, path };
}

function adjacentFoes(run: Run, u: User): Target[] {
  const from = posOf(run, u);
  return foes(run, u).filter((t) => {
    const p = posOf(run, t);
    if (cheb(p, from) !== 1) return false;
    const d = lineDir(from, p)!.dir;
    return cornerOk(run.floor, from.x, from.y, d) && !isWall(run.floor, p.x, p.y);
  });
}

/** 寝返らせられる相手 */
function turnable(run: Run, u: User): Monster[] {
  return (visibleFoes(run, u).filter((t) => t !== 'player') as Monster[])
    .filter((m) => !m.role && !m.gen && !m.ally)
    .sort((a, b) => cheb(a, posOf(run, u)) - cheb(b, posOf(run, u)));
}

/** その技が今使えるか。使えない時は理由 */
export function canUseSkill(run: Run, who: string, skill: string): { ok: boolean; reason?: string } {
  if (run.end) return { ok: false, reason: '戦は終わった' };
  if (!skillsOf(run, who).includes(skill)) return { ok: false, reason: 'まだ使えない技' };
  const u = userOf(run, who);
  if (!u) return { ok: false, reason: 'この階にいない' };
  const st = u === 'player' ? run.player.st : u.st;
  if (st.sleep || st.paralyze) return { ok: false, reason: '動けない' };
  const cd = cooldown(run, who, skill);
  if (cd > 0) return { ok: false, reason: `あと${cd}ターン` };
  const def = skillDef(skill);
  if (!hasTarget(run, u, def)) return { ok: false, reason: '狙える相手がいない' };
  return { ok: true };
}

function hasTarget(run: Run, u: User, def: SkillDef): boolean {
  switch (def.kind) {
    case 'line': case 'shot': case 'charge':
      return aimDir(run, u, def.range, u === 'player' ? run.player.dir : undefined) !== null;
    case 'around': return foes(run, u).some((t) => cheb(posOf(run, t), posOf(run, u)) <= def.range);
    case 'single': return adjacentFoes(run, u).length > 0;
    case 'sight': case 'volley': return visibleFoes(run, u).length > 0;
    case 'turn': return turnable(run, u).length > 0;
    case 'party': return true;
    default: return false;
  }
}

/** 技を使う（使えたら true）。手番の消費は呼ぶ側が決める */
export function useSkill(ctx: Ctx, who: string, skill: string, user?: User): boolean {
  const run = ctx.run;
  const u = user ?? userOf(run, who);
  if (!u) return false;
  const def = skillDef(skill);
  if (!hasTarget(run, u, def)) return false;
  (run.scd[who] ??= {})[skill] = def.cd;
  const from = posOf(run, u);
  const name = userName(run, u);
  ev(ctx, { k: 'skill', uid: u === 'player' ? 0 : u.uid, name: def.name, color: def.color, gen: who });
  ev(ctx, { k: 'se', name: def.effect === 'heal' ? 'revive' : def.effect === 'fire' ? 'fire' : def.kind === 'shot' || def.kind === 'volley' ? 'arrow' : 'slash' });
  log(ctx, `${name}の技「${def.name}」！`, isParty(u) ? 'good' : 'bad');
  const atk = userAtk(run, u);
  switch (def.kind) {
    case 'line': {
      const dir = aimDir(run, u, def.range, u === 'player' ? run.player.dir : undefined)!;
      face(run, u, dir);
      const tr = lineTargets(run, u, dir, def.range, true);
      ev(ctx, { k: 'beam', fx: from.x, fy: from.y, tx: tr.end.x, ty: tr.end.y, color: def.color });
      for (const t of tr.hits) apply(ctx, u, t, def, atk);
      break;
    }
    case 'shot': {
      const dir = aimDir(run, u, def.range, u === 'player' ? run.player.dir : undefined)!;
      face(run, u, dir);
      const pierce = def.effect === 'fire';
      const tr = lineTargets(run, u, dir, def.range, pierce);
      const end = !pierce && tr.hits.length ? posOf(run, tr.hits[0]) : tr.end;
      ev(ctx, { k: 'beam', fx: from.x, fy: from.y, tx: end.x, ty: end.y, color: def.color });
      if (def.effect === 'fire') scorch(ctx, tr.path);
      for (const t of tr.hits) apply(ctx, u, t, def, atk);
      break;
    }
    case 'charge': {
      const dir = aimDir(run, u, def.range, u === 'player' ? run.player.dir : undefined)!;
      face(run, u, dir);
      const tr = lineTargets(run, u, dir, def.range, true);
      for (const t of tr.hits) apply(ctx, u, t, def, atk);
      // 通り道の空いた所まで駆け抜ける
      let land: Pos | null = null;
      for (const p of tr.path) {
        if (run.end) break;
        if ((run.player.x === p.x && run.player.y === p.y) || monsterAt(run, p.x, p.y)) continue;
        land = p;
      }
      if (land && !run.end) {
        const fx = from.x, fy = from.y;
        if (u === 'player') { run.player.x = land.x; run.player.y = land.y; } else { u.x = land.x; u.y = land.y; }
        ev(ctx, { k: 'move', uid: u === 'player' ? 0 : u.uid, fx, fy, tx: land.x, ty: land.y });
      }
      break;
    }
    case 'around': {
      ev(ctx, { k: 'boom', x: from.x, y: from.y, r: def.range });
      for (const t of foes(run, u).filter((t) => cheb(posOf(run, t), from) <= def.range)) apply(ctx, u, t, def, atk);
      break;
    }
    case 'single': {
      const list = adjacentFoes(run, u);
      const ahead = u === 'player' ? list.find((t) => { const p = posOf(run, t); return p.x === from.x + DX[run.player.dir] && p.y === from.y + DY[run.player.dir]; }) : null;
      const t = ahead ?? list.sort((a, b) => hpOf(run, a) - hpOf(run, b))[0];
      face(run, u, lineDir(from, posOf(run, t))!.dir);
      ev(ctx, { k: 'atk', uid: u === 'player' ? 0 : u.uid, dir: lineDir(from, posOf(run, t))!.dir });
      apply(ctx, u, t, def, atk);
      break;
    }
    case 'sight': {
      ev(ctx, { k: 'flash', color: def.color });
      for (const t of visibleFoes(run, u)) apply(ctx, u, t, def, atk);
      break;
    }
    case 'volley': {
      const list = visibleFoes(run, u).sort((a, b) => cheb(posOf(run, a), from) - cheb(posOf(run, b), from)).slice(0, def.range);
      for (const t of list) {
        const p = posOf(run, t);
        ev(ctx, { k: 'proj', fx: from.x, fy: from.y, tx: p.x, ty: p.y, sprite: 'arrow' });
        apply(ctx, u, t, def, atk);
      }
      break;
    }
    case 'party': {
      ev(ctx, { k: 'flash', color: def.color });
      for (const t of friends(run, u)) support(ctx, t, def);
      if (u !== 'player' && !isParty(u)) support(ctx, u, def);
      break;
    }
    case 'turn': {
      const m = turnable(run, u)[0];
      m.ally = true;
      m.turned = true;
      m.awake = true;
      m.fleeing = false;
      m.st = {};
      run.stats.allies += 1;
      log(ctx, `${monName(m)}は寝返った！ この戦の間、味方になる。`, 'good');
      ev(ctx, { k: 'popup', x: m.x, y: m.y, text: '寝返り', color: '#ffd84a' });
      break;
    }
    default:
  }
  return true;
}

function face(run: Run, u: User, dir: Dir) {
  if (u === 'player') run.player.dir = dir;
  else u.dir = dir;
}

function hpOf(run: Run, t: Target): number {
  return t === 'player' ? run.player.hp : t.hp;
}

function youkaiTarget(run: Run, t: Target): boolean {
  if (t === 'player') return false;
  if (t.gen) return !!run.gens[t.gen]?.youkai;
  return isYoukai(t.id);
}

/** 相手に効果を与える */
function apply(ctx: Ctx, u: User, t: Target, def: SkillDef, atk: number) {
  const run = ctx.run;
  if (run.end) return;
  if (t !== 'player' && t.dead) return;
  let k = def.power;
  if (def.id === 'konshin' || def.id === 'dohatsu') {
    const hp = u === 'player' ? run.player.hp / run.player.maxHp : u.hp / u.maxHp;
    k *= 1 + (1 - hp) * 2;
  }
  if (def.id === 'ansatsu' && hpOf(run, t) < (t === 'player' ? run.player.maxHp : t.maxHp) * 0.5) k *= 1.5;
  if (def.effect === 'exorcise' && !youkaiTarget(run, t)) k *= 0.3;
  const boss = t !== 'player' && !!t.gen && !t.ally;
  const turns = Math.max(1, def.turns ?? 4);
  const hold = boss ? Math.max(2, Math.floor(turns / 2)) : turns;
  let dealt = 0;
  if (k > 0 && def.effect !== 'confuse' && def.effect !== 'sleep' && def.effect !== 'weaken') {
    dealt = hit(ctx, u, t, atk * k);
  }
  if (run.end) return;
  if (t !== 'player' && t.dead) {
    if (def.id === 'ryakudatsu' && isParty(u)) {
      const g = range(ctx.r, 40, 120);
      run.player.gold += g;
      log(ctx, `${g}文を奪った！`, 'good');
    }
    return;
  }
  const st = t === 'player' ? run.player.st : t.st;
  switch (def.effect) {
    case 'confuse':
      if (t === 'player') confusePlayer(ctx, Math.min(hold, 4)); else { st.confuse = hold; if (st.sleep) st.sleep = 0; }
      break;
    case 'sleep':
      if (t === 'player') sleepPlayer(ctx, Math.min(hold, 3)); else st.sleep = hold;
      break;
    case 'paralyze':
      if (t === 'player') { st.paralyze = Math.max(st.paralyze ?? 0, Math.min(hold, 2)); log(ctx, '体が凍えて動かない！', 'bad'); } else st.paralyze = hold;
      break;
    case 'weaken':
      if (t === 'player') { st.slow = Math.max(st.slow ?? 0, Math.min(hold, 6)); } else { st.weak = true; st.slow = Math.max(st.slow ?? 0, hold); }
      break;
    case 'exorcise':
      if (def.id === 'choubuku' && t !== 'player' && youkaiTarget(run, t)) st.sealed = true;
      break;
    case 'drain':
      if (dealt > 0) heal(ctx, u, Math.round(dealt / 2));
      break;
    case 'despair':
      if (chance(ctx.r, 0.5)) { if (t === 'player') confusePlayer(ctx, 3); else st.confuse = 3; }
      break;
    default:
  }
  if (def.id === 'raijin' && t !== 'player' && chance(ctx.r, 0.3)) st.paralyze = boss ? 2 : 3;
}

/** 打撃（守りの技・防御を通す） */
function hit(ctx: Ctx, u: User, t: Target, raw: number): number {
  const run = ctx.run;
  if (t === 'player') {
    const dmg = damageRoll(raw, playerDefense(run), 24, next(ctx.r));
    return hurtPlayer(ctx, dmg, `${userName(run, u)}の技`);
  }
  const dmg = damageRoll(raw, monDefense(t), 20, next(ctx.r));
  const before = t.hp;
  hurtMonster(ctx, t, dmg, u === 'player' ? 'player' : u, { crit: true });
  return Math.max(0, before - Math.max(0, t.hp));
}

function heal(ctx: Ctx, t: Target, n: number) {
  const run = ctx.run;
  if (n <= 0) return;
  if (t === 'player') {
    const p = run.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    if (p.hp > before) ev(ctx, { k: 'heal', x: p.x, y: p.y, n: p.hp - before });
  } else {
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + n);
    if (t.hp > before) ev(ctx, { k: 'heal', x: t.x, y: t.y, n: t.hp - before });
  }
}

/** 部隊にかける技 */
function support(ctx: Ctx, t: Target, def: SkillDef) {
  const run = ctx.run;
  const st = t === 'player' ? run.player.st : t.st;
  const maxHp = t === 'player' ? run.player.maxHp : t.maxHp;
  const turns = def.turns ?? 10;
  switch (def.effect) {
    case 'heal':
      heal(ctx, t, Math.round(maxHp * def.power));
      st.confuse = 0; st.sleep = 0; st.slow = 0; st.blind = 0; st.weak = false;
      if (st.paralyze && st.paralyze < 999) st.paralyze = 0;
      if (t === 'player' && def.id === 'sandan') run.player.hunger = Math.min(run.player.maxHunger, run.player.hunger + 30);
      break;
    case 'guard': st.guard = turns; break;
    case 'power': st.power = turns; st.powerK = def.power; break;
    case 'invincible': st.invincible = Math.max(st.invincible ?? 0, turns); break;
    case 'fast': st.fast = Math.max(st.fast ?? 0, turns); st.slow = 0; break;
    default:
  }
  const p = t === 'player' ? run.player : t;
  const label = def.effect === 'guard' ? '守り' : def.effect === 'power' ? '攻め' : def.effect === 'invincible' ? '結界' : def.effect === 'fast' ? '倍速' : '';
  if (label) ev(ctx, { k: 'popup', x: p.x, y: p.y, text: label, color: def.color });
}

/** 技の待ちを1ターン進める */
export function tickSkills(run: Run) {
  for (const who of Object.keys(run.scd)) {
    const table = run.scd[who];
    for (const s of Object.keys(table)) {
      if (table[s] > 0) table[s] -= 1;
      if (table[s] <= 0) delete table[s];
    }
  }
}

/** 敵の将の技：使えそうな技があれば使う（使ったら true） */
export function enemySkill(ctx: Ctx, m: Monster): boolean {
  const run = ctx.run;
  if (!m.gen || m.ally || m.st.sealed) return false;
  const g = run.gens[m.gen];
  if (!g) return false;
  const p = run.player;
  // 朔か部隊が見えていなければ使わない
  if (!visibleFoes(run, m).length && cheb(m, p) > 2) return false;
  for (const sid of g.skills) {
    if (cooldown(run, m.gen, sid) > 0) continue;
    const def = skillDef(sid);
    if (def.kind === 'turn') continue;
    if (def.kind === 'party') {
      // 回復は弱った時、守り・攻めは戦いの最中に
      if (def.effect === 'heal' && m.hp > m.maxHp * 0.55) continue;
      if (def.effect === 'invincible' && m.hp > m.maxHp * 0.4) continue;
      if (!chance(ctx.r, 0.5)) continue;
    } else if (!chance(ctx.r, 0.45)) continue;
    if (useSkill(ctx, m.gen, sid, m)) return true;
  }
  return false;
}
