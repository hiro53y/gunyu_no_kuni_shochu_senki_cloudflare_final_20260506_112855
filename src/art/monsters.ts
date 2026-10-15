// 描き足した敵の絵（SVG・128×128）。元の絵に合わせて、濃い輪郭・暖色の陰影・2頭身ほどの姿にしている
const OL = '#1c120b';

const wrap = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs>${defs}</defs><g stroke="${OL}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

const radial = (id: string, a: string, b: string, cx = '40%', cy = '35%') =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="70%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const linear = (id: string, a: string, b: string, vertical = true) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

/** 光る目 */
const eye = (x: number, y: number, r: number, color: string) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke-width="2"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff" stroke="none"/>`;

export const MONSTER_ART: Record<string, string> = {
  nekomata: wrap(
    radial('nk', '#f2b56a', '#9a5a26') + linear('nkt', '#d58b45', '#7b4219'),
    `<path d="M92 92 C118 80 120 52 108 40 C104 56 100 66 88 78" fill="url(#nkt)"/>
     <path d="M96 100 C124 100 126 74 120 62 C112 78 104 86 90 90" fill="url(#nkt)"/>
     <ellipse cx="62" cy="88" rx="32" ry="26" fill="url(#nk)"/>
     <path d="M44 104 l-4 14 h12 l2-12 M74 106 l2 12 h12 l-4-14" fill="#e9a35c"/>
     <path d="M38 58 L32 24 L54 42 Z" fill="#c97a36"/><path d="M86 58 L94 24 L72 42 Z" fill="#c97a36"/>
     <path d="M38 52 L36 32 L50 44 Z" fill="#f4c3b0" stroke-width="2"/><path d="M86 52 L90 32 L76 44 Z" fill="#f4c3b0" stroke-width="2"/>
     <ellipse cx="62" cy="58" rx="30" ry="24" fill="url(#nk)"/>
     <path d="M46 44 q6 4 0 8 M62 38 v8 M78 44 q-6 4 0 8" fill="none" stroke="#7b4219" stroke-width="2.5"/>
     ${eye(50, 58, 5, '#ffe34a')}${eye(74, 58, 5, '#ffe34a')}
     <path d="M48 58 v0 M58 70 q4 4 8 0" fill="none" stroke-width="2.5"/>
     <path d="M62 66 l-3 -3 h6 z" fill="#d0606a" stroke-width="2"/>
     <path d="M34 68 h-12 M34 72 l-11 4 M90 68 h12 M90 72 l11 4" stroke-width="2"/>
     <path d="M48 84 q6 6 12 0 M64 92 q6 6 12 0" fill="none" stroke="#9a5a26" stroke-width="3"/>`,
  ),
  rokurokubi: wrap(
    linear('rkk', '#8a3a6a', '#40183a') + radial('rkf', '#fff6ec', '#e6c4ac') + linear('rkn', '#f8e8d8', '#d8b49c', false),
    `<path d="M30 124 C28 100 40 84 62 82 C84 84 96 100 94 124 Z" fill="url(#rkk)"/>
     <path d="M48 86 L62 104 L76 86" fill="#f4dcc8" stroke-width="2.5"/>
     <path d="M36 106 h52" stroke="#e0b040" stroke-width="6"/>
     <path d="M40 96 q-10 10 -8 24 M84 96 q10 10 8 24" fill="none" stroke="#5a2048" stroke-width="3"/>
     <path d="M62 84 C64 64 96 66 98 48 C100 32 76 30 60 34 C48 37 40 34 38 30" fill="none" stroke="${OL}" stroke-width="16"/>
     <path d="M62 84 C64 64 96 66 98 48 C100 32 76 30 60 34 C48 37 40 34 38 30" fill="none" stroke="url(#rkn)" stroke-width="10"/>
     <path d="M66 76 C74 70 88 66 94 56" fill="none" stroke="#c89a82" stroke-width="2"/>
     <ellipse cx="34" cy="30" rx="22" ry="21" fill="url(#rkf)"/>
     <path d="M12 30 C10 4 58 2 56 30 C50 18 42 14 34 14 C26 14 18 18 12 30 Z" fill="#1c1420"/>
     <path d="M12 30 C6 44 8 58 14 64 C16 52 16 42 20 34 Z" fill="#1c1420"/>
     <ellipse cx="34" cy="8" rx="12" ry="7" fill="#1c1420"/><path d="M24 8 h22" stroke="#d84a5a" stroke-width="3"/>
     <path d="M24 30 q4 -4 8 0 M38 30 q4 -4 8 0" fill="none" stroke-width="2.5"/>
     <path d="M28 41 q6 5 12 0" fill="#b02a3a" stroke-width="2"/>
     <path d="M20 37 q2 2 4 0 M44 37 q2 2 4 0" stroke="#ef9aa6" stroke-width="2.5"/>`,
  ),
  chouchin: wrap(
    linear('chb', '#ffb35c', '#d4501f') + radial('chg', '#fff2a8', '#ff9a3a', '50%', '45%'),
    `<rect x="46" y="10" width="36" height="10" rx="3" fill="#3a2a22"/>
     <path d="M40 22 C26 40 26 92 40 108 H88 C102 92 102 40 88 22 Z" fill="url(#chb)"/>
     <path d="M34 38 H94 M30 56 H98 M30 74 H98 M34 92 H94" fill="none" stroke="#9a3a16" stroke-width="2.5"/>
     <rect x="44" y="106" width="40" height="10" rx="3" fill="#3a2a22"/>
     <ellipse cx="64" cy="56" rx="17" ry="13" fill="#fffbe8"/>
     <circle cx="64" cy="57" r="8" fill="#2a0e08" stroke-width="2"/><circle cx="61" cy="54" r="3" fill="#fff" stroke="none"/>
     <path d="M44 78 C52 92 76 92 84 78 Z" fill="#5a0f0a"/>
     <path d="M58 84 C58 104 76 108 72 88" fill="#e2464a" stroke-width="2.5"/>
     <circle cx="64" cy="66" r="40" fill="url(#chg)" opacity="0.18" stroke="none"/>`,
  ),
  honehoushi: wrap(
    linear('hbr', '#5d4a7a', '#2c2240') + radial('hsk', '#f6f0dc', '#c9bea0'),
    `<path d="M98 16 V120" stroke="#6a4a2a" stroke-width="5"/><circle cx="98" cy="14" r="8" fill="none" stroke="#d6b84a" stroke-width="4"/>
     <path d="M90 22 l-6 6 M106 22 l6 6" stroke="#d6b84a" stroke-width="3"/>
     <path d="M30 122 C30 92 40 74 64 72 C88 74 98 92 98 122 Z" fill="url(#hbr)"/>
     <path d="M50 76 L64 100 L78 76" fill="none" stroke="#c9a54a" stroke-width="4"/>
     <path d="M86 96 C94 94 100 96 100 100" fill="#e9e2c8" stroke-width="2.5"/>
     <circle cx="64" cy="48" r="24" fill="url(#hsk)"/>
     <path d="M48 60 C48 74 80 74 80 60" fill="#e9e2c8"/>
     <path d="M54 66 v6 M60 67 v7 M66 67 v7 M72 66 v6" stroke-width="2"/>
     <ellipse cx="55" cy="48" rx="7" ry="8" fill="#1a1020"/><ellipse cx="73" cy="48" rx="7" ry="8" fill="#1a1020"/>
     <circle cx="55" cy="49" r="2.5" fill="#c08aff" stroke="none"/><circle cx="73" cy="49" r="2.5" fill="#c08aff" stroke="none"/>
     <path d="M64 54 l-3 5 h6 z" fill="#1a1020" stroke-width="2"/>
     <path d="M30 34 C40 18 88 18 98 34 C88 30 40 30 30 34 Z" fill="#b08a4a"/>`,
  ),
  tsuchigumo: wrap(
    radial('tgb', '#7a5a4a', '#2e1e18') + radial('tga', '#9a6a52', '#3a2620'),
    `<path d="M50 70 C30 60 18 70 8 92 M50 76 C30 76 20 90 14 112 M78 70 C98 60 110 70 120 92 M78 76 C98 76 108 90 114 112" fill="none" stroke="${OL}" stroke-width="8"/>
     <path d="M50 70 C30 60 18 70 8 92 M50 76 C30 76 20 90 14 112 M78 70 C98 60 110 70 120 92 M78 76 C98 76 108 90 114 112" fill="none" stroke="#5a3e32" stroke-width="4"/>
     <path d="M52 62 C36 48 24 50 12 64 M76 62 C92 48 104 50 116 64 M54 82 C44 96 40 106 38 120 M74 82 C84 96 88 106 90 120" fill="none" stroke="${OL}" stroke-width="8"/>
     <path d="M52 62 C36 48 24 50 12 64 M76 62 C92 48 104 50 116 64 M54 82 C44 96 40 106 38 120 M74 82 C84 96 88 106 90 120" fill="none" stroke="#5a3e32" stroke-width="4"/>
     <ellipse cx="64" cy="88" rx="26" ry="22" fill="url(#tga)"/>
     <path d="M52 84 q12 10 24 0 M54 96 q10 8 20 0" fill="none" stroke="#c9a040" stroke-width="2.5"/>
     <ellipse cx="64" cy="60" rx="20" ry="17" fill="url(#tgb)"/>
     ${eye(56, 56, 4, '#ff3a2a')}${eye(72, 56, 4, '#ff3a2a')}
     <circle cx="62" cy="48" r="2.5" fill="#ff3a2a" stroke="none"/><circle cx="68" cy="48" r="2.5" fill="#ff3a2a" stroke="none"/>
     <path d="M58 70 l-2 6 M70 70 l2 6" stroke="#e8e0c0" stroke-width="3"/>`,
  ),
  baku: wrap(
    linear('bkw', '#fbf7ee', '#c8bfb0') + radial('bkd', '#4e4a58', '#18161e'),
    `<path d="M30 96 v22 h12 v-20 M50 100 v18 h11 v-18 M84 100 v18 h11 v-18 M100 96 v22 h12 v-22" fill="url(#bkd)"/>
     <ellipse cx="72" cy="80" rx="44" ry="28" fill="url(#bkd)"/>
     <path d="M60 56 C76 52 92 54 104 62 C110 74 108 92 100 102 C88 106 72 106 60 104 C54 88 54 70 60 56 Z" fill="url(#bkw)" stroke-width="2.5"/>
     <ellipse cx="32" cy="66" rx="22" ry="19" fill="url(#bkd)"/>
     <path d="M14 70 C2 76 0 92 8 104 C12 96 12 88 18 82 Z" fill="#2e2a36"/>
     <path d="M8 104 q-4 2 -2 6 q4 0 6 -4" fill="#2e2a36" stroke-width="2"/>
     <path d="M36 48 l4 -12 l8 10" fill="#2e2a36"/><path d="M38 46 l3 -6 l4 5" fill="#c86a8a" stroke="none"/>
     ${eye(30, 62, 4.5, '#ffd84a')}
     <path d="M22 74 q6 4 12 0" fill="none" stroke="#8a8098" stroke-width="2"/>
     <path d="M74 66 q10 -6 20 0 M80 84 q10 -6 20 0" fill="none" stroke="#e8e0d0" stroke-width="2"/>
     <path d="M112 72 q8 -4 8 6" fill="none" stroke-width="3"/>`,
  ),
  tengu: wrap(
    linear('tgw', '#2e3550', '#0e1020') + linear('tgr', '#3e5a4a', '#1e2e26') + radial('tgf', '#e8a07a', '#b8603e'),
    `<path d="M40 62 C10 48 4 74 8 96 C18 86 26 84 36 84 Z" fill="url(#tgw)"/>
     <path d="M88 62 C118 48 124 74 120 96 C110 86 102 84 92 84 Z" fill="url(#tgw)"/>
     <path d="M14 80 l10 -6 M14 90 l12 -6 M114 80 l-10 -6 M114 90 l-12 -6" stroke="#55607a" stroke-width="2"/>
     <path d="M38 122 C36 96 44 78 64 76 C84 78 92 96 90 122 Z" fill="url(#tgr)"/>
     <circle cx="56" cy="88" r="5" fill="#f0f0f0" stroke-width="2"/><circle cx="72" cy="88" r="5" fill="#f0f0f0" stroke-width="2"/>
     <path d="M90 92 L104 70 L112 76 L96 96 Z" fill="#c9a050"/><path d="M104 70 l8 -8 M108 72 l10 -4 M110 76 l10 2" stroke="#6a8040" stroke-width="3"/>
     <ellipse cx="64" cy="54" rx="22" ry="22" fill="url(#tgf)"/>
     <path d="M64 56 L92 64 L66 70 Z" fill="#2a2a30"/><path d="M64 56 L92 64" stroke="#5a5a64" stroke-width="2"/>
     ${eye(56, 50, 4, '#ffd23a')}${eye(72, 48, 3.5, '#ffd23a')}
     <path d="M48 42 l12 4 M80 40 l-10 5" stroke-width="3"/>
     <rect x="54" y="26" width="16" height="10" rx="2" fill="#1e1e24"/><path d="M50 36 h24" stroke="#1e1e24" stroke-width="4"/>`,
  ),
  gaki: wrap(
    radial('gkb', '#b6c98e', '#5e7a4a') + radial('gkh', '#c9d8a0', '#6e8a54'),
    `<path d="M46 104 l-6 16 h10 l6 -14 M76 104 l6 16 h10 l-6 -16" fill="#7e9a5a"/>
     <path d="M44 72 C32 82 26 92 24 100 M84 72 C96 82 102 92 104 100" fill="none" stroke="${OL}" stroke-width="9"/>
     <path d="M44 72 C32 82 26 92 24 100 M84 72 C96 82 102 92 104 100" fill="none" stroke="#9ab070" stroke-width="5"/>
     <ellipse cx="64" cy="90" rx="26" ry="22" fill="url(#gkb)"/>
     <path d="M48 70 q16 8 32 0" fill="none" stroke="#5e7a4a" stroke-width="2.5"/>
     <path d="M52 66 q12 4 24 0 M54 74 q10 4 20 0" fill="none" stroke="#7a9060" stroke-width="2"/>
     <path d="M60 100 q4 3 8 0" fill="none" stroke="#5e7a4a" stroke-width="2.5"/>
     <ellipse cx="64" cy="44" rx="22" ry="24" fill="url(#gkh)"/>
     <path d="M44 34 C40 18 56 12 64 20 C72 12 88 18 84 34" fill="none" stroke="#2a2a20" stroke-width="5"/>
     <ellipse cx="55" cy="42" rx="6" ry="7" fill="#1a1a14"/><ellipse cx="73" cy="42" rx="6" ry="7" fill="#1a1a14"/>
     <circle cx="55" cy="43" r="2.5" fill="#ff5a3a" stroke="none"/><circle cx="73" cy="43" r="2.5" fill="#ff5a3a" stroke="none"/>
     <path d="M52 56 C56 64 72 64 76 56 Z" fill="#3a1a14"/><path d="M56 57 l2 4 l2 -4 M68 57 l2 4 l2 -4" fill="#f0f0e0" stroke-width="1.5"/>`,
  ),
  yukionna: wrap(
    linear('ykk', '#f4f8ff', '#a8c4e8') + radial('ykf', '#ffffff', '#dfe8f4') + radial('yka', '#c8e8ff', '#6aa8e8', '50%', '50%'),
    `<circle cx="64" cy="70" r="56" fill="url(#yka)" opacity="0.25" stroke="none"/>
     <path d="M30 124 C28 96 40 74 64 72 C88 74 100 96 98 124 Z" fill="url(#ykk)"/>
     <path d="M50 76 L64 100 L78 76" fill="none" stroke="#6a8ac0" stroke-width="3"/>
     <path d="M40 102 h48" stroke="#8aa8d8" stroke-width="5"/>
     <path d="M36 50 C30 80 34 100 40 110 C44 90 44 70 48 54 Z M92 50 C98 80 94 100 88 110 C84 90 84 70 80 54 Z" fill="#141826"/>
     <ellipse cx="64" cy="48" rx="20" ry="22" fill="url(#ykf)"/>
     <path d="M42 50 C40 24 88 24 86 50 C80 36 72 32 64 32 C56 32 48 36 42 50 Z" fill="#141826"/>
     <path d="M54 50 q4 2 8 0 M68 50 q4 2 8 0" fill="none" stroke="#2a3a6a" stroke-width="2.5"/>
     <path d="M60 60 q4 2 8 0" fill="none" stroke="#7aa0d8" stroke-width="2.5"/>
     <path d="M24 30 l4 4 l4 -4 l-4 -4 z M104 24 l3 3 l3 -3 l-3 -3 z M108 60 l3 3 l3 -3 l-3 -3 z" fill="#ffffff" stroke="#7ab0e8" stroke-width="1.5"/>`,
  ),
  keeper: wrap(
    linear('kpk', '#3a6a8a', '#1e3a52') + radial('kpf', '#f6cfa0', '#c98a5a'),
    `<path d="M28 124 C26 96 40 78 64 76 C88 78 102 96 100 124 Z" fill="url(#kpk)"/>
     <path d="M44 92 h40 v32 h-40 z" fill="#e8dcc0"/>
     <path d="M52 100 h24 M52 108 h24" stroke="#b0a080" stroke-width="2"/>
     <path d="M48 80 L64 94 L80 80" fill="none" stroke="#e8dcc0" stroke-width="4"/>
     <circle cx="64" cy="50" r="26" fill="url(#kpf)"/>
     <path d="M38 44 C38 22 90 22 90 44 C84 34 44 34 38 44 Z" fill="#3a2a1e"/>
     <path d="M38 40 h52" stroke="#c94a3a" stroke-width="6"/>
     <path d="M52 52 q4 -4 8 0 M68 52 q4 -4 8 0" fill="none" stroke-width="3"/>
     <path d="M54 64 q10 8 20 0" fill="none" stroke-width="3"/>
     <ellipse cx="48" cy="60" rx="5" ry="3" fill="#e88a7a" stroke="none"/><ellipse cx="80" cy="60" rx="5" ry="3" fill="#e88a7a" stroke="none"/>
     <rect x="88" y="96" width="24" height="18" rx="2" fill="#7a4a2a"/><path d="M92 100 v10 M98 100 v10 M104 100 v10 M110 100 v10" stroke="#e8c070" stroke-width="2"/>`,
  ),
  oni: wrap(
    radial('onb', '#ff6a4a', '#9a1e14') + linear('onp', '#f4c84a', '#b0781a'),
    `<path d="M100 18 L118 112" stroke="${OL}" stroke-width="16"/><path d="M100 18 L118 112" stroke="#6a4a2a" stroke-width="11"/>
     <circle cx="104" cy="40" r="3" fill="#d0d0d0"/><circle cx="108" cy="58" r="3" fill="#d0d0d0"/><circle cx="112" cy="76" r="3" fill="#d0d0d0"/>
     <path d="M22 124 C18 92 32 70 64 68 C96 70 110 92 106 124 Z" fill="url(#onb)"/>
     <path d="M34 104 h60 v20 h-60 z" fill="url(#onp)"/><path d="M42 104 l6 20 M60 104 l4 20 M78 104 l4 20" stroke="#3a2a10" stroke-width="4"/>
     <path d="M48 84 q16 10 32 0" fill="none" stroke="#7a140e" stroke-width="3"/>
     <circle cx="64" cy="46" r="28" fill="url(#onb)"/>
     <path d="M42 26 L36 4 L54 20 Z M86 26 L92 4 L74 20 Z" fill="#f4ecd0"/>
     <path d="M36 30 C40 14 88 14 92 30 C86 22 42 22 36 30 Z" fill="#1a1010"/>
     <path d="M44 38 l14 6 M84 38 l-14 6" stroke-width="4"/>
     ${eye(52, 48, 5, '#ffe23a')}${eye(76, 48, 5, '#ffe23a')}
     <path d="M48 62 C54 70 74 70 80 62 Z" fill="#3a0a08"/><path d="M52 62 l3 -8 l3 8 M70 62 l3 -8 l3 8" fill="#f4ecd0" stroke-width="2"/>`,
  ),
};

