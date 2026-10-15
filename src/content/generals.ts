// 武将（固有22名と、名もなき侍大将）。名前・設定・台詞はすべて独自
import type { FactionId } from './sengoku';
import type { Kind } from '../battle/types';

/** 台詞の1行：[話す人の武将ID（'' は地の文）, 文] */
export type Line = [string, string];

export interface BondEvent { title: string; lines: Line[] }

export type FightStyle = 'melee' | 'reach' | 'bow' | 'gun';

export interface GenDef {
  id: string;
  name: string;
  /** 短い呼び名（台詞の名札） */
  short: string;
  reading: string;
  faction: FactionId;
  role: string;
  portrait: string;
  /** 統率・武力・知略・魅力 */
  cmd: number;
  pow: number;
  int: number;
  cha: number;
  /** 技（2つ目は絆が深まると使える） */
  skills: [string, string];
  style: FightStyle;
  /** 合戦の兵種 */
  kind: Kind;
  /** 妖魔（霊に効く技が効く） */
  youkai?: boolean;
  /** 登用できない */
  never?: boolean;
  /** 主家が残っている間は仕えない */
  loyal?: boolean;
  /** 最初の Lv の上乗せ */
  lvBonus?: number;
  desc: string;
  intro: string;
  defeat: string;
  join: string;
  refuse?: string;
  bond: BondEvent[];
}

