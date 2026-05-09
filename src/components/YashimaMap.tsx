// ===========================================================================
// 八洲マップSVG
// 15地域＋勢力カラー塗り分け＋隣接線＋家紋風アイコン＋選択ハイライト
// viewBox は 0 0 100 100、地域座標は data/regions.ts の mapX/mapY を使用。
// ===========================================================================

import { useMemo } from 'react';
import type { GameState, RegionId, FactionId } from '../types/game';
import { REGION_TEMPLATES } from '../data/regions';

interface Props {
  state: GameState;
  selectedId: RegionId | null;
  onSelect: (id: RegionId) => void;
}

const FACTION_CLASS: Record<FactionId, string> = {
  akatsuki: 'akatsuki', kurogane: 'kurogane', shion: 'shion', shirasagi: 'shirasagi',
  honoo: 'honoo', rengein: 'rengein', youma: 'youma', ronin: 'ronin',
};

/** 地形ごとの装飾アイコン（家紋風シルエット）— SVGパスかシンボル */
function terrainGlyph(terrain: string): string {
  switch (terrain) {
    case 'mountain': return '⛰';
    case 'mountain_temple': return '卍';
    case 'port':
    case 'coast':
    case 'islands': return '〜';
    case 'forest': return '森';
    case 'volcano': return '火';
    case 'snow': return '雪';
    case 'cursed': return '禍';
    case 'wasteland': return '荒';
    case 'pass': return '峠';
    case 'field': return '田';
    default: return '原';
  }
}

export function YashimaMap({ state, selectedId, onSelect }: Props) {
  // 隣接ペアのリスト（重複なし）
  const adjacencyPairs = useMemo(() => {
    const pairs: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const r of REGION_TEMPLATES) {
      for (const adj of r.adjacentIds) {
        const key = [r.id, adj].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([r.id, adj]);
        }
      }
    }
    return pairs;
  }, []);

  return (
    <svg
      className="yashimaMap"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="八洲全図"
    >
      {/* 背景：和紙風 */}
      <defs>
        <radialGradient id="paper-bg" cx="0.5" cy="0.5" r="0.8">
          <stop offset="0%" stopColor="#2A241C" />
          <stop offset="100%" stopColor="#14110F" />
        </radialGradient>
        <pattern id="paper-noise" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="transparent" />
          <circle cx="1" cy="1" r="0.25" fill="rgba(196,184,149,0.04)" />
          <circle cx="4" cy="3" r="0.18" fill="rgba(196,184,149,0.03)" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#paper-bg)" />
      <rect x="0" y="0" width="100" height="100" fill="url(#paper-noise)" />

      {/* 海原・空気感（緩い波線） */}
      <g opacity="0.18" stroke="rgba(124, 154, 174, 0.5)" strokeWidth="0.15" fill="none">
        <path d="M2 90 Q12 88 22 90 T42 90 T62 90 T82 90 T102 90" />
        <path d="M0 94 Q15 92 30 94 T60 94 T90 94" />
        <path d="M0 6 Q20 4 40 6 T80 6 T100 6" />
      </g>

      {/* 隣接線 */}
      {adjacencyPairs.map(([a, b]) => {
        const ra = REGION_TEMPLATES.find((r) => r.id === a);
        const rb = REGION_TEMPLATES.find((r) => r.id === b);
        if (!ra || !rb) return null;
        return (
          <line
            key={`adj-${a}-${b}`}
            className="adj-line"
            x1={ra.mapX} y1={ra.mapY}
            x2={rb.mapX} y2={rb.mapY}
          />
        );
      })}

      {/* 地域 */}
      {REGION_TEMPLATES.map((tmpl) => {
        const region = state.regions[tmpl.id];
        if (!region) return null;
        const fid = region.factionId;
        const cls = fid ? FACTION_CLASS[fid] : 'neutral';
        const isSelected = selectedId === tmpl.id;

        // 地域の中心
        const cx = tmpl.mapX;
        const cy = tmpl.mapY;

        // 不規則な多角形（地域形状）— 中心から放射状に半径をランダム化
        // 確定的にしたいので、tmpl.id 由来のシード擬似で固定
        const seedNum = parseInt(tmpl.id, 10) * 17 + 31;
        const points = Array.from({ length: 8 }).map((_, i) => {
          const ang = (i / 8) * Math.PI * 2;
          const wobble = ((seedNum * (i + 1)) % 100) / 100; // 0..1
          const r = 5.2 + wobble * 1.6;
          return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.85];
        });
        const path = `M ${points.map((p) => p.join(',')).join(' L ')} Z`;

        // プレイヤーが調略を進めている場合のマーカー
        const scoutPct = region.scoutProgress.akatsuki ?? 0;

        return (
          <g key={tmpl.id} onClick={() => onSelect(tmpl.id)} style={{ cursor: 'pointer' }}>
            <path
              className={`region-shape ${cls} ${isSelected ? 'selected' : ''}`}
              d={path}
              stroke="rgba(20,17,15,0.6)"
              strokeWidth="0.4"
              fillOpacity="0.85"
            />
            {/* 国力ドット */}
            <text className="region-power" x={cx} y={cy - 4.5}>
              ◆×{region.power}
            </text>
            {/* 地域名 */}
            <text className="region-text" x={cx} y={cy - 1.4}>
              {tmpl.name}
            </text>
            {/* 地形グリフ */}
            <text className="region-text" x={cx} y={cy + 2.2} style={{ fontSize: 2.8, opacity: 0.65 }}>
              {terrainGlyph(tmpl.terrain)}
            </text>
            {/* 調略進捗マーカー */}
            {scoutPct > 0 && fid !== 'akatsuki' && (
              <circle cx={cx + 5} cy={cy - 4} r="1.2" fill="var(--c-shu)" stroke="var(--c-sumi)" strokeWidth="0.2" />
            )}
          </g>
        );
      })}

      {/* マップタイトル（左下） */}
      <text x="3" y="97" fill="var(--c-kinari-d)" fontFamily="var(--font-fude)" fontSize="3" letterSpacing="0.5" opacity="0.55">
        八洲全図
      </text>
      <text x="97" y="97" fill="var(--c-kinari-d)" fontFamily="var(--font-mincho)" fontSize="2" textAnchor="end" opacity="0.5">
        群雄ノ國・掌中戦記
      </text>
    </svg>
  );
}