/** 道具の絵（元の絵が無い種類） */
export const ITEM_ART: Record<string, string> = {
  staff: wrap(
    linear('stw', '#c08a52', '#6a3e1e', false),
    `<path d="M28 116 L92 20" stroke="${OL}" stroke-width="12"/><path d="M28 116 L92 20" stroke="url(#stw)" stroke-width="7"/>
     <circle cx="94" cy="18" r="12" fill="#7ad0ff"/><circle cx="90" cy="14" r="4" fill="#ffffff" stroke="none"/>
     <path d="M80 34 l12 6 M70 50 l12 6" stroke="#d6b84a" stroke-width="4"/>
     <path d="M100 6 l4 -4 M108 18 l6 0 M100 30 l4 4" stroke="#bfe8ff" stroke-width="2.5"/>`,
  ),
  pot: wrap(
    radial('ptb', '#e8c8a0', '#8a5a36') + linear('ptl', '#5a8ab0', '#2a4a6a'),
    `<path d="M44 20 h40 v10 C84 36 104 46 106 74 C108 104 88 118 64 118 C40 118 20 104 22 74 C24 46 44 36 44 30 Z" fill="url(#ptb)"/>
     <path d="M40 18 h48" stroke-width="7"/><path d="M40 18 h48" stroke="#b0784a" stroke-width="3"/>
     <path d="M26 72 C44 80 84 80 102 72" fill="none" stroke="url(#ptl)" stroke-width="8"/>
     <path d="M30 88 C48 94 80 94 98 88" fill="none" stroke="#c9a060" stroke-width="3"/>
     <ellipse cx="46" cy="56" rx="6" ry="12" fill="#fff6e0" opacity="0.5" stroke="none"/>`,
  ),
  arrow: wrap(
    '',
    `<g transform="rotate(-35 64 64)">
       <path d="M10 56 H104 M10 64 H104 M10 72 H104" stroke="${OL}" stroke-width="7"/>
       <path d="M10 56 H104 M10 64 H104 M10 72 H104" stroke="#c8a070" stroke-width="3"/>
       <path d="M104 50 L122 56 L104 62 Z M104 58 L122 64 L104 70 Z M104 66 L122 72 L104 78 Z" fill="#c8d0d8" stroke-width="2"/>
       <path d="M8 50 L22 56 L8 62 M8 58 L22 64 L8 70 M8 66 L22 72 L8 78" fill="#f0f0e8" stroke-width="2"/>
       <path d="M54 52 v24" stroke="#a83a2a" stroke-width="5"/>
     </g>`,
  ),
  gold: wrap(
    radial('gdc', '#ffe58a', '#c8901a'),
    `<ellipse cx="44" cy="92" rx="30" ry="12" fill="url(#gdc)"/><rect x="38" y="88" width="12" height="7" fill="#7a4a10" stroke-width="2"/>
     <ellipse cx="80" cy="96" rx="30" ry="12" fill="url(#gdc)"/><rect x="74" y="92" width="12" height="7" fill="#7a4a10" stroke-width="2"/>
     <circle cx="64" cy="56" r="30" fill="url(#gdc)"/><rect x="56" y="48" width="16" height="16" fill="#7a4a10" stroke-width="2.5"/>
     <path d="M44 40 q20 -14 40 0" fill="none" stroke="#fff4c0" stroke-width="3"/>`,
  ),
  sanctuary: wrap(
    linear('scp', '#fff6dc', '#e2cfa0'),
    `<path d="M24 30 h80 v68 h-80 z" fill="url(#scp)"/>
     <circle cx="64" cy="64" r="22" fill="none" stroke="#c9a040" stroke-width="4"/>
     <path d="M64 46 v36 M46 64 h36" stroke="#c9a040" stroke-width="4"/>
     <rect x="18" y="24" width="10" height="80" rx="4" fill="#8a5a2a"/><rect x="100" y="24" width="10" height="80" rx="4" fill="#8a5a2a"/>`,
  ),
};

