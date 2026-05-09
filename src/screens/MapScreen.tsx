// ===========================================================================
// 地図画面（メイン）
// HUD + 操作リスト + 八洲マップ + 地域パネル + アクションバー
// 合戦コマンドは配置画面 → 合戦画面の順に遷移
// ===========================================================================

import { useCallback, useState } from 'react';
import type { BattleState, GameState, General, GeneralId, RegionId, GameConfig } from '../types/game';
import { Hud } from '../components/Hud';
import { YashimaMap } from '../components/YashimaMap';
import { RegionPanel, RegionPopup } from '../components/RegionPanel';
import { ActionBar, type ActionKind } from '../components/ActionBar';
import { OperationList } from '../components/OperationList';
import { RecruitDialog } from '../components/RecruitDialog';
import { GeneralDetail } from '../components/GeneralDetail';
import { ResultOverlay } from '../components/ResultOverlay';
import { SettingsDialog } from '../components/SettingsDialog';
import { BattleScreen } from './BattleScreen';
import { BattlePlacementScreen } from './BattlePlacementScreen';
import {
  applyBuildAction, applyCollectAction,
  attemptPersuade, hireRonin,
  initBattle, finalizeBattle, createRng,
} from '../engine';
import { applyScoutAction, applyRestAction, endTurn, consumeAp } from '../createGame';
import { audio } from '../audio/AudioManager';

interface Props {
  state: GameState;
  setState: (updater: (s: GameState) => GameState) => void;
  onReturnTitle: () => void;
}

type OverlayKind = 'recruit' | 'settings' | null;

