import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { skillCatalog, terrainLabel } from '../data/names';
import {
  estimateRegionDefense, getAvailableRonin, getFactionOfficers,
  getFactionRegions, getFactionTroops, getPlayerFaction, getPlayerRegions,
  getRegionOfficers,
} from '../engine/selectors';
import { PLAYER_FACTION_ID } from '../data/names';
import type { ActionLog, DomesticFocus, GameState, Region } from '../types/game';
import { OfficerCard } from '../components/OfficerCard';
import { CharacterPortrait } from '../components/CharacterPortrait';

interface Props {
  state: GameState;
  onSelectRegion: (id: string) => void;
  onDomestic: (focus: DomesticFocus) => void;
  onRecruit: () => void;
  onTrain: () => void;
  onSearch: () => void;
  onInvade: () => void;
  onRest: () => void;
  onEndTurn: () => void;
  onHire: (officerId: string) => void;
  onToggleOfficer: (id: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  onDeleteSave: () => void;
  notice: string;
}

const logTypeIcon: Record<string, string> = {
  battle: '⚔', action: '▶', economy: '⊕', event: '✦',
  system: '◆', warning: '！', save: '□',
};

const domesticFoci: { key: DomesticFocus; label: string; icon: string }[] = [
  { key: 'riceYield',        label: '石高', icon: '🌾' },
  { key: 'publicOrder',      label: '治安', icon: '🏮' },
  { key: 'castleHp',         label: '修城', icon: '🎯' },
  { key: 'developmentLevel', label: '開発', icon: '⚙' },
];

const REGION_POSITIONS: Record<string, { x: number; y: number }> = {
  r_shiramine:  { x: 38, y: 17 },
  r_tsukishiro: { x: 58, y: 24 },
  r_kiridani:   { x: 23, y: 34 },
  r_akihara:    { x: 46, y: 42 },
  r_kurose:     { x: 70, y: 39 },
  r_kazami:     { x: 21, y: 54 },
  r_suzukano:   { x: 44, y: 59 },
  r_takamori:   { x: 72, y: 59 },
  r_amagiri:    { x: 21, y: 76 },
  r_sabikawa:   { x: 48, y: 77 },
  r_hoshimi:    { x: 67, y: 80 },
  r_suhama:     { x: 50, y: 91 },
};

function getThreatBand(state: GameState, region: Region, selectedRegion?: Region): 'safe' | 'border' | 'chance' | 'even' | 'danger' {
  if (region.ownerFactionId === PLAYER_FACTION_ID) {
    const hasEnemyBorder = region.neighbors.some((nid) => state.regions[nid]?.ownerFactionId !== PLAYER_FACTION_ID);
    return hasEnemyBorder ? 'border' : 'safe';
  }
  if (!selectedRegion?.neighbors.includes(region.id) && selectedRegion?.ownerFactionId === PLAYER_FACTION_ID) {
    return 'danger';
  }
  const defense = estimateRegionDefense(state, region.id);
  if (defense < 1000) return 'chance';
  if (defense < 1500) return 'even';
  return 'danger';
}

const threatLabel: Record<ReturnType<typeof getThreatBand>, string> = {
  safe: '後方',
  border: '国境',
  chance: '好機',
  even: '互角',
  danger: '警戒',
};

export function MapScreen({
  state, onSelectRegion, onDomestic, onRecruit, onTrain, onSearch,
  onInvade, onRest, onEndTurn, onHire, onToggleOfficer,
  onSave, onLoad, onNewGame, onDeleteSave, notice,
}: Props) {
  const [tab, setTab]     = useState<'map' | 'officers' | 'status' | 'log' | 'manage'>('map');
  const [focus, setFocus] = useState<DomesticFocus>('riceYield');

  const faction  = getPlayerFaction(state);
  const regions  = getPlayerRegions(state);
  const ap       = state.actionPoints;
  const maxAp    = state.maxActionPoints;
  const goldLow  = faction.gold < 100;
  const foodLow  = faction.food < 150;

  const selectedRegion  = state.regions[state.selectedRegionId];
  const isPlayerRegion  = selectedRegion?.ownerFactionId === PLAYER_FACTION_ID;
  const canAttack = Boolean(
    selectedRegion &&
    selectedRegion.ownerFactionId !== PLAYER_FACTION_ID &&
    selectedRegion.neighbors.some((nid) => state.regions[nid]?.ownerFactionId === PLAYER_FACTION_ID),
  );

  const officersInRegion = useMemo(
    () => selectedRegion ? getRegionOfficers(state, selectedRegion.id) : [],
    [state, selectedRegion],
  );
  const roninInRegion = useMemo(
    () => getAvailableRonin(state).filter((o) => o.locationRegionId === state.selectedRegionId),
    [state],
  );
  const playerOfficers = useMemo(() => getFactionOfficers(state, PLAYER_FACTION_ID), [state]);
  const allFactions    = useMemo(() =>
    Object.values(state.factions).filter((f) => f.isMajor).sort((a, b) => {
      if (a.isPlayer) return -1;
      if (b.isPlayer) return 1;
      return getFactionRegions(state, b.id).length - getFactionRegions(state, a.id).length;
    }), [state]);

  const renderMap = () => {
    const regionList = Object.values(state.regions).sort((a, b) => a.mapY - b.mapY || a.mapX - b.mapX);
    const links = regionList.flatMap((region) =>
      region.neighbors
        .filter((nid) => region.id < nid && REGION_POSITIONS[nid])
        .map((nid) => ({ from: region.id, to: nid })),
    );

    return (
      <section className="illustratedMapShell" aria-label="八州国絵図">
        <div className="mapArtFrame">
          <img
            className="mapArtImage"
            src="/assets/art/map-design-sheet.png"
            alt=""
            draggable={false}
          />
          <svg className="mapLinkLayer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {links.map(({ from, to }) => {
              const a = REGION_POSITIONS[from];
              const b = REGION_POSITIONS[to];
              const hot = from === state.selectedRegionId || to === state.selectedRegionId;
              return (
                <line
                  key={`${from}-${to}`}
                  className={`mapRoute${hot ? ' hot' : ''}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                />
              );
            })}
          </svg>

          {regionList.map((r) => {
            const f = state.factions[r.ownerFactionId];
            const pos = REGION_POSITIONS[r.id] ?? { x: 50, y: 50 };
            const isPlayer   = r.ownerFactionId === PLAYER_FACTION_ID;
            const isSelected = r.id === state.selectedRegionId;
            const isNeighbor = selectedRegion?.neighbors.includes(r.id) ?? false;
            const band = getThreatBand(state, r, selectedRegion);
            const hpRatio = Math.max(0, Math.min(1, r.castleHp / r.maxCastleHp));
            return (
              <button
                key={r.id}
                className={[
                  'mapRegionNode',
                  isPlayer ? 'player' : 'enemy',
                  isSelected ? 'selected' : '',
                  isNeighbor && !isSelected ? 'neighbor' : '',
                  `threat-${band}`,
                ].filter(Boolean).join(' ')}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  '--node-color': f?.color ?? '#888',
                } as CSSProperties}
                onClick={() => onSelectRegion(r.id)}
                type="button"
              >
                <span className="nodeFlag" />
                <span className="nodeName">{r.name}</span>
                <span className="nodeMeta">
                  {isPlayer ? '我領' : f?.name ?? '不明'} / {threatLabel[band]}
                </span>
                <span className="nodeHp">
                  <span style={{ width: `${hpRatio * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="mapLegendPanel">
          <div>
            <strong>八州国絵図</strong>
            <span>隣接線が進軍路。赤く光る地域は選択地から即応可能。</span>
          </div>
          <div className="mapLegendKeys">
            <span><i className="legendDot player" />我領</span>
            <span><i className="legendDot chance" />好機</span>
            <span><i className="legendDot danger" />警戒</span>
          </div>
        </div>
      </section>
    );
  };

  const renderRegionDetail = () => {
    if (!selectedRegion) return null;
    const f = state.factions[selectedRegion.ownerFactionId];
    const defense  = estimateRegionDefense(state, selectedRegion.id);
    const hpRatio  = selectedRegion.castleHp / selectedRegion.maxCastleHp;
    return (
      <div className="regionPanel">
        <div className="regionPanelHeader">
          <div>
            <div className="regionPanelName" style={{ color: f?.color }}>{selectedRegion.name}</div>
            <div className="regionPanelFaction">{f?.name}</div>
          </div>
          <span className="terrainTag">{terrainLabel[selectedRegion.terrain]}</span>
        </div>

        <div className="regionStats">
          {[
            { label: '石高',   val: String(selectedRegion.riceYield),           cls: '' },
            { label: '治安',   val: String(selectedRegion.publicOrder),          cls: selectedRegion.publicOrder < 40 ? 'danger' : selectedRegion.publicOrder >= 70 ? 'good' : '' },
            { label: '守備兵', val: selectedRegion.localTroops.toLocaleString(), cls: '' },
            { label: '防衛力', val: defense.toLocaleString(),               cls: '' },
            { label: '開発度', val: String(selectedRegion.developmentLevel), cls: '' },
            { label: '城耐久', val: `${selectedRegion.castleHp}/${selectedRegion.maxCastleHp}`, cls: hpRatio < 0.3 ? 'danger' : '' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="rStat">
              <div className="rStatLabel">{label}</div>
              <div className={`rStatVal${cls ? ' ' + cls : ''}`}>{val}</div>
            </div>
          ))}
        </div>

        <div className={`attackAdvisor${canAttack ? ' ready' : isPlayerRegion ? ' home' : ' blocked'}`}>
          <span>{canAttack ? '進軍可能' : isPlayerRegion ? '自領選択中' : '進軍不可'}</span>
          <strong>
            {canAttack
              ? `出陣武将 ${state.selectedOfficerIds.length}/3`
              : isPlayerRegion
                ? '隣接する敵領を選ぶと進軍できる'
                : '自領に隣接していない敵領'}
          </strong>
        </div>

        {officersInRegion.length > 0 && (
          <div className="regionOfficerList">
            <div className="regionOfficerListTitle">在陣武将</div>
            {officersInRegion.map((o) => {
              const oFaction = state.factions[o.factionId];
              const isPlayer = o.factionId === PLAYER_FACTION_ID;
              const isSel = state.selectedOfficerIds.includes(o.id);
              return (
                <div
                  key={o.id}
                  className={`regionOfficerRow${isSel ? ' selected' : ''}`}
                  onClick={isPlayer ? () => onToggleOfficer(o.id) : undefined}
                  style={{ cursor: isPlayer ? 'pointer' : 'default' }}
                >
                  <CharacterPortrait officer={o} factionColor={oFaction?.color ?? '#666'} size={38} />
                  <div className="regionOfficerInfo">
                    <div className="regionOfficerName" style={{ color: isPlayer ? faction.color : undefined }}>
                      {o.name}
                    </div>
                    <div className="regionOfficerSub">
                      <span>{oFaction?.name}</span>
                      <span className="regionOfficerTroops">兵 {o.troops.toLocaleString()}</span>
                    </div>
                    {o.skills.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                        {o.skills.map((sid) => {
                          const sk = skillCatalog[sid];
                          return sk ? (
                            <span key={sid} className="skillTag" title={sk.description} style={{ fontSize: '0.52rem', padding: '1px 5px' }}>
                              {sk.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {isPlayer && <div className="regionOfficerHint">{isSel ? '✓ 出陣中' : 'タップで選択'}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {roninInRegion.length > 0 && (
          <div className="roninSection">
            <div className="regionOfficerListTitle">浪人（登用可）</div>
            {roninInRegion.map((o) => {
              const rf = state.factions[o.factionId];
              return (
                <div key={o.id} className="regionOfficerRow roninRow">
                  <CharacterPortrait officer={o} factionColor={rf?.color ?? '#888'} size={38} />
                  <div className="regionOfficerInfo">
                    <div className="regionOfficerName">{o.name}</div>
                    <div className="regionOfficerSub">
                      <span style={{ color: 'var(--muted)' }}>浪人</span>
                      <span className="regionOfficerTroops">兵 {o.troops.toLocaleString()}</span>
                    </div>
                    <button className="hireBtn" onClick={() => onHire(o.id)} type="button">
                      登用する
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderOfficers = () => (
    <div className="manageScreen" style={{ paddingBottom: 0 }}>
      <div className="sectionHead">
        <h2>武　将</h2>
        <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
          {state.selectedOfficerIds.length}/3 選択中
        </span>
      </div>
      <div className="officerArtBanner" aria-hidden="true">
        <img src="/assets/art/character-design-sheet.png" alt="" draggable={false} />
        <div className="officerArtBannerShade" />
        <div className="officerArtBannerText">
          <span>武将名鑑</span>
          <strong>{playerOfficers.length}名</strong>
        </div>
      </div>
      <div className="officerGrid">
        {playerOfficers.map((o) => (
          <OfficerCard
            key={o.id}
            officer={o}
            faction={faction}
            selected={state.selectedOfficerIds.includes(o.id)}
            onToggle={onToggleOfficer}
          />
        ))}
      </div>
    </div>
  );

  const renderStatus = () => (
    <div className="factionPanel">
      {allFactions.map((f) => {
        const fRegions = getFactionRegions(state, f.id);
        const troops   = getFactionTroops(state, f.id);
        const officers = getFactionOfficers(state, f.id);
        const defeated = fRegions.length === 0;
        return (
          <div key={f.id} className={`factionRow${defeated ? ' defeated' : ''}`}>
            <div className="factionDot" style={{ background: f.color }} />
            <div className="factionName" style={{ color: f.isPlayer ? 'var(--gold)' : undefined }}>
              {f.name}
              {f.isPlayer && <span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginLeft: 5 }}>(我が家)</span>}
            </div>
            <div className="factionInfo">
              {defeated
                ? <span style={{ color: 'var(--muted)' }}>滅亡</span>
                : (
                  <>
                    <div>{fRegions.length}地域</div>
                    <div>兵 {troops.toLocaleString()}</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--muted)' }}>武将 {officers.length}名</div>
                  </>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderLog = () => (
    <div className="logPanel">
      {[...state.logs].reverse().slice(0, 40).map((log: ActionLog) => (
        <div key={log.id} className="logItem">
          <div className="logTurn">
            <div>{logTypeIcon[log.type] ?? '―'}</div>
            <div>{log.turn}月</div>
          </div>
          <div className={`logMsg ${log.type}`}>{log.message}</div>
        </div>
      ))}
    </div>
  );

  const renderManage = () => (
    <div className="savePanel">
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>
        第{state.turn}月 進行中
      </div>
      <div className="savePanelRow">
        <button className="saveBtn" onClick={onSave} type="button">💾 セーブ</button>
        <button className="saveBtn" onClick={onLoad} type="button">📂 ロード</button>
      </div>
      <div className="savePanelRow">
        <button className="saveBtn" onClick={onNewGame} type="button">✦ タイトルへ</button>
        <button className="saveBtn danger" onClick={onDeleteSave} type="button">🗑 削除</button>
      </div>
      <p style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 4 }}>ターン終了時に自動セーブ</p>
    </div>
  );

  return (
    <div className="screen">
      <header className="gameHeader">
        <div className="gameHeaderTop">
          <div className="gameHeaderTitle">
            <h1>群雄ノ國</h1>
            <span className="turnBadge">第 {state.turn} 月</span>
          </div>
          <div className="apRow">
            <span className="apLabel">AP</span>
            {Array.from({ length: maxAp }).map((_, i) => (
              <div key={i} className={`apDot${i < ap ? ' filled' : ''}`} />
            ))}
          </div>
        </div>
        <div className="resourceBar">
          <div className={`resItem${goldLow ? ' low' : ''}`}>
            <span className="resLabel">金</span>
            <span className="resVal">{faction.gold.toLocaleString()}</span>
          </div>
          <div className={`resItem${foodLow ? ' low' : ''}`}>
            <span className="resLabel">兵糧</span>
            <span className="resVal">{faction.food.toLocaleString()}</span>
          </div>
          <div className="resItem">
            <span className="resLabel">士気</span>
            <span className="resVal">{faction.morale}</span>
          </div>
          <div className="resItem">
            <span className="resLabel">領地</span>
            <span className="resVal">
              {regions.length}<span style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>/12</span>
            </span>
          </div>
        </div>
      </header>

      {notice && <div className="toast">{notice}</div>}

      <nav className="tabNav">
        {(['map', 'officers', 'status', 'log', 'manage'] as const).map((k) => {
          const labels: Record<string, string> = { map: '地図', officers: '武将', status: '情勢', log: '軍記', manage: '管理' };
          return (
            <button key={k} className={`tabBtn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)} type="button">
              {labels[k]}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(132px + env(safe-area-inset-bottom))' }}>
        {tab === 'map'      && <div className="mapContainer">{renderMap()}{renderRegionDetail()}</div>}
        {tab === 'officers' && renderOfficers()}
        {tab === 'status'   && renderStatus()}
        {tab === 'log'      && renderLog()}
        {tab === 'manage'   && renderManage()}
      </div>

      <div className="commandBar">
        <div className="cmdGrid cmdGridFull">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <select
              style={{ fontSize: '0.6rem', background: 'var(--panel)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 4px', fontFamily: 'var(--font-serif)', width: '100%' }}
              value={focus}
              onChange={(e) => setFocus(e.target.value as DomesticFocus)}
            >
              {domesticFoci.map((f) => <option key={f.key} value={f.key}>{f.icon} {f.label}</option>)}
            </select>
            <button className="cmdBtn" onClick={() => onDomestic(focus)} disabled={ap < 1 || !isPlayerRegion} type="button">
              <span className="apCost">AP1</span><span className="icon">&#127968;</span><span>内政</span>
            </button>
          </div>
          <button className="cmdBtn" onClick={onRecruit} disabled={ap < 1 || !isPlayerRegion} type="button">
            <span className="apCost">AP1</span><span className="icon">&#9873;</span><span>徴兵</span>
          </button>
          <button className="cmdBtn" onClick={onTrain} disabled={ap < 1 || !isPlayerRegion} type="button">
            <span className="apCost">AP1</span><span className="icon">&#9876;</span><span>訓練</span>
          </button>
          <button className="cmdBtn" onClick={onSearch} disabled={ap < 1 || !isPlayerRegion} type="button">
            <span className="apCost">AP1</span><span className="icon">&#128269;</span><span>探索</span>
          </button>
          <button className="cmdBtn" onClick={onRest} disabled={ap < 1} type="button">
            <span className="apCost">AP1</span><span className="icon">&#9728;</span><span>休養</span>
          </button>
          <button className="cmdBtn cmdBtnAttack"
            onClick={onInvade}
            disabled={ap < 1 || !canAttack || state.selectedOfficerIds.length === 0}
            type="button"
          >
            <span className="apCost">AP1</span><span className="icon">&#128481;</span><span>進軍</span>
          </button>
          <button className="cmdBtn cmdBtnEnd" onClick={onEndTurn} type="button">
            <span className="icon">&#8618;</span><span>ターン終了</span>
          </button>
        </div>
      </div>
    </div>
  );
}
