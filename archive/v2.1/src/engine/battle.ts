// ===========================================================================
// 合戦エンジン v2.1
// 3×3 指揮官カード戦闘
// 純粋関数として実装し、新しい BattleState / GameState を返す。
// ===========================================================================

import type {
  BattleLogEntry, BattleResult, BattleSlot, BattleState,
  FactionId, GameState, General, GeneralId, RegionId, Skill, StatusEffect,
} from '../types/game';
import { TERRAIN_BONUSES } from '../data/regions';
import { getSkill } from '../data/skills';
import type { Rng } from './rng';

// --- 初期化 -----------------------------------------------------------------

/** 武将ID9個から空きを含む BattleSlot 配列を構築する（最大9） */
function makeSlots(state: GameState, generalIds: (GeneralId | null)[]): BattleSlot[] {
  const slots: BattleSlot[] = [];
  for (let i = 0; i < 9; i++) {
    const id = generalIds[i] ?? null;
    if (id === null) {
      slots.push({ generalId: null, hp: 0, hpMax: 0, guard: 0, tick: 0, statusEffects: [], retreated: true });
      continue;
    }
    const g = state.generals[id];
    if (!g) {
      slots.push({ generalId: null, hp: 0, hpMax: 0, guard: 0, tick: 0, statusEffects: [], retreated: true });
      continue;
    }
    const guard = Math.min(50, Math.floor(g.stats.command / 4));
    slots.push({
      generalId: id,
      hp: g.troopCurrent,
      hpMax: g.troopMax,
      guard,
      tick: 0,
      statusEffects: [],
      retreated: false,
    });
  }
  return slots;
}

interface InitBattleArgs {
  regionId: RegionId;
  playerIsAttacker: boolean;
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  /** プレイヤー側の配置（最大9） */
  playerGeneralIds: (GeneralId | null)[];
  /** 敵側の配置（最大9） */
  enemyGeneralIds: (GeneralId | null)[];
}

/** 戦闘開始時の BattleState を作る */
export function initBattle(state: GameState, args: InitBattleArgs): BattleState {
  const region = state.regions[args.regionId];
  const terrainBonus = TERRAIN_BONUSES[region.terrain] ?? TERRAIN_BONUSES.plain;

  return {
    regionId: args.regionId,
    playerIsAttacker: args.playerIsAttacker,
    attackerFactionId: args.attackerFactionId,
    defenderFactionId: args.defenderFactionId,
    playerSlots: makeSlots(state, args.playerGeneralIds),
    enemySlots: makeSlots(state, args.enemyGeneralIds),
    turn: 1,
    log: [{ turn: 0, message: `${region.name}（${terrainBonus.note}）で合戦が始まった！` }],
    result: 'in_progress',
    terrainBonus,
    capturedAfter: [],
    killedAfter: [],
  };
}

// --- 行動順 -----------------------------------------------------------------

export interface ActorRef {
  side: 'player' | 'enemy';
  index: number;
}

/** 各スロットの素早さは武力 + 統率/2。tickに加算しゴール100で行動。 */
function speedOf(g: General | undefined): number {
  if (!g) return 0;
  return Math.floor((g.stats.power + g.stats.command / 2) / 2);
}

function isAlive(slot: BattleSlot): boolean {
  return slot.generalId !== null && !slot.retreated && slot.hp > 0;
}

