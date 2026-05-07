// 武将台詞システム
// 和風国取りSLG向けの個性的な台詞を各武将に設定する

/** 攻撃開始時の台詞 */
export const attackQuotes: Record<string, string[]> = {
  o_harutsuna: [
    '暁ノ家の誇りにかけて、この地を奪う！',
    '全軍、続け！今こそ好機ぞ！',
    '我が剣の届くところに、敵はいない！',
  ],
  o_sayo: [
    '矢は放つ前に、もう届いておる。',
    '静かに、されど確かに。参ります。',
    '風を読め。それだけでよい。',
  ],
  o_saku: [
    'ちょっと待って、作戦確認——よし、行くよ！',
    '私が先頭で突っ込めばいいんでしょ？',
    '勝ち確ね。では参りましょうか！',
  ],
  o_naozumi: [
    '数字で見れば、勝てる戦だ。進む。',
    '算段は立っている。あとは実行のみ。',
    '損益を考えれば、ここで引く理由はない。',
  ],
  o_mayuki: [
    '……行きます。',
    '負けは、したくない。',
    '今度こそ、決める。',
  ],
  o_ginji: [
    'うっし、やるか！俺の出番だ！',
    '黙って俺についてこい！',
    'こういうのは好きだぜ、真っ向勝負！',
  ],
  // NPC・浪人
  o_touma: ['この戦、頂く。', '我が旗の下に伏せよ。', '速攻こそ我が流儀。'],
  o_gogetsu: ['鉄壁を破れるか、見せてみよ。', '策なき突撃は無謀に過ぎる。', '慎重に、だが確実に。'],
  o_kagesada: ['調略は済んだ。あとは形だけよ。', '内側から崩す。これが定石だ。', '情報は剣より鋭い。'],
  o_jin: ['疾風のごとく、参る！', 'この速さ、止められるか！', '一瞬で決する！'],
  o_madoka: ['皆の心は一つ。参りましょう！', '信頼こそ最強の武器。', '士気充填、全力で行きます！'],
  o_katsura: ['力押しで十分！', '細かいことはいい、突っ込む！', 'ここで一気に決める！'],
  o_gento: ['雇われ仕事だが、手は抜かん。', '腕試し、させてもらう。', '悪くない戦場だ。'],
  o_ryuga: ['貴様らに勝てるか、試してみよ。', '牙は見せてからでは遅い。', 'うおおお！'],
};

/** 攻撃勝利後の台詞 */
export const victoryQuotes: Record<string, string[]> = {
  o_harutsuna: [
    'これが暁ノ家の力だ！',
    '八州統一への道、また一歩進んだ！',
    '良い戦だった。皆、よくやった！',
  ],
  o_sayo: ['……勝ちましたね。', '予測通りでした。', '次の戦に備えましょう。'],
  o_saku: ['やったー！完璧じゃん！', 'ほら見て、私すごくない？', 'まあ当然か。えへへ。'],
  o_naozumi: ['計算通り。損害も想定内だ。', '効率的な勝利だ。', 'この戦果は記録しておこう。'],
  o_mayuki: ['……勝てた。', '良かった。', '次も、負けない。'],
  o_ginji: ['やったぜ！最高の戦だった！', '俺が先頭に立てば負けはない！', 'おしまい！次はどこだ？'],
  o_ryuga: ['ふん、こんなものか。', '悪くない。', '次はもっと強い奴と戦りたい。'],
  o_madoka: ['皆さんのお陰です！', 'やりました！万歳！', '心を一つに戦えば、必ず勝てます！'],
};

/** 防衛時（被攻撃時）の台詞 */
export const defenseQuotes: Record<string, string[]> = {
  o_harutsuna: ['我が領地に踏み込む者、一人も通さぬ！', '退け！ここは暁ノ家の地だ！'],
  o_sayo: ['来るとわかっていた。', '地の利は我にある。'],
  o_ginji: ['来い来い来い！返り討ちにしてやる！', 'よし、迎え撃つぞ！'],
  o_gogetsu: ['鉄壁の守り、崩せるものなら崩してみよ。', '動かざること山のごとし。'],
  o_madoka: ['皆、落ち着いて！必ず守り抜きます！', '守ることが、皆への約束です。'],
};

