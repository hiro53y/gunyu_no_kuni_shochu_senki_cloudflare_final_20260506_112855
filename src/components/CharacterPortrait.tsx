/**
 * CharacterPortrait.tsx
 * SVGで描画するキャラクターポートレートコンポーネント。
 * 各武将の髪型・目の形・口を組み合わせて個性的な顔を生成する。
 */
import type { Officer } from '../types/game';
import {
  characterDesigns,
  defaultDesign,
  type CharDesign,
  type EyeStyle,
  type HairStyle,
  type MouthStyle,
} from '../data/characterDesigns';

// 肌の色
const SKIN      = '#f2c490';
const SKIN_DARK = '#d6a070';
const SKIN_EAR  = '#c89060';

interface Props {
  officer: Officer;
  factionColor: string;
  /** ポートレートの幅（高さは 4/3 倍） */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** hex色を暗くする（最大値を cap でクランプ） */
function hexDarken(hex: string, factor: number, cap = 80): string {
  if (!hex.startsWith('#') || hex.length < 7) return '#0a0c10';
  const r = Math.min(Math.round(parseInt(hex.slice(1, 3), 16) * factor), cap);
  const g = Math.min(Math.round(parseInt(hex.slice(3, 5), 16) * factor), cap);
  const b = Math.min(Math.round(parseInt(hex.slice(5, 7), 16) * factor), cap);
  return `rgb(${r},${g},${b})`;
}

// ──────────────────────────────────────────────────────────
// 髪型 — 後ろレイヤー（顔の下）
// ──────────────────────────────────────────────────────────
function HairBack({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'topknot':
      return (
        <>
          <ellipse cx="30" cy="28" rx="18" ry="16" fill={color} />
          {/* 髷の軸 */}
          <rect x="26" y="10" width="8" height="16" rx="3" fill={color} />
          {/* 髷の玉 */}
          <ellipse cx="30" cy="10" rx="6" ry="5" fill={color} />
          {/* 両サイド */}
          <path d="M12,38 C11,44 12,55 13,63 C14,67 16,68 17,66 L18,36 C16,30 12,30 12,38Z" fill={color} />
          <path d="M48,38 C49,44 48,55 47,63 C46,67 44,68 43,66 L42,36 C44,30 48,30 48,38Z" fill={color} />
        </>
      );

    case 'long':
      return (
        <>
          <path d="M10,22 C8,34 8,54 10,72 C12,77 16,78 17,75 L18,34 C14,28 12,24 10,22Z" fill={color} />
          <path d="M50,22 C52,34 52,54 50,72 C48,77 44,78 43,75 L42,34 C46,28 48,24 50,22Z" fill={color} />
          <ellipse cx="30" cy="24" rx="19" ry="15" fill={color} />
        </>
      );

    case 'shortSpiky':
      return (
        <>
          <ellipse cx="30" cy="27" rx="17" ry="14" fill={color} />
          <path d="M13,35 C12,30 13,24 14,22 C16,18 18,21 17,28 L16,38" fill={color} />
          <path d="M47,35 C48,30 47,24 46,22 C44,18 42,21 43,28 L44,38" fill={color} />
        </>
      );

    case 'neat':
      return (
        <>
          <ellipse cx="30" cy="27" rx="16" ry="13" fill={color} />
          <path d="M14,36 C13,32 13,26 15,22 C17,18 18,21 18,27 L17,38" fill={color} />
          <path d="M46,36 C47,32 47,26 45,22 C43,18 42,21 42,27 L43,38" fill={color} />
        </>
      );

    case 'updo':
      return (
        <>
          <path d="M14,36 C13,30 14,23 16,19 C18,13 22,12 24,16 L24,34" fill={color} />
          <path d="M46,36 C47,30 46,23 44,19 C42,13 38,12 36,16 L36,34" fill={color} />
          <ellipse cx="30" cy="20" rx="16" ry="13" fill={color} />
          {/* 盛り上げ部 */}
          <ellipse cx="30" cy="10" rx="11" ry="7" fill={color} />
          <rect x="24" y="9" width="12" height="9" fill={color} />
        </>
      );

    case 'wild':
      return (
        <>
          <path d="M6,20 C4,34 4,54 6,68 C8,74 12,76 14,72 L16,36 C10,28 8,22 6,20Z" fill={color} />
          <path d="M54,20 C56,34 56,54 54,68 C52,74 48,76 46,72 L44,36 C50,28 52,22 54,20Z" fill={color} />
          <ellipse cx="30" cy="24" rx="22" ry="18" fill={color} />
          {/* ワイルドなスパイク */}
          <path d="M12,18 C10,9  14,7  16,14" fill={color} />
          <path d="M20,14 C18,5  24,3  26,12" fill={color} />
          <path d="M40,14 C42,5  36,3  34,12" fill={color} />
          <path d="M48,18 C50,9  46,7  44,14" fill={color} />
        </>
      );

    case 'swept':
      return (
        <>
          <ellipse cx="30" cy="26" rx="17" ry="14" fill={color} />
          <path d="M13,33 C12,27 13,20 15,17 C18,12 22,14 22,21 L20,34" fill={color} />
          <path d="M47,33 C48,27 47,20 45,17 C42,12 38,14 38,21 L40,34" fill={color} />
          <path d="M16,19 C18,12 24,10 30,10 C36,10 42,12 44,19" fill={color} />
        </>
      );

    case 'wavy':
      return (
        <>
          <path d="M11,24 C9,36 10,55 12,68 C14,73 17,74 18,72 L19,36 C14,30 12,26 11,24Z" fill={color} />
          <path d="M49,24 C51,36 50,55 48,68 C46,73 43,74 42,72 L41,36 C46,30 48,26 49,24Z" fill={color} />
          <ellipse cx="30" cy="23" rx="18" ry="14" fill={color} />
        </>
      );

    case 'messy':
      return (
        <>
          <path d="M10,24 C8,34 8,50 10,64 C12,70 15,72 16,68 L18,36 C12,28 10,24 10,24Z" fill={color} />
          <path d="M50,24 C52,34 52,50 50,64 C48,70 45,72 44,68 L42,36 C48,28 50,24 50,24Z" fill={color} />
          <ellipse cx="30" cy="26" rx="18" ry="14" fill={color} />
          <path d="M14,22 C12,14 16,12 18,18" fill={color} />
          <path d="M28,15 C26,7  32,5  34,14" fill={color} />
          <path d="M46,22 C48,14 44,12 42,18" fill={color} />
        </>
      );

    default:
      return <ellipse cx="30" cy="27" rx="16" ry="13" fill={color} />;
  }
}

// ──────────────────────────────────────────────────────────
// 髪型 — 前レイヤー（顔の上・前髪）
// ──────────────────────────────────────────────────────────
function HairFront({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'topknot':
      // 髷はきれいな額、前髪なし
      return null;

    case 'long':
      return (
        <path
          d="M13,30 C15,36 19,33 21,29 C23,26 25,32 27,30 C29,28 31,33 33,30 C35,27 37,33 40,29 C42,26 44,33 47,30"
          fill={color}
        />
      );

    case 'shortSpiky':
      return (
        <>
          <path d="M22,28 C20,17 24,14 26,22" fill={color} />
          <path d="M28,24 C27,11 33,9  32,22" fill={color} />
          <path d="M36,28 C40,17 36,14 34,24" fill={color} />
          <path d="M14,34 C16,30 18,28 20,32" fill={color} />
          <path d="M46,34 C44,30 42,28 40,32" fill={color} />
        </>
      );

    case 'neat':
      // 整った前髪ライン
      return (
        <path d="M14,34 C16,30 18,29 20,33 C22,36 18,37 17,35" fill={color} />
      );

    case 'updo':
      // 両サイドのふわっとした束
      return (
        <>
          <path d="M14,34 C13,39 14,45 15,49 C16,51 17,51 17,49 L17,36" fill={color} />
          <path d="M46,34 C47,39 46,45 45,49 C44,51 43,51 43,49 L43,36" fill={color} />
        </>
      );

    case 'wild':
      return (
        <>
          <path d="M12,32 C10,40 12,48 11,54" fill={color} />
          <path d="M48,32 C50,40 48,48 49,54" fill={color} />
          {/* 顔にかかる束 */}
          <path d="M18,32 C20,38 19,46 17,50" fill={color} opacity="0.85" />
        </>
      );

    case 'swept':
      return (
        <path d="M14,30 C16,25 21,25 23,30 C24,33 21,34 19,34" fill={color} />
      );

    case 'wavy':
      // ウェーブした前髪
      return (
        <path
          d="M13,30 C16,36 20,32 22,28 C24,25 26,32 29,30 C31,27 33,33 36,30 C38,27 40,33 44,29 C46,26 46,30 46,30"
          fill={color}
        />
      );

    case 'messy':
      return (
        <>
          <path d="M14,30 C18,36 20,33 22,29 C23,27 24,33 26,31" fill={color} />
          <path d="M36,29 C39,35 41,33 43,29" fill={color} />
          <path d="M22,32 C24,39 20,41 18,37" fill={color} opacity="0.7" />
        </>
      );

    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────
// 目
// ──────────────────────────────────────────────────────────
function Eyes({ style, color }: { style: EyeStyle; color: string }) {
  // 共通パーツ: 目の白 → 虹彩 → 瞳孔 → ハイライト
  const eye = (cx: number, cy: number, flipAngle?: boolean) => (
    <>
      <circle cx={cx} cy={cy} r="3.2" fill={color} />
      <circle cx={cx} cy={cy} r="1.9" fill="#100810" />
      <circle cx={cx - 0.8} cy={cy - 0.8} r="1" fill="rgba(255,255,255,0.88)" />
    </>
  );

  switch (style) {
    case 'calm':
      return (
        <>
          <path d="M18,43 C20,40 26,40 28,43 C26,46 20,46 18,43Z" fill="#1a1018" />
          {eye(23, 43)}
          <path d="M32,43 C34,40 40,40 42,43 C40,46 34,46 32,43Z" fill="#1a1018" />
          {eye(37, 43)}
          <path d="M18,39 C20,37.5 26,37.5 28,39" stroke="#1a1018" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M32,39 C34,37.5 40,37.5 42,39" stroke="#1a1018" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      );

    case 'fierce':
      return (
        <>
          <path d="M17,44 C19,40 27,40 29,43.5 C26,47 18,47 17,44Z" fill="#1a1018" />
          {eye(23, 43.5)}
          <path d="M31,43.5 C33,40 41,40 43,44 C42,47 32,47 31,43.5Z" fill="#1a1018" />
          {eye(37, 43.5)}
          {/* 吊り上がった眉 */}
          <path d="M17,38 C19,36 27,36.8 29,38" stroke="#1a1018" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M31,38 C33,36.8 41,36 43,38" stroke="#1a1018" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* 眉間のしわ */}
          <path d="M28,38 L29.5,40" stroke="#1a1018" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M32,38 L30.5,40" stroke="#1a1018" strokeWidth="1.2" strokeLinecap="round" />
        </>
      );

    case 'gentle':
      return (
        <>
          <path d="M18,43.5 C20,40.5 26,40.5 28,43.5 C26,47.5 20,47.5 18,43.5Z" fill="#1a1018" />
          {eye(23, 43.5)}
          <path d="M32,43.5 C34,40.5 40,40.5 42,43.5 C40,47.5 34,47.5 32,43.5Z" fill="#1a1018" />
          {eye(37, 43.5)}
          {/* やわらかい眉 */}
          <path d="M18,39.5 C20,38 26,38 28,39.5" stroke="#1a1018" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M32,39.5 C34,38 40,38 42,39.5" stroke="#1a1018" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </>
      );

    case 'sharp':
      return (
        <>
          <path d="M17,44 C19,40.5 27,40.5 29,44 C27,46.5 19,46.5 17,44Z" fill="#1a1018" />
          {eye(23, 43.5)}
          <path d="M31,44 C33,40.5 41,40.5 43,44 C41,46.5 33,46.5 31,44Z" fill="#1a1018" />
          {eye(37, 43.5)}
          {/* 鋭い斜め眉 */}
          <line x1="17" y1="39" x2="29" y2="37.5" stroke="#1a1018" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="31" y1="37.5" x2="43" y2="39" stroke="#1a1018" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );

    case 'alert':
      return (
        <>
          <path d="M17,43 C19,39.5 27,39.5 29,43 C27,46.5 19,46.5 17,43Z" fill="#1a1018" />
          {eye(23, 43)}
          <path d="M31,43 C33,39.5 41,39.5 43,43 C41,46.5 33,46.5 31,43Z" fill="#1a1018" />
          {eye(37, 43)}
          {/* 少し上がった眉 */}
          <path d="M17,38 C19,36 27,36 29,38" stroke="#1a1018" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M31,38 C33,36 41,36 43,38" stroke="#1a1018" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      );

    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────
// 口
// ──────────────────────────────────────────────────────────
function Mouth({ style }: { style: MouthStyle }) {
  switch (style) {
    case 'stern':
      return (
        <path d="M23,53 Q30,51.5 37,53" stroke="#b08060" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      );
    case 'smile':
      return (
        <>
          <path d="M23,52.5 Q30,56.5 37,52.5" stroke="#b07858" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M23,52.5 Q23,54.5 24.5,55" stroke="#b07858" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M37,52.5 Q37,54.5 35.5,55" stroke="#b07858" strokeWidth="1" fill="none" strokeLinecap="round" />
        </>
      );
    default:
      return (
        <path d="M25,52.5 Q30,53.5 35,52.5" stroke="#b08060" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      );
  }
}

// ──────────────────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────────────────
export function CharacterPortrait({ officer, factionColor, size = 60, className, style }: Props) {
  const design: CharDesign = characterDesigns[officer.id] ?? defaultDesign;
  const { hair, hairColor, eye, eyeColor, mouth, female, accessory, accColor } = design;

  // 勢力カラーから背景を暗めに生成
  const bgTop    = hexDarken(factionColor, 0.22, 70);
  const bgBottom = hexDarken(factionColor, 0.14, 50);
  const outfitC  = hexDarken(factionColor, 0.38, 100);

  const uid = `prt_${officer.id}`;
  const height = Math.round(size * (4 / 3));

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}_bg`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={bgTop} />
          <stop offset="100%" stopColor={bgBottom} />
        </linearGradient>
        <linearGradient id={`${uid}_face`} x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%"   stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_DARK} />
        </linearGradient>
        <clipPath id={`${uid}_clip`}>
          <rect width="60" height="80" />
        </clipPath>
      </defs>

      {/* 背景 */}
      <rect width="60" height="80" fill={`url(#${uid}_bg)`} />

      <g clipPath={`url(#${uid}_clip)`}>
        {/* 微細なグリッドパターン */}
        <rect width="60" height="80" fill="none"
          stroke={factionColor} strokeWidth="0.3" opacity="0.12"
          strokeDasharray="8 8"
        />

        {/* 髪（後ろレイヤー） */}
        <HairBack style={hair} color={hairColor} />

        {/* 首 */}
        <rect x="24" y="62" width="12" height="14" fill={`url(#${uid}_face)`} />

        {/* 耳 */}
        <ellipse cx="15" cy="47" rx="2.8" ry="3.8" fill={SKIN_EAR} />
        <ellipse cx="45" cy="47" rx="2.8" ry="3.8" fill={SKIN_EAR} />

        {/* 顔 */}
        <ellipse cx="30" cy="46" rx="15.5" ry="18.5" fill={`url(#${uid}_face)`} />

        {/* 目・眉 */}
        <Eyes style={eye} color={eyeColor} />

        {/* 鼻（控えめに） */}
        <path d="M28.5,50.5 L28,53 L30,53.8 L32,53 L31.5,50.5"
          fill="none" stroke={SKIN_DARK} strokeWidth="0.8" strokeLinejoin="round" />

        {/* 口 */}
        <Mouth style={mouth} />

        {/* 頬紅（女性のみ） */}
        {female && (
          <>
            <ellipse cx="20" cy="48" rx="4" ry="2.5" fill="rgba(220,120,100,0.18)" />
            <ellipse cx="40" cy="48" rx="4" ry="2.5" fill="rgba(220,120,100,0.18)" />
          </>
        )}

        {/* 髪（前レイヤー・前髪） */}
        <HairFront style={hair} color={hairColor} />

        {/* 飾り物 */}
        {accessory === 'pin' && accColor && (
          <>
            <rect x="17" y="29" width="22" height="2.5" rx="1.2" fill={accColor} opacity="0.9" />
            <circle cx="30" cy="30.2" r="3" fill={accColor} />
            <circle cx="30" cy="30.2" r="1.5" fill="rgba(255,255,255,0.5)" />
          </>
        )}
        {accessory === 'headband' && accColor && (
          <path d="M13,40 Q30,36.5 47,40"
            stroke={accColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        )}

        {/* 着物・衣装（下部） */}
        <path
          d={female
            ? 'M0,73 C10,67 20,64 30,64 C40,64 50,67 60,73 L60,80 L0,80Z'
            : 'M0,71 C10,65 18,63 30,63 C42,63 50,65 60,71 L60,80 L0,80Z'}
          fill={outfitC}
        />
        {/* 襟元 */}
        <path
          d={female
            ? 'M22,64 L30,70 L38,64'
            : 'M20,63 L27,70 L30,68 L33,70 L40,63'}
          fill="none"
          stroke={factionColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />

        {/* 下部グラデーションオーバーレイ */}
        <rect x="0" y="56" width="60" height="24" fill={bgBottom} opacity="0.35" />
      </g>

      {/* 枠線 */}
      <rect width="60" height="80" fill="none"
        stroke={factionColor} strokeWidth="1.5" opacity="0.35" />
    </svg>
  );
}

/** 小型ポートレート（地図画面・武将リストなど用） */
export function MiniPortrait({ officer, factionColor, size = 40 }: { officer: Officer; factionColor: string; size?: number }) {
  return <CharacterPortrait officer={officer} factionColor={factionColor} size={size} />;
}