/** すべてのスロットの tick を進めて、次に動くスロットを返す。100到達者がいなければ null（更に進める） */
function tickAndPickNext(battle: BattleState, state: GameState): { battle: BattleState; actor: ActorRef | null } {
  const next: BattleState = {
    ...battle,
    playerSlots: battle.playerSlots.map((s) => ({ ...s })),
    enemySlots: battle.enemySlots.map((s) => ({ ...s })),
  };
  // 状態異常での自動ダメージ（火傷・毒）も先に処理
  const decay = (slot: BattleSlot) => {
    let hp = slot.hp;
    const eff: StatusEffect[] = [];
    for (const e of slot.statusEffects) {
      if ((e.type === 'burn' || e.type === 'poison') && hp > 0) {
        hp -= e.magnitude;
      }
      if (e.turnsLeft - 1 > 0) eff.push({ ...e, turnsLeft: e.turnsLeft - 1 });
    }
    slot.hp = Math.max(0, hp);
    slot.statusEffects = eff;
    if (slot.hp === 0) slot.retreated = true;
  };

  for (const s of [...next.playerSlots, ...next.enemySlots]) {
    if (isAlive(s) && s.generalId) {
      const g = state.generals[s.generalId];
      s.tick += speedOf(g);
    }
  }
  // tick が100以上で alive のものから一番大きいものを選ぶ
  let best: { side: 'player' | 'enemy'; index: number; tick: number } | null = null;
  for (let i = 0; i < next.playerSlots.length; i++) {
    const s = next.playerSlots[i];
    if (isAlive(s) && s.tick >= 100 && (!best || s.tick > best.tick)) {
      best = { side: 'player', index: i, tick: s.tick };
    }
  }
  for (let i = 0; i < next.enemySlots.length; i++) {
    const s = next.enemySlots[i];
    if (isAlive(s) && s.tick >= 100 && (!best || s.tick > best.tick)) {
      best = { side: 'enemy', index: i, tick: s.tick };
    }
  }
  if (!best) return { battle: next, actor: null };

  // 行動者の tick を100消費
  const actorSlots = best.side === 'player' ? next.playerSlots : next.enemySlots;
  actorSlots[best.index] = { ...actorSlots[best.index], tick: actorSlots[best.index].tick - 100 };

  // ターン開始時の状態異常 decay
  for (const s of [...next.playerSlots, ...next.enemySlots]) {
    if (s === actorSlots[best.index]) decay(s);
  }

  return { battle: next, actor: { side: best.side, index: best.index } };
}

// --- ダメージ計算 -----------------------------------------------------------

interface AttackContext {
  attacker: BattleSlot;
  attackerGeneral: General;
  target: BattleSlot;
  targetGeneral: General;
  skill: Skill;
  battle: BattleState;
  rng: Rng;
}

function calcDamage(ctx: AttackContext): number {
  const { attacker, attackerGeneral, target, targetGeneral, skill, battle, rng } = ctx;

  let atk = attackerGeneral.stats.power;
  let def = targetGeneral.stats.command;

  // 状態異常バフ・デバフ
  for (const e of attacker.statusEffects) {
    if (e.type === 'atk_up') atk = Math.round(atk * (1 + e.magnitude / 100));
    if (e.type === 'rage') atk = Math.round(atk * 1.4);
  }
  for (const e of target.statusEffects) {
    if (e.type === 'guard_up') def = Math.round(def * (1 + e.magnitude / 100));
  }

  // 基礎ダメージ
  let dmg = (atk * 6 - def * 3) * skill.effect.basePower;
  if (dmg < attacker.hpMax * 0.02) dmg = attacker.hpMax * 0.02;

  // ガード
  if (rng.chance(target.guard / 100)) {
    dmg *= 0.5;
  }

  // 戦場補正
  dmg *= 1 + battle.terrainBonus.atkPct / 100;

  // 妖魔特効
  if (skill.effect.youmaSpecial && targetGeneral.homeFactionId === 'youma') {
    dmg *= skill.effect.youmaSpecial;
  }

  // 即死判定
  if (skill.effect.instaKillChance && rng.chance(skill.effect.instaKillChance)) {
    return target.hp; // 即死
  }

  // ばらつき ±10%
  dmg *= 0.9 + rng.next() * 0.2;

  return Math.max(1, Math.round(dmg));
}

// --- 攻撃の適用 ------------------------------------------------------------

function applyDamageTo(slot: BattleSlot, dmg: number): BattleSlot {
  const hp = Math.max(0, slot.hp - dmg);
  return { ...slot, hp, retreated: hp === 0 };
}

/** スロット配列から alive な敵スロットを最大n個返す（HP低い順） */
function pickTargets(slots: BattleSlot[], n: number): number[] {
  const alive = slots
    .map((s, i) => ({ s, i }))
    .filter((x) => isAlive(x.s))
    .sort((a, b) => a.s.hp - b.s.hp);
  return alive.slice(0, n).map((x) => x.i);
}

interface ExecuteArgs {
  battle: BattleState;
  state: GameState;
  actor: ActorRef;
  /** 使用するスキルID。null なら通常斬撃 */
  skillId: string | null;
  /** 単体対象の場合のスロット番号（敵スロット側）。null なら自動選択 */
  targetIndex: number | null;
  rng: Rng;
}

