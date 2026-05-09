// ===========================================================================
// 武将立ち絵プレースホルダ（A方針）
// SVG で勢力カラー＋名前の頭文字＋家紋シルエットを描く。
// portraitKey を override して将来 B方針の実画像と差し替え可能な構造。
// ===========================================================================

import type { General, FactionId } from '../types/game';

interface Props {
  general: General;
  size?: number; // px。bust-up時の横幅
  showLabel?: boolean;
  selected?: boolean;
}

const FACTION_COLOR: Record<FactionId, string> = {
  akatsuki:  'var(--f-akatsuki)',
  kurogane:  'var(--f-kurogane)',
  shion:     'var(--f-shion)',
  shirasagi: 'var(--f-shirasagi)',
  honoo:     'var(--f-honoo)',
  rengein:   'var(--f-rengein)',
  youma:     'var(--f-youma)',
  ronin:     'var(--f-ronin)',
};

/** 名前から表示する頭文字を1文字取り出す（空白を除く最初の漢字） */
function firstKanji(name: string): string {
  const stripped = name.replace(/\s+/g, '');
  return stripped.charAt(0) || '？';
}

/** 武将の特性で立ち絵の彩度・小細工を変える */
function decorAccent(g: General): { silhouette: string; glow: string } {
  if (g.factionId === 'youma' || g.homeFactionId === 'youma') {
    return { silhouette: '#1A0A1A', glow: '#7A1A4A' };
  }
  switch (g.trait) {
    case 'gem':       return { silhouette: '#2A1F0A', glow: '#FFD66E' };
    case 'wild':      return { silhouette: '#2A0F0F', glow: '#FF5040' };
    case 'commander': return { silhouette: '#1A1810', glow: '#FFB044' };
    case 'sniper':    return { silhouette: '#0F1A1A', glow: '#7AC4D4' };
    default:          return { silhouette: '#1A1612', glow: '#C4B895' };
  }
}

export function GeneralPortrait({ general, size = 64, showLabel = true, selected = false }: Props) {
  const w = size;
  const h = Math.round(size * 1.25); // 縦長
  const factionColor = general.factionId
    ? FACTION_COLOR[general.factionId]
    : (general.homeFactionId ? FACTION_COLOR[general.homeFactionId] : 'var(--c-sumi-line)');
  const accent = decorAccent(general);
  const initial = firstKanji(general.name);

  return (
    <div className={`portrait ${selected ? 'selected' : ''}`} style={{ width: w, height: showLabel ? h + 14 : h }}>
      <svg className="frame" width={w} height={h} viewBox="0 0 60 75" xmlns="http://www.w3.org/2000/svg">
        {/* 背景：勢力カラーの和紙風グラデーション */}
        <defs>
          <linearGradient id={`bg-${general.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={factionColor} stopOpacity="0.85" />
            <stop offset="100%" stopColor={accent.silhouette} stopOpacity="1" />
          </linearGradient>
          <radialGradient id={`glow-${general.id}`} cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor={accent.glow} stopOpacity="0.5" />
            <stop offset="100%" stopColor={accent.glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="60" height="75" fill={`url(#bg-${general.id})`} />
        <rect x="0" y="0" width="60" height="75" fill={`url(#glow-${general.id})`} />

        {/* 兜＋肩のシルエット（簡素な戦国期武将のシルエット） */}
        <g fill={accent.silhouette} opacity="0.92">
          {/* 兜（前立て付き） */}
          <path d="M30 12 L24 18 Q22 22 22 27 L38 27 Q38 22 36 18 Z" />
          <path d="M30 8 L28 14 L32 14 Z" /> {/* 前立て */}
          {/* 顔（楕円・薄く） */}
          <ellipse cx="30" cy="32" rx="6.5" ry="7" fillOpacity="0.55" />
          {/* 肩・胴 */}
          <path d="M16 75 L16 50 Q16 42 24 40 L36 40 Q44 42 44 50 L44 75 Z" />
          {/* 襟元 */}
          <path d="M27 40 L27 50 L33 50 L33 40 Z" fill={factionColor} fillOpacity="0.8" />
        </g>

        {/* 頭文字（大きな漢字） */}
        <text
          x="30" y="58"
          textAnchor="middle"
          fontFamily="var(--font-fude)"
          fontSize="20"
          fill={accent.glow}
          opacity="0.75"
          stroke={accent.silhouette}
          strokeWidth="0.5"
          style={{ paintOrder: 'stroke' }}
        >
          {initial}
        </text>

        {/* ユニーク武将マーク */}
        {general.isUnique && (
          <circle cx="54" cy="6" r="3" fill={factionColor} stroke={accent.glow} strokeWidth="0.5" />
        )}
      </svg>
      {showLabel && (
        <div className="label" style={{ color: accent.glow }}>
          {general.name.split(' ').slice(-1)[0]}
        </div>
      )}
    </div>
  );
}
