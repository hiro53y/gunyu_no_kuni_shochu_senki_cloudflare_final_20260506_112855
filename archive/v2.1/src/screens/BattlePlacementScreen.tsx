// ===========================================================================
// 合戦前の配置画面
// 自勢力武将から最大3名を選び、前列・中列・後列に配置する。
// ===========================================================================

import { useEffect, useMemo, useState } from 'react';
import type { GameState, GeneralId, RegionId, FactionId } from '../types/game';
import { GeneralPortrait } from '../components/GeneralPortrait';
import { audio } from '../audio/AudioManager';
import {
  createBattleForecast,
  getDeployableGenerals,
  getEnemyPreviewGenerals,
  hasBattleHistory,
  summarizeGenerals,
} from '../engine/battleIntel';
import { TERRAIN_BONUSES } from '../data/regions';

interface Props {
  state: GameState;
  regionId: RegionId;
  onConfirm: (playerSlots: (GeneralId | null)[]) => void;
  onCancel: () => void;
}

const FACTION_NAME: Record<FactionId, string> = {
  akatsuki: '暁ノ家', kurogane: '黒鉄家', shion: '紫苑家', shirasagi: '白鷺家',
  honoo: '焔ノ家', rengein: '蓮華院', youma: '妖魔の群', ronin: '浪人衆',
};

const ROW_LABELS = ['前列', '中列', '後列'];
const RATING_LABEL = { advantage: '有利', even: '互角', disadvantage: '不利' } as const;
const RATING_CLASS = { advantage: 'good', even: 'warn', disadvantage: 'bad' } as const;

