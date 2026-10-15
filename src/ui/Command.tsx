// 国の命令：武将を5人まで選び、能力の合計で成し遂げる（足りない分は次へ持ち越す）
import { useMemo, useState } from 'react';
import { FACTIONS, regionDef } from '../content/sengoku';
import { LORD } from '../content/generals';
import type { Campaign, CommandId, Scene } from '../campaign/state';
import { COMMANDS, commandError, commandGenerals, commandKey, commandNeed, doCommand, genInfo, statOf } from '../campaign/campaign';
import { KINDS } from '../battle/kinds';
import { KindMark, Modal, tokenUrl } from './common';
import { playSe } from '../audio/sound';

const STAT_LABEL = { cmd: '統率', pow: '武力', int: '知略' } as const;

export function CommandPanel({ c, cmd, target, onDone, onClose }: { c: Campaign; cmd: CommandId; target: string; onDone: (text: string, scene?: Scene) => void; onClose: () => void }) {
  const def = COMMANDS[cmd];
  const list = useMemo(() => commandGenerals(c).sort((a, b) => statOf(c, b.id, def.stat) - statOf(c, a.id, def.stat)), [c, def.stat]);
  const [picked, setPicked] = useState<string[]>(() => list.slice(0, 5).map((g) => g.id));
  const need = commandNeed(c, cmd, target);
  const carried = c.progress[commandKey(cmd, target)] ?? 0;
  const sum = picked.reduce((s, id) => s + statOf(c, id, def.stat), 0) + carried;
  const err = commandError(c, cmd, target, picked);
  const toggle = (id: string) => {
    playSe('menu');
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 5 ? p : [...p, id]));
  };
  const what = cmd === 'persuade' ? genInfo(c, target).name : cmd === 'war' ? FACTIONS[c.regions[target].owner].name : regionDef(target).name;
  return (
    <Modal title={`${def.name}：${what}`} onClose={onClose} className="inventory command">
      <p className="note">{def.desc}{def.fan ? '（扇を1つ使う）' : '（扇を使わない）'}</p>
      <div className="cmd-meter">
        <div className="cm-bar">
          <span className="cm-carry" style={{ width: `${Math.min(100, (carried / need) * 100)}%` }} />
          <span className="cm-now" style={{ width: `${Math.min(100, (sum / need) * 100)}%` }} />
        </div>
        <b className={sum >= need ? 'ok' : ''}>{STAT_LABEL[def.stat]} {sum}/{need}</b>
        {carried > 0 && <small>（前回までの {carried} を含む）</small>}
      </div>
      <p className="note">{sum >= need ? '成し遂げられる。' : `足りない分（${need - sum}）は次の命令へ持ち越す。`}</p>
      <div className="gen-pick">
        {list.map((g) => {
          const info = genInfo(c, g.id);
          const on = picked.includes(g.id);
          return (
            <button key={g.id} className={`gen-card ${on ? 'on' : ''}`} onClick={() => toggle(g.id)}>
              <img src={tokenUrl(info.portrait)} alt="" width={36} height={36} />
              <span className="gc-main">
                <b>{info.name}</b> <small><KindMark kind={g.kind} size={13} /> {KINDS[g.kind].name}・Lv{g.lv}{g.id === LORD ? '・当主' : ''}</small>
              </span>
              <span className="check">{STAT_LABEL[def.stat]} {statOf(c, g.id, def.stat)}</span>
            </button>
          );
        })}
      </div>
      <div className="row-buttons">
        <button onClick={onClose}>やめる</button>
        <button className="primary" disabled={!!err} onClick={() => { playSe('coin'); const r = doCommand(c, cmd, target, picked); onDone(r.text, r.scene); }}>
          命令する{err ? <small>{err}</small> : null}
        </button>
      </div>
    </Modal>
  );
}
