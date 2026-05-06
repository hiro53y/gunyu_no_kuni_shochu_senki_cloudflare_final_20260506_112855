/** 武将の外見デザイン定義 */

export type HairStyle =
  | 'topknot'     // 侍の髷（ちょんまげ）
  | 'long'        // 長髪ストレート（女性など）
  | 'shortSpiky'  // 短めスパイキー（若者）
  | 'neat'        // 整えた後ろ結い（文官）
  | 'updo'        // 盛り上げ髪（高貴な女性）
  | 'wild'        // 無造作に広がる（猛将）
  | 'swept'       // 流し後ろ（俊敏系）
  | 'wavy'        // ウェーブかかった中髪（女性一般）
  | 'messy';      // 乱れた浪人風

export type EyeStyle = 'calm' | 'fierce' | 'gentle' | 'sharp' | 'alert';
export type MouthStyle = 'neutral' | 'stern' | 'smile';

export interface CharDesign {
  hair: HairStyle;
  hairColor: string;
  eye: EyeStyle;
  eyeColor: string;
  mouth: MouthStyle;
  female?: boolean;
  accessory?: 'headband' | 'pin' | 'earring';
  accColor?: string;
}

export const characterDesigns: Record<string, CharDesign> = {
  // ── 暁ノ家（プレイヤー） ──────────────────────────────
  o_harutsuna: {
    hair: 'topknot', hairColor: '#191018',
    eye: 'fierce', eyeColor: '#5a2010',
    mouth: 'stern',
    accColor: '#c83020',
  },
  o_sayo: {
    hair: 'long', hairColor: '#181014',
    eye: 'sharp', eyeColor: '#3a4858',
    mouth: 'neutral', female: true,
  },
  o_saku: {
    hair: 'shortSpiky', hairColor: '#3a2010',
    eye: 'fierce', eyeColor: '#7a3808',
    mouth: 'stern',
  },
  o_naozumi: {
    hair: 'neat', hairColor: '#191018',
    eye: 'calm', eyeColor: '#1a2848',
    mouth: 'neutral',
  },

  // ── 白峰方 ────────────────────────────────────────────
  o_mayuki: {
    hair: 'updo', hairColor: '#181014',
    eye: 'calm', eyeColor: '#384858',
    mouth: 'neutral', female: true,
    accessory: 'pin', accColor: '#c0a030',
  },
  o_ginji: {
    hair: 'shortSpiky', hairColor: '#2a1810',
    eye: 'alert', eyeColor: '#5a3010',
    mouth: 'neutral',
  },
  o_chigusa: {
    hair: 'wavy', hairColor: '#2a1810',
    eye: 'gentle', eyeColor: '#3a3020',
    mouth: 'smile', female: true,
  },
  o_touma: {
    hair: 'neat', hairColor: '#181418',
    eye: 'calm', eyeColor: '#283040',
    mouth: 'neutral',
  },

  // ── 黒瀬衆 ────────────────────────────────────────────
  o_gogetsu: {
    hair: 'wild', hairColor: '#181018',
    eye: 'fierce', eyeColor: '#2a0808',
    mouth: 'stern',
  },
  o_kagesada: {
    hair: 'swept', hairColor: '#181018',
    eye: 'sharp', eyeColor: '#201828',
    mouth: 'stern',
  },
  o_rin: {
    hair: 'shortSpiky', hairColor: '#181418',
    eye: 'alert', eyeColor: '#203028',
    mouth: 'neutral', female: true,
  },
  o_gen: {
    hair: 'neat', hairColor: '#505058',
    eye: 'calm', eyeColor: '#303838',
    mouth: 'neutral',
  },

  // ── 風見連合 ──────────────────────────────────────────
  o_jin: {
    hair: 'swept', hairColor: '#2a1808',
    eye: 'alert', eyeColor: '#583808',
    mouth: 'neutral',
  },
  o_midori: {
    hair: 'long', hairColor: '#181c14',
    eye: 'gentle', eyeColor: '#284028',
    mouth: 'smile', female: true,
  },
  o_rei: {
    hair: 'wavy', hairColor: '#181418',
    eye: 'calm', eyeColor: '#303050',
    mouth: 'neutral', female: true,
  },
  o_souma: {
    hair: 'shortSpiky', hairColor: '#2a1a10',
    eye: 'alert', eyeColor: '#4a3010',
    mouth: 'neutral',
  },

  // ── 朱浜家 ────────────────────────────────────────────
  o_madoka: {
    hair: 'updo', hairColor: '#181014',
    eye: 'calm', eyeColor: '#3a2010',
    mouth: 'smile', female: true,
    accessory: 'pin', accColor: '#d09020',
  },
  o_katsura: {
    hair: 'topknot', hairColor: '#181418',
    eye: 'fierce', eyeColor: '#2a1010',
    mouth: 'stern',
  },
  o_iori: {
    hair: 'neat', hairColor: '#181020',
    eye: 'gentle', eyeColor: '#182838',
    mouth: 'neutral',
  },
  o_akari: {
    hair: 'wavy', hairColor: '#2a1808',
    eye: 'gentle', eyeColor: '#3a2828',
    mouth: 'smile', female: true,
  },

  // ── 浪人衆 ────────────────────────────────────────────
  o_gento: {
    hair: 'messy', hairColor: '#2a1810',
    eye: 'alert', eyeColor: '#3a2808',
    mouth: 'neutral',
  },
  o_kisaragi: {
    hair: 'long', hairColor: '#181018',
    eye: 'calm', eyeColor: '#383858',
    mouth: 'neutral', female: true,
  },
  o_ryuga: {
    hair: 'wild', hairColor: '#181018',
    eye: 'fierce', eyeColor: '#1a0808',
    mouth: 'stern',
  },
  o_chizuru: {
    hair: 'wavy', hairColor: '#2a1810',
    eye: 'gentle', eyeColor: '#3a2828',
    mouth: 'smile', female: true,
  },
};

export const defaultDesign: CharDesign = {
  hair: 'neat',
  hairColor: '#181418',
  eye: 'calm',
  eyeColor: '#303030',
  mouth: 'neutral',
};
