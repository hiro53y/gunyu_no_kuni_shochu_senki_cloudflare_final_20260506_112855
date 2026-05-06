import { useCallback, useEffect, useRef, useState } from 'react';
import { skillCatalog } from '../data/names';
import type { BattleResult, GameState } from '../types/game';

interface Props { result: BattleResult; state: GameState; onClose: () => void; }

interface Combatant {
  officerId: string; name: string; kanji: string; color: string;
  maxHp: number; hp: number; finalHp: number;
  valor: number; command: number; wisdom: number;
  skillCount: number; portraitType: number;
}

type EvType = 'attack' | 'skill' | 'defeat' | 'result';
interface AnimEvent {
  type: EvType; side: 'atk'|'def'; actorIdx: number; targetIdx: number;
  damage: number; skillName?: string; logMsg: string;
}
interface FloatItem { id: number; dmg: number; side: 'atk'|'def'; idx: number; isSkill: boolean; }

function hashPortrait(id: string, idx: number): number {
  let h = idx * 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 6;
  return Math.abs(h) % 6;
}

function makeCombatants(
  participants: BattleResult['attackerParticipants'],
  state: GameState, factionColor: string, fallbackName: string, fallbackTroops: number,
): Combatant[] {
  if (participants.length === 0) return [{
    officerId: 'local', name: fallbackName, kanji: '兵', color: factionColor,
    maxHp: Math.max(1, fallbackTroops), hp: Math.max(1, fallbackTroops),
    finalHp: Math.floor(fallbackTroops * 0.5),
    valor: 5, command: 5, wisdom: 5, skillCount: 0, portraitType: 0,
  }];
  return participants.map((p, idx) => {
    const off = state.officers[p.officerId];
    return {
      officerId: p.officerId, name: p.name, kanji: p.name.slice(0, 1), color: factionColor,
      maxHp: Math.max(1, p.troopsBefore), hp: Math.max(1, p.troopsBefore),
      finalHp: Math.max(0, p.troopsAfter),
      valor:   Math.min(9, Math.max(1, off?.valor   ?? 5)),
      command: Math.min(9, Math.max(1, off?.command ?? 5)),
      wisdom:  Math.min(9, Math.max(1, off?.wisdom  ?? 5)),
      skillCount: off?.skills?.length ?? 0,
      portraitType: hashPortrait(p.officerId, idx),
    };
  });
}

