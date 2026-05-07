import type { CSSProperties } from 'react';

type BattleSide = 'atk' | 'def';
type BattleSpriteSize = 'field' | 'card';

interface BattleMiniSpriteProps {
  variant: number;
  side: BattleSide;
  color: string;
  active?: boolean;
  hit?: boolean;
  defeated?: boolean;
  size?: BattleSpriteSize;
}

function clampHexPart(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}

function shade(hex: string, factor: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#2a3240';
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${clampHexPart(r)}${clampHexPart(g)}${clampHexPart(b)}`;
}

function normalizeVariant(variant: number): number {
  return Math.abs(Math.trunc(variant)) % 6;
}

function Weapon({ variant, metal, accent }: { variant: number; metal: string; accent: string }) {
  switch (normalizeVariant(variant)) {
    case 1:
      return (
        <>
          <path d="M16 24 L86 80" stroke={metal} strokeWidth="4" strokeLinecap="round" />
          <path d="M84 77 L93 83 L82 86Z" fill={metal} />
          <path d="M21 28 L29 34" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 2:
      return (
        <>
          <path d="M22 26 C6 44 8 70 24 88" stroke={shade(accent, 0.78)} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M23 29 L23 84" stroke={metal} strokeWidth="1.4" opacity="0.65" />
          <path d="M38 55 L89 50" stroke={metal} strokeWidth="3" strokeLinecap="round" />
          <path d="M88 50 L80 45 L81 55Z" fill={metal} />
        </>
      );
    case 3:
      return (
        <>
          <path d="M60 24 C78 20 87 28 88 42 C75 42 65 36 60 24Z" fill="#f5e6b8" stroke={accent} strokeWidth="2" />
          <path d="M60 25 L36 63" stroke={shade(accent, 0.8)} strokeWidth="3" strokeLinecap="round" />
          <path d="M70 27 L80 40 M64 29 L74 41" stroke={accent} strokeWidth="1.3" opacity="0.8" />
        </>
      );
    case 4:
      return (
        <>
          <path d="M16 48 L34 38 L39 70 L20 84Z" fill={shade(accent, 0.72)} stroke={metal} strokeWidth="2" />
          <path d="M24 44 L30 78 M18 58 L38 53" stroke={metal} strokeWidth="1.4" opacity="0.75" />
          <path d="M54 36 L83 28" stroke={metal} strokeWidth="4" strokeLinecap="round" />
          <path d="M82 29 L91 25 L84 35Z" fill={metal} />
        </>
      );
    case 5:
      return (
        <>
          <path d="M18 74 C34 62 45 58 61 40" stroke={metal} strokeWidth="4" strokeLinecap="round" />
          <path d="M57 42 L67 34 L64 47Z" fill={metal} />
          <path d="M45 42 C58 39 70 38 84 32" stroke={metal} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <path d="M82 33 L91 29 L84 39Z" fill={metal} opacity="0.9" />
        </>
      );
    default:
      return (
        <>
          <path d="M18 74 C34 61 53 47 83 24" stroke={metal} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M80 27 L91 16 L86 31Z" fill={metal} />
          <path d="M28 67 L36 75" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        </>
      );
  }
}

function Helmet({ variant, armor, trim }: { variant: number; armor: string; trim: string }) {
  const v = normalizeVariant(variant);
  if (v === 1) {
    return (
      <>
        <ellipse cx="48" cy="29" rx="19" ry="9" fill={shade(armor, 0.58)} stroke={trim} strokeWidth="2" />
        <path d="M29 29 Q48 13 67 29" fill={shade(armor, 0.72)} stroke={trim} strokeWidth="2" />
      </>
    );
  }
  if (v === 3) {
    return (
      <>
        <path d="M30 30 Q48 15 66 30 L61 36 Q48 28 35 36Z" fill={shade(armor, 0.76)} stroke={trim} strokeWidth="2" />
        <circle cx="48" cy="24" r="5" fill={trim} />
      </>
    );
  }
  if (v === 4) {
    return (
      <>
        <path d="M28 31 Q48 10 68 31 L64 40 L32 40Z" fill={shade(armor, 0.64)} stroke={trim} strokeWidth="2" />
        <path d="M35 25 Q48 16 61 25" stroke={trim} strokeWidth="2" fill="none" />
      </>
    );
  }
  return (
    <>
      <path d="M31 31 Q48 12 65 31 L61 39 L35 39Z" fill={shade(armor, 0.68)} stroke={trim} strokeWidth="2" />
      <path d="M48 13 C45 4 51 4 48 13Z" fill={trim} />
      {v === 2 && <path d="M34 21 Q48 8 62 21" stroke={trim} strokeWidth="2.5" fill="none" />}
      {v === 5 && <path d="M27 32 C35 24 61 24 69 32" stroke={trim} strokeWidth="2.5" fill="none" />}
    </>
  );
}

export function BattleMiniSprite({
  variant,
  side,
  color,
  active = false,
  hit = false,
  defeated = false,
  size = 'field',
}: BattleMiniSpriteProps) {
  const armor = color;
  const dark = shade(color, 0.42);
  const trim = '#e4b84f';
  const metal = '#d8dde7';
  const skin = '#d6a176';
  const mirrored = side === 'def';
  const className = [
    'battleMiniSprite',
    size,
    side,
    active ? 'is-active' : '',
    hit ? 'is-hit' : '',
    defeated ? 'is-defeated' : '',
  ].filter(Boolean).join(' ');

  return (
    <span
      className={className}
      style={{ '--sprite-color': color } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 96 112" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="48" cy="100" rx="28" ry="7" fill="rgba(0,0,0,0.35)" />
        <g transform={mirrored ? 'translate(96 0) scale(-1 1)' : undefined}>
          <Weapon variant={variant} metal={metal} accent={trim} />

          <path d="M36 86 L30 100 M58 86 L67 99" stroke="#15181e" strokeWidth="8" strokeLinecap="round" />
          <path d="M35 90 L28 101 M59 90 L70 100" stroke={metal} strokeWidth="3" strokeLinecap="round" opacity="0.4" />

          <path d="M30 58 Q47 44 66 58 L62 86 Q49 93 35 86Z" fill={dark} stroke={trim} strokeWidth="2" />
          <path d="M36 61 L48 86 L60 61" fill={armor} opacity="0.92" />
          <path d="M34 66 H62 M36 75 H60" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          <path d="M30 60 L18 72 M66 60 L79 68" stroke={dark} strokeWidth="9" strokeLinecap="round" />
          <path d="M20 72 L28 77 M76 68 L85 64" stroke={metal} strokeWidth="3.2" strokeLinecap="round" />

          <ellipse cx="48" cy="42" rx="15" ry="16" fill={skin} stroke={shade(skin, 0.78)} strokeWidth="1.5" />
          <path d="M35 43 Q41 39 46 43 M50 43 Q56 39 62 43" stroke="#17120d" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="42" cy="45" r="2" fill="#17120d" />
          <circle cx="55" cy="45" r="2" fill="#17120d" />
          <path d="M43 53 Q48 56 54 53" stroke="#7c3a2a" strokeWidth="1.6" strokeLinecap="round" fill="none" />

          <Helmet variant={variant} armor={armor} trim={trim} />

          <path d="M27 37 C23 50 26 62 32 69" stroke="#111" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
          <path d="M69 37 C73 50 70 62 64 69" stroke="#111" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
          {normalizeVariant(variant) === 5 && (
            <path d="M28 35 C16 44 13 59 20 76" stroke="#111" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
          )}

          <path d="M39 58 L30 86 M57 58 L66 86" stroke={trim} strokeWidth="2" opacity="0.45" />
          {active && (
            <path d="M18 31 C32 20 55 18 79 25" stroke="rgba(255,244,180,0.65)" strokeWidth="3" fill="none" strokeLinecap="round" />
          )}
        </g>
      </svg>
    </span>
  );
}
