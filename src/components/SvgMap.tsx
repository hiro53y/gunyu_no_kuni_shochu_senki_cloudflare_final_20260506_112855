import { PLAYER_FACTION_ID } from '../data/names';
import { estimateRegionDefense } from '../engine/selectors';
import type { GameState, Region } from '../types/game';

interface SvgMapProps {
  state: GameState;
  onSelectRegion: (regionId: string) => void;
}

// セルサイズ（SVG単位）
const CW = 72;
const CH = 60;
const PAD = 6;

// グリッド範囲
const COLS = 3;  // x: 0..2
const ROWS = 5;  // y: 0..4

const VW = COLS * CW + PAD * 2;
const VH = ROWS * CH + PAD * 2;

function cellX(mapX: number) { return PAD + mapX * CW; }
function cellY(mapY: number) { return PAD + mapY * CH; }

// 地形アイコン
const terrainIcon: Record<string, string> = {
  plain:    '⊕',
  mountain: '▲',
  forest:   '♣',
  river:    '〜',
  coast:    '≈',
};

// 脅威ラベル（プレイヤー視点）
function getDangerLabel(state: GameState, region: Region): { label: string; color: string } {
  if (region.ownerFactionId === PLAYER_FACTION_ID) {
    const onBorder = region.neighbors.some(
      (nid) => state.regions[nid]?.ownerFactionId !== PLAYER_FACTION_ID,
    );
    return onBorder
      ? { label: '国境', color: '#e8c560' }
      : { label: '後方', color: '#6a9e80' };
  }
  const def = estimateRegionDefense(state, region.id);
  if (def < 950)  return { label: '好機', color: '#d84c36' };
  if (def < 1400) return { label: '互角', color: '#d8c036' };
  return { label: '危険', color: '#8880ff' };
}

// 色を暗くする（選択外の不透明度で代替）
function factionFill(color: string, isSelected: boolean): string {
  return isSelected ? color : color;
}

// 隣接線（重複を避けるためregionId辞書順で一方向のみ描画）
function buildEdges(regions: Region[]): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const seen = new Set<string>();
  const regionMap: Record<string, Region> = {};
  regions.forEach((r) => { regionMap[r.id] = r; });

  regions.forEach((r) => {
    r.neighbors.forEach((nid) => {
      const key = [r.id, nid].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      const n = regionMap[nid];
      if (!n) return;
      edges.push({
        x1: cellX(r.mapX) + CW / 2,
        y1: cellY(r.mapY) + CH / 2,
        x2: cellX(n.mapX) + CW / 2,
        y2: cellY(n.mapY) + CH / 2,
      });
    });
  });
  return edges;
}

export function SvgMap({ state, onSelectRegion }: SvgMapProps) {
  const regions = Object.values(state.regions);
  const edges = buildEdges(regions);

  return (
    <div className="svgMapWrap">
      <svg viewBox={`0 0 ${VW} ${VH}`} xmlns="http://www.w3.org/2000/svg">
        {/* 背景 */}
        <rect width={VW} height={VH} fill="#060810" />

        {/* グリッド薄線 */}
        {Array.from({ length: COLS + 1 }).map((_, i) => (
          <line
            key={`vl${i}`}
            x1={PAD + i * CW} y1={PAD}
            x2={PAD + i * CW} y2={VH - PAD}
            stroke="rgba(180,140,55,0.06)" strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: ROWS + 1 }).map((_, i) => (
          <line
            key={`hl${i}`}
            x1={PAD} y1={PAD + i * CH}
            x2={VW - PAD} y2={PAD + i * CH}
            stroke="rgba(180,140,55,0.06)" strokeWidth="0.5"
          />
        ))}

        {/* 隣接線 */}
        {edges.map((e, i) => (
          <line
            key={`edge${i}`}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="rgba(180,140,55,0.22)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ))}

        {/* 地域セル */}
        {regions.map((region) => {
          const faction = state.factions[region.ownerFactionId];
          const selected = state.selectedRegionId === region.id;
          const isPlayer = region.ownerFactionId === PLAYER_FACTION_ID;
          const danger = getDangerLabel(state, region);
          const x = cellX(region.mapX);
          const y = cellY(region.mapY);
          const cx = x + CW / 2;
          const cy = y + CH / 2;
          const factionColor = faction?.color ?? '#666';

          // 城HPの割合
          const hpRatio = region.castleHp / region.maxCastleHp;

          return (
            <g
              key={region.id}
              onClick={() => onSelectRegion(region.id)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={`${region.name}（${faction?.name}）`}
            >
              {/* セル背景 */}
              <rect
                x={x + 2} y={y + 2}
                width={CW - 4} height={CH - 4}
                rx={5} ry={5}
                fill={factionColor}
                fillOpacity={selected ? 0.28 : isPlayer ? 0.22 : 0.16}
                stroke={selected ? factionColor : 'rgba(180,140,55,0.18)'}
                strokeWidth={selected ? 1.5 : 0.8}
              />

              {/* 選択時：ゴールドグロー枠 */}
              {selected && (
                <rect
                  x={x + 2} y={y + 2}
                  width={CW - 4} height={CH - 4}
                  rx={5} ry={5}
                  fill="none"
                  stroke="rgba(242,209,107,0.8)"
                  strokeWidth="1.5"
                />
              )}

              {/* 上部：勢力色ライン */}
              <rect
                x={x + 2} y={y + 2}
                width={CW - 4} height={4}
                rx={3} ry={3}
                fill={factionColor}
                fillOpacity={0.7}
              />

              {/* 地域名 */}
              <text
                x={cx} y={y + 22}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#f0e8d5"
                fontFamily="'Noto Serif JP', serif"
              >
                {region.name}
              </text>

              {/* 勢力名 */}
              <text
                x={cx} y={y + 33}
                textAnchor="middle"
                fontSize="7.5"
                fill="rgba(200,190,170,0.8)"
              >
                {faction?.name}
              </text>

              {/* 城HPバー */}
              <rect
                x={x + 8} y={y + CH - 12}
                width={CW - 16} height={3}
                rx={1.5}
                fill="rgba(255,255,255,0.08)"
              />
              <rect
                x={x + 8} y={y + CH - 12}
                width={(CW - 16) * Math.min(hpRatio, 1)}
                height={3}
                rx={1.5}
                fill={hpRatio > 0.6 ? '#5a9e72' : hpRatio > 0.3 ? '#c9972b' : '#d84c36'}
              />

              {/* 兵力＋地形 */}
              <text
                x={x + 8} y={y + CH - 15}
                fontSize="7"
                fill="rgba(180,160,120,0.8)"
              >
                {terrainIcon[region.terrain]}
              </text>
              <text
                x={cx + 4} y={y + CH - 15}
                textAnchor="middle"
                fontSize="7"
                fill="rgba(180,160,120,0.7)"
              >
                {region.localTroops}
              </text>

              {/* 脅威ラベル */}
              <text
                x={x + CW - 6} y={y + 22}
                textAnchor="end"
                fontSize="7"
                fontWeight="700"
                fill={danger.color}
              >
                {danger.label}
              </text>
            </g>
          );
        })}

        {/* 空きセル（地域なし）のうっすら表示 */}
        {/* — 不要 — */}
      </svg>
    </div>
  );
}
