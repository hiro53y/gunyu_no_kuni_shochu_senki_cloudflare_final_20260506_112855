// ===========================================================================
// 選択中の地域詳細パネル（右サイド・PC、ポップアップ・スマホ）
// ===========================================================================

import type { GameState, RegionId, FactionId } from '../types/game';
import { GeneralPortrait } from './GeneralPortrait';
import { TERRAIN_BONUSES } from '../data/regions';
import { regionFood, regionIncome } from '../engine/economy';

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

function satisfactionText(value: number): string {
  if (value >= 80) return '高いほど収入が伸び、一揆が起きにくい。現在は安定圏。';
  if (value >= 55) return '収入は標準。徴収や戦後支配で下がるため維持が必要。';
  if (value >= 30) return '収入が落ち、治安悪化が近い。建設より立て直し優先。';
  return '危険域。収入低下と反乱リスクが大きい。早めに手当てしたい。';
}

function RegionInsight({ state, regionId }: Props) {
  if (!regionId) return null;
  const region = state.regions[regionId];
  if (!region) return null;
  const bonus = TERRAIN_BONUSES[region.terrain];
  const income = regionIncome(region);
  const food = regionFood(region);

  return (
    <div className="regionInsight">
      <div className="insightItem">
        <span className="insightLabel">地形効果</span>
        <span className="insightText">{bonus?.note ?? '補正なし'}</span>
      </div>
      <div className="insightItem">
        <span className="insightLabel">収入見込み</span>
        <span className="insightText">毎月 金+{income.toLocaleString()} / 兵糧+{food.toLocaleString()}</span>
      </div>
      <div className="insightItem">
        <span className="insightLabel">満足度</span>
        <span className="insightText">{satisfactionText(region.satisfaction)}</span>
      </div>
    </div>
  );
}

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
      </div>

      <RegionInsight state={state} regionId={regionId} />

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
  const generalsHere = Object.values(state.generals).filter(
    (g) => g.factionId === factionId && (g.status === 'free' || g.status === 'recruited'),
  );
  const recentLog = state.log[0]?.message ?? 'まだ何も起こっていない';

  return (
    <div className="regionPopup">
      <div className="topLine">
        <span className="name">{region.name}</span>
        <span className="faction" style={{ color: factionColor }}>{factionName}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-kinari-d)' }}>
        {TERRAIN_LABEL[region.terrain]} ／ {region.product} ／ 国力{region.power} ／ 満足{region.satisfaction}
      </div>
      <RegionInsight state={state} regionId={regionId} />
      <div className="mobileRegionExtra">
        <div>
          <span className="miniLabel">作戦記</span>
          <span className="miniText">{recentLog}</span>
        </div>
        <div>
          <span className="miniLabel">所属武将</span>
          <span className="miniText">
            {generalsHere.length === 0 ? 'なし' : generalsHere.slice(0, 3).map((g) => g.name.replace(/^.*\s/, '')).join('、')}
            {generalsHere.length > 3 ? ` 他${generalsHere.length - 3}名` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
