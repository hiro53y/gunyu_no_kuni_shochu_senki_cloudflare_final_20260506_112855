// ===========================================================================
// 八洲マップSVG
// 古地図・軍略図として見えるよう、和紙背景、街道、地形別拠点札、
// 選択/隣接/侵攻可能状態を軽量SVGで表現する。
// ===========================================================================

import { useMemo } from 'react';
import type { GameState, RegionId, FactionId, Terrain } from '../types/game';
import { REGION_TEMPLATES } from '../data/regions';
import { createBattleForecast, getDeployableGenerals } from '../engine/battleIntel';

interface Props {
  state: GameState;
  selectedId: RegionId | null;
  onSelect: (id: RegionId) => void;
}

const FACTION_CLASS: Record<FactionId, string> = {
  akatsuki: 'akatsuki', kurogane: 'kurogane', shion: 'shion', shirasagi: 'shirasagi',
  honoo: 'honoo', rengein: 'rengein', youma: 'youma', ronin: 'ronin',
};

const HOME_REGION: Partial<Record<FactionId, RegionId>> = {
  akatsuki: '01',
  kurogane: '02',
  shion: '05',
  shirasagi: '08',
  honoo: '10',
  rengein: '12',
  youma: '13',
  ronin: '15',
};

const MAP_LAYOUT: Record<RegionId, { x: number; y: number }> = {
  '01': { x: 51, y: 55 },
  '02': { x: 76, y: 45 },
  '03': { x: 76, y: 60 },
  '04': { x: 62, y: 30 },
  '05': { x: 59, y: 78 },
  '06': { x: 47, y: 68 },
  '07': { x: 35, y: 86 },
  '08': { x: 22, y: 36 },
  '09': { x: 34, y: 19 },
  '10': { x: 57, y: 13 },
  '11': { x: 31, y: 53 },
  '12': { x: 21, y: 69 },
  '13': { x: 42, y: 42 },
  '14': { x: 74, y: 20 },
  '15': { x: 16, y: 88 },
};

const TERRAIN_LABEL: Record<Terrain, string> = {
  plain: '田',
  mountain: '山',
  port: '港',
  pass: '峠',
  field: '畑',
  coast: '汐',
  snow: '雪',
  volcano: '火',
  forest: '森',
  mountain_temple: '寺',
  cursed: '禍',
  wasteland: '荒',
  islands: '島',
};

function terrainClass(terrain: Terrain): string {
  return `terrain-${terrain.replace('_', '-')}`;
}

function terrainIcon(terrain: Terrain, cx: number, cy: number) {
  switch (terrain) {
    case 'mountain':
    case 'mountain_temple':
    case 'pass':
      return (
        <g className="terrainMini mountainMini" transform={`translate(${cx - 6} ${cy + 1})`}>
          <path d="M0 8 L5 0 L10 8 Z M7 8 L12 3 L17 8 Z" />
          {terrain === 'pass' && <path d="M4 8 C7 5 10 5 13 8" className="terrainStroke" />}
        </g>
      );
    case 'port':
    case 'coast':
    case 'islands':
      return (
        <g className="terrainMini waterMini" transform={`translate(${cx - 7} ${cy + 3})`}>
          <path d="M0 2 Q3 0 6 2 T12 2 T18 2" />
          <path d="M1 5 Q4 3 7 5 T13 5 T18 5" />
        </g>
      );
    case 'forest':
      return (
        <g className="terrainMini forestMini" transform={`translate(${cx - 6} ${cy + 1})`}>
          <path d="M2 8 L5 1 L8 8 Z M7 8 L10 0 L13 8 Z" />
        </g>
      );
    case 'volcano':
      return (
        <g className="terrainMini volcanoMini" transform={`translate(${cx - 5} ${cy + 1})`}>
          <path d="M0 8 L5 0 L10 8 Z" />
          <path d="M4 0 L3 4 L7 4 L6 0 Z" className="terrainFlame" />
        </g>
      );
    case 'snow':
      return <text className="terrainGlyph snowGlyph" x={cx} y={cy + 8}>雪</text>;
    case 'cursed':
      return <text className="terrainGlyph cursedGlyph" x={cx} y={cy + 8}>禍</text>;
    case 'wasteland':
      return (
        <g className="terrainMini wasteMini" transform={`translate(${cx - 7} ${cy + 4})`}>
          <path d="M0 4 L6 1 L12 5 L18 2" />
          <path d="M4 7 L9 5 L15 7" />
        </g>
      );
    default:
      return (
        <g className="terrainMini fieldMini" transform={`translate(${cx - 7} ${cy + 2})`}>
          <path d="M0 2 H18 M0 5 H18 M3 0 V7 M9 0 V7 M15 0 V7" />
        </g>
      );
  }
}

