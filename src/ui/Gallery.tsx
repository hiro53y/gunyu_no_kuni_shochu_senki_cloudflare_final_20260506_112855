// 開発用：すべての絵を並べて確認する（?gallery で開く。本番のビルドには入らない）
import { MONSTERS } from '../content/monsters';
import { ITEMS } from '../content/items';
import { TRAPS } from '../content/world';
import { itemSprite, monsterSprite, PORTRAITS, tokenSprite, trapSprite } from '../render/sprites';
import { BANDS } from '../content/world';
import { FACTIONS } from '../content/sengoku';
import { floorTile, liquidTile, wallTile } from '../render/tiles';

function Cell({ canvas, label }: { canvas: HTMLCanvasElement | null; label: string }) {
  return (
    <div style={{ width: 76, textAlign: 'center', fontSize: 10 }}>
      {canvas && <img src={canvas.toDataURL()} width={68} height={68} alt="" />}
      <div>{label}</div>
    </div>
  );
}

export default function Gallery() {
  const cats = [...new Set(ITEMS.map((i) => i.cat))];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8, background: '#3a3a3a', minHeight: '100%' }}>
      {PORTRAITS.map((p) => <Cell key={p} canvas={tokenSprite(p, '#c84a4a', 'ally')} label={p} />)}
      {Object.values(FACTIONS).map((f) => MONSTERS.filter((m) => m.soldier).map((m) => <Cell key={`${f.id}${m.id}`} canvas={monsterSprite(m.id, f.color, f.mon)} label={`${f.mon}${m.name}`} />))}
      {MONSTERS.filter((m) => !m.soldier).map((m) => <Cell key={m.id} canvas={monsterSprite(m.id)} label={m.name} />)}
      {cats.map((c) => { const d = ITEMS.find((i) => i.cat === c)!; return <Cell key={c} canvas={itemSprite(d.id)} label={d.name} />; })}
      {TRAPS.map((t) => <Cell key={t.id} canvas={trapSprite(t.id)} label={t.name} />)}
      {BANDS.map((band, b) => <Cell key={`f${b}`} canvas={floorTile(b, b % 4)} label={`床 ${band.name}`} />)}
      {BANDS.map((band, b) => <Cell key={`w${b}`} canvas={wallTile(b, true, 0)} label={`壁 ${band.name}`} />)}
      <Cell canvas={liquidTile('water', 0)} label="水" />
      <Cell canvas={liquidTile('lava', 0)} label="溶岩" />
    </div>
  );
}
