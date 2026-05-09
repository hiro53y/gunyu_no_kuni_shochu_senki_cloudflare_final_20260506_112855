// ===========================================================================
// 武将立ち絵
// portraitKey に対応する画像が public/assets/portraits/{key}.png に存在すれば
// それを表示。存在しなければSVG（A方針プレースホルダ）にフォールバックする。
// ===========================================================================

import { useState } from 'react';
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

/** 名前から表示する頭文字を1文字取り出す */
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

/** 画像URLの解決。webp → png の順で試行可能 */
function resolvePortraitUrl(key: string, ext: 'webp' | 'png' | 'jpg' = 'png'): string {
  return `/assets/portraits/${key}.${ext}`;
}

export function GeneralPortrait({ general, size = 64, showLabel = true, selected = false }: Props) {
  const w = size;
  const h = Math.round(size * 1.25); // 縦長
  const factionColor = general.factionId
    ? FACTION_COLOR[general.factionId]
    : (general.homeFactionId ? FACTION_COLOR[general.homeFactionId] : 'var(--c-sumi-line)');
  const accent = decorAccent(general);
  const initial = firstKanji(general.name);

  // 画像読み込み状態
  // 'png' を試行 → ダメなら 'jpg' → ダメなら SVG にフォールバック
  const [imgStage, setImgStage] = useState<'png' | 'jpg' | 'failed'>('png');
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleError = () => {
    if (imgStage === 'png') {
      setImgStage('jpg');
      setImgLoaded(false);
    } else {
      setImgStage('failed');
    }
  };

  const showImage = imgStage !== 'failed';
  const imageUrl = showImage ? resolvePortraitUrl(general.portraitKey, imgStage) : '';

  return (
    <div className={`portrait ${selected ? 'selected' : ''}`} style={{ width: w, height: showLabel ? h + 14 : h, position: 'relative' }}>
      {/* SVG プレースホルダ（常時レンダー、画像が読込まれるまで見える） */}
      <svg className="frame" width={w} height={h} viewBox="0 0 60 75" xmlns="http://www.w3.org/2000/svg">
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

        <g fill={accent.silhouette} opacity="0.92">
          <path d="M30 12 L24 18 Q22 22 22 27 L38 27 Q38 22 36 18 Z" />
          <path d="M30 8 L28 14 L32 14 Z" />
          <ellipse cx="30" cy="32" rx="6.5" ry="7" fillOpacity="0.55" />
          <path d="M16 75 L16 50 Q16 42 24 40 L36 40 Q44 42 44 50 L44 75 Z" />
          <path d="M27 40 L27 50 L33 50 L33 40 Z" fill={factionColor} fillOpacity="0.8" />
        </g>

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

        {general.isUnique && (
          <circle cx="54" cy="6" r="3" fill={factionColor} stroke={accent.glow} strokeWidth="0.5" />
        )}
      </svg>

      {/* 実画像オーバーレイ。読込成功時のみ可視、失敗時は SVG が見える */}
      {showImage && (
        <img
          key={imgStage}
          src={imageUrl}
          alt={general.name}
          width={w}
          height={h}
          onLoad={() => setImgLoaded(true)}
          onError={handleError}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: w, height: h,
            objectFit: 'cover',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.18s ease',
            pointerEvents: 'none',
            // ユニーク武将マーク用に小さなドットを上に出すための余地を残す
          }}
        />
      )}

      {/* ユニーク武将マーク（画像が読み込まれても表示） */}
      {imgLoaded && general.isUnique && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4, right: 4,
            width: 8, height: 8,
            borderRadius: '50%',
            background: factionColor,
            border: `1px solid ${accent.glow}`,
            boxShadow: `0 0 4px ${accent.glow}`,
            pointerEvents: 'none',
          }}
        />
      )}

      {showLabel && (
        <div className="label" style={{ color: accent.glow }}>
          {general.name.split(' ').slice(-1)[0]}
        </div>
      )}
    </div>
  );
}
