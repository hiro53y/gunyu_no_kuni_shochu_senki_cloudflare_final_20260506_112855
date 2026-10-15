// タイトルと、合戦の結果
import { useState } from 'react';
import { regionDef, turnLabel } from '../content/sengoku';
import { LORD } from '../content/generals';
import type { Campaign } from '../campaign/state';
import { genInfo, lordLv, ownedCount, type Report } from '../campaign/campaign';
import { bustUrl, tokenUrl } from './common';
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
        <p className="subtitle">― 国盗り合戦絵巻 ―</p>
        <div className="title-buttons">
          {c && (
            <button className="primary" onClick={click(props.onContinue)}>
              つづきから<small>{turnLabel(c.turn)}・{ownedCount(c)}国・朔 Lv{lordLv(c)}{props.running ? '・合戦中' : ''}{c.defeat ? '・落城' : ''}</small>
            </button>
          )}
          <button className={c ? '' : 'primary'} onClick={click(() => (c ? setConfirm(true) : props.onNew()))}>はじめから<small>暁ノ家の家督相続から</small></button>
          <div className="title-sub">
            <button onClick={click(props.onHelp)}>遊び方</button>
            <button onClick={click(props.onSettings)}>設定</button>
          </div>
        </div>
        <p className="credit">v4.1 ・ 八洲十五国を、六対六の合戦で切り取れ</p>
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
  const head = rep.kind === 'win' ? (rep.mode === 'defense' ? '撃退！' : rep.mode === 'hunt' ? '討ち払った！' : '勝利！') : '敗走……';
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
              const st = c.gens[id]?.status;
              return (
                <div key={id} className="rp-leader">
                  <img src={tokenUrl(info.portrait)} alt="" width={40} height={40} />
                  <span><b>{info.name}</b><small>{st === 'ours' ? '家臣になった' : st === 'jail' && !c.captives.includes(id) ? '牢へ入れた' : '捕らえた'}</small></span>
                </div>
              );
            })}
          </div>
        )}
        {rep.lines.map((t, i) => <p key={i} className="result-line">{t}</p>)}
        {rep.levelUps.length > 0 && <p className="result-line good">レベルが上がった：{rep.levelUps.join('、')}</p>}
        <div className="record-grid highlights">
          <div><small>朔</small><b>Lv{lordLv(c)}</b><small>兵 {(c.gens[LORD]?.troops ?? 0).toLocaleString()}</small></div>
          <div><small>文</small><b>{rep.gold.toLocaleString()}</b><small>得た</small></div>
          <div><small>失った兵</small><b>{rep.lost.toLocaleString()}</b><small>{rep.gained ? `勝って+${rep.gained.toLocaleString()}` : '城下で補充'}</small></div>
        </div>
        <button className="primary big" onClick={click(onBack)}>本陣へ戻る</button>
      </div>
    </div>
  );
}
