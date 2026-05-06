import { useCallback, useEffect, useRef, useState } from 'react';
import { skillCatalog } from '../data/names';
import type { BattleResult, GameState } from '../types/game';

interface Props {
  result: BattleResult;
  state: GameState;
  onClose: () => void;
}

interface Combatant {
  officerId: string;
  name: string;
  kanji: string;
  color: string;
  maxHp: number;
  hp: number;
  finalHp: number;
}

type EvType = 'attack' | 'skill' | 'defeat' | 'result';
interface AnimEvent {
  type: EvType;
  side: 'atk' | 'def';
  actorIdx: number;
  targetIdx: number;
  damage: number;
  skillName?: string;
  logMsg: string;
}

interface FloatItem {
  id: number;
  dmg: number;
  side: 'atk' | 'def';
  idx: number;
  isSkill: boolean;
}

function makeCombatants(
  participants: BattleResult['attackerParticipants'],
  factionColor: string,
  fallbackName: string,
  fallbackTroops: number,
): Combatant[] {
  if (participants.length === 0) {
    return [{ officerId: 'local', name: fallbackName, kanji: '兵', color: factionColor,
      maxHp: Math.max(1, fallbackTroops), hp: Math.max(1, fallbackTroops),
      finalHp: Math.floor(fallbackTroops * 0.5) }];
  }
  return participants.map((p) => ({
    officerId: p.officerId, name: p.name, kanji: p.name.slice(0, 1), color: factionColor,
    maxHp: Math.max(1, p.troopsBefore), hp: Math.max(1, p.troopsBefore),
    finalHp: Math.max(0, p.troopsAfter),
  }));
}

