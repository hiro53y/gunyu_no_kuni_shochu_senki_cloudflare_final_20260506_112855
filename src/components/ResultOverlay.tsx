// ===========================================================================
// 勝敗結果オーバーレイ（拡張版）
// 到達ターン・得点・撃破勢力数・登用武将数・最も活躍した武将
// ===========================================================================

import { useMemo } from 'react';
import type { GameState } from '../types/game';
import { GeneralPortrait } from './GeneralPortrait';

interface Props {
  state: GameState;
  onReturnTitle: () => void;
}

export function ResultOverlay({ state, onReturnTitle }: Props) {
  const isWin = state.victory === 'win_dominate' || state.victory === 'win_youma';
  const title = {
    win_dominate: '勝　利',
    win_youma:    '勝　利',
    lose_zero:    '敗　北',
    lose_timeout: '敗　北',
    none:         '',
  }[state.victory];
  const subtitle = {
    win_dominate: '八洲は暁ノ家の名を刻む',
    win_youma:    '黒淵を討ち、世に光が戻った',
    lose_zero:    '暁ノ家の旗は折れた',
    lose_timeout: '時は流れ、八洲を統べる前に力尽きた',
    none:         '',
  }[state.victory];

  const stats = useMemo(() => {
    const playerRegions = Object.values(state.regions).filter((r) => r.factionId === 'akatsuki').length;
    const destroyedFactions = Object.values(state.factions).filter((f) => f.destroyed).length;
    const recruited = Object.values(state.generals).filter(
      (g) => g.factionId === 'akatsuki' && !g.isUnique && g.status === 'recruited'
    ).length;
    const captured = state.prisoners.length;
    const killed = Object.values(state.generals).filter((g) => g.status === 'dead').length;

    // 最も活躍した武将＝兵数比率が高くかつ生存している武将（暫定指標）
    const playerGenerals = Object.values(state.generals).filter((g) => g.factionId === 'akatsuki');
    const mvp = playerGenerals
      .filter((g) => g.status === 'free' || g.status === 'recruited')
      .sort((a, b) => (b.troopCurrent + b.stats.power * 5) - (a.troopCurrent + a.stats.power * 5))[0];

    return { playerRegions, destroyedFactions, recruited, captured, killed, mvp };
  }, [state]);

  return (
    <div className="modalBackdrop resultBackdrop" role="dialog" aria-modal="true">
      <div className="resultBox">
        <div className={`resultTitle ${state.victory}`}>{title}</div>
        <div className="resultSubtitle">{subtitle}</div>

        <div className="resultStatsGrid">
          <ResultStat label="到達ターン" value={`${state.turn}`} />
          <ResultStat label="支配地域" value={`${stats.playerRegions} / 15`} />
          <ResultStat label="撃破勢力" value={`${stats.destroyedFactions}`} />
          <ResultStat label="登用武将" value={`${stats.recruited}`} />
          <ResultStat label="捕虜数" value={`${stats.captured}`} />
          <ResultStat label="得点" value={`${state.score}`} highlight />
        </div>

        {stats.mvp && (
          <section className="resultMvp">
            <div className="resultMvpLabel">最も活躍した武将</div>
            <div className="resultMvpBody">
              <GeneralPortrait general={stats.mvp} size={64} showLabel={false} />
              <div>
                <div className="resultMvpName">{stats.mvp.name}</div>
                <div className="resultMvpStats">
                  武{stats.mvp.stats.power} 統{stats.mvp.stats.command} 兵{stats.mvp.troopCurrent.toLocaleString()}
                </div>
              </div>
            </div>
          </section>
        )}

        <button className={`resultBtn ${isWin ? 'win' : 'lose'}`} onClick={onReturnTitle}>
          タイトルへ
        </button>
      </div>
    </div>
  );
}

function ResultStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`resultStat ${highlight ? 'highlight' : ''}`}>
      <span className="resultStatLabel">{label}</span>
      <span className="resultStatValue">{value}</span>
    </div>
  );
}
