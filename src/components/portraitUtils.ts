import type { Officer } from '../types/game';

/** 勢力IDに対応するポートレート背景色 */
const factionPortraitColors: Record<string, string> = {
  f_akebono:   'linear-gradient(135deg, #6b1c1c 0%, #3a0e0e 100%)',
  f_shiramine: 'linear-gradient(135deg, #1c3a6b 0%, #0e1e3a 100%)',
  f_kurose:    'linear-gradient(135deg, #2a2a3a 0%, #111118 100%)',
  f_kazami:    'linear-gradient(135deg, #1c4a2a 0%, #0e2014 100%)',
  f_suhama:    'linear-gradient(135deg, #5a3a00 0%, #2a1a00 100%)',
  f_ronin:     'linear-gradient(135deg, #3a3030 0%, #1a1414 100%)',
};

/** 武将名の最初の漢字を取得（ポートレート表示用） */
function getFirstKanji(name: string): string {
  // 姓と名の間にスペースがある場合は姓の先頭
  const parts = name.trim().split(/[\s　]/);
  return parts[0]?.[0] ?? name[0] ?? '武';
}

/** 武将の能力値から肩書バッジ用の色を返す */
export function getStatColor(val: number): string {
  if (val >= 80) return 'vhigh';
  if (val >= 65) return 'high';
  return '';
}

/** ポートレートスタイル（背景色・漢字）を生成 */
export function getPortraitStyle(officer: Officer): { bg: string; kanji: string } {
  const bg = factionPortraitColors[officer.factionId] ?? 'linear-gradient(135deg, #2a2040, #0d0f1c)';
  const kanji = getFirstKanji(officer.name);
  return { bg, kanji };
}

/** 武将の役割（武/文/智）を返す */
export function getOfficerRole(officer: Officer): '武' | '文' | '智' {
  const martial = officer.command + officer.valor;
  const civil   = officer.politics + officer.wisdom;
  if (martial - civil > 14) return '武';
  if (civil - martial > 14) return '文';
  return '智';
}

/** デザインシートから武将カード用の切り抜き位置を決定する */
export function getOfficerArtPosition(officer: Officer): string {
  const palette = ['4% 45%', '21% 45%', '38% 45%', '55% 45%', '72% 45%', '89% 45%'];
  let hash = 0;
  for (let i = 0; i < officer.id.length; i += 1) {
    hash = (hash * 31 + officer.id.charCodeAt(i)) % 997;
  }
  const role = getOfficerRole(officer);
  const roleOffset = role === '武' ? 0 : role === '智' ? 2 : 4;
  return palette[(hash + roleOffset) % palette.length];
}

/** 役割ごとの色 */
export const roleBadgeStyle: Record<string, React.CSSProperties> = {
  武: { color: '#ff9a9a', background: 'rgba(180,28,28,0.35)' },
  文: { color: '#9ac4ff', background: 'rgba(28,80,180,0.35)' },
  智: { color: '#b8ffb8', background: 'rgba(28,140,60,0.35)' },
};
