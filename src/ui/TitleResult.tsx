// タイトルと、戦の結果
import { useState } from 'react';
import { regionDef, turnLabel } from '../content/sengoku';
import type { Campaign } from '../campaign/state';
import { genInfo, ownedCount, type Report } from '../campaign/campaign';
import { bustUrl, tokenUrl } from '../render/sprites';
import { Modal, click } from './common';

export function TitleScreen(props: { c: Campaign | null; running: boolean; onContinue: () => void; onNew: () => void; onHelp: () => void; onSettings: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const c = props.c;
  return (
    <div className="title-screen sengoku">
      <img className="title-bust" src={bustUrl('akatsuki_saku')} alt="" />
      <div className="title-shade" />
      <div className="title-content">
        <h1 className="logo">群雄ノ國<span>掌中戦記</span></h1>
        <p className="subtitle">― 国盗り迷宮絵巻 ―</p>
        <div className="title-buttons">
          {c && (
            <button className="primary" onClick={click(props.onContinue)}>
              つづきから<small>{turnLabel(c.turn)}・{ownedCount(c)}国・朔 Lv{c.lord.lv}{props.running ? '・出陣中' : ''}{c.defeat ? '・落城' : ''}</small>
            </button>
          )}
          <button className={c ? '' : 'primary'} onClick={click(() => (c ? setConfirm(true) : props.onNew()))}>はじめから<small>暁ノ家の家督相続から</small></button>
          <div className="title-sub">
            <button onClick={click(props.onHelp)}>遊び方</button>
            <button onClick={click(props.onSettings)}>設定</button>
          </div>
        </div>
        <p className="credit">v3.0 ・ 八洲十五国を、迷宮の城から攻め落とせ</p>
      </div>
      {confirm && (
        <Modal title="はじめから遊びますか？" onClose={() => setConfirm(false)}>
          <p>今の国盗りの記録は消えます。</p>
          <div className="row-buttons">
            <button onClick={() => setConfirm(false)}>やめる</button>
            <button className="danger" onClick={() => { setConfirm(false); props.onNew(); }}>はじめから</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ResultScreen({ c, rep, onBack }: { c: Campaign; rep: Report; onBack: () => void }) {
  const r = regionDef(rep.region);
  const head = rep.kind === 'win' ? (rep.mode === 'siege' ? '落城！' : rep.mode === 'defense' ? '撃退！' : '祓い清めた！') : rep.kind === 'retreat' ? '撤退' : '敗走……';
  return (
    <div className={`result-screen ${rep.kind}`}>
      <div className="result-card">
        <p className="mode">{turnLabel(c.turn)}・{r.name}</p>
        <h1>{head}</h1>
        <p className="where">{rep.title}</p>
        {rep.captured.length > 0 && (
          <div className="captured-list">
            {rep.captured.map((id) => {
              const info = genInfo(c, id);
              return (
                <div key={id} className="rp-leader">
                  <img src={tokenUrl(info.portrait)} alt="" width={40} height={40} />
                  <span><b>{info.name}</b><small>{c.gens[id].status === 'gone' ? '討ち取った' : '捕らえた'}</small></span>
                </div>
              );
            })}
          </div>
        )}
        {rep.lines.map((t, i) => <p key={i} className="result-line">{t}</p>)}
        <div className="record-grid highlights">
          <div><small>朔</small><b>Lv{c.lord.lv}</b><small>HP {c.lord.maxHp}</small></div>
          <div><small>文</small><b>{rep.gold.toLocaleString()}</b><small>持ち帰り</small></div>
          <div><small>道具</small><b>{rep.items}</b><small>{rep.lostItems ? `${rep.lostItems}個失った` : '蔵へ'}</small></div>
        </div>
        <button className="primary big" onClick={click(onBack)}>本陣へ戻る</button>
      </div>
    </div>
  );
}