export const GENERALS: GenDef[] = [
  // ── 暁ノ家 ──
  {
    id: 'g_saku', name: '風間 朔', short: '朔', reading: 'かざま さく', faction: 'akatsuki', role: '当主・剣士', portrait: 'akatsuki_saku',
    cmd: 75, pow: 88, int: 60, cha: 82, skills: ['issen', 'kyouzaki'], style: 'melee', kind: 'bushi',
    desc: '暁ノ家の若き当主。口は悪いが誰より前に出る。剣の冴えは常人離れしている。',
    intro: '', defeat: '', join: '',
    bond: [],
  },
  {
    id: 'g_suzuran', name: '鈴蘭', short: '鈴蘭', reading: 'すずらん', faction: 'akatsuki', role: '巫女', portrait: 'akatsuki_suzuran',
    cmd: 60, pow: 35, int: 78, cha: 90, skills: ['harai', 'kanagi'], style: 'melee', kind: 'miko',
    desc: '朔の幼い頃からの世話係。巫女の家の生まれで、癒しと祓いの術を使う。朔にだけは容赦がない。',
    intro: '', defeat: '', join: '',
    bond: [
      { title: '朝餉の小言', lines: [
        ['g_suzuran', '若、また朝餉を抜きましたね。戦の前こそ食べるものです。'],
        ['g_saku', '腹が減ってた方が剣が冴えるんだよ。'],
        ['g_suzuran', '冴えるのは剣ではなく機嫌の悪さです。はい、おにぎり。三つ。'],
        ['g_saku', '……一つは梅干しじゃねえだろうな。'],
        ['g_suzuran', '全部梅干しです。好き嫌いも直していただきます。'],
      ] },
      { title: '社の鈴', lines: [
        ['', '夜更け。鈴蘭は焼けた社の跡で、ひとり鈴を鳴らしていた。'],
        ['g_suzuran', '先代さまが亡くなった夜も、こうして鳴らしました。若が泣かないので、代わりに。'],
        ['g_saku', '……泣くかよ。泣いてる暇があったら一つでも多く国を取る。'],
        ['g_suzuran', 'はい。だから私は、若が倒れない限り、何度でも立たせます。'],
        ['', '鈴蘭の祓いの力が強まった。新しい技「神薙ぎ」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_chikage', name: '朝霧 千景', short: '千景', reading: 'あさぎり ちかげ', faction: 'akatsuki', role: '軍師', portrait: 'akatsuki_chikage',
    cmd: 82, pow: 50, int: 92, cha: 70, skills: ['sakubou', 'kobu'], style: 'melee', kind: 'gunshi',
    desc: '朔の従姉で暁ノ家の軍師。冷静沈着。扇の陰でいつも三手先を読んでいる。',
    intro: '', defeat: '', join: '',
    bond: [
      { title: '盤上の戦', lines: [
        ['g_chikage', '朔、一局どう。負けたら今日の書状を全部読んでもらうわ。'],
        ['g_saku', '上等だ。……おい、なんで俺の王将がもう詰んでる。'],
        ['g_chikage', 'あなたは駒を前にしか進めないもの。戦も同じ。退く手も覚えなさい。'],
        ['g_saku', '退いたら負けだろ。'],
        ['g_chikage', '退いて勝つのが軍師の仕事よ。……それを任せてくれるなら、だけど。'],
      ] },
      { title: '扇の内', lines: [
        ['g_chikage', '本当はね、私も前に出たいの。あなたの隣で。'],
        ['g_saku', 'なら出りゃいい。背中は空けとく。'],
        ['g_chikage', '……馬鹿ね。軍師が前に出たら、誰が退き際を決めるの。'],
        ['g_chikage', 'でも、声だけは届けるわ。皆の背を押す声を。'],
        ['', '千景の采配が冴えた。新しい技「鼓舞」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_genba', name: '風間 玄蕃', short: '玄蕃', reading: 'かざま げんば', faction: 'akatsuki', role: '宿老・盾', portrait: 'akatsuki_genba',
    cmd: 78, pow: 75, int: 65, cha: 60, skills: ['teppeki', 'konshin'], style: 'reach', kind: 'ashigaru', lvBonus: 1,
    desc: '先代から仕える宿老。朔の大叔父。槍と盾で家を支えてきた老将。',
    intro: '', defeat: '', join: '',
    bond: [
      { title: '古傷', lines: [
        ['g_genba', '若。この肩の傷は、先代をかばって受けたものでしてな。'],
        ['g_saku', '耳にたこができるほど聞いた。'],
        ['g_genba', 'では、今日は続きを。先代は傷を見て笑われた。「玄蕃、次は俺がかばう」と。'],
        ['g_genba', '約束は果たされぬまま逝かれた。……若、どうか爺より先に逝きなさるな。'],
      ] },
      { title: '老いた槍', lines: [
        ['g_saku', '爺、無茶すんなよ。この前も腰をやったろ。'],
        ['g_genba', 'はっはっは！ 若に気遣われる日が来るとは。先代にお聞かせしたい。'],
        ['g_genba', 'なに、老いた槍にも一突きぶんの力は残っております。命を燃やす一突きが。'],
        ['', '玄蕃の槍が冴えた。新しい技「渾身」を覚えた。'],
      ] },
    ],
  },
  // ── 黒鉄家 ──
  {
    id: 'g_genbu', name: '黒鉄 玄武', short: '玄武', reading: 'くろがね げんぶ', faction: 'kurogane', role: '黒鉄家当主', portrait: 'kurogane_genbu',
    cmd: 85, pow: 80, int: 75, cha: 70, skills: ['tetsuyari', 'kokkou'], style: 'reach', kind: 'ashigaru', loyal: true,
    desc: '黒鉄家当主。鉱山と鉄砲を背に東を治める。力こそが民を守ると信じている。',
    intro: '玄武「小僧が。鉄の重さを教えてやる」',
    defeat: '玄武「……鉄より硬い剣か。見事だ」',
    join: '玄武「黒鉄の民を飢えさせぬと誓え。ならばこの槍、貴様に預ける」',
    refuse: '玄武「家の者が一人でも戦っている間、膝は折らん」',
    bond: [
      { title: '鉄の掟', lines: [
        ['g_genbu', '小僧……いや、殿。鉄砲は好かんか。'],
        ['g_saku', '撃つより斬る方が性に合う。'],
        ['g_genbu', '儂もだ。だが民は剣を振れぬ。引き金なら引ける。それだけの話よ。'],
        ['g_genbu', '強さを独り占めせぬことだ。それが鉄の掟だ。'],
      ] },
      { title: '黒き甲冑', lines: [
        ['g_genbu', 'この甲冑は父から継いだ。重いぞ。着てみるか。'],
        ['g_saku', '……動けねえ。よくこれで槍を振れるな。'],
        ['g_genbu', '重さに慣れれば、それは盾になる。殿の兵にも分けてやろう。'],
        ['', '玄武が心を開いた。新しい技「黒甲」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_hayato', name: '銅崎 隼人', short: '隼人', reading: 'あかがねざき はやと', faction: 'kurogane', role: '鉄砲頭', portrait: 'kurogane_hayato',
    cmd: 70, pow: 78, int: 70, cha: 55, skills: ['isseisha', 'sogeki'], style: 'gun', kind: 'teppo',
    desc: '黒鉄家の鉄砲頭。口数は少ないが、狙った的は外さない。',
    intro: '隼人「……撃て」',
    defeat: '隼人「弾が……届かなかった」',
    join: '隼人「腕を買ってくれるなら、撃つ先はどこでもいい」',
    bond: [
      { title: '火縄の匂い', lines: [
        ['g_hayato', '……殿は、鉄砲の音が怖くないのか。'],
        ['g_saku', 'うるせえとは思う。'],
        ['g_hayato', '怖がらない者は少ない。……少し、気に入った。'],
      ] },
      { title: '一発の重み', lines: [
        ['g_hayato', '一発撃つのに、弾と火薬と、職人ひと月分の手間がかかる。'],
        ['g_hayato', 'だから外さない。外せば職人の手間を捨てることになる。'],
        ['g_saku', 'お前、案外しゃべるんだな。'],
        ['g_hayato', '……今のは、忘れてくれ。'],
        ['', '隼人の狙いが研ぎ澄まされた。新しい技「狙撃」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_narukami', name: '鋼鉄 鳴雷', short: '鳴雷', reading: 'はがね なるかみ', faction: 'kurogane', role: '黒鉄家筆頭武将', portrait: 'kurogane_narukami',
    cmd: 75, pow: 92, int: 60, cha: 65, skills: ['raijin', 'gouda'], style: 'melee', kind: 'bushi', loyal: true,
    desc: '黒鉄家の筆頭武将。雷の鳴る峠で生まれ、雷のように戦う。',
    intro: '鳴雷「がっはっは！ 雷鳴峠へようこそ、暁の小僧！」',
    defeat: '鳴雷「ぐっ……！ 雷より速い剣があるとはな！」',
    join: '鳴雷「面白い！ お前の行く先には、もっと強い奴がいそうだ！」',
    refuse: '鳴雷「玄武の殿が立っている限り、俺は黒鉄の雷よ！」',
    bond: [
      { title: '力比べ', lines: [
        ['g_narukami', '殿！ 腕相撲だ！ 負けた方が今日の酒をおごる！'],
        ['g_saku', 'いいぜ。……っ、てめえ、腕が丸太かよ。'],
        ['g_narukami', 'がっはっは！ 俺の勝ちだ！ ……おい、なぜ鈴蘭殿が怒っている？'],
        ['g_suzuran', '酒代は家の蔵から出るのです。お二人とも、正座。'],
      ] },
      { title: '雷の生まれ', lines: [
        ['g_narukami', '俺は雷の夜に生まれた。母上は「この子は雷に愛された」と笑ったそうだ。'],
        ['g_narukami', '雷は怖いものじゃない。暗い夜道を照らす光だ。俺もそうありたい。'],
        ['', '鳴雷の拳に雷が宿った。新しい技「豪打」を覚えた。'],
      ] },
    ],
  },
  // ── 紫苑家 ──
  {
    id: 'g_hazuki', name: '紫苑院 葉月', short: '葉月', reading: 'しおんいん はづき', faction: 'shion', role: '紫苑家当主', portrait: 'shion_hazuki',
    cmd: 80, pow: 50, int: 92, cha: 88, skills: ['sandan', 'baishuu'], style: 'bow', kind: 'gunshi', loyal: true,
    desc: '紫苑家の若き女当主。商才と冷徹さで湊を富ませた。損な取引は決してしない。',
    intro: '葉月「いくらで退いてくださるの？ ……そう、値の付かない方なのね」',
    defeat: '葉月「計算違い……あなた、損得で動かないのね」',
    join: '葉月「よろしいわ。あなたという博打に、紫苑の蔵を賭けましょう」',
    refuse: '葉月「紫苑の旗が一本でも立つうちは、帳簿を閉じるわけにはいかないの」',
    bond: [
      { title: '帳簿', lines: [
        ['g_hazuki', '殿、この戦、兵糧が三割余計にかかっています。'],
        ['g_saku', '腹が減っては戦ができねえ。'],
        ['g_hazuki', 'ええ。だから余計にかけた分、勝っていただかないと困るの。……期待しているわ。'],
      ] },
      { title: '値の付かないもの', lines: [
        ['g_hazuki', '私、何にでも値を付けてきたわ。人の心にも。'],
        ['g_hazuki', 'でも、あなたに付く値だけは、どうしても計算できないの。'],
        ['g_saku', '安いってことか？'],
        ['g_hazuki', '……本当に、勘定のできない方。'],
        ['', '葉月が本気で手を貸すことにした。新しい技「買収」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_fuuko', name: '紫苑院 楓子', short: '楓子', reading: 'しおんいん ふうこ', faction: 'shion', role: '海賊頭', portrait: 'shion_fuuko',
    cmd: 70, pow: 82, int: 65, cha: 75, skills: ['kairikutachi', 'ryakudatsu'], style: 'melee', kind: 'bushi',
    desc: '葉月の妹。家を飛び出して海賊頭になった。豪快で、よく笑う。',
    intro: '楓子「あははっ！ 陸の侍が潮咲に何の用？ 獲物は早い者勝ちだよ！」',
    defeat: '楓子「参った参った！ あんた、海でも生きていけるね！」',
    join: '楓子「姉さんより先にあんたに付くってのも面白い。乗った！」',
    bond: [
      { title: '舟遊び', lines: [
        ['g_fuuko', '殿、舟出すよ！ 魚釣り勝負！'],
        ['g_saku', '……酔った。陸に戻せ。'],
        ['g_fuuko', 'あはは！ 天下の剣士さまの弱点見っけ！ 皆に言いふらそっと！'],
      ] },
      { title: '姉と妹', lines: [
        ['g_fuuko', '姉さんはさ、全部に値段を付けるでしょ。あたしはそれが嫌で海に出たの。'],
        ['g_fuuko', 'でも姉さん、あたしにだけは値段を付けなかった。……ずるいよね。'],
        ['', '楓子の刃に迷いがなくなった。新しい技「略奪」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_souji', name: '鳴海 蒼司', short: '蒼司', reading: 'なるみ そうじ', faction: 'shion', role: '知将', portrait: 'shion_souji',
    cmd: 72, pow: 55, int: 88, cha: 60, skills: ['sakuryaku', 'chouhatsu'], style: 'bow', kind: 'gunshi',
    desc: '紫苑家の知将。眼鏡の奥で策を巡らせる。書物と算盤が友。',
    intro: '蒼司「計算どおりなら、あなたはここで詰みです」',
    defeat: '蒼司「計算の外……。興味深い」',
    join: '蒼司「あなたという変数を、もう少し観察させてください」',
    bond: [
      { title: '書庫', lines: [
        ['g_souji', '殿、この書庫の本を全部読みました。次の本を所望します。'],
        ['g_saku', '……三日前に入れたばっかだぞ。'],
        ['g_souji', '速読は軍師の嗜みです。千景殿は二日でした。悔しいので、次は一日で。'],
      ] },
      { title: '眼鏡', lines: [
        ['g_souji', '昔、眼鏡を笑われましてね。でもこれのおかげで、敵の旗の紋まで見えるのです。'],
        ['g_souji', '人より見えるなら、人より先に手を打てる。……それが私の戦です。'],
        ['', '蒼司の策が冴えた。新しい技「挑発」を覚えた。'],
      ] },
    ],
  },
  // ── 白鷺家 ──
  {
    id: 'g_toshiro', name: '白鷺 凍司朗', short: '凍司朗', reading: 'しらさぎ とうしろう', faction: 'shirasagi', role: '白鷺家当主', portrait: 'shirasagi_toshiro',
    cmd: 88, pow: 85, int: 78, cha: 75, skills: ['hyouga', 'shinsoku'], style: 'melee', kind: 'bushi', loyal: true, lvBonus: 1,
    desc: '白鷺家の当主。古き武家の誇りを体現する老剣士。',
    intro: '凍司朗「白鷺の嶺に、土足で上がるか。若造」',
    defeat: '凍司朗「……老いたな。いや、そなたが速すぎるのか」',
    join: '凍司朗「誇りは捨てぬ。だが、誇りを預ける主は選べる」',
    refuse: '凍司朗「白鷺の血を継ぐ者が戦う限り、この首は渡さぬ」',
    bond: [
      { title: '剣の稽古', lines: [
        ['g_toshiro', '構えが荒い。だが、荒いまま速い。……妙な剣だ。'],
        ['g_saku', '直せって言うのか。'],
        ['g_toshiro', 'いや。直せばそなたの剣は死ぬ。荒さを磨け。儂が相手をしよう。'],
      ] },
      { title: '雪解け', lines: [
        ['g_toshiro', '儂の妻は、雪解けの季節に逝った。白鷺の嶺の雪は、それから溶けたことがない。'],
        ['g_toshiro', '……そなたらが騒がしいせいか、今年は溶けそうだ。'],
        ['', '凍司朗の剣に春が宿った。新しい技「神速」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_rin', name: '鷹羽 燐', short: '燐', reading: 'たかば りん', faction: 'shirasagi', role: '弓の名手', portrait: 'shirasagi_rin',
    cmd: 70, pow: 88, int: 62, cha: 70, skills: ['sanya', 'yougan'], style: 'bow', kind: 'yumi',
    desc: '白鷺家の弓の名手。鷹のような眼で、雪煙の向こうの的も射抜く。',
    intro: '燐「動かないで。外したくないから」',
    defeat: '燐「……矢が尽きた。あなたの勝ち」',
    join: '燐「あなたの背中を射る者がいたら、私が先に射る」',
    bond: [
      { title: '鷹', lines: [
        ['g_rin', 'この鷹、私が雛から育てたの。名前は「疾風」。'],
        ['g_saku', '……俺を睨んでるぞ。'],
        ['g_rin', '知らない人には懐かないの。私と同じ。……でも、そのうち慣れるわ。'],
      ] },
      { title: '的', lines: [
        ['g_rin', '弓を引く時、的のことしか考えない。そうしないと手が震えるから。'],
        ['g_rin', 'でも最近は、的の向こうに殿の背中が見える。……不思議と、震えないの。'],
        ['', '燐の眼が冴えた。新しい技「鷹眼」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_shizune', name: '雪見 静音', short: '静音', reading: 'ゆきみ しずね', faction: 'shirasagi', role: '騎馬隊長', portrait: 'shirasagi_shizune',
    cmd: 75, pow: 82, int: 60, cha: 72, skills: ['totsugeki', 'yukigake'], style: 'reach', kind: 'kiba',
    desc: '白鷺家の騎馬隊長。銀の髪をなびかせ、雪原を誰より速く駆ける。',
    intro: '静音「雪見野を駆け抜けられると思わないで」',
    defeat: '静音「雪に足を取られたのは……私の方だったのね」',
    join: '静音「馬を一頭、預けてくれる？ それで十分よ」',
    bond: [
      { title: '馬の世話', lines: [
        ['g_shizune', '殿、馬の毛並みを見て。今朝は機嫌がいいわ。'],
        ['g_saku', '分かんねえ。'],
        ['g_shizune', '耳が前を向いているでしょう。……殿も、機嫌がいいと眉が上がるのね。'],
      ] },
      { title: '雪原の夢', lines: [
        ['g_shizune', 'いつか、戦のない雪原を、ただ駆けてみたいの。'],
        ['g_saku', 'なら国を全部取って、雪原ごとお前にやるよ。'],
        ['g_shizune', '……大きく出たわね。約束よ。'],
        ['', '静音と馬の息が合った。新しい技「雪駆け」を覚えた。'],
      ] },
    ],
  },
  // ── 焔ノ家 ──
  {
    id: 'g_kurenai', name: '焔 紅葉', short: '紅葉', reading: 'ほのお くれない', faction: 'honoo', role: '焔ノ家当主・巫女', portrait: 'honoo_kurenai',
    cmd: 78, pow: 60, int: 85, cha: 92, skills: ['kaenjin', 'shinka'], style: 'bow', kind: 'onmyo', loyal: true,
    desc: '焔ノ家の当主で、火山の神に仕える巫女。炎の術を操り、民からは生き神と慕われる。',
    intro: '紅葉「神火を穢す者は、灰になって去りなさい」',
    defeat: '紅葉「神火が……あなたを認めた……？」',
    join: '紅葉「火は人を焼くためでなく、人を温めるためにある。それを証してください」',
    refuse: '紅葉「弟が戦う限り、私は焔ノ家の巫女です」',
    bond: [
      { title: '神火', lines: [
        ['g_kurenai', 'この火は千年、絶やされたことがありません。私の役目は、ただ見守ること。'],
        ['g_saku', '退屈じゃねえか。'],
        ['g_kurenai', 'ふふ。初めて言われました。……少しだけ、そうかもしれません。'],
      ] },
      { title: '巫女の祈り', lines: [
        ['g_kurenai', '殿のために祈ってもよいでしょうか。神様には内緒で。'],
        ['g_saku', '神様に内緒の祈りって、効くのか？'],
        ['g_kurenai', '効きます。私の祈りですもの。'],
        ['', '紅葉の祈りが届いた。新しい技「神火の祈り」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_tomoshibi', name: '焔 燈火', short: '燈火', reading: 'ほのお ともしび', faction: 'honoo', role: '火槍使い', portrait: 'honoo_tomoshibi',
    cmd: 60, pow: 80, int: 55, cha: 70, skills: ['hiyari', 'honoonagi'], style: 'reach', kind: 'teppo',
    desc: '紅葉の弟。火を噴く槍を振るう熱血漢。姉には頭が上がらない。',
    intro: '燈火「姉上には指一本触れさせない！ 燃えろぉぉ！」',
    defeat: '燈火「くそっ……！ 俺の炎が、消えた……」',
    join: '燈火「姉上を守れるなら、あんたの下でもいい。……いや、守らせてくれ！」',
    bond: [
      { title: '焼き芋', lines: [
        ['g_tomoshibi', '殿！ 火槍で焼き芋を作った！ 食え！'],
        ['g_saku', '……炭じゃねえか。'],
        ['g_tomoshibi', '中は！ 中はうまいはずなんだ！ 姉上はいつも食べてくれる！'],
      ] },
      { title: '弟の意地', lines: [
        ['g_tomoshibi', '俺、姉上みたいに祈れない。火を出すことしかできないんだ。'],
        ['g_saku', '十分だろ。寒い夜には、祈りよりたき火だ。'],
        ['g_tomoshibi', '……へへ。殿、たまにいいこと言うな！'],
        ['', '燈火の炎が燃え上がった。新しい技「焔薙ぎ」を覚えた。'],
      ] },
    ],
  },
  // ── 蓮華院 ──
  {
    id: 'g_kangetsu', name: '蓮華院 観月', short: '観月', reading: 'れんげいん かんげつ', faction: 'rengein', role: '蓮華院大導師', portrait: 'rengein_kangetsu',
    cmd: 82, pow: 45, int: 95, cha: 90, skills: ['kekkai', 'jouka'], style: 'bow', kind: 'miko', loyal: true,
    desc: '蓮華院の大導師。妖魔調伏の中心となる尼僧。穏やかだが、芯は鋼のよう。',
    intro: '観月「争いは何も生みません。……ですが、退けぬ時もあります」',
    defeat: '観月「あなたの剣に、迷いがありませんでした」',
    join: '観月「黒淵を討つため、蓮華院の祈りをあなたに」',
    refuse: '観月「蓮華の門徒が一人でも残るなら、私は院を離れられません」',
    bond: [
      { title: '写経', lines: [
        ['g_kangetsu', '殿、写経をなさいませんか。心が静まります。'],
        ['g_saku', '……三行で寝た。'],
        ['g_kangetsu', 'ふふ。眠れたのなら、それも功徳です。'],
      ] },
      { title: '浄化の光', lines: [
        ['g_kangetsu', '黒淵の霧は、人の憎しみを糧に濃くなるのです。'],
        ['g_kangetsu', 'だから戦のあとは、勝った者も負けた者も弔います。それが光を絶やさぬ道。'],
        ['', '観月の光が強まった。新しい技「浄化光」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_tesshin', name: '法蓮坊 鉄心', short: '鉄心', reading: 'ほうれんぼう てっしん', faction: 'rengein', role: '武僧', portrait: 'rengein_tesshin',
    cmd: 75, pow: 88, int: 60, cha: 65, skills: ['choubuku', 'kongousho'], style: 'melee', kind: 'sohei',
    desc: '蓮華院の武僧。金剛杵を振るい、妖魔を打ち払う。大食らい。',
    intro: '鉄心「喝ッ！ 千歳森に何用か、若造！」',
    defeat: '鉄心「ぬうっ……拙僧の修行が足りなんだか！」',
    join: '鉄心「妖魔を討つ旅なら、拙僧も混ぜてもらおう！ 飯は大盛りで頼む！」',
    bond: [
      { title: '大食らい', lines: [
        ['g_tesshin', '殿！ 拙僧、飯を五合いただいた！ 修行には力が要るのだ！'],
        ['g_suzuran', '……今月の兵糧が、なぜか足りないのです。'],
        ['g_tesshin', 'はっはっは！ ……すまぬ。'],
      ] },
      { title: '金剛の心', lines: [
        ['g_tesshin', '拙僧は昔、妖魔に村を焼かれた。だから仏門に入り、杵を握った。'],
        ['g_tesshin', '怒りは捨てよと教わったが、捨てられぬ。だから磨いた。金剛のように。'],
        ['', '鉄心の杵が唸った。新しい技「金剛杵」を覚えた。'],
      ] },
    ],
  },
  // ── 妖魔の群 ──
  {
    id: 'g_kurobuchi', name: '蛟王 黒淵', short: '黒淵', reading: 'こうおう くろぶち', faction: 'youma', role: '妖魔の首領', portrait: 'youma_kurobuchi',
    cmd: 95, pow: 95, int: 85, cha: 0, skills: ['kokumu', 'mizuchi'], style: 'melee', kind: 'onmyo', youkai: true, never: true, lvBonus: 4,
    desc: '黄泉沼の底から現れた妖魔の首領。人の憎しみを喰らい、八洲を黒い霧で覆おうとしている。',
    intro: '黒淵「小さき人の子よ。お前の憎しみは、さぞ甘かろう」',
    defeat: '黒淵「馬鹿な……憎しみ無き刃が、我を……！」',
    join: '',
    bond: [],
  },
  {
    id: 'g_guren', name: '夜叉姫 紅蓮', short: '紅蓮', reading: 'やしゃひめ ぐれん', faction: 'youma', role: '黒淵の側近', portrait: 'youma_guren',
    cmd: 80, pow: 90, int: 70, cha: 70, skills: ['gurenmai', 'kyuuketsu'], style: 'melee', kind: 'onmyo', youkai: true,
    desc: '黒淵に仕える夜叉の姫。気まぐれで、強い者にしか興味がない。',
    intro: '紅蓮「あら、可愛い坊や。黒淵様の前に、私と遊んでいきなさい」',
    defeat: '紅蓮「ふふ……負けちゃった。久しぶりに、楽しかったわ」',
    join: '紅蓮「黒淵様より、あなたの方が面白そう。退屈させないでね？」',
    bond: [
      { title: '夜叉の気まぐれ', lines: [
        ['g_guren', 'ねえ坊や、人の子はなぜ花を愛でるの？ すぐ枯れるのに。'],
        ['g_saku', 'すぐ枯れるからだろ。'],
        ['g_guren', '……ふうん。じゃあ、あなたもすぐ枯れるのね。少し、もったいないわ。'],
      ] },
      { title: '紅の記憶', lines: [
        ['g_guren', '私ね、昔は人だったの。もう名前も思い出せないけれど。'],
        ['g_guren', 'あなたといると、時々思い出しそうになるの。……嫌な坊や。'],
        ['', '紅蓮の炎が妖しく揺れた。新しい技「吸血」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_gaou', name: '鬼鎧 牙王', short: '牙王', reading: 'きがい がおう', faction: 'youma', role: '鬼大将', portrait: 'youma_gaou',
    cmd: 70, pow: 95, int: 50, cha: 20, skills: ['onikudaki', 'dohatsu'], style: 'melee', kind: 'bushi', youkai: true, lvBonus: 1,
    desc: '鬼哭原に陣取る鬼の大将。強い者と戦うことだけが生きがい。',
    intro: '牙王「グハハハ！ 強い匂いがする！ 来い、人の子！」',
    defeat: '牙王「グ……ハハ……！ 負けた……強い……！」',
    join: '牙王「お前に付いていけば、もっと強い奴と戦えるか？ ならば行く！」',
    bond: [
      { title: '鬼の流儀', lines: [
        ['g_gaou', '殿！ 鬼は強い者に従う！ だから殿に従う！'],
        ['g_saku', '分かりやすくていいな、お前。'],
        ['g_gaou', 'グハハ！ 殿も分かりやすい！ 気に入った！'],
      ] },
      { title: '鬼の涙', lines: [
        ['g_gaou', '……鬼哭原の鬼は、昔、人に追われて逃げた鬼だ。泣きながら逃げた。'],
        ['g_gaou', '殿の国では、鬼も泣かずに住めるか？'],
        ['g_saku', '住めるようにする。国を取るってのは、そういうことだ。'],
        ['', '牙王の怒りが力に変わった。新しい技「怒髪」を覚えた。'],
      ] },
    ],
  },
  // ── 浪人衆 ──
  {
    id: 'g_kagemaru', name: '漆黒 影丸', short: '影丸', reading: 'しっこく かげまる', faction: 'ronin', role: '浪人衆頭領・忍', portrait: 'ronin_kagemaru',
    cmd: 78, pow: 85, int: 80, cha: 60, skills: ['ansatsu', 'kagebunshin'], style: 'melee', kind: 'shinobi', loyal: true,
    desc: '浪人衆の頭領。忍の技を使う。素顔を見た者はいない。',
    intro: '影丸「……依頼人は誰か、とは聞くな」',
    defeat: '影丸「影が、光に負けたか」',
    join: '影丸「雇い主にしては、悪くない。……報酬は、天下の後でいい」',
    refuse: '影丸「仲間の浪人どもが残っている。頭が先に降りるわけにはいかん」',
    bond: [
      { title: '素顔', lines: [
        ['g_saku', 'お前、飯の時も覆面取らねえのか。'],
        ['g_kagemaru', '取れば、ただの男だ。忍は、ただの男であってはならん。'],
        ['g_saku', '……隙間から箸入れてるの、器用だな。'],
      ] },
      { title: '影の約束', lines: [
        ['g_kagemaru', '昔、主に捨てられた。影は用が済めば消えるものだと。'],
        ['g_saku', 'うちは消さねえよ。飯も出す。'],
        ['g_kagemaru', '……変わった雇い主だ。'],
        ['', '影丸が本気で仕えることにした。新しい技「影走り」を覚えた。'],
      ] },
    ],
  },
  {
    id: 'g_yuzuriha', name: '朔月 楪', short: '楪', reading: 'さくつき ゆずりは', faction: 'ronin', role: '二刀流剣士', portrait: 'ronin_yuzuriha',
    cmd: 65, pow: 90, int: 60, cha: 80, skills: ['sougetsu', 'zanshin'], style: 'melee', kind: 'bushi',
    desc: '二刀を操る流れの女剣士。強い剣士を探して旅をしている。',
    intro: '楪「あなたが噂の剣士？ ……一手、所望するわ」',
    defeat: '楪「見事……。私の二刀より、あなたの一刀が速い」',
    join: '楪「あなたの隣なら、もっと強くなれそう。連れていって」',
    bond: [
      { title: '名前', lines: [
        ['g_yuzuriha', '朔と朔月。名前が似ているわね、私たち。'],
        ['g_saku', '偶然だろ。'],
        ['g_yuzuriha', '剣士は偶然を縁と呼ぶの。……覚えておいて。'],
      ] },
      { title: '二刀の理由', lines: [
        ['g_yuzuriha', '二刀を持つのは、一本を師から、一本を兄弟子から継いだから。'],
        ['g_yuzuriha', '二人とも、妖魔に殺されたわ。私は二人分、強くならなきゃいけないの。'],
        ['', '楪の剣が澄んだ。新しい技「残心」を覚えた。'],
      ] },
    ],
  },
];

// ── 名もなき侍大将（浪人宿で雇える・城の守り手） ──

export interface GenericType { key: string; kind: Kind; label: string; portraits: string[]; cmd: [number, number]; pow: [number, number]; int: [number, number] }

/** 名もなき侍大将（兵種ごと） */
export const GENERIC_TYPES: GenericType[] = [
  { key: 'ashigaru', kind: 'ashigaru', label: '足軽大将', portraits: ['generic_normal', 'generic_defender'], cmd: [62, 80], pow: [50, 66], int: [45, 62] },
  { key: 'bushi', kind: 'bushi', label: '侍大将', portraits: ['generic_attacker', 'generic_wild', 'generic_commander'], cmd: [55, 72], pow: [70, 88], int: [30, 55] },
  { key: 'yumi', kind: 'yumi', label: '弓大将', portraits: ['generic_sniper'], cmd: [50, 66], pow: [62, 80], int: [45, 62] },
  { key: 'teppo', kind: 'teppo', label: '鉄砲頭', portraits: ['generic_commander', 'generic_defender'], cmd: [55, 70], pow: [62, 78], int: [45, 60] },
  { key: 'kiba', kind: 'kiba', label: '騎馬武者', portraits: ['generic_gem'], cmd: [60, 75], pow: [70, 86], int: [40, 58] },
  { key: 'shinobi', kind: 'shinobi', label: '忍頭', portraits: ['generic_sniper', 'generic_wild'], cmd: [45, 60], pow: [60, 76], int: [60, 76] },
  { key: 'gunshi', kind: 'gunshi', label: '軍師', portraits: ['generic_strategist'], cmd: [55, 70], pow: [35, 50], int: [75, 90] },
  { key: 'miko', kind: 'miko', label: '巫女頭', portraits: ['generic_gem', 'generic_strategist'], cmd: [45, 60], pow: [30, 45], int: [65, 82] },
  { key: 'sohei', kind: 'sohei', label: '僧兵頭', portraits: ['generic_defender', 'generic_normal'], cmd: [62, 78], pow: [62, 78], int: [45, 60] },
  { key: 'onmyo', kind: 'onmyo', label: '陰陽師', portraits: ['generic_strategist'], cmd: [45, 60], pow: [35, 50], int: [75, 90] },
  { key: 'youkai', kind: 'youkai', label: '鬼武者', portraits: ['youma_grunt'], cmd: [55, 70], pow: [75, 90], int: [25, 45] },
];

export const SURNAMES = ['山田', '岡部', '村瀬', '井川', '土井', '長谷', '片岡', '波多', '立花', '杉村', '宮田', '堀', '樋口', '神保', '武藤', '富田', '石井', '矢野', '三宅', '安藤', '磯野', '岩瀬', '北山', '古沢', '湯浅', '佐久間', '津田', '前野', '柴山', '榎本', '結城', '相馬', '本郷', '新庄', '鵜飼', '滝沢', '白石'];
export const GIVEN_NAMES = ['源八', '藤十郎', '与次郎', '新左衛門', '伊織', '左京', '九郎', '平助', '清次', '右近', '惣助', '忠平', '五兵衛', '市之助', '虎之助', '勘解由', '主水', '掃部', '兵部', '織部', '弥三郎', '七之助', '半次郎', '小十郎', '宗五郎', '甚兵衛', '又兵衛', '千鶴', '紗那', '楓', '菖蒲', '桔梗', '真琴', '椿', '雪乃', '瑠璃', '葵', '茜', '澪', '志乃'];
export const ONI_NAMES = ['赤角', '青牙', '黒爪', '岩鬼', '火車', '鉄鬼', '骨喰', '血吸', '雷角', '泥丸'];

export const GEN_BY_ID: Record<string, GenDef> = Object.fromEntries(GENERALS.map((g) => [g.id, g]));

export const LORD = 'g_saku';
