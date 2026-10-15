// ===========================================================================
// 武将詳細モーダル
// 立ち絵大型表示・ステータス・スキル詳細・装備・関係性・備考
// ===========================================================================

import type { General, GameState, FactionId } from '../types/game';
import { GeneralPortrait } from './GeneralPortrait';
import { getSkill } from '../data/skills';

interface Props {
  state: GameState;
  general: General;
  onClose: () => void;
}

const FACTION_NAME: Record<FactionId, string> = {
  akatsuki: '暁ノ家', kurogane: '黒鉄家', shion: '紫苑家', shirasagi: '白鷺家',
  honoo: '焔ノ家', rengein: '蓮華院', youma: '妖魔の群', ronin: '浪人衆',
};
const STATUS_LABEL: Record<General['status'], string> = {
  free:      '通常',
  recruited: '登用済',
  captured:  '捕虜中',
  dead:      '討死',
  ronin:     '浪人',
};
const TRAIT_LABEL: Record<General['trait'], string> = {
  normal:     '平凡型',
  attacker:   '攻め手',
  defender:   '守り手',
  strategist: '軍師型',
  commander:  '名将型',
  sniper:     '狙撃手',
  wild:       '暴れ者',
  gem:        '逸材',
};

export function GeneralDetail({ state, general, onClose }: Props) {
  const factionName = general.factionId
    ? FACTION_NAME[general.factionId]
    : (general.homeFactionId ? `（元）${FACTION_NAME[general.homeFactionId]}` : '無所属');

  const skills = general.skillIds.map((id) => getSkill(id));

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="generalDetail" onClick={(e) => e.stopPropagation()}>
        <button className="closeBtn" onClick={onClose} aria-label="閉じる">×</button>

        <div className="gdHeader">
          <GeneralPortrait general={general} size={120} showLabel={false} />
          <div className="gdHeaderText">
            <div className="gdName">
              {general.isUnique && <span className="uniqueMark">★</span>}
              {general.name}
            </div>
            <div className="gdReading">{general.reading}</div>
            <div className="gdFaction">{factionName}</div>
            <div className="gdTags">
              <span className={`gdTag status-${general.status}`}>{STATUS_LABEL[general.status]}</span>
              {!general.isUnique && (
                <span className={`gdTag trait-${general.trait}`}>【{TRAIT_LABEL[general.trait]}】</span>
              )}
            </div>
          </div>
        </div>

        <section className="gdSection">
          <h3 className="gdSectionTitle">能力</h3>
          <div className="gdStatsGrid">
            <StatBar label="統率" value={general.stats.command} />
            <StatBar label="武力" value={general.stats.power} />
            <StatBar label="知略" value={general.stats.intel} />
            <StatBar label="魅力" value={general.stats.charisma} />
          </div>
        </section>

        <section className="gdSection">
          <h3 className="gdSectionTitle">兵・スタミナ・忠誠</h3>
          <div className="gdMiniGrid">
            <MiniStat label="兵数" value={`${general.troopCurrent.toLocaleString()} / ${general.troopMax.toLocaleString()}`} />
            <MiniStat label="スタミナ" value={`${general.stamina}`} />
            <MiniStat label="忠誠" value={`${general.loyalty}`} />
            {general.status === 'captured' && (
              <MiniStat label="拘束ターン" value={`${general.capturedTurns}`} />
            )}
          </div>
        </section>

        <section className="gdSection">
          <h3 className="gdSectionTitle">技</h3>
          {skills.length === 0 ? (
            <div className="muted">技なし</div>
          ) : (
            <ul className="gdSkillList">
              {skills.map((s, i) => (
                <li key={i} className="gdSkillRow">
                  <span className="gdSkillIcon">{i === 0 ? '⚔' : '✦'}</span>
                  <div className="gdSkillBody">
                    <div className="gdSkillName">
                      {s.name}
                      <span className="gdSkillCost">気{s.cost}</span>
                      <span className="gdSkillKind">{kindLabel(s.kind)}</span>
                    </div>
                    <div className="gdSkillDesc">{s.description}</div>
                    {s.cutInDialogue && (
                      <div className="gdSkillDialogue">「{s.cutInDialogue}」</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {general.remarks && (
          <section className="gdSection">
            <h3 className="gdSectionTitle">備考</h3>
            <div className="gdRemarks">{general.remarks}</div>
          </section>
        )}

        {/* 一応 state を参照（未使用警告抑止） */}
        <span style={{ display: 'none' }}>{state.turn}</span>
      </div>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="gdStat">
      <span className="gdStatLabel">{label}</span>
      <div className="gdStatBarOuter">
        <div className="gdStatBarFill" style={{ width: `${pct}%` }} />
      </div>
      <span className="gdStatValue">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="gdMiniStat">
      <span className="gdMiniLabel">{label}</span>
      <span className="gdMiniValue">{value}</span>
    </div>
  );
}

function kindLabel(kind: string): string {
  return ({
    attack: '単体攻撃',
    aoe: '範囲攻撃',
    support: '補助',
    heal: '回復',
    special: '特殊',
  } as Record<string, string>)[kind] ?? kind;
}
