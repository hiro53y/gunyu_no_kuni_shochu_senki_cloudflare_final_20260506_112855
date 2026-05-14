// ===========================================================================
// 選択中の地域詳細パネル（右サイド・PC、ポップアップ・スマホ）
// ===========================================================================

import type { GameState, RegionId, FactionId } from '../types/game';
import { GeneralPortrait } from './GeneralPortrait';
import { createBattleForecast, getDeployableGenerals } from '../engine/battleIntel';

interface Props {
  state: GameState;
  regionId: RegionId | null;
}

const FACTION_NAME: Record<FactionId, string> = {
  akatsuki: '暁ノ家', kurogane: '黒鉄家', shion: '紫苑家', shirasagi: '白鷺家',
  honoo: '焔ノ家', rengein: '蓮華院', youma: '妖魔の群', ronin: '浪人衆',
};
const FACTION_VAR: Record<FactionId, string> = {
  akatsuki: 'var(--f-akatsuki)', kurogane: 'var(--f-kurogane)', shion: 'var(--f-shion)',
  shirasagi: 'var(--f-shirasagi)', honoo: 'var(--f-honoo)', rengein: 'var(--f-rengein)',
  youma: 'var(--f-youma)', ronin: 'var(--f-ronin)',
};

const TERRAIN_LABEL: Record<string, string> = {
  plain: '平野', mountain: '山地', port: '港湾', pass: '峠',
  field: '田園', coast: '海岸', snow: '雪原', volcano: '火山',
  forest: '深い森', mountain_temple: '山岳寺領', cursed: '魔境',
  wasteland: '荒野', islands: '群島',
};

export function RegionPanel({ state, regionId }: Props) {
  if (!regionId) {
    return (
      <aside className="regionPanel">
        <div className="regionHead">
          <div className="regionName">地域未選択</div>
          <div className="regionReading">マップ上の地域を選択してください</div>
        </div>
      </aside>
    );
  }
  const region = state.regions[regionId];
  if (!region) return null;

  const generalsHere = Object.values(state.generals).filter(
    (g) => g.factionId === region.factionId && (g.status === 'free' || g.status === 'recruited'),
  );
  const factionId = region.factionId;
  const factionName = factionId ? FACTION_NAME[factionId] : '無主';
  const factionColor = factionId ? FACTION_VAR[factionId] : 'var(--c-kinari-d)';

  const isPlayer = factionId === 'akatsuki';
  const isAdjacent = region.adjacentIds.some((aid) => state.regions[aid]?.factionId === 'akatsuki');
  const forecast = !isPlayer && isAdjacent
    ? createBattleForecast(state, regionId, getDeployableGenerals(state).slice(0, 3))
    : null;
  const recLabel = forecast?.recommendation === 'high'
    ? '高'
    : forecast?.recommendation === 'medium'
      ? '中'
      : forecast?.recommendation === 'low'
        ? '低'
        : null;

  return (
    <aside className="regionPanel" aria-label="地域詳細">
      <div className="regionHead">
        <div className="regionName">{region.name}</div>
        <div className="regionReading">{region.reading}</div>
        <div className="regionFaction" style={{ color: factionColor, marginTop: 6 }}>
          {factionName}
        </div>
      </div>

      <div className="regionStats">
        <div className="regionStat">
          <span className="label">地形</span>
          <span className="value" style={{ fontSize: 13 }}>{TERRAIN_LABEL[region.terrain] ?? region.terrain}</span>
        </div>
        <div className="regionStat">
          <span className="label">特産</span>
          <span className="value" style={{ fontSize: 13 }}>{region.product}</span>
        </div>
        <div className="regionStat">
          <span className="label">国力</span>
          <span className="value">{region.power}</span>
        </div>
        <div className="regionStat">
          <span className="label">満足度</span>
          <span className="value">{region.satisfaction}</span>
        </div>
        {isPlayer && (
          <>
            <div className="regionStat">
              <span className="label">田畑/市場</span>
              <span className="value" style={{ fontSize: 13 }}>{region.buildLevels.farm}/{region.buildLevels.market}</span>
            </div>
            <div className="regionStat">
              <span className="label">城壁/鍛冶</span>
              <span className="value" style={{ fontSize: 13 }}>{region.buildLevels.wall}/{region.buildLevels.forge}</span>
            </div>
          </>
        )}
        {!isPlayer && isAdjacent && (
          <div className="regionStat" style={{ gridColumn: '1 / -1' }}>
            <span className="label">調略進捗</span>
            <span className="value">{region.scoutProgress.akatsuki ?? 0} / 100</span>
          </div>
        )}
        {forecast && recLabel && (
          <div className={`regionRecommendation ${forecast.recommendation}`}>
            <span>おすすめ度：{recLabel}</span>
            <small>理由：{forecast.recommendationReason}</small>
            <small>勝率目安 {forecast.winRate}% / {forecast.mainReason}</small>
          </div>
        )}
      </div>

      <div className="regionGenerals">
        <h4>所属武将（{generalsHere.length}）</h4>
        {generalsHere.length === 0 ? (
          <div style={{ color: 'var(--c-kinari-d)', fontSize: 11, fontStyle: 'italic' }}>武将なし</div>
        ) : (
          generalsHere.slice(0, 6).map((g) => (
            <div className="generalRow" key={g.id}>
              <GeneralPortrait general={g} size={36} showLabel={false} />
              <div className="meta">
                <span className="name">{g.isUnique && '★ '}{g.name}</span>
                <span className="stats">
                  武{g.stats.power} 統{g.stats.command} 兵{g.troopCurrent}/{g.troopMax}
                </span>
              </div>
            </div>
          ))
        )}
        {generalsHere.length > 6 && (
          <div style={{ color: 'var(--c-kinari-d)', fontSize: 11, marginTop: 4 }}>
            …他{generalsHere.length - 6}名
          </div>
        )}
      </div>
    </aside>
  );
}

/** モバイル用：マップ下部に出る簡易ポップアップ */
export function RegionPopup({ state, regionId }: Props) {
  if (!regionId) return null;
  const region = state.regions[regionId];
  if (!region) return null;
  const factionId = region.factionId;
  const factionName = factionId ? FACTION_NAME[factionId] : '無主';
  const factionColor = factionId ? FACTION_VAR[factionId] : 'var(--c-kinari-d)';
  const isPlayer = factionId === 'akatsuki';
  const isAdjacent = !isPlayer && region.adjacentIds.some((aid) => state.regions[aid]?.factionId === 'akatsuki');
  const forecast = isAdjacent
    ? createBattleForecast(state, regionId, getDeployableGenerals(state).slice(0, 3))
    : null;
  const recLabel = forecast?.recommendation === 'high' ? '高' : forecast?.recommendation === 'medium' ? '中' : forecast?.recommendation === 'low' ? '低' : null;

  return (
    <div className="regionPopup">
      <div className="topLine">
        <span className="name">{region.name}</span>
        <span className="faction" style={{ color: factionColor }}>{factionName}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-kinari-d)' }}>
        {TERRAIN_LABEL[region.terrain]} ／ {region.product} ／ 国力{region.power} ／ 満足{region.satisfaction}
      </div>
      {forecast && recLabel && (
        <div className={`popupRecommendation ${forecast.recommendation}`}>
          おすすめ度：{recLabel}　{forecast.recommendationReason}
        </div>
      )}
    </div>
  );
}