export function BattlePlacementScreen({ state, regionId, onConfirm, onCancel }: Props) {
  // 配置スロット：[front, middle, back]
  const [slots, setSlots] = useState<(GeneralId | null)[]>([null, null, null]);
  const [selectedGeneralId, setSelectedGeneralId] = useState<GeneralId | null>(null);

  const region = state.regions[regionId];
  const enemyFid = region?.factionId;

  // 出陣可能な武将（自勢力・status free/recruited・兵数>0）
  const roster = useMemo(() => {
    return getDeployableGenerals(state);
  }, [state.generals]);

  // 敵プレビュー（上位3名）
  const enemyPreview = useMemo(() => {
    return getEnemyPreviewGenerals(state, regionId);
  }, [state, regionId]);

  const availableStats = useMemo(() => summarizeGenerals(roster), [roster]);
  const placedGenerals = useMemo(() => slots
    .map((id) => (id ? state.generals[id] : null))
    .filter((g): g is NonNullable<typeof g> => g !== null), [slots, state.generals]);
  const forecast = useMemo(() => createBattleForecast(state, regionId, placedGenerals), [state, regionId, placedGenerals]);
  const firstBattle = !hasBattleHistory(state);
  const terrainNote = region ? TERRAIN_BONUSES[region.terrain]?.note ?? region.terrain : '';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!firstBattle || slots.some(Boolean) || roster.length === 0) return;
    const ids = roster.slice(0, 3).map((g) => g.id);
    setSlots([ids[0] ?? null, ids[1] ?? null, ids[2] ?? null]);
  }, [firstBattle, roster, slots]);

  function handleRosterClick(id: GeneralId) {
    audio.play('tap');
    if (slots.includes(id)) {
      // 既に配置済 → 選択中なら外す
      setSlots(slots.map((s) => (s === id ? null : s)));
      if (selectedGeneralId === id) setSelectedGeneralId(null);
      return;
    }
    setSelectedGeneralId(selectedGeneralId === id ? null : id);
  }

  function handleSlotClick(idx: number) {
    audio.play('tap');
    if (slots[idx]) {
      // 既に配置 → 外して候補リストへ
      const newSlots = [...slots];
      const removed = newSlots[idx];
      newSlots[idx] = null;
      setSlots(newSlots);
      if (selectedGeneralId === removed) setSelectedGeneralId(null);
      return;
    }
    if (selectedGeneralId) {
      const newSlots = [...slots];
      newSlots[idx] = selectedGeneralId;
      setSlots(newSlots);
      setSelectedGeneralId(null);
    }
  }

  function handleAutoFill() {
    audio.play('click');
    const ids = roster.slice(0, 3).map((g) => g.id);
    setSlots([ids[0] ?? null, ids[1] ?? null, ids[2] ?? null]);
    setSelectedGeneralId(null);
  }

  function handleClear() {
    audio.play('click');
    setSlots([null, null, null]);
    setSelectedGeneralId(null);
  }

  function handleConfirm() {
    audio.play('turnEnd');
    // 3スロット → 9スロット形式に展開
    const expanded: (GeneralId | null)[] = [
      slots[0], null, null,
      slots[1], null, null,
      slots[2], null, null,
    ];
    onConfirm(expanded);
  }

  function handleCancel() {
    audio.play('fail');
    onCancel();
  }

  const placedCount = slots.filter(Boolean).length;

  return (
    <div className="placementScreen">
      <header className="placementHud">
        <div className="placementHudGroup">
          <span className="label">出陣先</span>
          <span className="value">{region?.name ?? '?'}</span>
        </div>
        <div className="placementHudGroup">
          <span className="label">敵勢力</span>
          <span className="value">{enemyFid ? FACTION_NAME[enemyFid] : '無主'}</span>
        </div>
        <div className="placementHudGroup">
            <span className="label">地形</span>
            <span className="value" style={{ fontSize: 12 }}>
            {terrainNote}
          </span>
        </div>
      </header>

      <section className="placementForecast">
        <div className="forecastCard available">
          <span className="forecastLabel">出陣可能戦力</span>
          <strong>{availableStats.troopTotal.toLocaleString()}</strong>
          <small>合計戦力 {availableStats.combatPower.toLocaleString()} / {availableStats.generalCount}名</small>
        </div>
        <div className="forecastCard">
          <span className="forecastLabel">配置中の味方</span>
          <strong>{forecast.player.troopTotal.toLocaleString()}</strong>
          <small>敵兵数 {forecast.enemy.troopTotal.toLocaleString()}</small>
        </div>
        <div className={`forecastCard ${RATING_CLASS[forecast.rating]}`}>
          <span className="forecastLabel">戦力評価</span>
          <strong>{RATING_LABEL[forecast.rating]}</strong>
          <small>勝率目安 {forecast.winRate}%</small>
        </div>
        <div className="forecastReason">
          <b>地形補正</b> {forecast.terrainNote}<br />
          <b>{forecast.rating === 'disadvantage' ? '主な敗因' : '主な勝因'}</b> {forecast.mainReason}
        </div>
        {forecast.rating === 'disadvantage' && (
          <div className="forecastWarning">
            この地域は序盤の戦力では危険です。先に探索・徴収・弱い地域への進軍をおすすめします。
          </div>
        )}
      </section>

      <div className="placementBody">
        {/* プレイヤー配置 */}
        <section className="placementSlots">
          <h3 className="placementSubTitle">配置 ({placedCount}/3)</h3>
          <div className="placementSlotList">
            {slots.map((gid, idx) => {
              const g = gid ? state.generals[gid] : null;
              return (
                <button
                  key={idx}
                  className={`placementSlot ${g ? 'filled' : 'empty'} ${selectedGeneralId && !g ? 'highlight' : ''}`}
                  onClick={() => handleSlotClick(idx)}
                >
                  <span className="rowLabel">{ROW_LABELS[idx]}</span>
                  {g ? (
                    <>
                      <GeneralPortrait general={g} size={56} showLabel={false} />
                      <div className="slotMeta">
                        <div className="slotName">{g.name}</div>
                        <div className="slotStats">
                          武{g.stats.power} 統{g.stats.command} 兵{g.troopCurrent}
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="emptyHint">{selectedGeneralId ? 'ここに配置' : '空き'}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="placementButtons">
            <button className="phantBtn autoFill" onClick={handleAutoFill}>強い順で自動配置</button>
            <button className="phantBtn" onClick={handleClear}>全クリア</button>
          </div>
        </section>

        {/* 敵プレビュー */}
        <section className="placementEnemyPreview">
          <h3 className="placementSubTitle" style={{ color: 'var(--c-shu)' }}>
            敵の手勢（上位3名）
          </h3>
          {enemyPreview.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>武将なし（地域兵のみ）</div>
          ) : (
            enemyPreview.map((g) => (
              <div key={g.id} className="enemyPreviewRow">
                <GeneralPortrait general={g} size={40} showLabel={false} />
                <div>
                  <div style={{ fontSize: 12 }}>{g.name}</div>
                  <small style={{ color: 'var(--c-kinari-d)' }}>
                    武{g.stats.power} 統{g.stats.command} 兵{g.troopCurrent}
                  </small>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* 自勢力の候補一覧 */}
      <section className="placementRoster">
        <h3 className="placementSubTitle">出陣可能（{roster.length}名）</h3>
        {roster.length === 0 ? (
          <div className="muted" style={{ fontSize: 12 }}>出陣可能な武将がいません</div>
        ) : (
          <div className="rosterGrid">
            {roster.map((g) => {
              const placed = slots.includes(g.id);
              const selected = selectedGeneralId === g.id;
              return (
                <button
                  key={g.id}
                  className={`rosterCard ${placed ? 'placed' : ''} ${selected ? 'selected' : ''}`}
                  onClick={() => handleRosterClick(g.id)}
                >
                  <GeneralPortrait general={g} size={48} showLabel={false} />
                  <div className="rosterMeta">
                    <div className="rosterName">{g.isUnique && '★'}{g.name}</div>
                    <div className="rosterStats">
                      武{g.stats.power} 統{g.stats.command}
                    </div>
                    <div className="rosterTroops">
                      兵 {g.troopCurrent}/{g.troopMax}
                    </div>
                  </div>
                  {placed && <span className="placedBadge">配置済</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <footer className="placementFooter">
        <button className="phantBtn cancel" onClick={handleCancel}>戻る</button>
        <div style={{ flex: 1 }} />
        <button
          className={`phantBtn confirm ${placedCount === 0 ? 'disabled' : ''}`}
          onClick={handleConfirm}
          disabled={placedCount === 0}
        >
          出陣（{placedCount}名）
        </button>
      </footer>
    </div>
  );
}
