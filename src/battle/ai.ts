// 合戦の判断（敵と「おまかせ」）：技と標的ごとに見込みを点数にして、いちばん良いものを選ぶ
import { battleSkill } from './kinds';
import { activeUnit, alive, canUse, estimate, gauge, legalTargets } from './engine';
import type { Action, Battle, Side, Unit } from './types';

const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

/** 自分の側から見た戦果（50より大きいと優勢） */
function myGauge(b: Battle, side: Side): number {
  const g = gauge(b);
  return side === 'L' ? g : 100 - g;
}

function hitValue(b: Battle, u: Unit, t: Unit, skillId: string): number {
  const est = estimate(b, u, t, skillId);
  let v = Math.min(est, t.troops);
  if (est >= t.troops) v += t.troops * 0.6 + 120;
  if (t.boss) v *= 1.2;
  if (battleSkill(skillId).effect === 'cancel' && t.prep) v += 400;
  // ガード中の足軽・かばわれる相手は物理の打撃が減る
  const s = battleSkill(skillId);
  if (s.physical && !s.ignoreGuard) {
    if (t.kind === 'ashigaru' && t.guarding) v *= 0.55;
    else if (alive(b, t.side).some((g) => g !== t && g.guarding && (g.guardAll || g.row === t.row))) v *= 0.7;
  }
  return v;
}

export interface Choice { action: Action; score: number }

/** 1つの技について、いちばん良い使い方と点数 */
function scoreSkill(b: Battle, u: Unit, skillId: string): Choice | null {
  if (!canUse(b, u, skillId).ok) return null;
  const s = battleSkill(skillId);
  const foe = other(u.side);
  const foes = alive(b, foe);
  const allies = alive(b, u.side);
  const costN = s.cost === 'all' ? Math.max(1, u.ap) : Math.max(0.5, s.cost);
  const late = b.time > b.limit * 0.55;
  let best: Choice | null = null;
  const consider = (score: number, target?: number) => {
    if (!best || score > best.score) best = { action: { t: 'skill', skill: skillId, target }, score };
  };
  switch (s.effect) {
    case 'dmg':
    case 'cancel':
    case 'drain':
    case 'delay':
    case 'weaken':
    case 'dispel': {
      if (s.range === 'all') {
        let v = 0;
        for (const t of foes) {
          if (s.mult > 0) v += hitValue(b, u, t, skillId);
          if (s.effect === 'delay') v += 40;
          if (s.effect === 'weaken') v += 30;
          if (s.effect === 'dispel') v += (t.buffs.atk + t.buffs.def + t.buffs.spd) * 150;
        }
        if (s.prep) v *= 0.85;
        consider(v / Math.sqrt(costN));
      } else if (s.range === 'pierce') {
        for (const t of legalTargets(b, u, skillId)) {
          const v = foes.filter((x) => x.slot === t.slot).reduce((sum, x) => sum + hitValue(b, u, x, skillId), 0);
          consider(v / Math.sqrt(costN), t.uid);
        }
      } else {
        for (const t of legalTargets(b, u, skillId)) {
          let v = s.mult > 0 ? hitValue(b, u, t, skillId) : 0;
          if (s.effect === 'delay') v += 50;
          if (s.effect === 'dispel') v += (t.buffs.atk + t.buffs.def + t.buffs.spd) * 150;
          consider(v / Math.sqrt(costN), t.uid);
        }
      }
      break;
    }
    case 'assassin':
      for (const t of legalTargets(b, u, skillId)) {
        if (t.boss || t.lord) continue;
        const p = Math.max(0.08, Math.min(0.6, 0.42 * u.troops / Math.max(1, t.troops)));
        consider((p * t.troops * 1.3) / Math.sqrt(costN), t.uid);
      }
      break;
    case 'guard':
    case 'guardAll': {
      const threats = foes.some((f) => f.kind !== 'onmyo');
      const v = !u.guarding ? 160 : u.guard < 0.6 ? 110 : 10;
      consider(threats ? v + (s.effect === 'guardAll' ? 40 : 0) : 0);
      break;
    }
    case 'buffAtk':
    case 'buffDef':
    case 'buffSpd': {
      const stat = s.effect === 'buffAtk' ? 'atk' : s.effect === 'buffDef' ? 'def' : 'spd';
      const list = s.range === 'allies' ? allies : [u];
      const gain = list.filter((t) => t.buffs[stat] < (s.amount ?? 0.3)).length;
      const base = s.range === 'self' && stat === 'atk' ? u.troops * 0.25 : 70;
      consider(gain ? (gain * base * (late ? 0.5 : 1)) / Math.sqrt(costN) : 0);
      break;
    }
    case 'buffRandom':
      consider(late ? 30 : allies.length * 45);
      break;
    case 'heal': {
      const list = s.range === 'allies' ? allies : s.range === 'self' ? [u] : allies;
      if (s.range === 'ally') {
        for (const t of legalTargets(b, u, skillId)) consider(Math.min(t.maxTroops - t.troops, t.maxTroops * 0.2) * 1.1 + (t.lord ? 60 : 0), t.uid);
      } else {
        const v = list.reduce((sum, t) => sum + Math.min(t.maxTroops - t.troops, t.maxTroops * 0.14 * s.mult), 0);
        consider(v / Math.sqrt(costN));
      }
      break;
    }
    case 'guardBreak':
      consider(foes.reduce((sum, t) => sum + (t.guarding ? t.guard * 260 : 0), 0));
      break;
    case 'gauge': {
      const g = myGauge(b, u.side);
      consider((s.amount ?? 5) * (late || Math.abs(g - 50) < 12 ? 28 : 10) / Math.sqrt(costN));
      break;
    }
    case 'extend': {
      const g = myGauge(b, u.side);
      // 押されていて時間が少ない時だけ延ばす
      consider(g < 50 && b.limit - b.time < 25 ? 300 : 0);
      break;
    }
    case 'barrier': {
      if (s.range === 'allies') consider(allies.filter((t) => !t.barrier).length * 50 / Math.sqrt(costN));
      else for (const t of legalTargets(b, u, skillId)) if (!t.barrier) consider((t.lord ? 160 : 70) + t.troops * 0.05, t.uid);
      break;
    }
    default:
  }
  return best;
}

/** 手番の部隊の行動を選ぶ */
export function chooseAction(b: Battle): Action {
  const u = activeUnit(b);
  if (!u) return { t: 'wait' };
  let best: Choice | null = null;
  for (const id of u.skills) {
    const c = scoreSkill(b, u, id);
    if (c && (!best || c.score > best.score)) best = c;
  }
  if (!best || best.score <= 5) return { t: 'wait' };
  return best.action;
}
