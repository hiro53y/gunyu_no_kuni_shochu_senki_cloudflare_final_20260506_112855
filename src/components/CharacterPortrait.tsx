// ===========================================================================
// アプリ内完結の和風武将ポートレート
// 外部画像に依存せず、武将ID・能力・所属から決定的にSVG顔グラを生成する。
// ===========================================================================

import type { FactionId, General } from '../types/game';

interface Props {
  general: General;
  size?: number;
  showLabel?: boolean;
  selected?: boolean;
}

type PortraitRole =
  | 'young'
  | 'elder'
  | 'brute'
  | 'strategist'
  | 'defender'
  | 'attacker'
  | 'ronin'
  | 'enemyLord'
  | 'female';

const FACTION_COLOR: Record<FactionId, string> = {
  akatsuki: '#C84A4A',
  kurogane: '#525560',
  shion: '#7E5BA3',
  shirasagi: '#A8A8B0',
  honoo: '#D43818',
  rengein: '#3F8060',
  youma: '#1A1A1A',
  ronin: '#1F3A6E',
};

const ROLE_PALETTE: Record<PortraitRole, { bg1: string; bg2: string; cloth: string; accent: string; skin: string }> = {
  young:      { bg1: '#8F3430', bg2: '#241816', cloth: '#9E3D30', accent: '#E7BE61', skin: '#D9A778' },
  elder:      { bg1: '#54555F', bg2: '#171719', cloth: '#303744', accent: '#D6C08A', skin: '#C99A72' },
  brute:      { bg1: '#B43A24', bg2: '#150B09', cloth: '#3A1511', accent: '#F06A3D', skin: '#C8865F' },
  strategist: { bg1: '#4C3E75', bg2: '#111524', cloth: '#232A4B', accent: '#A8B9F0', skin: '#D2A67A' },
  defender:   { bg1: '#2E4C58', bg2: '#12191B', cloth: '#263E48', accent: '#8CBBC4', skin: '#C79B74' },
  attacker:   { bg1: '#9F2F20', bg2: '#120B09', cloth: '#2A1110', accent: '#F0A13C', skin: '#D09A68' },
  ronin:      { bg1: '#273B5B', bg2: '#101421', cloth: '#20202A', accent: '#9FB3D8', skin: '#C89567' },
  enemyLord:  { bg1: '#2A1028', bg2: '#050406', cloth: '#1A0B18', accent: '#B34AC8', skin: '#B98472' },
  female:     { bg1: '#7B3B5E', bg2: '#19111A', cloth: '#5B243E', accent: '#F1C5D8', skin: '#D9AA82' },
};

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length];
}

function roleOf(g: General): PortraitRole {
  const name = g.name;
  if (g.homeFactionId === 'youma' || g.factionId === 'youma') return 'enemyLord';
  if (g.homeFactionId === 'ronin' || g.factionId === 'ronin') return 'ronin';
  if (/[蘭千景楓葉燐静音紅蓮楪]/.test(name)) return 'female';
  if (g.trait === 'wild') return 'brute';
  if (g.trait === 'defender' || g.stats.command >= 86 && g.stats.power < 82) return 'defender';
  if (g.trait === 'attacker' || g.stats.power >= 86) return 'attacker';
  if (g.trait === 'strategist' || g.stats.intel >= 82) return 'strategist';
  if (g.stats.charisma >= 84 || g.trait === 'commander') return 'young';
  if (g.stats.command >= 80) return 'elder';
  return 'young';
}

function crestPath(seed: number): string {
  const n = seed % 4;
  if (n === 0) return 'M30 8 L34 16 L43 17 L37 24 L39 33 L30 28 L21 33 L23 24 L17 17 L26 16 Z';
  if (n === 1) return 'M30 10 C38 14 42 21 40 30 C34 26 26 26 20 30 C18 21 22 14 30 10 Z';
  if (n === 2) return 'M20 17 L40 17 L36 33 L24 33 Z M30 8 L35 17 L25 17 Z';
  return 'M30 9 L35 20 L47 20 L37 27 L41 39 L30 31 L19 39 L23 27 L13 20 L25 20 Z';
}