function roadPath(ax: number, ay: number, bx: number, by: number, seed: number): string {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.max(1, Math.hypot(dx, dy));
  const bend = ((seed % 7) - 3) * 0.55;
  const cx = mx - (dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
}

function mapPoint(id: RegionId): { x: number; y: number } {
  return MAP_LAYOUT[id];
}

export function YashimaMap({ state, selectedId, onSelect }: Props) {
  const deployable = useMemo(() => getDeployableGenerals(state).slice(0, 3), [state]);
  const templateById = useMemo(() => new Map(REGION_TEMPLATES.map((r) => [r.id, r])), []);
  const playerRegions = useMemo(
    () => new Set(Object.values(state.regions).filter((r) => r.factionId === 'akatsuki').map((r) => r.id)),
    [state.regions],
  );
  const selectedRegion = selectedId ? state.regions[selectedId] : null;
  const selectedAdj = useMemo(() => new Set(selectedRegion?.adjacentIds ?? []), [selectedRegion]);
  const reachableRegions = useMemo(() => {
    const ids = new Set<RegionId>();
    for (const region of Object.values(state.regions)) {
      if (region.factionId !== 'akatsuki') continue;
      for (const adjacentId of region.adjacentIds) {
        const adjacent = state.regions[adjacentId];
        if (adjacent && adjacent.factionId !== 'akatsuki') ids.add(adjacent.id);
      }
    }
    return ids;
  }, [state.regions]);

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

  function isAttackable(regionId: RegionId): boolean {
    const region = state.regions[regionId];
    if (!region || region.factionId === 'akatsuki') return false;
    return region.adjacentIds.some((id) => playerRegions.has(id));
  }

  return (
    <svg
      className="yashimaMap strategyMap"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="八洲軍略図"
    >
      <defs>
        <radialGradient id="paper-bg" cx="0.5" cy="0.45" r="0.82">
          <stop offset="0%" stopColor="#3A3024" />
          <stop offset="55%" stopColor="#211B16" />
          <stop offset="100%" stopColor="#0D0B0A" />
        </radialGradient>
        <pattern id="paper-noise" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="transparent" />
          <circle cx="0.7" cy="0.8" r="0.12" fill="#D4BE88" opacity="0.18" />
          <circle cx="2.8" cy="1.9" r="0.10" fill="#000" opacity="0.16" />
          <path d="M0 3.7 C1.5 3.2 2.5 4.2 4 3.5" stroke="#C9A24A" strokeWidth="0.05" opacity="0.14" />
        </pattern>
        <filter id="ink-wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="12" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.25" />
        </filter>
        <filter id="marker-glow">
          <feGaussianBlur stdDeviation="1.15" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="road-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5A432C" />
          <stop offset="50%" stopColor="#C9A24A" />
          <stop offset="100%" stopColor="#5A432C" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="100" height="100" fill="url(#paper-bg)" />
      <rect x="0" y="0" width="100" height="100" fill="url(#paper-noise)" />
      <g className="mapLandMass">
        <path d="M33 8 C47 3 66 5 77 18 C89 31 88 54 78 70 C67 88 45 96 27 90 C12 85 6 70 12 54 C17 39 18 18 33 8 Z" />
        <path d="M70 20 C78 23 84 31 85 41 C80 37 76 33 70 34 Z" />
        <path d="M12 78 C18 76 25 80 27 88 C20 87 15 84 12 78 Z" />
      </g>

      <g className="mapInkLines">
        <path d="M4 15 C16 10 26 14 36 10 S61 7 73 12 S90 13 97 9" />
        <path d="M2 83 C18 78 31 82 45 79 S75 73 97 78" />
        <path d="M8 34 C22 29 39 33 49 28 S74 24 91 31" />
        <path d="M11 57 C26 53 37 61 51 56 S74 50 90 55" />
      </g>

      <g className="roadLayer">
        {adjacencyPairs.map(([a, b]) => {
          const ra = templateById.get(a);
          const rb = templateById.get(b);
          if (!ra || !rb) return null;
          const selectedRoad = selectedId === a || selectedId === b;
          const pa = mapPoint(a as RegionId);
          const pb = mapPoint(b as RegionId);
          return (
            <path
              key={`road-${a}-${b}`}
              className={`strategyRoad ${selectedRoad ? 'selected' : ''}`}
              d={roadPath(pa.x, pa.y, pb.x, pb.y, Number(a) * 11 + Number(b) * 17)}
            />
          );
        })}
      </g>

      <g className="mapRegionLayer">
        {REGION_TEMPLATES.map((tmpl, index) => {
          const region = state.regions[tmpl.id];
          if (!region) return null;
          const fid = region.factionId;
          const cls = fid ? FACTION_CLASS[fid] : 'neutral';
          const isSelected = selectedId === tmpl.id;
          const adjacent = selectedAdj.has(tmpl.id);
          const attackable = isAttackable(tmpl.id);
          const reachable = reachableRegions.has(tmpl.id);
          const forecast = attackable ? createBattleForecast(state, tmpl.id, deployable) : null;
          const riskClass = forecast?.recommendation === 'high'
            ? 'risk-low'
            : forecast?.recommendation === 'medium'
              ? 'risk-mid'
              : forecast?.recommendation === 'low'
                ? 'risk-high'
                : '';
          const isHome = fid && HOME_REGION[fid] === tmpl.id;
          const isPlayerHome = isHome && fid === 'akatsuki';
          const isEnemyHome = isHome && fid !== 'akatsuki';
          const { x: cx, y: cy } = mapPoint(tmpl.id);
          const width = tmpl.name.length >= 4 ? 15 : 13.2;
          const height = 10.5;
          const danger = fid && fid !== 'akatsuki' ? Math.min(9, region.power + (attackable ? 2 : 0)) : region.power;
          const isDimmed = !isSelected && fid !== 'akatsuki' && !reachable;
          const infoLabel = fid === 'akatsuki'
            ? `${TERRAIN_LABEL[region.terrain]} / 自領`
            : reachable
              ? `${TERRAIN_LABEL[region.terrain]} / 進軍可`
              : `${TERRAIN_LABEL[region.terrain]} / 危${danger}`;

          return (
            <g
              key={tmpl.id}
              className={[
                'mapNode',
                cls,
                terrainClass(region.terrain),
                isSelected && 'selected',
                adjacent && 'adjacent',
                attackable && 'attackable',
                reachable && 'reachable',
                isDimmed && 'unreachable',
                riskClass,
                isPlayerHome && 'playerHome',
                isEnemyHome && 'enemyHome',
              ].filter(Boolean).join(' ')}
              transform={`translate(${cx} ${cy})`}
              style={{ cursor: 'pointer', animationDelay: `${index * 45}ms` }}
              onClick={() => onSelect(tmpl.id)}
            >
              <ellipse className="nodeShadow" cx="0" cy="4.8" rx={width * 0.56} ry="2.6" />
              {isHome && <circle className="homeAura" cx="0" cy="0" r={width * 0.72} />}
              <path
                className="nodeBanner"
                d={`M ${-width / 2} ${-height / 2 + 1}
                    Q ${-width / 2 + 1} ${-height / 2 - 1} ${-width / 2 + 3} ${-height / 2}
                    L ${width / 2 - 2} ${-height / 2}
                    Q ${width / 2 + 1} ${-height / 2 + 1} ${width / 2} ${-height / 2 + 3}
                    L ${width / 2 - 1} ${height / 2 - 1}
                    Q ${width / 2 - 2} ${height / 2 + 1} ${width / 2 - 4} ${height / 2}
                    L ${-width / 2 + 2} ${height / 2}
                    Q ${-width / 2 - 1} ${height / 2 - 1} ${-width / 2} ${height / 2 - 3} Z`}
              />
              <path className="nodeInnerLine" d={`M ${-width / 2 + 1.4} ${1.1} L ${width / 2 - 1.4} ${1.1}`} />
              {isSelected && <circle className="selectedBeacon" cx="0" cy="0" r={width * 0.72} />}
              {terrainIcon(region.terrain, 0, -0.2)}
              <text className="nodeName" x="0" y="-1.8">{tmpl.name}</text>
              <text className="nodeInfo" x="0" y="4.4">{infoLabel}</text>
              {attackable && <path className="attackRune" d={`M ${width / 2 - 3} ${-height / 2 + 1} L ${width / 2 - 0.6} ${-height / 2 + 3.4} L ${width / 2 - 3} ${-height / 2 + 5.8}`} />}
              {region.scoutProgress.akatsuki ? (
                <circle className="scoutDot" cx={width / 2 - 1.6} cy={height / 2 - 1.5} r="1.1" />
              ) : null}
            </g>
          );
        })}
      </g>

      <g className="mapLegend">
        <path d="M3 91 H26 V98 H3 Z" />
        <text x="5" y="95">八洲軍略図</text>
      </g>
      <text className="mapSeal" x="96" y="96" textAnchor="end">掌中戦記</text>
    </svg>
  );
}
