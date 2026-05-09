// ===========================================================================
// 合戦前の配置画面
// 自勢力武将から最大3名を選び、前列・中列・後列に配置する。
// ===========================================================================

import { useMemo, useState } from 'react';
import type { GameState, GeneralId, RegionId, FactionId } from '../types/game';
import { GeneralPortrait } from '../components/GeneralPortrait';
import { audio } from '../audio/AudioManager';

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

export function BattlePlacementScreen({ state, regionId, onConfirm, onCancel }: Props) {
  // 配置スロット：[front, middle, back]
  const [slots, setSlots] = useState<(GeneralId | null)[]>([null, null, null]);
  const [selectedGeneralId, setSelectedGeneralId] = useState<GeneralId | null>(null);

  const region = state.regions[regionId];
  const enemyFid = region?.factionId;

  // 出陣可能な武将（自勢力・status free/recruited・兵数>0）
  const roster = useMemo(() => {
    return Object.values(state.generals)
      .filter((g) => g.factionId === 'akatsuki')
      .filter((g) => g.status === 'free' || g.status === 'recruited')
      .filter((g) => g.troopCurrent > 0)
      .sort((a, b) => (b.stats.power + b.stats.command) - (a.stats.power + a.stats.command));
  }, [state.generals]);

  // 敵プレビュー（上位3名）
  const enemyPreview = useMemo(() => {
    if (!enemyFid) return [];
    return Object.values(state.generals)
      .filter((g) => g.factionId === enemyFid)
      .filter((g) => g.troopCurrent > 0)
      .sort((a, b) => (b.stats.power + b.stats.command) - (a.stats.power + a.stats.command))
      .slice(0, 3);
  }, [state.generals, enemyFid]);

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
            {/* 戦場補正のメモ */}
            {(region?.terrain ?? '')}
          </span>
        </div>
      </header>

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
            <button className="phantBtn" onClick={handleAutoFill}>強い順で自動配置</button>
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