/** 罠の絵（元の絵が無い種類）：丸い板に記号 */
const plate = (symbol: string, color: string) =>
  wrap(
    radial('tp', '#8a7a6a', '#3e342c'),
    `<ellipse cx="64" cy="76" rx="50" ry="34" fill="url(#tp)"/><ellipse cx="64" cy="72" rx="40" ry="26" fill="#2a221c" opacity="0.5" stroke="none"/>
     <g stroke="${color}" stroke-width="6" fill="none">${symbol}</g>`,
  );

export const TRAP_ART: Record<string, string> = {
  warp: plate('<path d="M64 72 m-6 0 a6 6 0 1 1 12 0 a12 12 0 1 1 -24 0 a18 18 0 1 1 36 0"/>', '#9a7aff'),
  spin: plate('<path d="M44 72 a20 12 0 1 0 40 0 a14 8 0 1 0 -28 0 a8 4 0 1 0 16 0"/>', '#f0c040'),
  sleep: plate('<path d="M48 60 h14 l-14 16 h14 M68 54 h10 l-10 12 h10"/>', '#b0a0ff'),
  rust: plate('<path d="M44 84 l40 -28 M50 60 l8 8 M70 80 l8 8"/>', '#c86a2a'),
  hunger: plate('<path d="M42 66 h44 C86 84 42 84 42 66 Z M58 58 l4 -10 M68 58 l4 -10"/>', '#e0d0a0'),
  summon: plate('<path d="M64 52 C50 52 48 66 48 78 h32 C80 66 78 52 64 52 Z M60 84 h8"/>', '#ff6a4a'),
  gust: plate('<path d="M40 64 h30 a8 8 0 1 0 -8 -8 M40 76 h40 a8 8 0 1 1 -8 8 M40 88 h20"/>', '#a0e0ff'),
  slow: plate('<path d="M44 84 h36 C92 84 92 62 76 62 C66 62 64 74 72 76 M44 84 l-4 -10"/>', '#8ad070'),
  curse: plate('<circle cx="64" cy="68" r="12"/><path d="M58 70 h0 M70 70 h0 M58 86 l12 -8 M70 86 l-12 -8"/>', '#c070ff'),
  poison: plate('<path d="M40 88 L84 56 M76 56 h8 v8"/>', '#a050d0'),
  arrow: plate('<path d="M40 88 L84 56 M76 56 h8 v8"/>', '#e0e0e0'),
};
