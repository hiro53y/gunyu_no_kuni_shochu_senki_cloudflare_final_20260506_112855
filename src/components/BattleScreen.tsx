import { useEffect, useRef, useState } from 'react';
import { getAttackQuote, getDefeatQuote, getVictoryQuote, officerTitles } from '../data/dialogue';
import type { BattleParticipant, BattleResult, GameState, Officer } from '../types/game';
import { getPortraitStyle } from './portraitUtils';

interface BattleScreenProps {
  result: BattleResult;
  state: GameState;
  onClose: () => void;
}

interface LogEntry {
  id: string;
  type: 'heading' | 'skill' | 'power' | 'damage' | 'castle' | 'result' | 'info';
  icon: string;
  text: string;
  win?: boolean;
  delay: number;
}

function buildLog(result: BattleResult, state: GameState): LogEntry[] {
  const entries: LogEntry[] = [];
  let delay = 400;
  const step = 320;

  const attackerFaction = state.factions[result.attackerFactionId];
  const defenderFaction = state.factions[result.defenderFactionId];

  entries.push({
    id: 'h1',
    type: 'heading',
    icon: '⚔',
    text: `${attackerFaction?.name ?? '???'} が ${result.targetRegionName} へ進軍`,
    delay,
  });
  delay += step;

  if (result.activatedSkills.length > 0) {
    result.activatedSkills.forEach((skillName, i) => {
      entries.push({ id: `sk${i}`, type: 'skill', icon: '✦', text: `${skillName}`, delay });
      delay += step * 0.8;
    });
  }

  entries.push({
    id: 'pw1',
    type: 'power',
    icon: '⚡',
    text: `攻撃力  ${result.attackerPower.toLocaleString()}`,
    delay,
  });
  delay += step * 0.7;

  entries.push({
    id: 'pw2',
    type: 'power',
    icon: '🛡',
    text: `防御力  ${result.defenderPower.toLocaleString()}（${defenderFaction?.name ?? '???'}）`,
    delay,
  });
  delay += step;

  const powerDiff = result.attackerPower - result.defenderPower;
  if (Math.abs(powerDiff) < result.attackerPower * 0.1) {
    entries.push({ id: 'pw3', type: 'info', icon: '─', text: '戦力はほぼ互角！激戦となった', delay });
  } else if (powerDiff > 0) {
    entries.push({ id: 'pw3', type: 'info', icon: '▲', text: '攻撃側が優勢！', delay });
  } else {
    entries.push({ id: 'pw3', type: 'info', icon: '▼', text: '守備側が優勢！', delay });
  }
  delay += step * 0.8;

  if (result.attackerParticipants.length > 0) {
    entries.push({ id: 'ah', type: 'heading', icon: '⚔', text: '味方の損害', delay });
    delay += step * 0.6;
    result.attackerParticipants.forEach((p, i) => {
      const loss = p.troopsBefore - p.troopsAfter;
      entries.push({
        id: `ap${i}`,
        type: 'damage',
        icon: '└',
        text: `${p.name}  ${p.troopsBefore.toLocaleString()} → ${p.troopsAfter.toLocaleString()}（損害 ${loss.toLocaleString()}）`,
        delay,
      });
      delay += step * 0.7;
    });
  }

  if (result.defenderParticipants.length > 0) {
    entries.push({ id: 'dh', type: 'heading', icon: '🛡', text: '敵の損害', delay });
    delay += step * 0.6;
    result.defenderParticipants.forEach((p, i) => {
      const loss = p.troopsBefore - p.troopsAfter;
      entries.push({
        id: `dp${i}`,
        type: 'damage',
        icon: '└',
        text: `${p.name}  ${p.troopsBefore.toLocaleString()} → ${p.troopsAfter.toLocaleString()}（損害 ${loss.toLocaleString()}）`,
        delay,
      });
      delay += step * 0.7;
    });
  }

  entries.push({
    id: 'ca',
    type: 'castle',
    icon: '🏯',
    text: `${result.targetRegionName} 城耐久  ${result.castleHpBefore} → ${result.castleHpAfter}`,
    delay,
  });
  delay += step;

  entries.push({
    id: 'res',
    type: 'result',
    icon: result.conquered ? '◎' : '×',
    text: result.conquered
      ? `${result.targetRegionName} を制圧した！`
      : `${result.targetRegionName} の攻略に失敗した`,
    win: result.conquered,
    delay,
  });

  return entries;
}

function GeneralBlock({
  officer,
  participant,
  side,
  delay,
}: {
  officer: Officer | undefined;
  participant: BattleParticipant;
  side: 'attacker' | 'defender';
  delay: number;
}) {
  const { bg, kanji } = officer ? getPortraitStyle(officer) : { bg: '#1a2440', kanji: '武' };
  const loss = participant.troopsBefore - participant.troopsAfter;

  return (
    <div className="generalCard" style={{ animationDelay: `${delay}ms` }}>
      <div className="generalPortrait" style={{ '--portrait-bg': bg } as React.CSSProperties}>
        {kanji}
      </div>
      <div className="generalInfo">
        <div className="generalName">{participant.name}</div>
        <div className="generalTroops">
          {participant.troopsBefore.toLocaleString()}
          {loss > 0 && <span className="troopDiff"> −{loss.toLocaleString()}</span>}
        </div>
      </div>
    </div>
  );
}

