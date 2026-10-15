// ===========================================================================
// 必殺技カットイン演出
// 武将立ち絵が画面サイドからスライドイン、台詞ウィンドウが下から立ち上がる。
// 0.8秒で自動消滅。
// ===========================================================================

import { useEffect, useState } from 'react';
import type { General } from '../types/game';
import { GeneralPortrait } from './GeneralPortrait';

interface Props {
  general: General;
  skillName: string;
  dialogue?: string;
  side: 'player' | 'enemy';
  onComplete: () => void;
}

export function BattleCutIn({ general, skillName, dialogue, side, onComplete }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'leave'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 200);
    const t2 = setTimeout(() => setPhase('leave'), 1300);
    const t3 = setTimeout(() => onComplete(), 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className={`cutinOverlay phase-${phase} side-${side}`}>
      <div className="cutinFrame">
        <div className="cutinPortrait">
          <GeneralPortrait general={general} size={120} showLabel={false} />
        </div>
        <div className="cutinSlash" aria-hidden="true" />
        <div className="cutinInfo">
          <div className="cutinName">{general.name}</div>
          <div className="cutinSkill">▶ {skillName}</div>
          {dialogue && <div className="cutinDialogue">「{dialogue}」</div>}
        </div>
      </div>
    </div>
  );
}