/** 1回の行動を適用した新しい battle を返す */
export function executeAction(args: ExecuteArgs): BattleState {
  const { battle, state, actor, skillId, targetIndex, rng } = args;
  const battle2: BattleState = {
    ...battle,
    playerSlots: battle.playerSlots.map((s) => ({ ...s })),
    enemySlots: battle.enemySlots.map((s) => ({ ...s })),
    log: [...battle.log],
  };
  const actorSlots = actor.side === 'player' ? battle2.playerSlots : battle2.enemySlots;
  const oppSlots = actor.side === 'player' ? battle2.enemySlots : battle2.playerSlots;

  const atk = actorSlots[actor.index];
  if (!atk.generalId) return battle2;
  const atkG = state.generals[atk.generalId];
  if (!atkG) return battle2;

  const skill = skillId ? getSkill(skillId) : getSkill('sk_zangeki');

  battle2.log.push({
    turn: battle2.turn,
    message: `${atkG.name}が「${skill.name}」を発動。${skill.description}`,
    cutInGeneralId: skill.effect.basePower >= 1.5 ? atkG.id : undefined,
    cutInDialogue: skill.cutInDialogue,
  });

  // ターゲット決定
  let targetIndices: number[] = [];
  if (skill.target === 'enemy_one') {
    targetIndices = targetIndex !== null && isAlive(oppSlots[targetIndex])
      ? [targetIndex]
      : pickTargets(oppSlots, 1);
  } else if (skill.target === 'enemy_all') {
    targetIndices = pickTargets(oppSlots, skill.effect.hits ?? 9);
  } else if (skill.target === 'self') {
    // 自身対象は対象不要
    targetIndices = [];
  } else if (skill.target === 'ally_one' || skill.target === 'ally_all') {
    // 味方対象。actorSlots を使う
    const friendlies = actorSlots
      .map((s, i) => ({ s, i }))
      .filter((x) => isAlive(x.s))
      .sort((a, b) => (a.s.hp / a.s.hpMax) - (b.s.hp / b.s.hpMax));
    const n = skill.target === 'ally_one' ? 1 : (skill.effect.hits ?? friendlies.length);
    targetIndices = friendlies.slice(0, n).map((x) => x.i);
  }

  // 適用
  if (skill.kind === 'attack' || skill.kind === 'aoe') {
    for (const ti of targetIndices) {
      const tgt = oppSlots[ti];
      const tgtG = tgt.generalId ? state.generals[tgt.generalId] : null;
      if (!tgtG) continue;
      const dmg = calcDamage({ attacker: atk, attackerGeneral: atkG, target: tgt, targetGeneral: tgtG, skill, battle: battle2, rng });
      oppSlots[ti] = applyDamageTo(tgt, dmg);
      battle2.log.push({ turn: battle2.turn, message: `→ ${tgtG.name}に ${dmg.toLocaleString()} の損害（残兵${oppSlots[ti].hp.toLocaleString()}）` });
      if (oppSlots[ti].hp === 0) {
        battle2.log.push({ turn: battle2.turn, message: `${tgtG.name}は撤退した` });
      }
      // 状態異常付与
      if (skill.effect.inflict && rng.chance(skill.effect.inflict.chance)) {
        oppSlots[ti] = {
          ...oppSlots[ti],
          statusEffects: [...oppSlots[ti].statusEffects, {
            type: skill.effect.inflict.type,
            turnsLeft: skill.effect.inflict.turns,
            magnitude: skill.effect.inflict.magnitude ?? 0,
          }],
        };
      }
    }
  } else if (skill.kind === 'heal') {
    const targets = skill.target === 'self' ? [{ side: 'self', i: actor.index }] :
      targetIndices.map((i) => ({ side: 'ally', i }));
    for (const t of targets) {
      const slot = t.side === 'self' ? actorSlots[actor.index] : actorSlots[t.i];
      const g = slot.generalId ? state.generals[slot.generalId] : null;
      if (!g) continue;
      const heal = Math.round((atkG.stats.intel * 6 + g.troopMax * 0.1) * skill.effect.basePower * (1 + battle2.terrainBonus.healPct / 100));
      const newHp = Math.min(slot.hpMax, slot.hp + heal);
      const newSlot = { ...slot, hp: newHp, statusEffects: slot.statusEffects.filter((e) => skill.id === 'sk_harai' ? false : true) };
      if (t.side === 'self') actorSlots[actor.index] = newSlot;
      else actorSlots[t.i] = newSlot;
      battle2.log.push({ turn: battle2.turn, message: `→ ${g.name}を ${heal.toLocaleString()} 回復（兵${newHp.toLocaleString()}）` });
    }
  } else if (skill.kind === 'support') {
    if (skill.effect.selfBuff) {
      const targetSlots = skill.target === 'ally_all'
        ? actorSlots.map((slot, index) => ({ slot, index })).filter((x) => isAlive(x.slot))
        : [{ slot: actorSlots[actor.index], index: actor.index }];
      for (const target of targetSlots) {
        actorSlots[target.index] = {
          ...actorSlots[target.index],
          statusEffects: [
            ...actorSlots[target.index].statusEffects,
            ...(skill.effect.selfBuff.atk ? [{ type: 'atk_up' as const, turnsLeft: skill.effect.selfBuff.turns, magnitude: skill.effect.selfBuff.atk * 100 }] : []),
            ...(skill.effect.selfBuff.def ? [{ type: 'guard_up' as const, turnsLeft: skill.effect.selfBuff.turns, magnitude: skill.effect.selfBuff.def * 100 }] : []),
          ],
        };
      }
      battle2.log.push({ turn: battle2.turn, message: `→ ${skill.target === 'ally_all' ? '味方全体' : atkG.name}が強化された` });
    }
    if (skill.effect.debuff && skill.target === 'enemy_all') {
      for (let i = 0; i < oppSlots.length; i++) {
        if (!isAlive(oppSlots[i])) continue;
        oppSlots[i] = {
          ...oppSlots[i],
          statusEffects: [
            ...oppSlots[i].statusEffects,
            ...(skill.effect.debuff.atk ? [{ type: 'atk_up' as const, turnsLeft: skill.effect.debuff.turns, magnitude: skill.effect.debuff.atk * 100 }] : []),
            ...(skill.effect.debuff.def ? [{ type: 'guard_up' as const, turnsLeft: skill.effect.debuff.turns, magnitude: skill.effect.debuff.def * 100 }] : []),
          ],
        };
      }
      battle2.log.push({ turn: battle2.turn, message: `→ 敵全体が弱化された` });
    }
  } else if (skill.kind === 'special') {
    // 単体への特殊効果（封印・即死等）
    for (const ti of targetIndices) {
      const tgt = oppSlots[ti];
      const tgtG = tgt.generalId ? state.generals[tgt.generalId] : null;
      if (!tgtG) continue;
      if (skill.effect.basePower > 0) {
        const dmg = calcDamage({ attacker: atk, attackerGeneral: atkG, target: tgt, targetGeneral: tgtG, skill, battle: battle2, rng });
        oppSlots[ti] = applyDamageTo(tgt, dmg);
        battle2.log.push({ turn: battle2.turn, message: `→ ${tgtG.name}に ${dmg.toLocaleString()} の損害（残兵${oppSlots[ti].hp.toLocaleString()}）` });
      }
      if (skill.effect.inflict && rng.chance(skill.effect.inflict.chance)) {
        oppSlots[ti] = {
          ...oppSlots[ti],
          statusEffects: [...oppSlots[ti].statusEffects, {
            type: skill.effect.inflict.type,
            turnsLeft: skill.effect.inflict.turns,
            magnitude: skill.effect.inflict.magnitude ?? 0,
          }],
        };
        battle2.log.push({ turn: battle2.turn, message: `→ ${tgtG.name}は${skill.effect.inflict.type}状態` });
      }
    }
  }

  // 反動
  if (skill.effect.recoil && skill.effect.recoil > 0) {
    const recoilDmg = Math.round(actorSlots[actor.index].hpMax * skill.effect.recoil);
    actorSlots[actor.index] = applyDamageTo(actorSlots[actor.index], recoilDmg);
  } else if (skill.effect.recoil && skill.effect.recoil < 0) {
    // 吸血扱い
    const heal = Math.round(actorSlots[actor.index].hpMax * Math.abs(skill.effect.recoil));
    actorSlots[actor.index] = { ...actorSlots[actor.index], hp: Math.min(actorSlots[actor.index].hpMax, actorSlots[actor.index].hp + heal) };
  }

  return battle2;
}

