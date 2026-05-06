interface TutorialOverlayProps {
  onClose: () => void;
}

export function TutorialOverlay({ onClose }: TutorialOverlayProps) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <section className="tutorialModal">
        <p className="eyebrow">初回指南</p>
        <h2 id="tutorial-title">八州統一への流れ</h2>
        <ol>
          <li>まず地図タブで地域を選ぶ。</li>
          <li>内政で石高、治安、城を整える。</li>
          <li>徴兵と訓練で戦力を増やす。</li>
          <li>隣接する敵地域へ進軍する。</li>
          <li>8地域を支配すれば勝利。</li>
        </ol>
        <button className="primaryButton" onClick={onClose} type="button">
          はじめる
        </button>
      </section>
    </div>
  );
}
