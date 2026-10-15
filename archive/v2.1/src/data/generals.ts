// ===========================================================================
// ユニーク武将 22名 v2.1
// world_v2.md §4 に対応
// ===========================================================================

import type { General, GeneralId } from '../types/game';

interface UniqueTemplate {
  id: GeneralId;
  name: string;
  reading: string;
  factionId: General['factionId'];
  stats: General['stats'];
  skillIds: string[];
  troopMax: number;
  /** UI / 後日差替用キー */
  portraitKey: string;
  remarks: string;
}

/** 22名のユニーク武将テンプレート */
export const UNIQUE_GENERAL_TEMPLATES: UniqueTemplate[] = [
  // 暁ノ家
  {
    id: 'g_kazama_saku', name: '風間 朔', reading: 'かざま さく',
    factionId: 'akatsuki',
    stats: { command: 75, power: 88, intel: 60, charisma: 82 },
    skillIds: ['sk_issen', 'sk_kyouzaki'],
    troopMax: 800,
    portraitKey: 'akatsuki_saku',
    remarks: '暁ノ家の若き当主。粗暴で口は悪いが、誰よりも前に出る。',
  },
  {
    id: 'g_suzuran', name: '鈴蘭', reading: 'すずらん',
    factionId: 'akatsuki',
    stats: { command: 60, power: 35, intel: 78, charisma: 90 },
    skillIds: ['sk_kanagi', 'sk_harai'],
    troopMax: 400,
    portraitKey: 'akatsuki_suzuran',
    remarks: '朔付きの巫女。幼少期からの世話係。',
  },
  {
    id: 'g_asagiri_chikage', name: '朝霧 千景', reading: 'あさぎり ちかげ',
    factionId: 'akatsuki',
    stats: { command: 82, power: 50, intel: 92, charisma: 70 },
    skillIds: ['sk_sakubou', 'sk_kobu'],
    troopMax: 600,
    portraitKey: 'akatsuki_chikage',
    remarks: '朔の従姉、軍師。冷静沈着。',
  },
  {
    id: 'g_kazama_genba', name: '風間 玄蕃', reading: 'かざま げんば',
    factionId: 'akatsuki',
    stats: { command: 78, power: 75, intel: 65, charisma: 60 },
    skillIds: ['sk_teppeki', 'sk_konshin'],
    troopMax: 750,
    portraitKey: 'akatsuki_genba',
    remarks: '先代からの宿老。家を支える老将。',
  },

  // 黒鉄家
  {
    id: 'g_kurogane_genbu', name: '黒鉄 玄武', reading: 'くろがね げんぶ',
    factionId: 'kurogane',
    stats: { command: 85, power: 80, intel: 75, charisma: 70 },
    skillIds: ['sk_tetsuyari', 'sk_kokkou'],
    troopMax: 1200,
    portraitKey: 'kurogane_genbu',
    remarks: '黒鉄家当主。鉱山と鉄砲を背景に東方を支配する。',
  },
  {
    id: 'g_akaganezaki_hayato', name: '銅崎 隼人', reading: 'あかがねざき はやと',
    factionId: 'kurogane',
    stats: { command: 70, power: 78, intel: 70, charisma: 55 },
    skillIds: ['sk_isseisha', 'sk_sogeki'],
    troopMax: 560,
    portraitKey: 'kurogane_hayato',
    remarks: '黒鉄家鉄砲頭。',
  },
  {
    id: 'g_hagane_narukami', name: '鋼鉄 鳴雷', reading: 'はがね なるかみ',
    factionId: 'kurogane',
    stats: { command: 75, power: 92, intel: 60, charisma: 65 },
    skillIds: ['sk_raijin', 'sk_gouda'],
    troopMax: 900,
    portraitKey: 'kurogane_narukami',
    remarks: '黒鉄家筆頭武将。',
  },

  // 紫苑家
  {
    id: 'g_shionin_hazuki', name: '紫苑院 葉月', reading: 'しおんいん はづき',
    factionId: 'shion',
    stats: { command: 80, power: 50, intel: 92, charisma: 88 },
    skillIds: ['sk_sandan', 'sk_baishuu'],
    troopMax: 800,
    portraitKey: 'shion_hazuki',
    remarks: '紫苑家当主、若き女当主。商才と冷徹さで知られる。',
  },
  {
    id: 'g_shionin_fuuko', name: '紫苑院 楓子', reading: 'しおんいん ふうこ',
    factionId: 'shion',
    stats: { command: 70, power: 82, intel: 65, charisma: 75 },
    skillIds: ['sk_kairikutachi', 'sk_ryakudatsu'],
    troopMax: 800,
    portraitKey: 'shion_fuuko',
    remarks: '葉月の妹、海賊頭。',
  },
  {
    id: 'g_narumi_souji', name: '鳴海 蒼司', reading: 'なるみ そうじ',
    factionId: 'shion',
    stats: { command: 72, power: 55, intel: 88, charisma: 60 },
    skillIds: ['sk_sakuryaku', 'sk_chouhatsu'],
    troopMax: 600,
    portraitKey: 'shion_souji',
    remarks: '紫苑家の知将。',
  },

  // 白鷺家
  {
    id: 'g_shirasagi_toshiro', name: '白鷺 凍司朗', reading: 'しらさぎ とうしろう',
    factionId: 'shirasagi',
    stats: { command: 88, power: 85, intel: 78, charisma: 75 },
    skillIds: ['sk_shinsoku', 'sk_shirasagi'],
    troopMax: 1000,
    portraitKey: 'shirasagi_toshiro',
    remarks: '白鷺家当主。古くからの武家の誇りを残す。',
  },
  {
    id: 'g_takaba_rin', name: '鷹羽 燐', reading: 'たかば りん',
    factionId: 'shirasagi',
    stats: { command: 70, power: 88, intel: 62, charisma: 70 },
    skillIds: ['sk_sanya', 'sk_yougan'],
    troopMax: 700,
    portraitKey: 'shirasagi_rin',
    remarks: '弓の名手。',
  },
  {
    id: 'g_yukimi_shizune', name: '雪見 静音', reading: 'ゆきみ しずね',
    factionId: 'shirasagi',
    stats: { command: 75, power: 82, intel: 60, charisma: 72 },
    skillIds: ['sk_yukigake', 'sk_totsugeki'],
    troopMax: 800,
    portraitKey: 'shirasagi_shizune',
    remarks: '騎馬隊長。',
  },

  // 焔ノ家
  {
    id: 'g_honoo_kurenai', name: '焔 紅葉', reading: 'ほのお くれない',
    factionId: 'honoo',
    stats: { command: 78, power: 60, intel: 85, charisma: 92 },
    skillIds: ['sk_kaenjin', 'sk_shinkanoinori'],
    troopMax: 700,
    portraitKey: 'honoo_kurenai',
    remarks: '焔ノ家当主、巫女。火山の神を祀る。',
  },
  {
    id: 'g_honoo_tomoshibi', name: '焔 燈火', reading: 'ほのお ともしび',
    factionId: 'honoo',
    stats: { command: 60, power: 80, intel: 55, charisma: 70 },
    skillIds: ['sk_hiyaritotsugeki', 'sk_honoonagi'],
    troopMax: 650,
    portraitKey: 'honoo_tomoshibi',
    remarks: '紅葉の弟、火槍使い。',
  },

  // 蓮華院
  {
    id: 'g_rengein_kangetsu', name: '蓮華院 観月', reading: 'れんげいん かんげつ',
    factionId: 'rengein',
    stats: { command: 82, power: 45, intel: 95, charisma: 90 },
    skillIds: ['sk_rengekekkai', 'sk_johkakou'],
    troopMax: 700,
    portraitKey: 'rengein_kangetsu',
    remarks: '蓮華院大導師、女性。妖魔調伏の中心人物。',
  },
  {
    id: 'g_horenbo_tesshin', name: '法蓮坊 鉄心', reading: 'ほうれんぼう てっしん',
    factionId: 'rengein',
    stats: { command: 75, power: 88, intel: 60, charisma: 65 },
    skillIds: ['sk_kongouhsh', 'sk_choubuku'],
    troopMax: 640,
    portraitKey: 'rengein_tesshin',
    remarks: '武僧。妖魔への特効を持つ。',
  },

  // 妖魔の群
  {
    id: 'g_kouou_kurobuchi', name: '蛟王 黒淵', reading: 'こうおう くろぶち',
    factionId: 'youma',
    stats: { command: 95, power: 95, intel: 85, charisma: 0 },
    skillIds: ['sk_kokumu', 'sk_mizuchikoukou'],
    troopMax: 2500,
    portraitKey: 'youma_kurobuchi',
    remarks: '妖魔の群首領。最終ボス。',
  },
  {
    id: 'g_yashahime_guren', name: '夜叉姫 紅蓮', reading: 'やしゃひめ ぐれん',
    factionId: 'youma',
    stats: { command: 80, power: 90, intel: 70, charisma: 70 },
    skillIds: ['sk_gurenmai', 'sk_kyuuketsu'],
    troopMax: 1500,
    portraitKey: 'youma_guren',
    remarks: '黒淵の側近。',
  },
  {
    id: 'g_kigai_gaou', name: '鬼鎧 牙王', reading: 'きがい がおう',
    factionId: 'youma',
    stats: { command: 70, power: 95, intel: 50, charisma: 0 },
    skillIds: ['sk_onikudaki', 'sk_dohatsu'],
    troopMax: 1500,
    portraitKey: 'youma_gaou',
    remarks: '鬼大将。',
  },

  // 浪人衆
  {
    id: 'g_shikkoku_kagemaru', name: '漆黒 影丸', reading: 'しっこく かげまる',
    factionId: 'ronin',
    stats: { command: 78, power: 85, intel: 80, charisma: 60 },
    skillIds: ['sk_ansatsu', 'sk_kagebunshin'],
    troopMax: 800,
    portraitKey: 'ronin_kagemaru',
    remarks: '浪人衆頭領、忍。',
  },
  {
    id: 'g_sakutsuki_yuzuriha', name: '朔月 楪', reading: 'さくつき ゆずりは',
    factionId: 'ronin',
    stats: { command: 65, power: 90, intel: 60, charisma: 80 },
    skillIds: ['sk_sougetsuzan', 'sk_zanshin'],
    troopMax: 700,
    portraitKey: 'ronin_yuzuriha',
    remarks: '二刀流の女剣士。',
  },
];

/** 初期 GameState の General レコードを構築する */
export function buildInitialGenerals(): Record<GeneralId, General> {
  const out: Record<GeneralId, General> = {};
  for (const t of UNIQUE_GENERAL_TEMPLATES) {
    out[t.id] = {
      id: t.id,
      name: t.name,
      reading: t.reading,
      factionId: t.factionId,
      homeFactionId: t.factionId,
      isUnique: true,
      isGeneric: false,
      trait: 'normal',
      stats: { ...t.stats },
      skillIds: [...t.skillIds],
      troopMax: t.troopMax,
      troopCurrent: t.troopMax,
      stamina: 100,
      loyalty: 90,
      status: 'free',
      capturedTurns: 0,
      persuadeAttempts: 0,
      portraitKey: t.portraitKey,
      remarks: t.remarks,
    };
  }
  return out;
}