// --- 終了判定 ---------------------------------------------------------------

function teamAlive(slots: BattleSlot[]): boolean {
  return slots.some(isAlive);
}

function determineResult(battle: BattleState): BattleResult {
  const player = teamAlive(battle.playerSlots);
  const enemy = teamAlive(battle.enemySlots);
  if (player && !enemy) return 'player_win';
  if (!player && enemy) return 'enemy_win';
  if (!player && !enemy) return 'draw';
  if (battle.turn >= 30) {
    const psum = battle.playerSlots.reduce((s, x) => s + x.hp, 0);
    const esum = battle.enemySlots.reduce((s, x) => s + x.hp, 0);
    if (psum > esum) return 'player_win';
    if (esum > psum) return 'enemy_win';
    return 'draw';
  }
  return 'in_progress';
}

// --- 自動進行 ---------------------------------------------------------------

/** AI が選ぶスキル（高威力をランダムに） */
function pickAiSkill(general: General, rng: Rng, strategicTurn = 99): string {
  if (strategicTurn <= 3 && rng.chance(0.45)) return 'sk_zangeki';
  const candidates = general.skillIds.length > 0 ? general.skillIds : ['sk_zangeki'];
  return rng.pick(candidates);
}

/** 1ステップ進める（プレイヤー自動含む全自動シミュレート用） */
export function autoStep(battle: BattleState, state: GameState, rng: Rng): BattleState {
  if (battle.result !== 'in_progress') return battle;
  const { battle: next, actor } = tickAndPickNext(battle, state);
  if (!actor) {
    return { ...next, turn: next.turn + 1, result: determineResult({ ...next, turn: next.turn + 1 }) };
  }
  const slot = (actor.side === 'player' ? next.playerSlots : next.enemySlots)[actor.index];
  if (!slot.generalId) return next;
  const g = state.generals[slot.generalId];
  if (!g) return next;
  const skillId = actor.side === 'enemy' ? pickAiSkill(g, rng, state.turn) : pickAiSkill(g, rng);
  const after = executeAction({ battle: next, state, actor, skillId, targetIndex: null, rng });
  return { ...after, result: determineResult(after) };
}

