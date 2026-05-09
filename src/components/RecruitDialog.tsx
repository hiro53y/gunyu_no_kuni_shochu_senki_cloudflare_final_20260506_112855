// ===========================================================================
// 登用・説得ダイアログ（改良版）
// 説得：成功率・必要金・拘束ターン・忠誠を事前表示
// 雇用：trait・能力・必要金を表示
// ===========================================================================

import type { General, GameState, GenericTrait } from '../types/game';
import { GeneralPortrait } from './GeneralPortrait';
import { persuasionCost, persuasionSuccessRate, hireCost } from '../engine/recruit';

interface Props {
  state: GameState;
  onClose: () => void;
  onPersuade: (id: string) => void;
  onHire: (id: string) => void;
  onShowDetail: (g: General) => void;
}

const TRAIT_LABEL: Record<GenericTrait, string> = {
  normal: '平凡',
  attacker: '攻め手',
  defender: '守り手',
  strategist: '軍師',
  commander: '名将',
  sniper: '狙撃手',
  wild: '暴れ者',
  gem: '逸材',
};

export function RecruitDialog({ state, onClose, onPersuade, onHire, onShowDetail }: Props) {
  const prisoners = state.prisoners
    .map((id) => state.generals[id])
    .filter((g): g is General => Boolean(g));
  const ronins = state.roninPool
    .map((id) => state.generals[id])
    .filter((g): g is General => Boolean(g));

  const treasury = state.factions.akatsuki.treasury;

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="recruitDialog" onClick={(e) => e.stopPropagation()}>
        <button className="closeBtn" onClick={onClose} aria-label="閉じる">×</button>

        <h2 className="rdTitle">登用・説得</h2>
        <div className="rdTreasury">国庫 {treasury.toLocaleString()} 金</div>

        <section className="rdSection">
          <div className="rdSectionTitle">
            <span>捕虜（{prisoners.length}）</span>
            <small className="muted">説得して登用する</small>
          </div>
          {prisoners.length === 0 ? (
            <div className="rdEmpty">合戦に勝利すると敵将を捕らえることがある。</div>
          ) : (
            <div className="rdList">
              {prisoners.map((g) => {
                const cost = persuasionCost(g);
                const rate = persuasionSuccessRate(state, g);
                const ratePct = Math.round(rate * 100);
                const canPay = treasury >= cost;
                const isYouma = g.homeFactionId === 'youma';
                return (
                  <article key={g.id} className="rdEntry">
                    <button className="rdPortrait" onClick={() => onShowDetail(g)} aria-label="詳細">
                      <GeneralPortrait general={g} size={48} showLabel={false} />
                    </button>
                    <div className="rdMeta">
                      <div className="rdName">
                        {g.isUnique && '★ '}
                        {g.name}
                        {!g.isUnique && <span className={`rdTrait trait-${g.trait}`}>【{TRAIT_LABEL[g.trait]}】</span>}
                      </div>
                      <div className="rdStats">
                        武{g.stats.power} 統{g.stats.command} 知{g.stats.intel} 魅{g.stats.charisma}
                        ／ 拘束 {g.capturedTurns}月 ／ 試行 {g.persuadeAttempts}回
                      </div>
                      <div className="rdProgress">
                        <span className={`rdProb rate-${probTier(ratePct)}`}>
                          成功率 {isYouma ? '不可' : `${ratePct}%`}
                        </span>
                        <span className={`rdCost ${canPay ? '' : 'insufficient'}`}>
                          必要 {cost.toLocaleString()} 金
                        </span>
                      </div>
                    </div>
                    <button
                      className="rdActionBtn"
                      onClick={() => onPersuade(g.id)}
                      disabled={!canPay || isYouma}
                    >
                      説得
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rdSection">
          <div className="rdSectionTitle">
            <span>浪人候補（{ronins.length}）</span>
            <small className="muted">金で雇って即戦力に</small>
          </div>
          {ronins.length === 0 ? (
            <div className="rdEmpty">浪間に人材なし。</div>
          ) : (
            <div className="rdList">
              {ronins.map((g) => {
                const cost = hireCost(g);
                const canPay = treasury >= cost;
                return (
                  <article key={g.id} className="rdEntry">
                    <button className="rdPortrait" onClick={() => onShowDetail(g)} aria-label="詳細">
                      <GeneralPortrait general={g} size={48} showLabel={false} />
                    </button>
                    <div className="rdMeta">
                      <div className="rdName">
                        {g.name}
                        <span className={`rdTrait trait-${g.trait}`}>【{TRAIT_LABEL[g.trait]}】</span>
                      </div>
                      <div className="rdStats">
                        武{g.stats.power} 統{g.stats.command} 知{g.stats.intel} 魅{g.stats.charisma}
                        ／ 兵上限 {g.troopMax.toLocaleString()}
                      </div>
                      <div className="rdProgress">
                        <span className={`rdCost ${canPay ? '' : 'insufficient'}`}>
                          必要 {cost.toLocaleString()} 金
                        </span>
                      </div>
                    </div>
                    <button
                      className="rdActionBtn"
                      onClick={() => onHire(g.id)}
                      disabled={!canPay}
                    >
                      雇用
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="rdFooter">
          <button className="rdCloseBtn" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

function probTier(pct: number): string {
  if (pct >= 60) return 'high';
  if (pct >= 30) return 'mid';
  return 'low';
}