function buildEvents(atk: Combatant[], def: Combatant[], result: BattleResult): AnimEvent[] {
  const events: AnimEvent[] = [];
  const atkHp = atk.map(c => ({ hp: c.maxHp, final: c.finalHp }));
  const defHp = def.map(c => ({ hp: c.maxHp, final: c.finalHp }));
  const ROUNDS = 4;
  const skillNames = result.activatedSkills.map(id => skillCatalog[id]?.name ?? null).filter(Boolean) as string[];
  for (let round = 0; round < ROUNDS; round++) {
    const isLast = round === ROUNDS - 1;
    for (let ai = 0; ai < atk.length; ai++) {
      if (atkHp[ai].hp <= 0) continue;
      const di = defHp.findIndex(d => d.hp > 0);
      if (di < 0) break;
      const isSkill = round === 1 && ai === 0 && skillNames.length > 0;
      const base = Math.max(1, Math.floor((defHp[di].hp - (isLast ? defHp[di].final : defHp[di].hp * 0.55)) / (ROUNDS - round)));
      const dmg = isSkill ? Math.floor(base * 1.6) : base;
      if (isSkill) events.push({ type: 'skill', side: 'atk', actorIdx: ai, targetIdx: di, damage: 0, skillName: skillNames[0], logMsg: `✦ ${atk[ai].name}の「${skillNames[0]}」発動！` });
      events.push({ type: 'attack', side: 'atk', actorIdx: ai, targetIdx: di, damage: dmg,
        logMsg: isSkill ? `⚔ ${atk[ai].name}→${def[di].name}：${dmg.toLocaleString()}の一撃！` : `⚔ ${atk[ai].name}が${def[di].name}を攻撃　−${dmg.toLocaleString()}` });
      defHp[di].hp = Math.max(defHp[di].final, defHp[di].hp - dmg);
      if (defHp[di].hp <= 0 && def[di].finalHp <= 0)
        events.push({ type: 'defeat', side: 'def', actorIdx: di, targetIdx: di, damage: 0, logMsg: `☠ ${def[di].name}、討ち取られた！` });
    }
    for (let di = 0; di < def.length; di++) {
      if (defHp[di].hp <= 0) continue;
      const ai = atkHp.findIndex(a => a.hp > 0);
      if (ai < 0) break;
      const dmg = Math.max(1, Math.floor((atkHp[ai].hp - (isLast ? atkHp[ai].final : atkHp[ai].hp * 0.6)) / (ROUNDS - round)));
      events.push({ type: 'attack', side: 'def', actorIdx: di, targetIdx: ai, damage: dmg,
        logMsg: `🛡 ${def[di].name}が反撃！ ${atk[ai].name}に−${dmg.toLocaleString()}` });
      atkHp[ai].hp = Math.max(atkHp[ai].final, atkHp[ai].hp - dmg);
      if (atkHp[ai].hp <= 0 && atk[ai].finalHp <= 0)
        events.push({ type: 'defeat', side: 'atk', actorIdx: ai, targetIdx: ai, damage: 0, logMsg: `☠ ${atk[ai].name}、敗退！` });
    }
  }
  events.push({ type: 'result', side: 'atk', actorIdx: 0, targetIdx: 0, damage: 0,
    logMsg: result.victory ? '【勝利】戦場を制した！' : '【敗北】敵の守りを崩せず…' });
  return events;
}

// ── Portrait SVG (6 warrior designs) ──────────────────────────────────────