/** 戦闘を最後まで自動シミュレートする（最大1000ステップ） */
export function autoResolve(battle: BattleState, state: GameState, rng: Rng): BattleState {
  let b = battle;
  for (let i = 0; i < 1000; i++) {
    if (b.result !== 'in_progress') break;
    b = autoStep(b, state, rng);
  }
  return b;
}

/**
 * 次に行動する武将を見つけるまで tick を進める。
 * 見つからずに tick が空回りした場合は battle.turn を増やして determineResult を再評価する。
 * UIから1ステップずつ呼び出すための入口。
 */
export interface NextActorResult {
  battle: BattleState;
  actor: ActorRef | null;
}
export function advanceToNextActor(battle: BattleState, state: GameState): NextActorResult {
  let cur = battle;
  for (let round = 0; round < 30; round++) {
    if (cur.result !== 'in_progress') return { battle: cur, actor: null };
    const r = tickAndPickNext(cur, state);
    cur = r.battle;
    if (r.actor) return { battle: cur, actor: r.actor };
    // 誰も100に達しなかった → 1合分の時間経過とみなしターン+1
    cur = { ...cur, turn: cur.turn + 1 };
    cur = { ...cur, result: determineResult(cur) };
  }
  return { battle: cur, actor: null };
}

/** AIが行動者の代わりにスキルを選び execute する */
export function aiExecuteAction(
  battle: BattleState, state: GameState, actor: ActorRef, rng: Rng,
): BattleState {
  const slot = (actor.side === 'player' ? battle.playerSlots : battle.enemySlots)[actor.index];
  if (!slot.generalId) return battle;
  const g = state.generals[slot.generalId];
  if (!g) return battle;
  const skillId = pickAiSkill(g, rng, state.turn);
  const after = executeAction({ battle, state, actor, skillId, targetIndex: null, rng });
  return { ...after, result: determineResult(after) };
}

/** 通常斬撃の攻撃者AIで使うスキル選択を公開（プレイヤーが攻撃ボタンに使う用） */
export function getDefaultPlayerActions(general: General | undefined): { id: string; name: string; cost: number }[] {
  if (!general) return [{ id: 'sk_zangeki', name: '通常攻撃', cost: 0 }];
  const out = [{ id: 'sk_zangeki', name: '通常攻撃', cost: 0 }];
  for (const sid of general.skillIds) {
    const sk = getSkill(sid);
    out.push({ id: sk.id, name: sk.name, cost: sk.cost });
  }
  return out;
}

/** プレイヤーがスキルを実行（targetIndex は単体スキルなら必須） */
export function playerExecuteAction(
  battle: BattleState, state: GameState, actor: ActorRef, skillId: string,
  targetIndex: number | null, rng: Rng,
): BattleState {
  const after = executeAction({ battle, state, actor, skillId, targetIndex, rng });
  return { ...after, result: determineResult(after) };
}

