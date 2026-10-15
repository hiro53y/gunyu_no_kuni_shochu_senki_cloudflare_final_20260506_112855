// 合戦の判断（敵と「おまかせ」）：技と標的ごとに見込みを点数にして、いちばん良いものを選ぶ
// 戦果は与えた打撃の割合で決まるので、「打撃の見込み − 受ける反撃」を基本に、準備崩し・ガード・時間の使い方を足す
import { battleSkill, KINDS } from './kinds';
import { activeUnit, alive, assassinChance, attackPower, canUse, defensePower, effTroops, estimate, healAmount, legalTargets, other, rating } from './engine';
import type { Action, Battle, Unit } from './types';

/** 自分の側から見た戦果の評価（正なら優勢） */
function myRating(b: Battle, u: Unit): number {
  return rating(b) * (u.side === 'L' ? 1 : -1);
}

/** 受ける反撃の見込み */
function counterEst(u: Unit, t: Unit, counter: number): number {
  if (counter <= 0 || !KINDS[t.kind].counter) return 0;
  const eff = effTroops(t.troops);
  const diff = Math.max(1, attackPower(t, false) - defensePower(u, false));
  return Math.min(u.troops, Math.max(eff / 10, Math.min(t.troops, (eff * diff) / 10)) * counter);
}

/** 1部隊への打撃の値打ち */
function hitValue(b: Battle, u: Unit, t: Unit, skillId: string, single: boolean): number {
  const s = battleSkill(skillId);
  let est = estimate(b, u, t, skillId);
  // かばわれる見込み（同じ列の足軽がいれば半分に）
  if (single && !s.magic && s.effect !== 'ratio') {
    const g = alive(b, t.side).find((x) => x !== t && x.kind === 'ashigaru' && x.guarding && x.guard > 0 && (x.guardAll || x.row === t.row));
    if (g) est *= s.ignoreGuard ? 1 - Math.min(1, g.guard) * 0.3 : 1 - Math.min(1, g.guard) * 0.5;
  }
  if (t.barrier) est *= 0.2;
  let v = Math.min(est, t.troops);
  if (est >= t.troops) v += 80 + t.troops * 0.3; // 壊滅させれば戦果+5
  if (t.boss) v *= 1.15;
  // 準備中の部隊は崩す値打ちが大きい
  if (s.effect === 'cancel' && t.prep) v += 250 + estimate(b, t, u, t.prep.skill) * 1.5;
  // 速い・危ない相手を先に
  if (t.kind === 'onmyo' || t.kind === 'teppo' || t.kind === 'gunshi') v *= 1.1;
  v -= counterEst(u, t, s.counter) * 0.9;
  return v;
}

export interface Choice { action: Action; score: number }