function buildEvents(atk: Combatant[], def: Combatant[], result: BattleResult): AnimEvent[] {
  const events: AnimEvent[] = [];
  const atkHp = atk.map((c) => ({ hp: c.maxHp, final: c.finalHp }));
  const defHp = def.map((c) => ({ hp: c.maxHp, final: c.finalHp }));
  const ROUNDS = 4;
  const skillNames = result.activatedSkills
    .map((id) => skillCatalog[id]?.name ?? null).filter(Boolean) as string[];

  for (let round = 0; round < ROUNDS; round++) {
    const isLastRound = round === ROUNDS - 1;
    for (let ai = 0; ai < atk.length; ai++) {
      if (atkHp[ai].hp <= 0) continue;
      const di = defHp.findIndex((d) => d.hp > 0);
      if (di < 0) break;
      const isSkillRound = round === 1 && ai === 0 && skillNames.length > 0;
      const baseDmg = Math.max(1, Math.floor(
        (defHp[di].hp - (isLastRound ? defHp[di].final : defHp[di].hp * 0.55)) / (ROUNDS - round)));
      const dmg = isSkillRound ? Math.floor(baseDmg * 1.6) : baseDmg;
      if (isSkillRound) {
        events.push({ type: 'skill', side: 'atk', actorIdx: ai, targetIdx: di, damage: 0,
          skillName: skillNames[0], logMsg: `✦ ${atk[ai].name}の「${skillNames[0]}」発動！` });
      }
      events.push({ type: 'attack', side: 'atk', actorIdx: ai, targetIdx: di, damage: dmg,
        logMsg: isSkillRound
          ? `⚔ ${atk[ai].name}→${def[di].name}：${dmg.toLocaleString()}の一撃！`
          : `⚔ ${atk[ai].name}が${def[di].name}を攻撃　−${dmg.toLocaleString()}` });
      defHp[di].hp = Math.max(defHp[di].final, defHp[di].hp - dmg);
      if (defHp[di].hp <= 0 && def[di].finalHp <= 0)
        events.push({ type: 'defeat', side: 'def', actorIdx: di, targetIdx: di, damage: 0,
          logMsg: `☠ ${def[di].name}、討ち取られた！` });
    }
    for (let di = 0; di < def.length; di++) {
      if (defHp[di].hp <= 0) continue;
      const ai = atkHp.findIndex((a) => a.hp > 0);
      if (ai < 0) break;
      const dmg = Math.max(1, Math.floor(
        (atkHp[ai].hp - (isLastRound ? atkHp[ai].final : atkHp[ai].hp * 0.6)) / (ROUNDS - round)));
      events.push({ type: 'attack', side: 'def', actorIdx: di, targetIdx: ai, damage: dmg,
        logMsg: `🛡 ${def[di].name}が反撃！ ${atk[ai].name}に−${dmg.toLocaleString()}` });
      atkHp[ai].hp = Math.max(atkHp[ai].final, atkHp[ai].hp - dmg);
      if (atkHp[ai].hp <= 0 && atk[ai].finalHp <= 0)
        events.push({ type: 'defeat', side: 'atk', actorIdx: ai, targetIdx: ai, damage: 0,
          logMsg: `☠ ${atk[ai].name}、敗退！` });
    }
  }
  events.push({ type: 'result', side: 'atk', actorIdx: 0, targetIdx: 0, damage: 0,
    logMsg: result.victory ? '【勝利】戦場を制した！' : '【敗北】敵の守りを崩せず…' });
  return events;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ArmyGauge({ totalHp, maxHp, side }: { totalHp: number; maxHp: number; side: 'atk' | 'def' }) {
  const SEG = 20;
  const ratio = maxHp > 0 ? totalHp / maxHp : 0;
  const filled = Math.round(ratio * SEG);
  return (
    <div className="rHudGauge">
      {Array(SEG).fill(0).map((_, i) => (
        <div key={i} className={`rHudSeg ${i < filled ? `filled-${side}` : 'empty'}`} />
      ))}
    </div>
  );
}

function TroopLine({ count, side, active }: { count: number; side: 'atk' | 'def'; active: boolean }) {
  const visible = Math.min(Math.max(count, 0), 8);
  return (
    <div className={`rTroopLine ${side}`}>
      {Array(visible).fill(0).map((_, i) => (
        <div key={i} className={`rTroopShape ${side} ${active ? 'attacking' : ''}`}
          style={{ animationDelay: `${i * 0.04}s` }} />
      ))}
    </div>
  );
}

interface CardProps {
  c: Combatant; side: 'atk' | 'def';
  isActive: boolean; isHit: boolean; isSkill: boolean; isDefeated: boolean;
}

function CharCard({ c, side, isActive, isHit, isSkill, isDefeated }: CardProps) {
  const HP_SEGS = 6;
  const ratio = c.maxHp > 0 ? c.hp / c.maxHp : 0;
  const filled = Math.max(0, Math.ceil(ratio * HP_SEGS));
  const cls = ['rCard', side,
    isActive ? (isSkill ? 'is-skill' : 'is-attacking') : '',
    isHit ? 'is-hit' : '', isDefeated ? 'is-defeated' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div className="rPortrait"
        style={{ background: `linear-gradient(160deg,${c.color}ee 0%,${c.color}55 60%,#0a0f1800 100%)` }}>
        <span className="rKanji">{c.kanji}</span>
        {isSkill && <div className="rSkillRing" />}
      </div>
      <div className="rCardBody">
        <div className="rCardName">{c.name}</div>
        <div className="rHpSegs">
          {Array(HP_SEGS).fill(0).map((_, i) => (
            <div key={i} className={`rHpSeg ${i < filled ? `filled-${side}` : 'empty'}`} />
          ))}
        </div>
        <div className="rHpNum">{isDefeated ? '---' : c.hp.toLocaleString()}</div>
      </div>
      {isDefeated && <div className="rDefeatedOverlay">部隊壊滅</div>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function BattleScene({ result, state, onClose }: Props) {
  const atkFaction = state.factions[result.attackerFactionId];
  const defFaction = state.factions[result.defenderFactionId];
  const defRegion  = state.regions[result.targetRegionId];

  const [atkC, setAtkC] = useState<Combatant[]>(() =>
    makeCombatants(result.attackerParticipants, atkFaction?.color ?? '#c03020',
      atkFaction?.name ?? '攻撃側', defRegion?.localTroops ?? 200));
  const [defC, setDefC] = useState<Combatant[]>(() =>
    makeCombatants(result.defenderParticipants, defFaction?.color ?? '#4090e0',
      defFaction?.name ?? '守備兵', defRegion?.localTroops ?? 200));

  const eventsRef  = useRef<AnimEvent[]>([]);
  const eIdxRef    = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skippedRef = useRef(false);
  const floatIdRef = useRef(0);

  const [activeAtk,    setActiveAtk]    = useState(-1);
  const [activeDef,    setActiveDef]    = useState(-1);
  const [hitAtk,       setHitAtk]       = useState(-1);
  const [hitDef,       setHitDef]       = useState(-1);
  const [skillFlash,   setSkillFlash]   = useState(false);
  const [skillRingIdx, setSkillRingIdx] = useState<{ side: 'atk'|'def'; idx: number }|null>(null);
  const [floats,       setFloats]       = useState<FloatItem[]>([]);
  const [logLines,     setLogLines]     = useState<{ msg: string; cls: string }[]>([]);
  const [phase,        setPhase]        = useState<'intro'|'fighting'|'result'>('intro');
  const [defeatedAtk,  setDefeatedAtk]  = useState<Set<number>>(new Set());
  const [defeatedDef,  setDefeatedDef]  = useState<Set<number>>(new Set());
  const [roundNum,     setRoundNum]     = useState(1);

  const atkTotalHp = atkC.reduce((s, c) => s + c.hp, 0);
  const atkMaxHp   = atkC.reduce((s, c) => s + c.maxHp, 0);
  const defTotalHp = defC.reduce((s, c) => s + c.hp, 0);
  const defMaxHp   = defC.reduce((s, c) => s + c.maxHp, 0);
  const atkAlive   = atkC.filter((_, i) => !defeatedAtk.has(i)).length;
  const defAlive   = defC.filter((_, i) => !defeatedDef.has(i)).length;

  useEffect(() => {
    eventsRef.current = buildEvents(atkC, defC, result);
    const t = setTimeout(() => setPhase('fighting'), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback((msg: string, cls: string) => {
    setLogLines((prev) => [...prev, { msg, cls }].slice(-3));
  }, []);

  const addFloat = useCallback((dmg: number, side: 'atk'|'def', idx: number, isSkill: boolean) => {
    const id = ++floatIdRef.current;
    setFloats((prev) => [...prev, { id, dmg, side, idx, isSkill }]);
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 950);
  }, []);

  const playNext = useCallback(() => {
    const events = eventsRef.current;
    const idx = eIdxRef.current;
    if (idx >= events.length) return;
    eIdxRef.current = idx + 1;
    const ev = events[idx];

    if (ev.type === 'result') {
      setPhase('result');
      setAtkC((prev) => prev.map((c) => ({ ...c, hp: c.finalHp })));
      setDefC((prev) => prev.map((c) => ({ ...c, hp: c.finalHp })));
      addLog(ev.logMsg, 'log-result');
      return;
    }
    if (idx > 0 && idx % 4 === 0) setRoundNum((r) => Math.min(r + 1, 4));

    if (ev.type === 'skill') {
      setSkillFlash(true);
      setSkillRingIdx({ side: ev.side, idx: ev.actorIdx });
      if (ev.side === 'atk') { setActiveAtk(ev.actorIdx); setActiveDef(-1); }
      else                   { setActiveDef(ev.actorIdx); setActiveAtk(-1); }
      addLog(ev.logMsg, 'log-skill');
      setTimeout(() => {
        setSkillFlash(false); setSkillRingIdx(null);
        if (!skippedRef.current) timerRef.current = setTimeout(playNext, 300);
      }, 600);
      return;
    }
    if (ev.type === 'defeat') {
      if (ev.side === 'def') setDefeatedDef((prev) => new Set([...prev, ev.actorIdx]));
      else                   setDefeatedAtk((prev) => new Set([...prev, ev.actorIdx]));
      addLog(ev.logMsg, 'log-defeat');
      timerRef.current = setTimeout(playNext, skippedRef.current ? 60 : 500);
      return;
    }
    if (ev.side === 'atk') {
      setActiveAtk(ev.actorIdx); setActiveDef(-1);
      setHitDef(ev.targetIdx);   setHitAtk(-1);
      setDefC((prev) => prev.map((c, i) =>
        i === ev.targetIdx ? { ...c, hp: Math.max(c.finalHp, c.hp - ev.damage) } : c));
      addFloat(ev.damage, 'def', ev.targetIdx, false);
    } else {
      setActiveDef(ev.actorIdx); setActiveAtk(-1);
      setHitAtk(ev.targetIdx);   setHitDef(-1);
      setAtkC((prev) => prev.map((c, i) =>
        i === ev.targetIdx ? { ...c, hp: Math.max(c.finalHp, c.hp - ev.damage) } : c));
      addFloat(ev.damage, 'atk', ev.targetIdx, false);
    }
    addLog(ev.logMsg, 'log-attack');
    const resetMs = skippedRef.current ? 60 : 480;
    setTimeout(() => { setActiveAtk(-1); setActiveDef(-1); setHitAtk(-1); setHitDef(-1); }, resetMs - 80);
    timerRef.current = setTimeout(playNext, resetMs);
  }, [addLog, addFloat]);

  useEffect(() => {
    if (phase === 'fighting') timerRef.current = setTimeout(playNext, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, playNext]);

  const handleSkip = () => {
    skippedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    for (let i = eIdxRef.current; i < eventsRef.current.length; i++) {
      const ev = eventsRef.current[i];
      if (ev.type === 'result') {
        setPhase('result');
        setAtkC((prev) => prev.map((c) => ({ ...c, hp: c.finalHp })));
        setDefC((prev) => prev.map((c) => ({ ...c, hp: c.finalHp })));
        addLog(ev.logMsg, 'log-result');
        break;
      }
      if (ev.type === 'defeat') {
        if (ev.side === 'def') setDefeatedDef((prev) => new Set([...prev, ev.actorIdx]));
        else                   setDefeatedAtk((prev) => new Set([...prev, ev.actorIdx]));
      }
    }
    eIdxRef.current = eventsRef.current.length;
  };

  const atkName = atkFaction?.name ?? '攻撃側';
  const defName = defFaction?.name ?? '防衛側';

  return (
    <div className="ranceBattle">

      {/* ── TOP HUD ── */}
      <div className="rTopHud">
        <div className="rHudSide atk">
          <div className="rHudLabel">{atkName}</div>
          <ArmyGauge totalHp={atkTotalHp} maxHp={atkMaxHp} side="atk" />
        </div>
        <div className="rHudCenter">
          <div className="rHudTitle">{result.targetRegionName}の戦い</div>
          <div className="rHudRound">第{roundNum}波 / 4</div>
        </div>
        <div className="rHudSide def">
          <ArmyGauge totalHp={defTotalHp} maxHp={defMaxHp} side="def" />
          <div className="rHudLabel def">{defName}</div>
        </div>
      </div>

      {/* ── BATTLEFIELD VISUAL ── */}
      <div className="rFieldArea">
        <div className="rFieldBg" />
        <TroopLine count={atkAlive} side="atk" active={activeAtk >= 0} />
        <div className="rDmgDisplay">
          <span className="rDmgNum atk">{atkTotalHp.toLocaleString()}</span>
          <span className="rDmgBar"> | </span>
          <span className="rDmgNum def">{defTotalHp.toLocaleString()}</span>
        </div>
        <TroopLine count={defAlive} side="def" active={activeDef >= 0} />
        {floats.map((f) => (
          <div key={f.id}
            className={`rFloat ${f.side}${f.isSkill ? ' skill' : ''}`}
            style={{ top: `${20 + (f.idx % 3) * 25}%` }}>
            −{f.dmg.toLocaleString()}
          </div>
        ))}
        {skillFlash && <div className="rSkillFlash" />}
      </div>

      {/* ── CHARACTER GRIDS ── */}
      <div className="rBattleSides">
        <div className="rBattleSide">
          <div className="rSideLabel atk">{atkName} 出陣武将</div>
          <div className="rCardGrid">
            {atkC.map((c, i) => (
              <CharCard key={c.officerId + i} c={c} side="atk"
                isActive={activeAtk === i} isHit={hitAtk === i}
                isSkill={skillRingIdx?.side === 'atk' && skillRingIdx.idx === i}
                isDefeated={defeatedAtk.has(i)} />
            ))}
          </div>
        </div>
        <div className="rVsDivider"><span className="rVsText">VS</span></div>
        <div className="rBattleSide">
          <div className="rSideLabel def">{defName} 迎撃武将</div>
          <div className="rCardGrid">
            {defC.map((c, i) => (
              <CharCard key={c.officerId + i} c={c} side="def"
                isActive={activeDef === i} isHit={hitDef === i}
                isSkill={skillRingIdx?.side === 'def' && skillRingIdx.idx === i}
                isDefeated={defeatedDef.has(i)} />
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER BAR ── */}
      <div className="rFooterBar">
        <div className="rFooterLeft">
          {phase !== 'result' && (
            <button className="rSkipBtn" onClick={handleSkip}>スキップ [Esc]</button>
          )}
        </div>
        <div className="rLogArea">
          {phase === 'intro' && (
            <div className="rLogLine log-attack">{atkName}が{result.targetRegionName}へ進軍！</div>
          )}
          {logLines.map((l, i) => (
            <div key={i} className={`rLogLine ${l.cls}`}>{l.msg}</div>
          ))}
        </div>
        <div className="rFooterRight">
          <span className="rFieldBonus">戦場補正 ±0%</span>
        </div>
      </div>

      {/* ── RESULT OVERLAY ── */}
      {phase === 'result' && (
        <div className="rResultOverlay">
          <div className={`rResultBanner ${result.victory ? 'win' : 'lose'}`}>
            {result.victory ? '勝　利' : '敗　北'}
          </div>
          <div className="rResultGrid">
            <div className="rResultItem">
              <span className="rRLabel">討ち取り</span>
              <span className="rRVal win">{result.defenderLosses.toLocaleString()}</span>
            </div>
            <div className="rResultItem">
              <span className="rRLabel">味方損害</span>
              <span className="rRVal lose">{result.attackerLosses.toLocaleString()}</span>
            </div>
            <div className="rResultItem">
              <span className="rRLabel">城耐久</span>
              <span className="rRVal">{result.castleHpBefore}→{result.castleHpAfter}</span>
            </div>
            <div className="rResultItem">
              <span className="rRLabel">制　圧</span>
              <span className="rRVal" style={{ color: result.conquered ? 'var(--gold)' : 'var(--muted)' }}>
                {result.conquered ? '占領！' : 'なし'}
              </span>
            </div>
          </div>
          <button className="rResultBtn" onClick={onClose}>戦場を去る</button>
        </div>
      )}
    </div>
  );
}