/** 公開：判定関数 */
export { determineResult };

// --- 戦後処理（捕虜化判定・兵数反映） ------------------------------------

interface FinalizeResult {
  state: GameState;
  log: BattleLogEntry[];
}

/** 戦闘終了時：兵数を generals に反映、撃破された武将に捕虜化判定 */
export function finalizeBattle(state: GameState, battle: BattleState, rng: Rng): FinalizeResult {
  const generals = { ...state.generals };
  const captured: GeneralId[] = [];
  const killed: GeneralId[] = [];
  const log: BattleLogEntry[] = [];

  const playerWon = battle.result === 'player_win';
  const winnerSide = playerWon ? 'player' : 'enemy';

  // 兵数反映：両陣営すべてのスロットに対して
  const allSlots = [
    ...battle.playerSlots.map((s) => ({ slot: s, side: 'player' as const })),
    ...battle.enemySlots.map((s) => ({ slot: s, side: 'enemy' as const })),
  ];
  for (const { slot, side } of allSlots) {
    if (!slot.generalId) continue;
    const g = generals[slot.generalId];
    if (!g) continue;
    generals[slot.generalId] = {
      ...g,
      troopCurrent: slot.hp,
      stamina: Math.max(20, g.stamina - 30),
    };
    // 撃破判定
    if (slot.hp === 0 && side !== winnerSide) {
      // 死亡判定
      const deathChance = g.isUnique ? 0.10 : 0.25;
      if (rng.chance(deathChance) || g.factionId === 'youma') {
        // 妖魔は基本消滅扱い
        if (rng.chance(0.95) && g.factionId === 'youma') {
          generals[slot.generalId] = { ...generals[slot.generalId], status: 'dead', factionId: null };
          killed.push(slot.generalId);
          log.push({ turn: battle.turn, message: `${g.name}は討ち取られた` });
          continue;
        }
        if (g.factionId !== 'youma' && rng.chance(deathChance)) {
          generals[slot.generalId] = { ...generals[slot.generalId], status: 'dead', factionId: null };
          killed.push(slot.generalId);
          log.push({ turn: battle.turn, message: `${g.name}は討ち取られた` });
          continue;
        }
      }
      // 捕虜化判定
      if (playerWon) {
        const akatsukiRuler = state.generals[state.factions.akatsuki.rulerGeneralId];
        const charismaBonus = ((akatsukiRuler?.stats.charisma ?? 50) - 50) * 0.5;
        let captureChance = 0.30 + charismaBonus / 100;
        if (g.homeFactionId === 'youma') captureChance -= 0.20;
        if (g.homeFactionId === 'ronin') captureChance += 0.15;
        captureChance = Math.min(0.85, Math.max(0.05, captureChance));

        if (rng.chance(captureChance)) {
          generals[slot.generalId] = {
            ...generals[slot.generalId],
            status: 'captured',
            factionId: null,
            capturedTurns: 0,
            persuadeAttempts: 0,
            troopCurrent: 0,
          };
          captured.push(slot.generalId);
          log.push({ turn: battle.turn, message: `${g.name}を捕虜にした！` });
        } else {
          generals[slot.generalId] = {
            ...generals[slot.generalId],
            troopCurrent: Math.round(g.troopMax * 0.1),
          };
          log.push({ turn: battle.turn, message: `${g.name}は逃げ延びた` });
        }
      }
    }
  }

  // 地域支配権の移動：勝者が攻め手なら奪取
  let regions = state.regions;
  if (playerWon === battle.playerIsAttacker) {
    const winnerFactionId = battle.attackerFactionId;
    regions = {
      ...state.regions,
      [battle.regionId]: {
        ...state.regions[battle.regionId],
        factionId: winnerFactionId,
        satisfaction: Math.max(20, state.regions[battle.regionId].satisfaction - 20),
      },
    };
    log.push({ turn: battle.turn, message: `${state.regions[battle.regionId].name}を制圧した！` });
  } else {
    log.push({ turn: battle.turn, message: `防衛に成功した` });
  }

  const newState: GameState = {
    ...state,
    generals,
    regions,
    prisoners: [...state.prisoners, ...captured],
    battleState: null,
    rngSeed: rng.getSeed(),
  };

  return { state: newState, log };
}