/** 敗北時の台詞 */
export const defeatQuotes: Record<string, string[]> = {
  o_harutsuna: ['くっ……撤退だ、ここで無駄死にするな！', 'まだだ……次こそ必ず！'],
  o_sayo: ['……読みが外れた。', '退きます。次は必ず。'],
  o_saku: ['え？嘘でしょ？！撤退撤退！', 'うー、悔しい！覚えてろよ！'],
  o_naozumi: ['想定外の損害だ……今は退こう。', '損切りが正解か。不本意だが。'],
  o_ginji: ['なにい……！？負けか……退くぞ！', 'こんな、こんな奴らに……！'],
  o_ryuga: ['……強い。だが、次は違う。', 'まだ終わっていない。'],
};

/** スキル発動時の台詞（スキルID→台詞） */
export const skillQuotes: Record<string, string> = {
  swiftCharge: '疾風のごとく！',
  firmFormation: '鉄壁、破れるものなら破ってみよ！',
  magistrate: '民の声を聞け。これが政というものよ。',
  strategistEye: '敵の動き……読んだ！',
  rally: '皆の者、気合を入れよ！',
  intrigue: 'すでに、内から崩れている……',
  castleCraft: '石垣一つで、千の兵に勝る。',
  popularTrust: '人の心をつかむのが、真の力。',
  fieldDrill: '日頃の鍛錬がここで活きる！',
};

/** 武将の性格タイプ（台詞フォールバック用） */
export type OfficerPersonality = 'brave' | 'calm' | 'cheerful' | 'stoic' | 'clever' | 'loyal';

export const officerPersonality: Record<string, OfficerPersonality> = {
  o_harutsuna: 'brave',
  o_sayo: 'calm',
  o_saku: 'cheerful',
  o_naozumi: 'clever',
  o_mayuki: 'stoic',
  o_ginji: 'brave',
  o_touma: 'brave',
  o_gogetsu: 'calm',
  o_kagesada: 'clever',
  o_rin: 'brave',
  o_gen: 'clever',
  o_jin: 'brave',
  o_midori: 'calm',
  o_rei: 'calm',
  o_souma: 'loyal',
  o_madoka: 'loyal',
  o_katsura: 'brave',
  o_iori: 'clever',
  o_akari: 'cheerful',
  o_gento: 'stoic',
  o_kisaragi: 'clever',
  o_ryuga: 'brave',
  o_chizuru: 'cheerful',
};

const genericAttackByPersonality: Record<OfficerPersonality, string[]> = {
  brave: ['参る！', '遅れるな、前へ！', '怖れるな、俺についてこい！'],
  calm: ['着実に、進む。', '乱れるな。', '冷静に対処せよ。'],
  cheerful: ['いくよー！', 'やってやろう！', '楽しくなってきた！'],
  stoic: ['……行く。', '黙って従え。', '余計な口は要らぬ。'],
  clever: ['算段は整った。', '策は万全だ。', '失敗は想定済みだ。'],
  loyal: ['殿のために！', '皆のために戦う！', 'この命、捧げます！'],
};

const genericVictoryByPersonality: Record<OfficerPersonality, string[]> = {
  brave: ['よし、勝った！次だ！', '俺たちに不可能はない！'],
  calm: ['想定内だ。次の手を考えよう。', '勝利を確認した。'],
  cheerful: ['やったー！最高！', 'ばっちり！えへへ！'],
  stoic: ['……以上だ。', '勝った。それだけだ。'],
  clever: ['予測通り。', '計画は完遂した。'],
  loyal: ['殿のためなら、何でもできます！', '皆の力が勝利をつかんだ！'],
};