export function BattleScreen({ result, state, onClose }: BattleScreenProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const logEntries = buildLog(result, state);

  // 攻撃側リード武将（台詞用）
  const leadAttackerId = result.attackerParticipants[0]
    ? Object.values(state.officers).find((o) => o.name === result.attackerParticipants[0].name)?.id
    : undefined;
  const leadDefenderId = result.defenderParticipants[0]
    ? Object.values(state.officers).find((o) => o.name === result.defenderParticipants[0].name)?.id
    : undefined;

  const attackQuote = leadAttackerId ? getAttackQuote(leadAttackerId) : '参る！';
  const postQuote = leadAttackerId
    ? result.conquered
      ? getVictoryQuote(leadAttackerId)
      : getDefeatQuote(leadAttackerId)
    : result.conquered
    ? '制圧した！'
    : '撤退する！';

  const leadAttackerOfficer = leadAttackerId ? state.officers[leadAttackerId] : undefined;
  const attackerFaction = state.factions[result.attackerFactionId];
  const defenderFaction = state.factions[result.defenderFactionId];

  // ログを順番に表示
  useEffect(() => {
    if (skipped) return;
    if (visibleCount >= logEntries.length) {
      const timer = setTimeout(() => setShowResult(true), 600);
      return () => clearTimeout(timer);
    }
    const entry = logEntries[visibleCount];
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, entry.delay - (visibleCount > 0 ? logEntries[visibleCount - 1].delay : 0));
    return () => clearTimeout(timer);
  }, [visibleCount, logEntries, skipped]);

  // スキップ
  const handleSkip = () => {
    setSkipped(true);
    setVisibleCount(logEntries.length);
    setShowResult(true);
  };

  // ログ末尾へスクロール
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleCount]);

  const totalDelay = logEntries[logEntries.length - 1]?.delay ?? 0;

  return (
    <div className="battleOverlay" onClick={!showResult ? handleSkip : undefined}>
      <div className="battleBg" />

      {/* 上部：地名バナー */}
      <div className="battleTopBanner">
        <span className="battleKanji">戦　闘</span>
        <span className="battleArrow">▶</span>
        <span className="battlePlace">{result.targetRegionName}</span>
      </div>

      {/* 両軍表示 */}
      <div className="battleSides">
        {/* 攻撃側 */}
        <div className="battleSide attacker">
          <div className="battleSideLabel">攻 撃</div>
          <div className="battleFaction">{attackerFaction?.name}</div>
          {result.attackerParticipants.map((p, i) => {
            const officer = Object.values(state.officers).find((o) => o.name === p.name);
            return (
              <GeneralBlock key={p.officerId} officer={officer} participant={p} side="attacker" delay={i * 80} />
            );
          })}
        </div>

        <div className="battleVsText">VS</div>

        {/* 防御側 */}
        <div className="battleSide defender">
          <div className="battleSideLabel">防 衛</div>
          <div className="battleFaction">{defenderFaction?.name}</div>
          {result.defenderParticipants.map((p, i) => {
            const officer = Object.values(state.officers).find((o) => o.name === p.name);
            return (
              <GeneralBlock key={p.officerId} officer={officer} participant={p} side="defender" delay={i * 80} />
            );
          })}
        </div>
      </div>

      {/* 開戦台詞 */}
      <div className="preBattleQuote">
        <span className="quoteChar">{leadAttackerOfficer?.name ?? attackerFaction?.name}</span>
        <span className="quoteText">{attackQuote}</span>
      </div>

      {/* コンバットログ */}
      <div className="combatLog" ref={logRef}>
        {logEntries.slice(0, visibleCount).map((entry) => (
          <div
            key={entry.id}
            className={`logLine type-${entry.type}${entry.type === 'result' ? (entry.win ? ' win' : ' lose') : ''}`}
          >
            <span className="logLineIcon">{entry.icon}</span>
            <span>{entry.text}</span>
          </div>
        ))}
        {!showResult && visibleCount < logEntries.length && (
          <div style={{ color: 'var(--muted)', fontSize: '0.72rem', padding: '4px 8px', opacity: 0.7 }}>
            タップでスキップ…
          </div>
        )}
      </div>

      {/* 戦闘結果バナー */}
      {showResult && (
        <div className="battleResultBanner" onClick={(e) => e.stopPropagation()}>
          <div className={`battleResultLabel ${result.conquered ? 'win' : 'lose'}`}>
            {result.conquered ? '制　圧　成　功' : '撃　　　退'}
          </div>
          <div className="postQuote">{postQuote}</div>
          <button className="battleCloseBtn" onClick={onClose} type="button">
            続ける
          </button>
        </div>
      )}
    </div>
  );
}