export function MapScreen({ state, setState, onReturnTitle }: Props) {
  const [selectedId, setSelectedId] = useState<RegionId | null>('01');
  const [notice, setNotice] = useState<string>('');
  const [overlay, setOverlay] = useState<OverlayKind>(null);
  const [detailGeneralId, setDetailGeneralId] = useState<string | null>(null);
  const [activeBattle, setActiveBattle] = useState<BattleState | null>(null);
  const [pendingBattleRegion, setPendingBattleRegion] = useState<RegionId | null>(null);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 2500);
  }, []);

  const updateConfig = useCallback((next: GameConfig) => {
    setState((s) => ({ ...s, config: next }));
  }, [setState]);

  // --- 合戦の起動（配置画面経由） -----------------------------------------

  const handleBattleStart = useCallback((targetRegionId: RegionId) => {
    const region = state.regions[targetRegionId];
    if (!region) return;
    if (state.ap < 1) { flash('行動回数が足りません'); return; }
    audio.play('click');
    setPendingBattleRegion(targetRegionId);
  }, [state, flash]);

  const handlePlacementConfirm = useCallback((playerSlots: (GeneralId | null)[]) => {
    if (!pendingBattleRegion) return;
    const region = state.regions[pendingBattleRegion];
    if (!region) return;

    const enemyFid = region.factionId;
    const enemyForce = enemyFid
      ? Object.values(state.generals)
          .filter((g) => g.factionId === enemyFid)
          .filter((g) => g.troopCurrent > 0)
          .sort((a, b) => (b.stats.power + b.stats.command) - (a.stats.power + a.stats.command))
          .slice(0, 3)
          .map((g) => g.id)
      : [];

    const enemySlots = [
      enemyForce[0] ?? null, null, null,
      enemyForce[1] ?? null, null, null,
      enemyForce[2] ?? null, null, null,
    ];

    setState((s) => ({ ...s, ap: Math.max(0, s.ap - 1) }));

    const battle = initBattle(state, {
      regionId: pendingBattleRegion,
      playerIsAttacker: true,
      attackerFactionId: 'akatsuki',
      defenderFactionId: enemyFid ?? 'ronin',
      playerGeneralIds: playerSlots,
      enemyGeneralIds: enemySlots,
    });
    setActiveBattle(battle);
    setPendingBattleRegion(null);
  }, [state, setState, pendingBattleRegion]);

  const handlePlacementCancel = useCallback(() => {
    setPendingBattleRegion(null);
  }, []);

  const completeBattle = useCallback((finalBattle: BattleState) => {
    setState((s) => {
      const rng = createRng(s.rngSeed);
      const fin = finalizeBattle(s, finalBattle, rng);
      return fin.state;
    });
    const messageMap: Record<string, string> = {
      player_win: '合戦に勝利！',
      enemy_win:  '合戦に敗北…',
      draw:       '引き分け',
    };
    if (finalBattle.result === 'player_win') audio.play('victory');
    else if (finalBattle.result === 'enemy_win') audio.play('defeat');
    else audio.play('turnEnd');
    flash(messageMap[finalBattle.result] ?? '');
    setActiveBattle(null);
  }, [setState, flash]);

  // --- その他コマンドのハンドラ -----------------------------------------

  const handleAction = useCallback((action: ActionKind) => {
    if (action === 'endTurn') {
      audio.play('turnEnd');
      setState((s) => endTurn(s));
      flash('ターン終了');
      return;
    }
    if (action === 'recruit') {
      audio.play('click');
      setOverlay('recruit');
      return;
    }
    if (action === 'battle') {
      if (!selectedId) return;
      handleBattleStart(selectedId);
      return;
    }
    if (!selectedId && action !== 'rest') return;
    audio.play('click');

    setState((s) => {
      const after = (() => {
        switch (action) {
          case 'build': {
            const r = applyBuildAction(s, selectedId!, 'farm');
            flash(r.message);
            if (!r.ok) { audio.play('fail'); return s; }
            const consumed = consumeAp(r.state, 1);
            return consumed.ok ? consumed.state : r.state;
          }
          case 'collect': {
            const r = applyCollectAction(s, selectedId!);
            flash(r.message);
            if (!r.ok) { audio.play('fail'); return s; }
            const consumed = consumeAp(r.state, 1);
            return consumed.ok ? consumed.state : r.state;
          }
          case 'sabotage': {
            const r = applyScoutAction(s, selectedId!);
            flash(r.message);
            if (!r.ok) { audio.play('fail'); return s; }
            const consumed = consumeAp(r.state, 1);
            return consumed.ok ? consumed.state : r.state;
          }
          case 'scout': {
            const consumed = consumeAp(s, 1);
            if (!consumed.ok) { flash('行動回数が足りません'); audio.play('fail'); return s; }
            const region = s.regions[selectedId!];
            if (!region) { flash('地域が見つかりません'); return s; }
            const gain = 800;
            flash(`${region.name}を探索（${gain}金）`);
            return {
              ...consumed.state,
              factions: {
                ...consumed.state.factions,
                akatsuki: { ...consumed.state.factions.akatsuki, treasury: consumed.state.factions.akatsuki.treasury + gain },
              },
            };
          }
          case 'rest': {
            const playerGenerals = Object.values(s.generals)
              .filter((g) => g.factionId === 'akatsuki')
              .map((g) => g.id);
            audio.play('heal');
            flash('武将が休養した');
            return applyRestAction(s, playerGenerals);
          }
        }
        return s;
      })();
      return after;
    });
  }, [selectedId, setState, flash, handleBattleStart]);

  const handlePersuade = useCallback((id: string) => {
    setState((s) => {
      const rng = createRng(s.rngSeed);
      const r = attemptPersuade(s, id, rng);
      if (r.ok) audio.play('levelUp');
      else audio.play('fail');
      flash(r.message);
      return r.state;
    });
  }, [setState, flash]);

  const handleHire = useCallback((id: string) => {
    setState((s) => {
      const r = hireRonin(s, id);
      if (r.ok) audio.play('levelUp');
      else audio.play('fail');
      flash(r.message);
      return r.state;
    });
  }, [setState, flash]);

  const showDetail = useCallback((g: General) => {
    setDetailGeneralId(g.id);
  }, []);

  // --- 配置画面 → 合戦画面 → 地図 の優先順 ------------------------------

  if (activeBattle) {
    return (
      <BattleScreen
        state={state}
        initialBattle={activeBattle}
        onComplete={completeBattle}
      />
    );
  }
  if (pendingBattleRegion) {
    return (
      <BattlePlacementScreen
        state={state}
        regionId={pendingBattleRegion}
        onConfirm={handlePlacementConfirm}
        onCancel={handlePlacementCancel}
      />
    );
  }

  const detailGeneral = detailGeneralId ? state.generals[detailGeneralId] : null;

  return (
    <div className="mapScreen">
      <Hud state={state} onOpenMenu={() => { audio.play('tap'); setOverlay('settings'); }} />

      <div className="mapBody">
        <OperationList state={state} />

        <div className="mapArea">
          <YashimaMap state={state} selectedId={selectedId} onSelect={(id) => { audio.play('tap'); setSelectedId(id); }} />
          <RegionPopup state={state} regionId={selectedId} />
        </div>

        <RegionPanel state={state} regionId={selectedId} />
      </div>

      <ActionBar state={state} selectedRegionId={selectedId} onAction={handleAction} />

      {notice && <div className="toast">{notice}</div>}

      {overlay === 'recruit' && (
        <RecruitDialog
          state={state}
          onClose={() => setOverlay(null)}
          onPersuade={handlePersuade}
          onHire={handleHire}
          onShowDetail={showDetail}
        />
      )}

      {overlay === 'settings' && (
        <SettingsDialog
          config={state.config}
          onChange={updateConfig}
          onClose={() => setOverlay(null)}
        />
      )}

      {detailGeneral && (
        <GeneralDetail
          state={state}
          general={detailGeneral}
          onClose={() => setDetailGeneralId(null)}
        />
      )}

      {state.victory !== 'none' && (
        <ResultOverlay state={state} onReturnTitle={onReturnTitle} />
      )}
    </div>
  );
}