function scoreSkill(b: Battle, u: Unit, skillId: string): Choice | null {
  if (!canUse(b, u, skillId).ok) return null;
  const s = battleSkill(skillId);
  const foes = alive(b, other(u.side));
  const allies = alive(b, u.side);
  const costN = s.cost === 'all' ? Math.max(1, u.ap) : Math.max(0.6, s.cost);
  const per = (v: number) => v / Math.pow(costN, 0.75);
  const late = b.ticks <= 6;
  let best: Choice | null = null;
  const consider = (score: number, target?: number) => {
    if (!best || score > best.score) best = { action: { t: 'skill', skill: skillId, target }, score };
  };
  switch (s.effect) {
    case 'dmg':
    case 'cancel':
    case 'drain':
    case 'drainAp':
    case 'mercy':
    case 'ratio':
    case 'dispel': {
      if (s.range === 'all') {
        let v = 0;
        for (const t of foes) {
          if (s.mult > 0 || s.effect === 'ratio') v += hitValue(b, u, t, skillId, false);
          if (s.effect === 'dispel') v += (t.buffs.atk + t.buffs.def + t.buffs.int + t.buffs.spd) * 140;
        }
        if (s.prep) v *= late ? 0.2 : 0.8;
        consider(per(v));
      } else if (s.range === 'pierce') {
        for (const t of legalTargets(b, u, skillId)) {
          const v = foes.filter((x) => x.slot === t.slot).reduce((sum, x) => sum + hitValue(b, u, x, skillId, false), 0);
          consider(per(v), t.uid);
        }
      } else {
        for (const t of legalTargets(b, u, skillId)) {
          let v = s.mult > 0 ? hitValue(b, u, t, skillId, true) : 0;
          if (s.effect === 'drainAp' && t.ap > 0) v += 60;
          if (s.effect === 'dispel') v += (t.buffs.atk + t.buffs.def + t.buffs.spd) * 80;
          if (s.effect === 'mercy') v = t.boss || t.out ? 40 : 15;
          consider(per(v), t.uid);
        }
      }
      break;
    }
    case 'assassin':
      for (const t of legalTargets(b, u, skillId)) {
        const p = assassinChance(u, t, s.amount ?? 0.75);
        consider(per(p * (t.troops + 80) * 1.1), t.uid);
      }
      break;
    case 'guard':
    case 'guardAll': {
      const threats = foes.filter((f) => !battleSkill(f.skills[0] ?? 'a_atk').magic).length;
      const covered = s.effect === 'guardAll' ? allies.length - 1 : allies.filter((x) => x !== u && x.row === u.row).length;
      const v = !u.guarding ? 140 : u.guard < 0.6 ? 100 : u.guard < 1 ? 50 : 5;
      consider(threats ? per(v * (0.6 + covered * 0.3)) : 0);
      break;
    }
    case 'buffAtk':
    case 'buffDef':
    case 'buffInt':
    case 'buffSpd': {
      const stat = s.effect === 'buffAtk' ? 'atk' : s.effect === 'buffDef' ? 'def' : s.effect === 'buffInt' ? 'int' : 'spd';
      const list = s.range === 'allies' ? allies : [u];
      const gain = list.filter((t) => t.buffs[stat] < (s.amount ?? 0.3));
      const base = stat === 'atk' ? gain.reduce((sum, t) => sum + effTroops(t.troops) * 0.35, 0) : gain.length * 60;
      consider(late ? per(base * 0.3) : per(base));
      break;
    }
    case 'tactics':
      consider(late ? 20 : per(allies.length * 55));
      break;
    case 'heal': {
      const amount = healAmount(u, s.mult);
      if (s.range === 'ally') {
        for (const t of legalTargets(b, u, skillId)) consider(per(Math.min(t.maxTroops - t.troops, amount) * 0.9 + (t.lord ? 40 : 0)), t.uid);
      } else {
        const list = s.range === 'self' ? [u] : allies;
        consider(per(list.reduce((sum, t) => sum + Math.min(t.maxTroops - t.troops, amount), 0) * 0.9));
      }
      break;
    }
    case 'guardBreak':
      consider(per(foes.reduce((sum, t) => sum + (t.guarding ? Math.min(1.5, t.guard) * 220 : 0), 0)));
      break;
    case 'gauge': {
      const r = myRating(b, u);
      consider(per((s.amount ?? 5) * (late || Math.abs(r) < 15 ? 30 : 12)));
      break;
    }
    case 'time': {
      const r = myRating(b, u);
      const amt = s.amount ?? 0;
      // 勝っていれば時間を減らし、負けていれば延ばす
      if (amt < 0) consider(r > 5 ? per(-amt * 70) : 0);
      else consider(r < 0 && b.ticks <= 8 ? per(amt * 80) : 0);
      break;
    }
    case 'field':
      consider(late ? 10 : per(allies.reduce((sum, t) => sum + effTroops(t.troops), 0) * 0.04));
      break;
    case 'barrier': {
      if (s.range === 'allies') consider(per(allies.filter((t) => !t.barrier).length * 70));
      else for (const t of legalTargets(b, u, skillId)) if (!t.barrier) consider(per((t.lord ? 150 : 60) + t.troops * 0.12 + (t.prep ? 100 : 0)), t.uid);
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
  // 戦果で勝っていて時間が少ない時は、待機で時間を流す（反撃で兵を失わない）
  const r = myRating(b, u);
  if (r > 10 && b.ticks <= 4 && (!best || best.score < 200)) return { t: 'wait' };
  if (!best || best.score <= 8) return { t: 'wait' };
  return best.action;
}