const genericDefeatByPersonality: Record<OfficerPersonality, string[]> = {
  brave: ['くっ……退くぞ！', 'まだ終わっていない！'],
  calm: ['……退こう。損害を抑えることが先決だ。', '冷静に後退する。'],
  cheerful: ['あちゃー！撤退撤退！', '次はうまくやるもん！'],
  stoic: ['……退く。', '失敗だ。'],
  clever: ['誤算があった。一時撤退する。', '情報が足りなかった。'],
  loyal: ['申し訳ありません……退きます。', 'ここで死ぬわけにはいかぬ！'],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getAttackQuote(officerId: string): string {
  const specific = attackQuotes[officerId];
  if (specific) return pickRandom(specific);
  const personality = officerPersonality[officerId] ?? 'brave';
  return pickRandom(genericAttackByPersonality[personality]);
}

export function getVictoryQuote(officerId: string): string {
  const specific = victoryQuotes[officerId];
  if (specific) return pickRandom(specific);
  const personality = officerPersonality[officerId] ?? 'brave';
  return pickRandom(genericVictoryByPersonality[personality]);
}

export function getDefeatQuote(officerId: string): string {
  const specific = defeatQuotes[officerId];
  if (specific) return pickRandom(specific);
  const personality = officerPersonality[officerId] ?? 'brave';
  return pickRandom(genericDefeatByPersonality[personality]);
}

export function getSkillQuote(skillId: string): string {
  return skillQuotes[skillId] ?? '必殺！';
}

/** 武将の肩書（表示用） */
export const officerTitles: Record<string, string> = {
  o_harutsuna: '暁ノ家 当主',
  o_sayo: '暁ノ家 弓頭',
  o_saku: '暁ノ家 斥候将',
  o_naozumi: '暁ノ家 軍師',
  o_mayuki: '暁ノ家 騎馬将',
  o_ginji: '暁ノ家 先鋒将',
  o_touma: '白峰方 旗頭',
  o_gogetsu: '白峰方 守将',
  o_kagesada: '黒瀬衆 謀臣',
  o_rin: '黒瀬衆 勇将',
  o_gen: '黒瀬衆 軍師',
  o_jin: '風見連合 将',
  o_midori: '風見連合 政務',
  o_rei: '風見連合 参謀',
  o_souma: '風見連合 将校',
  o_madoka: '朱浜家 統帥',
  o_katsura: '朱浜家 武将',
  o_iori: '朱浜家 城守',
  o_akari: '朱浜家 参謀',
  o_gento: '浪人',
  o_kisaragi: '浪人',
  o_ryuga: '浪人',
  o_chizuru: '浪人',
};

/** 武将の「属性」アイコン（戦闘系 / 政務系 / バランス） */
export function getOfficerRole(officer: { command: number; valor: number; wisdom: number; politics: number }): '武' | '文' | '智' {
  const martial = officer.command + officer.valor;
  const civil = officer.politics + officer.wisdom;
  if (martial - civil > 15) return '武';
  if (civil - martial > 15) return '文';
  return '智';
}

/** ランダムイベントのフレーバー台詞 */
export const eventDialogue: Record<string, { title: string; drama: string; speaker: string }> = {
  goodHarvest: {
    title: '豊作の知らせ',
    drama: '今年は大豊作じゃ！田畑は実り、民の顔にも笑みが戻った。兵糧に余裕が生まれた。',
    speaker: '老農',
  },
  badHarvest: {
    title: '凶作の報告',
    drama: '殿……今年の稲は、ほとんど実らず。厳しい冬を覚悟しなければなりませぬ。',
    speaker: '郡代',
  },
  merchant: {
    title: '商人の来訪',
    drama: '遠路はるばる参りました。良い兵糧がございます。ご入り用でしたら——',
    speaker: '行商人',
  },
  ronin: {
    title: '浪人の来訪',
    drama: '仕官先を探しておりまする。拙者の腕、ご覧いただけませぬか。',
    speaker: '流れ者',
  },
  uprising: {
    title: '一揆の勃発',
    drama: '治安の乱れが臨界を超えた！民衆が武器を取り、役人を追い出したとの報！',
    speaker: '伝令',
  },
  artisan: {
    title: '名工の到来',
    drama: '城の石垣を見せていただきました。手を入れれば、まだまだ堅固にできまする。',
    speaker: '名工',
  },
  rumor: {
    title: '不穏な流言',
    drama: '殿に謀反の疑いあり……根拠のない噂が広まっております。士気に影響が出ております。',
    speaker: '忍び',
  },
  festival: {
    title: '祭礼の季節',
    drama: '今年も祭りの時が来た。笛の音が響き、民の心が一つになる。これが平和というものよ。',
    speaker: '神官',
  },
};