function PortraitSvg({ type, color }: { type: number; color: string }) {
  const sk = '#d08c66'; const a = '#c8a020';
  if (type === 0) return (
    <svg viewBox="0 0 60 76" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M18 23 Q24 8 30 7 Q36 8 42 23" fill="#181818" />
      <ellipse cx="30" cy="10" rx="4" ry="6" fill="#181818" />
      <ellipse cx="30" cy="26" rx="13" ry="15" fill={sk} />
      <path d="M19 18 L25 16.5" stroke="#181818" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M35 16.5 L41 18" stroke="#181818" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="23.5" cy="21" rx="3.2" ry="3" fill="#fff" />
      <ellipse cx="36.5" cy="21" rx="3.2" ry="3" fill="#fff" />
      <circle cx="24" cy="21.5" r="2" fill="#180800" />
      <circle cx="37" cy="21.5" r="2" fill="#180800" />
      <circle cx="24.7" cy="21" r="0.7" fill="#fff" />
      <circle cx="37.7" cy="21" r="0.7" fill="#fff" />
      <path d="M29 27 Q30 29 31 27" stroke="#9a5838" strokeWidth="0.9" fill="none" />
      <path d="M25.5 33 Q30 32 34.5 33" stroke="#8a3820" strokeWidth="1.4" fill="none" />
      <rect x="25" y="40" width="10" height="8" fill={sk} />
      <path d="M10 55 Q16 46 30 44 Q44 46 50 55 L52 76 L8 76Z" fill={color} />
      <path d="M16 46 Q30 45 44 46" stroke={a} strokeWidth="1.2" fill="none" />
      <path d="M26 50 L30 58 L34 50" fill={a} opacity="0.8" />
    </svg>
  );
  if (type === 1) return (
    <svg viewBox="0 0 60 76" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M15 28 Q17 10 30 8 Q43 10 45 28Z" fill={color} />
      <path d="M15 28 Q17 11 30 9 Q43 11 45 28" stroke={a} strokeWidth="1.5" fill="none" />
      <rect x="28" y="2" width="4" height="9" rx="1.5" fill={a} />
      <path d="M28 4 L30 0 L32 4Z" fill={a} />
      <path d="M15 28 L10 38 Q12 44 17 42 L20 28" fill={color} opacity="0.85" />
      <path d="M45 28 L50 38 Q48 44 43 42 L40 28" fill={color} opacity="0.85" />
      <path d="M17 26 Q18 44 30 46 Q42 44 43 26Z" fill={sk} />
      <path d="M20 27 L26 26" stroke="#3a2000" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M34 26 L40 27" stroke="#3a2000" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="23" cy="32" rx="3" ry="2.5" fill="#fff" />
      <ellipse cx="37" cy="32" rx="3" ry="2.5" fill="#fff" />
      <circle cx="23.5" cy="32.5" r="1.8" fill="#180800" />
      <circle cx="37.5" cy="32.5" r="1.8" fill="#180800" />
      <circle cx="24.2" cy="32" r="0.6" fill="#fff" />
      <circle cx="38.2" cy="32" r="0.6" fill="#fff" />
      <path d="M28.5 37 Q30 39 31.5 37" stroke="#9a5838" strokeWidth="0.8" fill="none" />
      <path d="M25 42 Q30 44 35 42" stroke="#7a3020" strokeWidth="1.3" fill="none" />
      <rect x="20" y="45" width="20" height="7" rx="1" fill={color} />
      <rect x="18" y="50" width="24" height="3" rx="1" fill={a} opacity="0.6" />
      <path d="M8 58 Q30 54 52 58 L52 76 L8 76Z" fill={color} />
      <path d="M8 58 Q30 55 52 58" stroke={a} strokeWidth="1.3" fill="none" />
    </svg>
  );
  if (type === 2) return (
    <svg viewBox="0 0 60 76" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M16 24 Q14 8 20 5 Q24 11 22 20" fill="#222" />
      <path d="M22 20 Q20 5 28 4 Q30 11 28 20" fill="#222" />
      <path d="M32 20 Q34 4 40 6 Q40 13 38 20" fill="#222" />
      <path d="M38 20 Q44 8 46 14 Q44 18 42 22" fill="#222" />
      <ellipse cx="30" cy="26" rx="14" ry="15" fill={sk} />
      <path d="M18 19 L25 17.5" stroke="#222" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M35 17.5 L42 19" stroke="#222" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="23" cy="22" rx="3.8" ry="3.5" fill="#fff" />
      <ellipse cx="37" cy="22" rx="3.8" ry="3.5" fill="#fff" />
      <circle cx="23.5" cy="22.5" r="2.5" fill="#180800" />
      <circle cx="37.5" cy="22.5" r="2.5" fill="#180800" />
      <circle cx="24.3" cy="21.8" r="0.9" fill="#fff" />
      <circle cx="38.3" cy="21.8" r="0.9" fill="#fff" />
      <path d="M33 19 L37 25" stroke="#8a4030" strokeWidth="1.2" opacity="0.7" />
      <path d="M28.5 28 Q30 30 31.5 28" stroke="#9a5838" strokeWidth="1" fill="none" />
      <path d="M24 34 Q30 37 36 34" stroke="#7a2810" strokeWidth="1.4" fill="none" />
      <rect x="24" y="40" width="12" height="9" fill={sk} />
      <path d="M12 53 Q20 46 30 45 Q40 46 48 53 L52 76 L8 76Z" fill={color} />
      <path d="M20 46 Q30 46 40 46" stroke={a} strokeWidth="1.3" fill="none" />
    </svg>
  );
  if (type === 3) return (
    <svg viewBox="0 0 60 76" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M12 22 Q8 40 12 62 Q20 66 20 50 Q18 34 18 22Z" fill="#1a0a00" />
      <path d="M48 22 Q52 40 48 62 Q40 66 40 50 Q42 34 42 22Z" fill="#1a0a00" />
      <path d="M17 22 Q18 8 30 7 Q42 8 43 22" fill="#1a0a00" />
      <ellipse cx="30" cy="26" rx="12.5" ry="14" fill="#d89a76" />
      <path d="M20.5 19.5 Q24 18 27 19" stroke="#3a1800" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M33 19 Q36 18 39.5 19.5" stroke="#3a1800" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <ellipse cx="23.5" cy="23" rx="3.5" ry="3.2" fill="#fff" />
      <ellipse cx="36.5" cy="23" rx="3.5" ry="3.2" fill="#fff" />
      <circle cx="24" cy="23.5" r="2.3" fill="#1a0800" />
      <circle cx="37" cy="23.5" r="2.3" fill="#1a0800" />
      <circle cx="24.8" cy="23" r="0.8" fill="#fff" />
      <circle cx="37.8" cy="23" r="0.8" fill="#fff" />
      <path d="M20 21 Q23.5 19.5 27 21" stroke="#1a0800" strokeWidth="1" fill="none" />
      <path d="M33 21 Q36.5 19.5 40 21" stroke="#1a0800" strokeWidth="1" fill="none" />
      <path d="M29 28.5 Q30 30.5 31 28.5" stroke="#9a6040" strokeWidth="0.7" fill="none" />
      <path d="M26 34 Q30 33 34 34" stroke="#aa4040" strokeWidth="1.3" fill="none" />
      <rect x="25" y="39" width="10" height="8" fill="#d89a76" />
      <path d="M16 54 Q22 47 30 46 Q38 47 44 54 L46 76 L14 76Z" fill={color} />
      <path d="M22 47 Q30 46 38 47" stroke={a} strokeWidth="1.2" fill="none" />
      <path d="M24 47 L30 54 L36 47" fill={a} opacity="0.7" />
    </svg>
  );
  if (type === 4) return (
    <svg viewBox="0 0 60 76" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M18 24 Q20 6 30 5 Q40 6 42 24" fill="#2a2a1a" />
      <path d="M22 22 Q24 10 30 8 Q36 10 38 22" fill="#3a3a28" />
      <path d="M16 24 L14 30 L18 28 L18 24" fill="#888" />
      <ellipse cx="30" cy="30" rx="13" ry="14" fill={sk} />
      <path d="M20 26.5 L26 25.5" stroke="#3a2000" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M34 25.5 L40 26.5" stroke="#3a2000" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="23" cy="30" rx="3.5" ry="2" fill="#fff" />
      <ellipse cx="37" cy="30" rx="3.5" ry="2" fill="#fff" />
      <circle cx="23.5" cy="30.2" r="1.8" fill="#180800" />
      <circle cx="37.5" cy="30.2" r="1.8" fill="#180800" />
      <path d="M19.5 29.5 Q23 28 26.5 29.5" stroke="#2a1800" strokeWidth="1.5" fill="none" />
      <path d="M33.5 29.5 Q37 28 40.5 29.5" stroke="#2a1800" strokeWidth="1.5" fill="none" />
      <path d="M28.5 34 Q30 36 31.5 34" stroke="#9a5838" strokeWidth="0.8" fill="none" />
      <path d="M25 40 Q30 42.5 35 40" stroke="#7a3820" strokeWidth="1.3" fill="none" />
      <rect x="24" y="43" width="12" height="8" fill={sk} />
      <path d="M14 55 Q22 50 30 49 Q38 50 46 55 L48 76 L12 76Z" fill={color} />
      <path d="M22 50 Q30 50 38 50" stroke={a} strokeWidth="1" fill="none" />
      <path d="M28 50 L24 60 M32 50 L36 60" stroke={a} strokeWidth="0.8" opacity="0.4" fill="none" />
    </svg>
  );
  return (
    <svg viewBox="0 0 60 76" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M12 26 Q14 6 30 5 Q46 6 48 26 L48 52 Q46 58 30 60 Q14 58 12 52Z" fill="#0a0a0a" />
      <path d="M15 24 Q17 14 30 13 Q43 14 45 24 L45 38 L15 38Z" fill={sk} />
      <path d="M12 36 L15 34 L45 34 L48 36 L48 56 L12 56Z" fill="#111" />
      <path d="M18.5 21.5 L24 20" stroke="#1a0a00" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 20 L41.5 21.5" stroke="#1a0a00" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="23" cy="26" rx="3.8" ry="2.8" fill="#fff" />
      <ellipse cx="37" cy="26" rx="3.8" ry="2.8" fill="#fff" />
      <circle cx="23.5" cy="26.2" r="2.4" fill="#150500" />
      <circle cx="37.5" cy="26.2" r="2.4" fill="#150500" />
      <circle cx="24.3" cy="25.5" r="0.8" fill="#fff" />
      <circle cx="38.3" cy="25.5" r="0.8" fill="#fff" />
      <path d="M29 17 L31 21" stroke="#9a5838" strokeWidth="0.7" opacity="0.4" fill="none" />
      <path d="M12 56 L8 76 L52 76 L48 56Z" fill="#111" />
      <path d="M20 60 Q30 58 40 60" stroke={color} strokeWidth="2" opacity="0.8" fill="none" />
      <path d="M18 66 Q30 64 42 66" stroke={color} strokeWidth="1.5" opacity="0.4" fill="none" />
    </svg>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ArmyGauge({ totalHp, maxHp, side }: { totalHp: number; maxHp: number; side: 'atk'|'def' }) {
  const SEG = 20; const ratio = maxHp > 0 ? totalHp / maxHp : 0; const filled = Math.round(ratio * SEG);
  return (
    <div className="rHudGauge">
      {Array(SEG).fill(0).map((_, i) => (
        <div key={i} className={`rHudSeg ${i < filled ? `filled-${side}` : 'empty'}`} />
      ))}
    </div>
  );
}

function TroopLine({ count, side, active }: { count: number; side: 'atk'|'def'; active: boolean }) {
  return (
    <div className={`rTroopLine ${side}`}>
      {Array(Math.min(Math.max(count, 0), 8)).fill(0).map((_, i) => (
        <div key={i} className={`rTroopShape ${side} ${active ? 'attacking' : ''}`}
          style={{ animationDelay: `${i * 0.04}s` }} />
      ))}
    </div>
  );
}

interface CardProps {
  c: Combatant; side: 'atk'|'def';
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
      <div className="rPortrait">
        <PortraitSvg type={c.portraitType} color={c.color} />
        {isSkill && <div className="rSkillRing" />}
        {isDefeated && <div className="rPortraitX">✕</div>}
      </div>
      <div className="rCardBody">
        <div className="rCardName">{c.name}</div>
        <div className="rStatRow">
          <span className="rStatChip" title="武勇">武{c.valor}</span>
          <span className="rStatChip" title="統率">統{c.command}</span>
          <span className="rStatChip" title="知略">知{c.wisdom}</span>
          {c.skillCount > 0 && <span className="rSkillStar">{'★'.repeat(Math.min(c.skillCount, 3))}</span>}
        </div>
        <div className="rHpSegs">
          {Array(HP_SEGS).fill(0).map((_, i) => (
            <div key={i} className={`rHpSeg ${i < filled ? `filled-${side}` : 'empty'}`} />
          ))}
        </div>
        <div className="rHpNum">{isDefeated ? '討取' : c.hp.toLocaleString()}</div>
      </div>
      {isDefeated && <div className="rDefeatedOverlay">部隊壊滅</div>}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function BattleScene({ result, state, onClose }: Props) {
  const atkFaction = state.factions[result.attackerFactionId];
  const defFaction = state.factions[result.defenderFactionId];
  const defRegion  = state.regions[result.targetRegionId];

  const [atkC, setAtkC] = useState<Combatant[]>(() =>
    makeCombatants(result.attackerParticipants, state, atkFaction?.color ?? '#c03020', atkFaction?.name ?? '攻撃側', defRegion?.localTroops ?? 200));
  const [defC, setDefC] = useState<Combatant[]>(() =>
    makeCombatants(result.defenderParticipants, state, defFaction?.color ?? '#4090e0', defFaction?.name ?? '守備兵', defRegion?.localTroops ?? 200));

  const eventsRef  = useRef<AnimEvent[]>([]);
  const eIdxRef    = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout>|null>(null);
  const skippedRef = useRef(false);
  const floatIdRef = useRef(0);

  const [activeAtk,    setActiveAtk]    = useState(-1);
  const [activeDef,    setActiveDef]    = useState(-1);
  const [hitAtk,       setHitAtk]       = useState(-1);
  const [hitDef,       setHitDef]       = useState(-1);
  const [skillFlash,   setSkillFlash]   = useState(false);
  const [skillRingIdx, setSkillRingIdx] = useState<{side:'atk'|'def';idx:number}|null>(null);
  const [floats,       setFloats]       = useState<FloatItem[]>([]);
  const [logLines,     setLogLines]     = useState<{msg:string;cls:string}[]>([]);
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
    setLogLines(prev => [...prev, { msg, cls }].slice(-3));
  }, []);
  const addFloat = useCallback((dmg: number, side: 'atk'|'def', idx: number, isSkill: boolean) => {
    const id = ++floatIdRef.current;
    setFloats(prev => [...prev, { id, dmg, side, idx, isSkill }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 950);
  }, []);

  const playNext = useCallback(() => {
    const events = eventsRef.current; const idx = eIdxRef.current;
    if (idx >= events.length) return;
    eIdxRef.current = idx + 1;
    const ev = events[idx];
    if (ev.type === 'result') {
      setPhase('result');
      setAtkC(prev => prev.map(c => ({ ...c, hp: c.finalHp })));
      setDefC(prev => prev.map(c => ({ ...c, hp: c.finalHp })));
      addLog(ev.logMsg, 'log-result'); return;
    }
    if (idx > 0 && idx % 4 === 0) setRoundNum(r => Math.min(r + 1, 4));
    if (ev.type === 'skill') {
      setSkillFlash(true); setSkillRingIdx({ side: ev.side, idx: ev.actorIdx });
      if (ev.side === 'atk') { setActiveAtk(ev.actorIdx); setActiveDef(-1); }
      else                   { setActiveDef(ev.actorIdx); setActiveAtk(-1); }
      addLog(ev.logMsg, 'log-skill');
      setTimeout(() => {
        setSkillFlash(false); setSkillRingIdx(null);
        if (!skippedRef.current) timerRef.current = setTimeout(playNext, 300);
      }, 600); return;
    }
    if (ev.type === 'defeat') {
      if (ev.side === 'def') setDefeatedDef(prev => new Set([...prev, ev.actorIdx]));
      else                   setDefeatedAtk(prev => new Set([...prev, ev.actorIdx]));
      addLog(ev.logMsg, 'log-defeat');
      timerRef.current = setTimeout(playNext, skippedRef.current ? 60 : 500); return;
    }
    if (ev.side === 'atk') {
      setActiveAtk(ev.actorIdx); setActiveDef(-1); setHitDef(ev.targetIdx); setHitAtk(-1);
      setDefC(prev => prev.map((c, i) => i === ev.targetIdx ? { ...c, hp: Math.max(c.finalHp, c.hp - ev.damage) } : c));
      addFloat(ev.damage, 'def', ev.targetIdx, false);
    } else {
      setActiveDef(ev.actorIdx); setActiveAtk(-1); setHitAtk(ev.targetIdx); setHitDef(-1);
      setAtkC(prev => prev.map((c, i) => i === ev.targetIdx ? { ...c, hp: Math.max(c.finalHp, c.hp - ev.damage) } : c));
      addFloat(ev.damage, 'atk', ev.targetIdx, false);
    }
    addLog(ev.logMsg, 'log-attack');
    const ms = skippedRef.current ? 60 : 480;
    setTimeout(() => { setActiveAtk(-1); setActiveDef(-1); setHitAtk(-1); setHitDef(-1); }, ms - 80);
    timerRef.current = setTimeout(playNext, ms);
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
        setAtkC(prev => prev.map(c => ({ ...c, hp: c.finalHp })));
        setDefC(prev => prev.map(c => ({ ...c, hp: c.finalHp })));
        addLog(ev.logMsg, 'log-result'); break;
      }
      if (ev.type === 'defeat') {
        if (ev.side === 'def') setDefeatedDef(prev => new Set([...prev, ev.actorIdx]));
        else                   setDefeatedAtk(prev => new Set([...prev, ev.actorIdx]));
      }
    }
    eIdxRef.current = eventsRef.current.length;
  };

  const atkName = atkFaction?.name ?? '攻撃側';
  const defName = defFaction?.name ?? '防衛側';

  return (
    <div className="ranceBattle">
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

      <div className="rFieldArea">
        <div className="rFieldBg" />
        <TroopLine count={atkAlive} side="atk" active={activeAtk >= 0} />
        <div className="rDmgDisplay">
          <span className="rDmgNum atk">{atkTotalHp.toLocaleString()}</span>
          <span className="rDmgBar"> | </span>
          <span className="rDmgNum def">{defTotalHp.toLocaleString()}</span>
        </div>
        <TroopLine count={defAlive} side="def" active={activeDef >= 0} />
        {floats.map(f => (
          <div key={f.id} className={`rFloat ${f.side}${f.isSkill ? ' skill' : ''}`}
            style={{ top: `${20 + (f.idx % 3) * 25}%` }}>
            −{f.dmg.toLocaleString()}
          </div>
        ))}
        {skillFlash && <div className="rSkillFlash" />}
      </div>

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

      <div className="rFooterBar">
        <div className="rFooterLeft">
          {phase !== 'result' && <button className="rSkipBtn" onClick={handleSkip}>スキップ [Esc]</button>}
        </div>
        <div className="rLogArea">
          {phase === 'intro' && <div className="rLogLine log-attack">{atkName}が{result.targetRegionName}へ進軍！</div>}
          {logLines.map((l, i) => <div key={i} className={`rLogLine ${l.cls}`}>{l.msg}</div>)}
        </div>
        <div className="rFooterRight"><span className="rFieldBonus">戦場補正 ±0%</span></div>
      </div>

      {phase === 'result' && (
        <div className="rResultOverlay">
          <div className={`rResultBanner ${result.victory ? 'win' : 'lose'}`}>
            {result.victory ? '勝　利' : '敗　北'}
          </div>
          <div className="rResultGrid">
            <div className="rResultItem"><span className="rRLabel">討ち取り</span><span className="rRVal win">{result.defenderLosses.toLocaleString()}</span></div>
            <div className="rResultItem"><span className="rRLabel">味方損害</span><span className="rRVal lose">{result.attackerLosses.toLocaleString()}</span></div>
            <div className="rResultItem"><span className="rRLabel">城耐久</span><span className="rRVal">{result.castleHpBefore}→{result.castleHpAfter}</span></div>
            <div className="rResultItem"><span className="rRLabel">制　圧</span>
              <span className="rRVal" style={{ color: result.conquered ? 'var(--gold)' : 'var(--muted)' }}>
                {result.conquered ? '占領！' : 'なし'}</span></div>
          </div>
          <button className="rResultBtn" onClick={onClose}>戦場を去る</button>
        </div>
      )}
    </div>
  );
}
