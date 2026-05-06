import { useMemo, useState } from 'react';
import { skillCatalog, terrainLabel } from '../data/names';
import { officerTitles } from '../data/dialogue';
import {
  estimateRegionDefense, getAvailableRonin, getFactionOfficers,
  getFactionRegions, getFactionTroops, getPlayerFaction, getPlayerRegions,
  getRegionOfficers,
} from '../engine/selectors';
import { PLAYER_FACTION_ID } from '../data/names';
import type { ActionLog, DomesticFocus, GameState } from '../types/game';

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

function portraitBg(color: string) {
  return `linear-gradient(135deg, ${color}cc 0%, ${color}55 100%)`;
}

const logTypeIcon: Record<string, string> = {
  battle: '⚔', action: '▶', economy: '⊕', event: '✦', system: '◆', warning: '！', save: '□',
};

const domesticFoci: { key: DomesticFocus; label: string; icon: string }[] = [
  { key: 'riceYield',        label: '石高', icon: '🌾' },
  { key: 'publicOrder',      label: '治安', icon: '🏮' },
  { key: 'castleHp',         label: '修城', icon: '🏯' },
  { key: 'developmentLevel', label: '開発', icon: '⚙'  },
];

// 12地域のグリッド配置（3列×4行）
const MAP_ROWS = [
  ['r_shiramine',  'r_tsukishiro', 'r_kiridani'],
  ['r_akihara',    'r_kagebana',   'r_suhama'],
  ['r_kurose',     'r_midorinami', 'r_kazami'],
  ['r_hagino',     'r_tokinoura',  'r_nagareyama'],
];

