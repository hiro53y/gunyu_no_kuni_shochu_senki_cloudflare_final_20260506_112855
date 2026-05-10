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
  const [phaseLabel, setPhaseLabel] = useState<string>('合戦開始');

  // rng は state.rngSeed を受けて、battle 内部でのみ使う（state は更新しない）
  const rngRef = useRef(createRng(state.rngSeed));
  // 現在進行中のtimerが多重発動しないようにロックする
  const tickLockRef = useRef(false);

  const region = state.regions[battle.regionId];

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

  // --- プレイヤー入力 ------------------------------------------------------

  const playerActions = useMemo(() => {
    if (!activeActor || activeActor.side !== 'player') return [];
    const slot = battle.playerSlots[activeActor.index];
    if (!slot.generalId) return [];
    const g = state.generals[slot.generalId];
    return getDefaultPlayerActions(g);
  }, [activeActor, battle, state]);

  function executePlayerSkill(skillId: string, targetIndex: number | null) {
    if (!activeActor) return;
    const slot = battle.playerSlots[activeActor.index];
    const g = slot.generalId ? state.generals[slot.generalId] : null;
    const skill = getSkill(skillId);
    setPendingSkillId(null);
    setSelectedTarget(null);

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
    if (!window.confirm('降伏しますか？合戦は敗北扱いになります。')) return;
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
        {!finished && (
          <button className="surrenderBtn" onClick={handleSurrender}>
            降伏
          </button>
        )}
      </header>

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
          <FormationGauge battle={battle} />
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
          <div key={`${entry.turn}-${i}`} className="logLine">
            {entry.message}
          </div>
        ))}
      </div>

      {/* プレイヤー行動UI */}
      {!finished && activeActor?.side === 'player' && (
        <div className="actionPicker">
          <div className="actionLabel">行動を選択</div>
          <div className="actionRow">
            {playerActions.map((a) => (
              <button
                key={a.id}
                className="actionBtn"
                onClick={() => handleSkillClick(a.id)}
                disabled={pendingSkillId !== null}
              >
                <span className="actionName">{a.name}</span>
                {a.cost > 0 && <span className="actionCost">気{a.cost}</span>}
              </button>
            ))}
          </div>
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
    </div>
  );
}

// --- 補助コンポーネント ----------------------------------------------------

function FormationGauge({ battle }: { battle: BattleState }) {
  const playerHp = battle.playerSlots.reduce((s, x) => s + x.hp, 0);
  const enemyHp  = battle.enemySlots.reduce((s, x) => s + x.hp, 0);
  const total = playerHp + enemyHp || 1;
  const playerPct = (playerHp / total) * 100;

  return (
    <div className="formationGauge" role="img" aria-label="陣形ゲージ">
      <div className="formGaugeLabel">陣形</div>
      <div className="formGaugeBar">
        <div className="formGaugePlayer" style={{ height: `${playerPct}%` }} />
        <div className="formGaugeEnemy"  style={{ height: `${100 - playerPct}%` }} />
      </div>
      <div className="formGaugeValues">
        <span>{playerHp.toLocaleString()}</span>
        <span>{enemyHp.toLocaleString()}</span>
      </div>
    </div>
  );
}

function BattleSummary({ battle, state }: { battle: BattleState; state: GameState }) {
  const lines: BattleLogEntry[] = battle.log.slice(-12);
  return (
    <div className="battleSummary">
      <div className="summaryLine">合戦ターン {battle.turn} 経過</div>
      <div className="summaryLog">
        {lines.map((l, i) => (
          <div key={i} className="summaryLogLine">{l.message}</div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-kinari-d)', marginTop: 8 }}>
        ※ 戦果（兵数反映・捕虜化判定・地域支配権）は確定ボタ�ンで適用されます。
      </div>
      <span style={{ display: 'none' }}>{state.turn}</span>
    </div>
  );
}
