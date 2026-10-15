// 冒険中の小さな画面：状態・マスの情報・値段の候補
import { itemDef, ITEMS } from '../content/items';
import { monDef, type Ability } from '../content/monsters';
import { TRAP_BY_ID } from '../content/world';
import { at, visibleFrom } from '../engine/geo';
import { buyPrice, charmIs, equipped, expFor, playerAttack, playerDefense, sealDesc, sealsOf, sellPrice, typeKnown } from '../engine/core';
import type { Item, Monster, Run } from '../engine/types';
import { skillDef } from '../content/skills';
import { FACTIONS } from '../content/sengoku';
import { monName } from '../engine/core';
import { tokenUrl } from '../render/sprites';
import { ItemIcon, Modal, MonsterIcon, itemLabel } from './common';

const ABILITY_TEXT: Record<Ability['k'], string> = {
  none: '', steal: '盗んで逃げる', confuse: '叩くと混乱させる', fire: '直線に火を放つ', stone: '遠くから石を投げる', arrow: '遠くから矢を射る', gun: '遠くから鉄砲を撃つ（撃ったら弾込め）', rust: '装備を錆びさせる',
  reach: '2マス先まで届く', explode: '弱ると爆発する', magic: '術を放つ', poison: '力を下げる', drain: 'レベルを下げる', blow: '吹き飛ばす',
  hunger: '満腹度を下げる', freeze: '眠らせる', double: '2回攻撃', regen: '傷がふさがる', boss: '配下を呼び、業火を吐く',
};

function statusText(m: Monster): string {
  const st = m.st;
  const out: string[] = [];
  if (!m.awake || st.sleep) out.push('眠り');
  if (st.confuse) out.push('混乱');
  if (st.paralyze) out.push('金縛り');
  if (st.slow) out.push('鈍足');
  if (st.fast) out.push('倍速');
  if (st.sealed) out.push('封印');
  if (st.guard) out.push('守り');
  if (st.power) out.push('攻め');
  if (st.invincible) out.push('無敵');
  if (m.turned) out.push('寝返り');
  if (st.decoy) out.push('身代わり');
  if (st.bond) out.push('痛み分け');
  if (m.ally) out.push('仲間');
  if (m.role === 'keeper' && m.angry) out.push('激怒');
  return out.join('・');
}

/** 迷宮のマスをタップした時の情報 */
export function TileInfo({ run, x, y, onClose }: { run: Run; x: number; y: number; onClose: () => void }) {
  const f = run.floor;
  const vis = visibleFrom(f, run.player.x, run.player.y);
  const seen = vis.has(at(f, x, y)) || charmIs(run, 'c_toushi') || !!f.clairvoyant;
  const m = seen ? run.monsters.find((o) => o.x === x && o.y === y && !o.dead) : undefined;
  const fi = seen ? f.items.find((o) => o.x === x && o.y === y) : undefined;
  const trap = f.traps.find((t) => t.x === x && t.y === y && (t.found || charmIs(run, 'c_wanami')));
  const stairs = f.stairs && f.stairs.x === x && f.stairs.y === y && f.seen[at(f, x, y)];
  const isPlayer = run.player.x === x && run.player.y === y;
  let body: React.ReactNode = <p className="empty">特に何もない。</p>;
  const g = m?.gen ? run.gens[m.gen] : null;
  if (m && g) {
    body = (
      <div className="book-detail">
        <img className="token-img" src={tokenUrl(g.portrait)} width={72} height={72} alt="" style={{ borderColor: m.ally ? '#c84a4a' : FACTIONS[g.faction]?.color }} />
        <div>
          <b>{g.name}</b> <small>Lv{g.lv}{m.ally ? '・味方' : m.gen === run.bossGen ? '・城主' : '・敵将'}</small>
          <div className="hp-bar small"><div className="hp-fill" style={{ width: `${Math.max(0, m.hp / m.maxHp) * 100}%` }} /></div>
          <p className="stats">HP {m.hp}/{m.maxHp}{statusText(m) ? `・${statusText(m)}` : ''}</p>
          <p className="stats">技：{g.skills.map((sid) => skillDef(sid).name).join('・')}</p>
          <p className="stats">{g.style === 'reach' ? '槍で2マス先まで届く。' : g.style === 'bow' ? '弓で離れた相手を射る。' : g.style === 'gun' ? '鉄砲で離れた相手を撃つ。' : '刀で斬りかかる。'}</p>
        </div>
      </div>
    );
  } else if (m && !m.disguise) {
    const def = monDef(m.id);
    const ability = m.st.sealed ? '（特技は封じられている）' : ABILITY_TEXT[def.ability.k];
    body = (
      <div className="book-detail">
        <MonsterIcon id={m.id} size={72} color={m.ally ? '#c84a4a' : FACTIONS[run.faction]?.color} />
        <div>
          <b>{monName(m)}</b>{def.spd > 0 && <small>（倍速）</small>}
          <div className="hp-bar small"><div className="hp-fill" style={{ width: `${Math.max(0, m.hp / m.maxHp) * 100}%` }} /></div>
          <p className="stats">HP {m.hp}/{m.maxHp}{statusText(m) ? `・${statusText(m)}` : ''}</p>
          {ability && <p>{ability}</p>}
          <p className="stats">{def.desc}</p>
        </div>
      </div>
    );
  } else if (fi || (m && m.disguise)) {
    const item = fi ? fi.item : ({ uid: -1, id: m!.disguise! } as Item);
    body = (
      <div className="book-detail">
        <ItemIcon id={item.id} size={56} />
        <div>
          <b>{itemLabel(run, item)}</b>
          {fi?.item.shop && <p className="price">店の品：{buyPrice(fi.item)}文</p>}
          {fi?.item.shop && <PriceHint run={run} item={fi.item} />}
        </div>
      </div>
    );
  } else if (trap) {
    body = <p><b>{TRAP_BY_ID[trap.id]?.name}</b>：{TRAP_BY_ID[trap.id]?.desc}</p>;
  } else if (stairs) {
    body = <p>次の階への階段。上に乗って「階段」で進む。</p>;
  } else if (isPlayer) {
    body = <p>朔が立っている。</p>;
  } else if (!seen) {
    body = <p className="empty">ここは見えていない。</p>;
  }
  return <Modal title="調べる" onClose={onClose}>{body}</Modal>;
}