export function MapScreen({
  state, onSelectRegion, onDomestic, onRecruit, onTrain, onSearch,
  onInvade, onRest, onEndTurn, onHire, onToggleOfficer,
  onSave, onLoad, onNewGame, onDeleteSave, notice,
}: Props) {
  const [tab, setTab]     = useState<'map'|'officers'|'status'|'log'|'manage'>('map');
  const [focus, setFocus] = useState<DomesticFocus>('riceYield');

  const faction  = getPlayerFaction(state);
  const regions  = getPlayerRegions(state);
  const ap       = state.actionPoints;
  const maxAp    = state.maxActionPoints;
  const goldLow  = faction.gold < 100;
  const foodLow  = faction.food < 150;

  const selectedRegion  = state.regions[state.selectedRegionId];
  const isPlayerRegion  = selectedRegion?.ownerFactionId === PLAYER_FACTION_ID;
  const neighborRegions = selectedRegion?.neighbors?.map((nid) => state.regions[nid]) ?? [];
  const canAttack = isPlayerRegion && neighborRegions.some((n) => n && n.ownerFactionId !== PLAYER_FACTION_ID);

  const officersInRegion = useMemo(() => selectedRegion ? getRegionOfficers(state, selectedRegion.id) : [], [state, selectedRegion]);
  const roninInRegion    = useMemo(() => getAvailableRonin(state).filter((o) => o.locationRegionId === state.selectedRegionId), [state]);
  const playerOfficers   = useMemo(() => getFactionOfficers(state, PLAYER_FACTION_ID), [state]);
  const allFactions      = useMemo(() =>
    Object.values(state.factions).filter((f) => f.isMajor).sort((a, b) => {
      if (a.isPlayer) return -1;
      if (b.isPlayer) return 1;
      return getFactionRegions(state, b.id).length - getFactionRegions(state, a.id).length;
    }), [state]);

  /* ── マップ ── */
  const renderMap = () => (
    <div className="mapGrid">
      {MAP_ROWS.flat().map((rid) => {
        const r = state.regions[rid];
        if (!r) return <div key={rid} />;
        const f = state.factions[r.ownerFactionId];
        const isPlayer   = r.ownerFactionId === PLAYER_FACTION_ID;
        const isSelected = rid === state.selectedRegionId;
        const isNeighbor = selectedRegion?.neighbors.includes(rid);
        const hpRatio = r.castleHp / r.maxCastleHp;
        const hpCls = hpRatio > 0.55 ? '' : hpRatio > 0.3 ? ' mid' : ' low';
        return (
          <button
            key={rid}
            className={['mapTile', isPlayer ? 'player' : '', isSelected ? 'selected' : '', isNeighbor && !isSelected ? 'tileNeighbor' : ''].filter(Boolean).join(' ')}
            style={{ '--tile-color': f?.color ?? '#666' } as React.CSSProperties}
            onClick={() => onSelectRegion(rid)}
            type="button"
          >
            <div className="tileColorBar" />
            {isPlayer && <span className="tilePlayer">我</span>}
            <span className="tileName">{r.name}</span>
            <span className="tileFaction" style={{ color: f?.color }}>{f?.name}</span>
            <span className="tileTroops">兵 {r.localTroops.toLocaleString()}</span>
            <div className="tileHpBar">
              <div className={`tileHpFill${hpCls}`} style={{ width: `${hpRatio * 100}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );

  /* ── 地域詳細 ── */
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
            { label: '防衛力', val: defense.toLocaleString(),                    cls: '' },
            { label: '開発度', val: String(selectedRegion.developmentLevel),     cls: '' },
            { label: '城耐久', val: `${selectedRegion.castleHp}/${selectedRegion.maxCastleHp}`, cls: hpRatio < 0.3 ? 'danger' : '' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="rStat">
              <div className="rStatLabel">{label}</div>
              <div className={`rStatVal${cls ? ' ' + cls : ''}`}>{val}</div>
            </div>
          ))}
        </div>
        {officersInRegion.map((o) => (
          <div key={o.id} className="regionOfficerRow">
            <div className="miniPortrait" style={{ background: portraitBg(f?.color ?? '#666') }}>{o.name.slice(0,1)}</div>
            <span className="regionOfficerName">{o.name}</span>
            <span className="regionOfficerTroops">兵 {o.troops.toLocaleString()}</span>
          </div>
        ))}
        {roninInRegion.length > 0 && (
          <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {roninInRegion.map((o) => (
              <button key={o.id} className="saveBtn" onClick={() => onHire(o.id)} type="button">{o.name}を登用</button>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── 武将タブ ── */
  const renderOfficers = () => (
    <div className="manageScreen" style={{ paddingBottom: 0 }}>
      <div className="sectionHead"><h2>武　将</h2><span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>最大3名選択</span></div>
      <div className="officerGrid">
        {playerOfficers.map((o) => {
          const isSelected = state.selectedOfficerIds.includes(o.id);
          const role = o.command >= o.wisdom ? (o.valor >= o.wisdom ? '武' : '政') : '智';
          const roleColors: Record<string, string> = { '武': '#e03030', '智': '#4090e0', '政': '#40a060' };
          const trRatio = o.troops / o.maxTroops;
          return (
            <button key={o.id} className={`officerCard${isSelected ? ' selected' : ''}`} onClick={() => onToggleOfficer(o.id)} type="button" aria-pressed={isSelected}>
              <div className="officerCardTop">
                <div className="officerPortrait" style={{ background: portraitBg(faction.color) }}>
                  {o.name.slice(0,1)}
                  <span className="roleTag" style={{ background: roleColors[role], color: '#fff' }}>{role}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="officerName">{o.name}</div>
                  <div className="officerTitle">{officerTitles[o.id] ?? ''}</div>
                  <div className="officerLevel">Lv{o.level} / EXP {o.exp}/100</div>
                </div>
                {isSelected && <span className="selectedBadge">出陣</span>}
              </div>
              <div className="officerCardStats">
                {[['統', o.command],['武', o.valor],['知', o.wisdom],['政', o.politics],['魅', o.charisma]].map(([k, v]) => (
                  <div key={String(k)} className="statCell">
                    <span className="statName">{k}</span>
                    <span className={`statVal${Number(v) >= 85 ? ' vhigh' : Number(v) >= 70 ? ' high' : ''}`}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="officerTroopBar">
                <div className="troopBarOuter"><div className={`troopBarFill${trRatio < 0.35 ? ' low' : ''}`} style={{ width: `${trRatio*100}%` }} /></div>
                <span className="troopCount">兵 {o.troops.toLocaleString()}/{o.maxTroops.toLocaleString()}</span>
              </div>
              {o.skills.length > 0 && (
                <div className="skillTagRow">
                  {o.skills.map((sid) => { const sk = skillCatalog[sid]; return sk ? <span key={sid} className="skillTag" title={sk.description}>{sk.name}</span> : null; })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ── 情勢タブ ── */
  const renderStatus = () => (
    <div className="factionPanel">
      {allFactions.map((f) => {
        const fRegions = getFactionRegions(state, f.id);
        const troops   = getFactionTroops(state, f.id);
        const defeated = fRegions.length === 0;
        return (
          <div key={f.id} className={`factionRow${defeated ? ' defeated' : ''}`}>
            <div className="factionDot" style={{ background: f.color }} />
            <div className="factionName" style={{ color: f.isPlayer ? 'var(--gold)' : undefined }}>
              {f.name}{f.isPlayer && <span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginLeft: 5 }}>（我が家）</span>}
            </div>
            <div className="factionInfo">
              {defeated ? <span style={{ color: 'var(--muted)' }}>滅亡</span>
                : <><div>{fRegions.length}地域</div><div>兵 {troops.toLocaleString()}</div></>}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── 軍記タブ ── */
  const renderLog = () => (
    <div className="logPanel">
      {[...state.logs].reverse().slice(0, 40).map((log: ActionLog) => (
        <div key={log.id} className="logItem">
          <div className="logTurn"><div>{logTypeIcon[log.type] ?? '─'}</div><div>{log.turn}月</div></div>
          <div className={`logMsg ${log.type}`}>{log.message}</div>
        </div>
      ))}
    </div>
  );

  /* ── 管理タブ ── */
  const renderManage = () => (
    <div className="savePanel">
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>第{state.turn}月 進行中</div>
      <div className="savePanelRow">
        <button className="saveBtn" onClick={onSave}>💾 セーブ</button>
        <button className="saveBtn" onClick={onLoad}>📂 ロード</button>
      </div>
      <div className="savePanelRow">
        <button className="saveBtn" onClick={onNewGame}>✦ タイトルへ</button>
        <button className="saveBtn danger" onClick={onDeleteSave}>🗑 削除</button>
      </div>
      <p style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 4 }}>ターン終了時に自動セーブ</p>
    </div>
  );

  return (
    <div className="screen">
      {/* ヘッダー */}
      <header className="gameHeader">
        <div className="gameHeaderTop">
          <div className="gameHeaderTitle">
            <h1>群雄ノ國</h1>
            <span className="turnBadge">第 {state.turn} 月</span>
          </div>
          <div className="apRow">
            <span className="apLabel">AP</span>
            {Array.from({ length: maxAp }).map((_, i) => <div key={i} className={`apDot${i < ap ? ' filled' : ''}`} />)}
          </div>
        </div>
        <div className="resourceBar">
          <div className={`resItem${goldLow ? ' low' : ''}`}><span className="resLabel">金</span><span className="resVal">{faction.gold.toLocaleString()}</span></div>
          <div className={`resItem${foodLow ? ' low' : ''}`}><span className="resLabel">兵糧</span><span className="resVal">{faction.food.toLocaleString()}</span></div>
          <div className="resItem"><span className="resLabel">士気</span><span className="resVal">{faction.morale}</span></div>
          <div className="resItem"><span className="resLabel">領地</span><span className="resVal">{regions.length}<span style={{ fontSize:'0.55rem', color:'var(--muted)' }}>/12</span></span></div>
        </div>
      </header>

      {notice && <div className="toast">{notice}</div>}

      {/* タブナビ */}
      <nav className="tabNav">
        {([['map','地図'],['officers','武将'],['status','情勢'],['log','軍記'],['manage','管理']] as const).map(([k, l]) => (
          <button key={k} className={`tabBtn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)} type="button">{l}</button>
        ))}
      </nav>

      {/* コンテンツ */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {tab === 'map' && <div className="mapContainer">{renderMap()}{renderRegionDetail()}</div>}
        {tab === 'officers' && renderOfficers()}
        {tab === 'status'   && renderStatus()}
        {tab === 'log'      && renderLog()}
        {tab === 'manage'   && renderManage()}
      </div>

      {/* コマンドバー */}
      <div className="commandBar">
        <div className="cmdGrid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <select
              style={{ fontSize: '0.6rem', background: 'var(--panel)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 4px', fontFamily: 'var(--font-serif)', width: '100%' }}
              value={focus} onChange={(e) => setFocus(e.target.value as DomesticFocus)}
            >
              {domesticFoci.map((f) => <option key={f.key} value={f.key}>{f.icon} {f.label}</option>)}
            </select>
            <button className="cmdBtn" onClick={() => onDomestic(focus)} disabled={ap < 1 || !isPlayerRegion} type="button">
              <span className="apCost">AP1</span><span className="icon">🏛</span><span>内政</span>
            </button>
          </div>
          <button className="cmdBtn" onClick={onRecruit} disabled={ap < 1 || !isPlayerRegion} type="button">
            <span className="apCost">AP1</span><span className="icon">🪖</span><span>徴兵</span>
          </button>
          <button className="cmdBtn" onClick={onTrain} disabled={ap < 1 || !isPlayerRegion} type="button">
            <span className="apCost">AP1</span><span className="icon">⚔</span><span>鍛練</span>
          </button>
          <button className="cmdBtn cmdBtnAttack" onClick={onInvade} disabled={ap < 1 || !canAttack || state.selectedOfficerIds.length === 0} type="button">
            <span className="apCost">AP1</span><span className="icon">🗡</span><span>進軍</span>
          </button>
          <button className="cmdBtn cmdBtnEnd" onClick={onEndTurn} type="button">
            <span className="icon">↪</span><span>ターン終了</span>
          </button>
        </div>
      </div>
    </div>
  );
}
