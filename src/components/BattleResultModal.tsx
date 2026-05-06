import type { BattleResult } from '../types/game';

interface BattleResultModalProps {
  result: BattleResult | null;
  onClose: () => void;
}

export function BattleResultModal({ result, onClose }: BattleResultModalProps) {
  if (!result) {
    return null;
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="battle-title">
      <section className={`battleModal ${result.conquered ? 'isWin' : 'isHold'}`}>
        <p className="eyebrow">戦闘結果</p>
        <h2 id="battle-title">{result.targetRegionName}</h2>
        <div className="battleBanner">{result.conquered ? '制圧成功' : '撃退'}</div>
        <dl className="battleStats">
          <div>
            <dt>攻撃</dt>
            <dd>{result.attackerPower}</dd>
          </div>
          <div>
            <dt>防御</dt>
            <dd>{result.defenderPower}</dd>
          </div>
          <div>
            <dt>味方損害</dt>
            <dd>{result.attackerLosses}</dd>
          </div>
          <div>
            <dt>敵損害</dt>
            <dd>{result.defenderLosses}</dd>
          </div>
          <div>
            <dt>城耐久</dt>
            <dd>
              {result.castleHpBefore} → {result.castleHpAfter}
            </dd>
          </div>
        </dl>
        {result.activatedSkills.length > 0 && (
          <div className="skillList">
            {result.activatedSkills.map((skill, index) => (
              <span key={`${skill}_${index}`}>{skill}</span>
            ))}
          </div>
        )}
        <p className="hintText">{result.hint}</p>
        <button className="primaryButton" onClick={onClose} type="button">
          閉じる
        </button>
      </section>
    </div>
  );
}
