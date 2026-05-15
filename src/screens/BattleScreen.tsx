// ===========================================================================
// 合戦画面（v2.1の主役）
// 3×3の指揮官カードを左右に配置、tick制で行動順を進める。
// プレイヤーターンはスキル選択UIを表示、敵ターンはAIが自動で動く。
// 必殺技時はカットインが入る。
// ===========================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BattleLogEntry, BattleState, GameState, General } from '../types/game';
import { BattleCard } from '../components/BattleCard';
import { BattleCutIn } from '../components/BattleCutIn';
import {
  advanceToNextActor, aiExecuteAction, playerExecuteAction,
  getDefaultPlayerActions, createRng,
  type ActorRef,
} from '../engine';
import { getSkill } from '../data/skills';
import { audio } from '../audio/AudioManager';
import { summarizeSlots } from '../engine/battleIntel';
import type { Skill, SkillKind, SkillTarget } from '../types/game';

interface Props {
  state: GameState;
  initialBattle: BattleState;
  onComplete: (finalBattle: BattleState) => void;
}

interface CutInData {
  general: General;
  skillName: string;
  dialogue?: string;
  side: 'player' | 'enemy';
}

const AI_DELAY_MS = 900;
const TICK_DELAY_MS = 250;

export function BattleScreen({ state, initialBattle, onComplete }: Props) {
  // 合戦中は battle BGM
  useEffect(() => {
    audio.playBgm('battle').catch(() => { /* noop */ });
  }, []);

  const [battle, setBattle] = useState<BattleState>(initialBattle);
  const [activeActor, setActiveActor] = useState<ActorRef | null>(null);
  const [cutIn, setCutIn] = useState<CutInData | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);
  const [focusedSkillId, setFocusedSkillId] = useState<string | null>(null);
  const [phaseLabel, setPhaseLabel] = useState<string>('合戦開始');
  const [showSurrenderModal, setShowSurrenderModal] = useState(false);

  // rng は state.rngSeed を受けて、battle 内部でのみ使う（state は更新しない）
  const rngRef = useRef(createRng(state.rngSeed));
  // 現在進行中のtimerが多重発動しないようにロックする
  const tickLockRef = useRef(false);

  const region = state.regions[battle.regionId];
  const battleIntel = useMemo(() => describeBattleState(battle, state), [battle, state]);

  // --- 敵ターンの自動進行 -------------------------------------------------

  const stepEnemy = useCallback((actor: ActorRef, currentBattle: BattleState) => {
    const slot = currentBattle.enemySlots[actor.index];
    if (!slot.generalId) {
      setActiveActor(null);
      return;
    }
    const g = state.generals[slot.generalId];
    if (!g) {
      setActiveActor(null);
      return;
    }

    setPhaseLabel(`${g.name}の手番`);

    const aiSkillId = g.skillIds[Math.floor(Math.random() * g.skillIds.length)] ?? 'sk_zangeki';
    const aiSkill = getSkill(aiSkillId);
    const willCutIn = aiSkill.effect.basePower >= 1.5 && !!aiSkill.cutInDialogue;

    const proceed = () => {
      const after = aiExecuteAction(currentBattle, state, actor, rngRef.current);
      setBattle(after);
      setActiveActor(null);
    };

    if (willCutIn) {
      audio.play('cutIn');
      setCutIn({ general: g, skillName: aiSkill.name, dialogue: aiSkill.cutInDialogue, side: 'enemy' });
      window.setTimeout(proceed, 1700);
    } else {
      audio.play('attack');
      window.setTimeout(proceed, AI_DELAY_MS);
    }
  }, [state]);

  // --- tick → 行動者の決定 --------------------------------------------------
  // 注意: pending state は使わない。useEffect の deps で再呼出されると
  // cleanup で自分の timeout を取り消してしまうため。
  // 代わりに activeActor/cutIn/result を gate として使い、ref で多重発火を防ぐ。
  useEffect(() => {
    if (battle.result !== 'in_progress') return;
    if (activeActor) return;
    if (cutIn) return;
    if (tickLockRef.current) return;

    tickLockRef.current = true;
    const t = window.setTimeout(() => {
      tickLockRef.current = false;
      const r = advanceToNextActor(battle, state);

      if (!r.actor) {
        setBattle(r.battle);
        return;
      }

      setBattle(r.battle);
      setActiveActor(r.actor);

      if (r.actor.side === 'enemy') {
        stepEnemy(r.actor, r.battle);
      } else {
        const slot = r.battle.playerSlots[r.actor.index];
        const g = slot.generalId ? state.generals[slot.generalId] : null;
        setPhaseLabel(g ? `${g.name}の手番` : '味方の手番');
      }
    }, TICK_DELAY_MS);

    return () => {
      window.clearTimeout(t);
      tickLockRef.current = false;
    };
  }, [battle, activeActor, cutIn, state, stepEnemy]);

  // --- 戦闘終了の検出 ------------------------------------------------------

  const finished = battle.result !== 'in_progress';

  useEffect(() => {
    if (!finished) return;
    if (battle.result === 'enemy_win') {
      audio.play('defeat');
      audio.playBgm('defeat').catch(() => { /* noop */ });
    } else if (battle.result === 'player_win') {
      audio.play('victory');
    }
  }, [finished, battle.result]);

  useEffect(() => {
    document.body.style.overflow = showSurrenderModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSurrenderModal]);

  // --- プレイヤー入力 ------------------------------------------------------

  const playerActions = useMemo(() => {
    if (!activeActor || activeActor.side !== 'player') return [];
    const slot = battle.playerSlots[activeActor.index];
    if (!slot.generalId) return [];
    const g = state.generals[slot.generalId];
    return getDefaultPlayerActions(g);
  }, [activeActor, battle, state]);
  const activeGeneral = useMemo(() => {
    if (!activeActor || activeActor.side !== 'player') return null;
    const slot = battle.playerSlots[activeActor.index];
    return slot.generalId ? state.generals[slot.generalId] ?? null : null;
  }, [activeActor, battle.playerSlots, state.generals]);
  const focusedSkill = useMemo(() => {
    const id = focusedSkillId ?? playerActions[0]?.id ?? 'sk_zangeki';
    return getSkill(id);
  }, [focusedSkillId, playerActions]);

  function executePlayerSkill(skillId: string, targetIndex: number | null) {
    if (!activeActor) return;
    const slot = battle.playerSlots[activeActor.index];
    const g = slot.generalId ? state.generals[slot.generalId] : null;
    const skill = getSkill(skillId);
    setPendingSkillId(null);
    setSelectedTarget(null);
    setFocusedSkillId(skillId);

    const proceed = () => {
      const after = playerExecuteAction(battle, state, activeActor, skillId, targetIndex, rngRef.current);
      setBattle(after);
      setActiveActor(null);
    };

    if (g && skill.cutInDialogue) {
      audio.play('cutIn');
      setCutIn({ general: g, skillName: skill.name, dialogue: skill.cutInDialogue, side: 'player' });
      window.setTimeout(proceed, 1700);
    } else if (skill.kind === 'heal') {
      audio.play('heal');
      window.setTimeout(proceed, 250);
    } else if (skill.kind === 'support') {
      audio.play('skill');
      window.setTimeout(proceed, 250);
    } else {
      audio.play('attack');
      window.setTimeout(proceed, 250);
    }
  }

  function handleSkillClick(skillId: string) {
    if (!activeActor || activeActor.side !== 'player') return;
    const skill = getSkill(skillId);

    if (skill.target === 'enemy_one') {
      const aliveEnemies = battle.enemySlots
        .map((s, i) => ({ s, i }))
        .filter((x) => x.s.generalId && !x.s.retreated && x.s.hp > 0);
      if (aliveEnemies.length === 0) return;
      if (aliveEnemies.length === 1) {
        executePlayerSkill(skillId, aliveEnemies[0].i);
        return;
      }
      // 複数いる → ターゲット選択待ち
      setPendingSkillId(skillId);
      setFocusedSkillId(skillId);
      setPhaseLabel('攻撃する相手を選択');
      return;
    }
    // 対象不要（自身/全体/味方）
    executePlayerSkill(skillId, null);
  }

  function handleEnemyClick(idx: number) {
    if (!activeActor || activeActor.side !== 'player') return;
    if (!pendingSkillId) {
      setSelectedTarget(idx);
      return;
    }
    setSelectedTarget(idx);
    executePlayerSkill(pendingSkillId, idx);
  }

  function cancelPendingSkill() {
    setPendingSkillId(null);
    setSelectedTarget(null);
    const slot = activeActor && activeActor.side === 'player'
      ? battle.playerSlots[activeActor.index]
      : null;
    const g = slot?.generalId ? state.generals[slot.generalId] : null;
    setPhaseLabel(g ? `${g.name}の手番` : '');
  }

  // --- 戦闘終了処理 -------------------------------------------------------

  function handleConfirmEnd() {
    onComplete(battle);
  }

  function handleSurrender() {
    audio.play('tap');
    setShowSurrenderModal(true);
  }

  function confirmSurrender() {
    audio.play('defeat');
    setShowSurrenderModal(false);
    setBattle({ ...battle, result: 'enemy_win' });
  }

  // --- レンダリング -------------------------------------------------------

  const playerActiveIdx = activeActor?.side === 'player' ? activeActor.index : -1;
  const enemyActiveIdx  = activeActor?.side === 'enemy'  ? activeActor.index : -1;

  return (
    <div className="battleScreen">
      {/* 上部HUD */}
      <header className="battleHud">
        <div className="battleHudGroup">
          <span className="label">戦場</span>
          <span className="value">{region?.name ?? ''}</span>
        </div>
        <div className="battleHudGroup">
          <span className="label">補正</span>
          <span className="value">{battle.terrainBonus.note}</span>
        </div>
        <div className="battleHudGroup">
          <span className="label">合戦ターン</span>
          <span className="value">{battle.turn}/30</span>
        </div>
        <div className="battleHudGroup phase">
          <span className="value">{phaseLabel}</span>
        </div>
        <div className={`battleHudGroup advantage ${battleIntel.className}`}>
          <span className="label">現在の優勢</span>
          <span className="value">{battleIntel.label}</span>
        </div>
        {!finished && (
          <button className="surrenderBtn" onClick={handleSurrender}>
            降伏
          </button>
        )}
      </header>

      <section className="battleInfoStrip">
        <span>地形補正：{battle.terrainBonus.note}</span>
        <span>合戦ターン：{battle.turn}/30</span>
        <span className={battleIntel.className}>戦況：{battleIntel.label}</span>
        <strong>{battleIntel.reason}</strong>
      </section>
      {activeGeneral && (
        <section className="activeTurnStrip">
          <span className="label">手番</span>
          <strong>{activeGeneral.name}</strong>
          <span>兵{battle.playerSlots[activeActor?.index ?? 0]?.hp.toLocaleString()} / 守{battle.playerSlots[activeActor?.index ?? 0]?.guard}%</span>
        </section>
      )}

      {/* 中央：3×3スロット */}
      <div className="battleField">
        <div className="battleSide playerSide">
          <div className="sideLabel">暁ノ家</div>
          <div className="slotGrid">
            {battle.playerSlots.map((slot, i) => (
              <BattleCard
                key={i}
                state={state}
                slot={slot}
                side="player"
                isActive={i === playerActiveIdx}
                isTargetable={false}
                isSelectedTarget={false}
                onClick={() => {}}
              />
            ))}
          </div>
        </div>

        <div className="battleCenter">
          <FormationGauge battle={battle} reason={battleIntel.reason} label={battleIntel.label} className={battleIntel.className} />
        </div>

        <div className="battleSide enemySide">
          <div className="sideLabel">{state.factions[battle.defenderFactionId]?.name ?? '敵'}</div>
          <div className="slotGrid">
            {battle.enemySlots.map((slot, i) => {
              const isAlive = slot.generalId && !slot.retreated && slot.hp > 0;
              const isTargetable = !!isAlive && activeActor?.side === 'player' && !!pendingSkillId;
              return (
                <BattleCard
                  key={i}
                  state={state}
                  slot={slot}
                  side="enemy"
                  isActive={i === enemyActiveIdx}
                  isTargetable={isTargetable}
                  isSelectedTarget={selectedTarget === i}
                  onClick={() => handleEnemyClick(i)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 戦闘ログ */}
      <div className="battleLog" aria-label="戦闘ログ">
        {battle.log.slice(-6).map((entry, i) => (
          <div key={`${entry.turn}-${i}`} className={`logLine ${logKind(entry.message)}`}>
            <span className="logIcon">{logIcon(entry.message)}</span>
            <span>{entry.message}</span>
          </div>
        ))}
      </div>

      {/* プレイヤー行動UI */}
      {!finished && activeActor?.side === 'player' && (
        <div className="actionPicker">
          <div className="actionLabel">行動を選択</div>
          <div className="actionRow">
            {playerActions.map((a) => (
              <SkillActionButton
                key={a.id}
                skill={getSkill(a.id)}
                disabledReason={getSkillUnavailableReason(getSkill(a.id), battle, pendingSkillId)}
                onFocusSkill={() => setFocusedSkillId(a.id)}
                onUse={() => handleSkillClick(a.id)}
              />
            ))}
          </div>
          <SkillDetailPanel skill={focusedSkill} disabledReason={getSkillUnavailableReason(focusedSkill, battle, pendingSkillId)} />
          {pendingSkillId && (
            <div className="actionHint">
              攻撃する相手を選んでください
              <button
                onClick={cancelPendingSkill}
                style={{
                  marginLeft: 12, padding: '2px 8px', fontSize: 11,
                  background: 'transparent', border: '1px solid var(--c-kinari-d)',
                  color: 'var(--c-kinari-d)', borderRadius: 'var(--radius-s)',
                }}
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      )}

      {/* 戦闘終了オーバーレイ */}
      {finished && (
        <div className="battleResultOverlay">
          <div className="battleResultBox">
            <div className={`battleResultTitle ${battle.result}`}>
              {battle.result === 'player_win' && '勝　利'}
              {battle.result === 'enemy_win' && '敗　北'}
              {battle.result === 'draw' && '引　分'}
            </div>
            <div className="battleResultDetail">
              <BattleSummary battle={battle} state={state} />
            </div>
            <button className="battleResultBtn" onClick={handleConfirmEnd}>
              戦果を確定
            </button>
          </div>
        </div>
      )}

      {/* カットイン */}
      {cutIn && (
        <BattleCutIn
          general={cutIn.general}
          skillName={cutIn.skillName}
          dialogue={cutIn.dialogue}
          side={cutIn.side}
          onComplete={() => setCutIn(null)}
        />
      )}

      {showSurrenderModal && (
        <div className="surrenderModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="surrender-title">
          <div className="surrenderModal">
            <h2 id="surrender-title">降伏確認</h2>
            <p>降伏するとこの合戦は敗北扱いになります。よろしいですか？</p>
            <div className="surrenderActions">
              <button onClick={() => { audio.play('tap'); setShowSurrenderModal(false); }}>
                戦場に戻る
              </button>
              <button className="danger" onClick={confirmSurrender}>
                降伏する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 補助コンポーネント ----------------------------------------------------

function SkillActionButton({
  skill,
  disabledReason,
  onFocusSkill,
  onUse,
}: {
  skill: Skill;
  disabledReason: string | null;
  onFocusSkill: () => void;
  onUse: () => void;
}) {
  const disabled = disabledReason !== null;
  return (
    <button
      className="actionBtn"
      onClick={onUse}
      onFocus={onFocusSkill}
      onPointerEnter={onFocusSkill}
      disabled={disabled}
      title={disabledReason ?? skill.description}
    >
      <span className="actionName">{skill.name === '通常斬撃' ? '通常攻撃' : skill.name}</span>
      <span className="actionMeta">
        {skill.cost > 0 ? `気${skill.cost}` : '気0'} / {skillKindLabel(skill.kind)}
      </span>
      <span className="actionDesc">{shortSkillText(skill)}</span>
      {disabledReason && <span className="actionReason">{disabledReason}</span>}
    </button>
  );
}

function SkillDetailPanel({ skill, disabledReason }: { skill: Skill; disabledReason: string | null }) {
  return (
    <div className="skillDetailPanel">
      <div>
        <span className="skillType">{skillKindLabel(skill.kind)}</span>
        <strong>{skill.name === '通常斬撃' ? '通常攻撃' : skill.name}</strong>
        <span>気{skill.cost}</span>
      </div>
      <p>{skill.description}</p>
      <small>対象：{skillTargetLabel(skill.target)}{disabledReason ? ` / 使用不可：${disabledReason}` : ''}</small>
    </div>
  );
}

function getSkillUnavailableReason(skill: Skill, battle: BattleState, pendingSkillId: string | null): string | null {
  if (pendingSkillId && pendingSkillId !== skill.id) return '対象選択中';
  if ((skill.target === 'enemy_one' || skill.target === 'enemy_all') &&
      !battle.enemySlots.some((s) => s.generalId && !s.retreated && s.hp > 0)) {
    return '対象なし';
  }
  if ((skill.target === 'ally_one' || skill.target === 'ally_all') &&
      !battle.playerSlots.some((s) => s.generalId && !s.retreated && s.hp > 0)) {
    return '対象なし';
  }
  return null;
}

function skillKindLabel(kind: SkillKind): string {
  return {
    attack: '攻撃',
    aoe: '攻撃',
    support: '強化/弱体',
    heal: '回復',
    special: '特殊',
  }[kind];
}

function skillTargetLabel(target: SkillTarget): string {
  return {
    enemy_one: '敵単体',
    enemy_all: '敵全体',
    ally_one: '味方単体',
    ally_all: '味方全体',
    self: '自分',
  }[target];
}

function shortSkillText(skill: Skill): string {
  const text = skill.description.replace(/。$/, '');
  return text.length > 18 ? `${text.slice(0, 18)}…` : text;
}

function FormationGauge({ battle, reason, label, className }: { battle: BattleState; reason: string; label: string; className: string }) {
  const playerHp = battle.playerSlots.reduce((s, x) => s + x.hp, 0);
  const enemyHp  = battle.enemySlots.reduce((s, x) => s + x.hp, 0);
  const total = playerHp + enemyHp || 1;
  const playerPct = (playerHp / total) * 100;

  return (
    <div className="formationGauge" role="img" aria-label="陣形ゲージ">
      <div className="formGaugeLabel">陣形</div>
      <div className={`formGaugeAdvantage ${className}`}>{label}</div>
      <div className="formGaugeBar">
        <div className="formGaugePlayer" style={{ height: `${playerPct}%` }} />
        <div className="formGaugeEnemy"  style={{ height: `${100 - playerPct}%` }} />
      </div>
      <div className="formGaugeValues">
        <span>{playerHp.toLocaleString()}</span>
        <span>{enemyHp.toLocaleString()}</span>
      </div>
      <div className="formGaugeReason">{reason}</div>
    </div>
  );
}

function BattleSummary({ battle, state }: { battle: BattleState; state: GameState }) {
  const lines: BattleLogEntry[] = battle.log.slice(-12);
  const defeatNotes = battle.result === 'enemy_win' ? buildDefeatNotes(battle, state) : [];
  return (
    <div className="battleSummary">
      <div className="summaryLine">合戦ターン {battle.turn} 経過</div>
      {defeatNotes.length > 0 && (
        <div className="defeatSummary">
          <h3>敗因まとめ</h3>
          {defeatNotes.map((note) => <div key={note}>- {note}</div>)}
          <h3>次におすすめの行動</h3>
          <div>- 探索で武将を増やす</div>
          <div>- 徴収で金を増やす</div>
          <div>- 兵を補充する</div>
          <div>- 危険度の低い隣接国を攻める</div>
        </div>
      )}
      <div className="summaryLog">
        {lines.map((l, i) => (
          <div key={i} className={`summaryLogLine ${logKind(l.message)}`}>{l.message}</div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-kinari-d)', marginTop: 8 }}>
        ※ 戦果（兵数反映・捕虜化判定・地域支配権）は確定ボタ�ンで適用されます。
      </div>
      <span style={{ display: 'none' }}>{state.turn}</span>
    </div>
  );
}

function describeBattleState(battle: BattleState, state: GameState): { label: string; reason: string; className: string } {
  const player = summarizeSlots(state, battle.playerSlots);
  const enemy = summarizeSlots(state, battle.enemySlots);
  const playerScore = Math.max(1, player.combatPower);
  const enemyScore = Math.max(1, enemy.combatPower);
  const diff = playerScore - enemyScore;
  const label = Math.abs(diff) < Math.max(playerScore, enemyScore) * 0.12
    ? '互角'
    : diff > 0 ? '味方優勢' : '敵優勢';
  const className = label === '味方優勢' ? 'good' : label === '敵優勢' ? 'bad' : 'warn';
  let reason = '兵数と武将能力が拮抗しています。';
  if (label === '敵優勢') {
    reason = enemy.troopTotal > player.troopTotal && enemy.topPower > player.topPower
      ? '敵優勢：敵兵数が多く、敵武将の武力が高い'
      : enemy.troopTotal > player.troopTotal
        ? '敵優勢：敵兵数が多い'
        : '敵優勢：敵上位武将の武力が高い';
  } else if (label === '味方優勢') {
    reason = player.troopTotal > enemy.troopTotal
      ? '味方優勢：味方兵数が残っており押し返せます'
      : '味方優勢：味方武将の能力が上回っています';
  }
  return { label, reason, className };
}

function buildDefeatNotes(battle: BattleState, state: GameState): string[] {
  const player = summarizeSlots(state, battle.playerSlots);
  const enemy = summarizeSlots(state, battle.enemySlots);
  const enemyTop = enemy.topGeneralName ?? '敵上位武将';
  const earlyRetreat = battle.playerSlots.some((s) => s.generalId && s.retreated);
  const notes = [
    enemy.troopTotal >= player.troopTotal ? '敵の総兵力が味方を上回っていました' : '残存兵力で敵を削り切れませんでした',
    `敵武将「${enemyTop}」の攻撃が強力でした`,
  ];
  if (earlyRetreat) notes.push('味方の一部武将が早期に撤退しました');
  notes.push('序盤は兵力差のある相手を避け、弱い地域から攻めるのが安全です');
  return notes;
}

function logKind(message: string): string {
  if (message.includes('発動')) return 'skill';
  if (message.includes('撤退') || message.includes('敗走')) return 'retreat';
  if (message.includes('損害')) return 'damage';
  if (message.includes('敗北') || message.includes('討ち取')) return 'defeat';
  return 'normal';
}

function logIcon(message: string): string {
  if (message.includes('発動')) return '技';
  if (message.includes('撤退') || message.includes('敗走')) return '退';
  if (message.includes('損害')) return '撃';
  if (message.includes('敗北') || message.includes('討ち取')) return '敗';
  return '記';
}