export function CharacterPortrait({ general, size = 64, showLabel = true, selected = false }: Props) {
  const seed = hashText(`${general.id}:${general.name}:${general.portraitKey}`);
  const role = roleOf(general);
  const palette = ROLE_PALETTE[role];
  const faction = general.factionId ?? general.homeFactionId;
  const factionColor = faction ? FACTION_COLOR[faction] : '#6E6250';
  const w = size;
  const h = Math.round(size * 1.25);
  const uid = `cp-${general.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const faceW = pick([15, 16, 18, 19], seed);
  const jaw = pick([2, 3, 4], seed >> 3);
  const eyeTilt = pick([-1.4, -0.6, 0, 0.7, 1.3], seed >> 5);
  const brow = pick([0, 1, 2], seed >> 7);
  const hair = pick(['topknot', 'loose', 'helmet', 'headband', 'eboshi'] as const, seed >> 9);
  const hasBeard = role === 'elder' || role === 'brute' || ((seed >> 11) % 5 === 0 && role !== 'female');
  const mouth = pick(['M27 45 Q30 46 33 45', 'M27 45 Q30 44 33 45', 'M27 45 L33 45'], seed >> 13);
  const armor = role === 'defender' || role === 'elder' || role === 'enemyLord' || role === 'brute';
  const sideHair = role === 'female' || hair === 'loose';

  return (
    <div
      className={`portrait characterPortrait role-${role} ${selected ? 'selected' : ''}`}
      style={{ width: w, height: showLabel ? h + 14 : h, position: 'relative' }}
      title={general.name}
    >
      <svg className="frame characterFrame" width={w} height={h} viewBox="0 0 60 75" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={general.name}>
        <defs>
          <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.bg1} />
            <stop offset="58%" stopColor={palette.bg2} />
            <stop offset="100%" stopColor="#090706" />
          </linearGradient>
          <radialGradient id={`${uid}-halo`} cx="50%" cy="35%" r="52%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.38" />
            <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-rough`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed % 97} result="noise" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.08" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
          </filter>
        </defs>

        <rect x="0" y="0" width="60" height="75" rx="2" fill={`url(#${uid}-bg)`} />
        <rect x="0" y="0" width="60" height="75" fill={`url(#${uid}-halo)`} />
        <path d={crestPath(seed)} transform="translate(0 16) scale(0.72)" fill={factionColor} opacity="0.16" />
        <path d="M5 11 C17 3 43 4 55 13" stroke={palette.accent} strokeOpacity="0.24" strokeWidth="1" fill="none" />
        <path d="M6 63 C20 57 41 58 55 64" stroke="#000" strokeOpacity="0.35" strokeWidth="9" fill="none" />

        <g filter={`url(#${uid}-rough)`}>
          <path d="M13 75 C14 58 18 50 25 47 L35 47 C42 50 46 58 47 75 Z" fill={palette.cloth} />
          <path d="M20 75 L23 52 L30 58 L37 52 L40 75 Z" fill={armor ? '#24282B' : '#241817'} opacity="0.92" />
          {armor && (
            <g opacity="0.9">
              <path d="M16 61 L44 61 L42 75 L18 75 Z" fill="#34383A" />
              <path d="M20 61 L20 75 M26 60 L26 75 M34 60 L34 75 M40 61 L40 75" stroke={palette.accent} strokeOpacity="0.38" strokeWidth="0.8" />
            </g>
          )}
          <path d="M25 47 L30 55 L35 47" fill={palette.accent} opacity="0.82" />

          {sideHair && (
            <>
              <path d="M17 25 C11 36 14 47 22 52 C19 42 21 34 24 27 Z" fill="#15100E" />
              <path d="M43 25 C49 36 46 47 38 52 C41 42 39 34 36 27 Z" fill="#15100E" />
            </>
          )}

          {hair === 'helmet' && (
            <>
              <path d="M16 25 C18 14 23 9 30 8 C37 9 42 14 44 25 L39 30 L21 30 Z" fill="#2D3033" />
              <path d="M30 5 L34 15 L26 15 Z" fill={palette.accent} />
              <path d="M18 24 L42 24" stroke={palette.accent} strokeWidth="1.4" strokeOpacity="0.8" />
            </>
          )}
          {hair === 'eboshi' && (
            <path d="M23 23 C23 12 27 6 31 3 C35 11 37 18 36 25 Z" fill="#141012" />
          )}
          {hair === 'headband' && (
            <>
              <path d="M20 23 C21 15 25 11 30 11 C35 11 39 15 40 23 C34 20 26 20 20 23 Z" fill="#16100E" />
              <path d="M18 24 L42 22" stroke={factionColor} strokeWidth="3" />
            </>
          )}
          {hair === 'topknot' && (
            <>
              <path d="M20 24 C21 16 25 12 30 12 C35 12 39 16 40 24 C34 20 26 20 20 24 Z" fill="#17110F" />
              <path d="M27 12 C25 7 29 5 33 8 C34 10 33 12 31 13 Z" fill="#17110F" />
            </>
          )}
          {hair === 'loose' && (
            <path d="M18 25 C17 13 25 9 31 10 C40 11 44 20 42 30 C35 23 25 22 18 25 Z" fill="#17110F" />
          )}

          <path
            d={`M${30 - faceW / 2} 26 C${20 - jaw} 37 ${22 + jaw} 49 30 50 C${38 - jaw} 49 ${40 + jaw} 37 ${30 + faceW / 2} 26 C38 21 22 21 ${30 - faceW / 2} 26 Z`}
            fill={palette.skin}
          />
          <path d="M22 27 C25 23 35 23 38 27" stroke="#201512" strokeWidth="1.1" fill="none" opacity="0.35" />

          <g stroke="#241512" strokeWidth="1.4" strokeLinecap="round">
            {brow === 0 && (
              <>
                <path d={`M22 ${34 - eyeTilt} L28 ${33 + eyeTilt}`} />
                <path d={`M32 ${33 + eyeTilt} L38 ${34 - eyeTilt}`} />
              </>
            )}
            {brow === 1 && (
              <>
                <path d="M22 33 Q25 31 28 33" />
                <path d="M32 33 Q35 31 38 33" />
              </>
            )}
            {brow === 2 && (
              <>
                <path d="M22 32 L28 31" strokeWidth="1.8" />
                <path d="M32 31 L38 32" strokeWidth="1.8" />
              </>
            )}
          </g>
          <g fill="#1C1110">
            <path d={`M23 ${37 - eyeTilt * 0.35} Q25 ${36 - eyeTilt * 0.4} 28 ${37 - eyeTilt * 0.35} Q25 ${38 - eyeTilt * 0.3} 23 ${37 - eyeTilt * 0.35} Z`} />
            <path d={`M32 ${37 + eyeTilt * 0.35} Q35 ${36 + eyeTilt * 0.4} 37 ${37 + eyeTilt * 0.35} Q35 ${38 + eyeTilt * 0.3} 32 ${37 + eyeTilt * 0.35} Z`} />
          </g>
          <path d="M30 38 L28 43 L31 43" stroke="#805D4B" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d={mouth} stroke="#43251F" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {hasBeard && (
            <>
              <path d="M24 42 C26 48 34 48 36 42 C35 52 25 52 24 42 Z" fill="#211514" opacity="0.72" />
              <path d="M22 39 C25 42 27 43 29 43 M38 39 C35 42 33 43 31 43" stroke="#211514" strokeWidth="1" />
            </>
          )}
        </g>

        <path d="M1 1 H59 V74 H1 Z" fill="none" stroke={selected ? '#FFD66E' : factionColor} strokeWidth={selected ? 2.4 : 1.3} />
        <path d="M4 4 H56 V71 H4 Z" fill="none" stroke={palette.accent} strokeOpacity="0.35" strokeWidth="0.6" />
        {general.isUnique && <circle cx="53" cy="7" r="4" fill={factionColor} stroke={palette.accent} strokeWidth="1" />}
      </svg>
      {showLabel && (
        <div className="label" style={{ color: palette.accent }}>
          {general.name.split(' ').slice(-1)[0]}
        </div>
      )}
    </div>
  );
}