/** 値段から正体の候補を出す（不思議のダンジョンの「値段識別」） */
export function priceCandidates(run: Run, item: Item, mode: 'buy' | 'sell'): string[] {
  const def = itemDef(item.id);
  if (typeKnown(run, item.id)) return [];
  const price = mode === 'buy' ? buyPrice(item) : sellPrice(item);
  return ITEMS.filter((d) => d.cat === def.cat && d.weight > 0).filter((d) => {
    const trial: Item = { ...item, id: d.id };
    if (d.cat === 'staff' && d.charges) {
      for (let c = 0; c <= 12; c++) {
        trial.charges = c;
        if ((mode === 'buy' ? buyPrice(trial) : sellPrice(trial)) === price) return true;
      }
      return false;
    }
    return (mode === 'buy' ? buyPrice(trial) : sellPrice(trial)) === price;
  }).map((d) => (run.known[d.id] ? `${d.name}（識別済み）` : d.name));
}

export function PriceHint({ run, item, mode = 'buy' }: { run: Run; item: Item; mode?: 'buy' | 'sell' }) {
  const list = priceCandidates(run, item, mode);
  if (!list.length) return null;
  return <p className="note">値段から見た候補：{list.join('・')}</p>;
}

/** 状態：強さ・装備・状態異常 */
export function StatusPanel({ run, onClose }: { run: Run; onClose: () => void }) {
  const p = run.player;
  const st = p.st;
  const conds: string[] = [];
  if (st.sleep) conds.push(`眠り（${st.sleep}）`);
  if (st.confuse) conds.push(`混乱（${st.confuse}）`);
  if (st.paralyze) conds.push(`金縛り（${st.paralyze}）`);
  if (st.slow) conds.push(`鈍足（${st.slow}）`);
  if (st.fast) conds.push(`倍速（${st.fast}）`);
  if (st.invincible) conds.push(`無敵（${st.invincible}）`);
  if (st.hidden) conds.push(`姿隠し（${st.hidden}）`);
  if (st.stuck) conds.push(`足止め（${st.stuck}）`);
  if (st.guard) conds.push(`守り（${st.guard}）`);
  if (st.power) conds.push(`攻め（${st.power}）`);
  const slots: ['weapon' | 'armor' | 'charm' | 'arrow', string][] = [['weapon', '武器'], ['armor', '防具'], ['charm', 'お守り'], ['arrow', '矢']];
  const allies = run.monsters.filter((m) => m.ally);
  const next = expFor(p.lv + 1);
  return (
    <Modal title="状態" onClose={onClose} className="inventory">
      <div className="record-grid">
        <div><small>レベル</small><b>{p.lv}</b><small>次まで {Math.max(0, next - p.exp)}</small></div>
        <div><small>攻撃力</small><b>{Math.round(playerAttack(run))}</b><small>力 {p.str}/{p.maxStr}</small></div>
        <div><small>防御力</small><b>{Math.round(playerDefense(run))}</b><small>満腹 {p.hunger}/{p.maxHunger}</small></div>
      </div>
      <h4>装備</h4>
      <div className="inv-list">
        {slots.map(([slot, label]) => {
          const item = equipped(run, slot);
          return (
            <div key={slot} className="inv-row static">
              <span className="cat-chip">{label}</span>
              {item ? <><ItemIcon id={item.id} size={26} /><span className="inv-name">{itemLabel(run, item)}<small className="sub">{sealsOf(item).map(sealDesc).join('／')}</small></span></> : <span className="inv-name sub">なし</span>}
            </div>
          );
        })}
      </div>
      <h4>状態</h4>
      <p>{conds.length ? conds.join('・') : 'ふつう'}{run.thief ? '・泥棒' : ''}</p>
      {allies.length > 0 && <><h4>部隊</h4>{allies.map((m) => <p key={m.uid}>{monName(m)}{m.gen ? ` Lv${run.gens[m.gen]?.lv}` : ''} HP {m.hp}/{m.maxHp}{statusText(m) ? `・${statusText(m)}` : ''}</p>)}</>}
      <p className="note">ターン {run.turn}・この階 {run.floor.turns}ターン・倒した敵 {run.stats.kills}・いちばん大きな一撃 {run.stats.maxHit ?? 0}</p>
    </Modal>
  );
}
