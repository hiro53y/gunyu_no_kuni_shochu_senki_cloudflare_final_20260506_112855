# Codex / 画像生成AI 向け立ち絵生成プロンプト

このドキュメントは「群雄ノ國：掌中戦記 v2.1」の武将立ち絵30枚を、
Codex などのコーディングエージェント、または DALL·E / Midjourney /
Stable Diffusion 系の画像生成AIで作成するための指示書です。

## 制作概要

- 必要枚数: **最大30枚**（ユニーク武将22枚 + 汎用trait8枚 + 妖魔雑兵1枚）
- 画像サイズ: **480 × 600 ピクセル**（縦横比 4:5、bust-up構図）
- ファイル形式: **PNG 24bit**（透過なし、フル背景）
- 保存先: `public/assets/portraits/{portraitKey}.png`
- 著作権: **完全オリジナル制作**。既存商業作品（特に戦国ランス含む）の
  キャラクター・絵柄・ポーズを参照しないこと

## 共通スタイルガイド

すべての画像で以下を統一すること:

- **構図**: 顔と肩を含む bust-up（胸より上）。中心線は画像中央。
  顔は画像の上から30〜45%の位置。
- **画風**: 和風セルアニメ調（線画は墨筆風の太線、塗りはセル＋わずかな
  水彩にじみ）。リアルすぎず、デフォルメしすぎない中間トーン。
- **時代感**: 戦国時代風の和装・甲冑。誇張のない実装色合い。
- **背景**: 勢力カラーをベースにした半抽象的なグラデーション。
  和柄（雲・霞・桜・山稜・蓮華等）を薄く重ねるとよい。
  背景は無地で良いが完全な白・黒は避ける。
- **照明**: 顔の左前方からやや強めの光。陰影で立体感を出す。
- **目線**: 基本は正面。例外として一部キャラ（観月・千景）はやや横向き。

## 勢力カラー（背景・装備の差し色）

| 勢力 | キーカラー | HEX |
|---|---|---|
| 暁ノ家 | 茜色 | #C84A4A |
| 黒鉄家 | 鋼鼠色 | #525560 |
| 紫苑家 | 藤紫 | #7E5BA3 |
| 白鷺家 | 銀鼠 | #A8A8B0 |
| 焔ノ家 | 緋色 | #D43818 |
| 蓮華院 | 萌葱 | #3F8060 |
| 妖魔の群 | 黒墨 | #1A1A1A |
| 浪人衆 | 紺青 | #1F3A6E |

---

## キャラクター別プロンプト

各セクションは「保存ファイル名 → 日本語説明 → 英語プロンプト」の形式。
英語プロンプトは画像生成AIにそのまま投入できるよう調整済み。

### 暁ノ家（プレイヤー勢力・茜色 #C84A4A）

#### `akatsuki_saku.png` — 風間 朔（かざま さく）

暁ノ家の若き当主。20代前半男性。粗暴で口は悪いが直感の鋭い剣士。
黒髪短髪、鋭い目つき、無精ひげ少し。茜色の小袖に鎖帷子。
腰に打刀。背景に朝日の朱と三日月の紋。

> A young Japanese male warlord in his early 20s, samurai bust-up portrait,
> short black hair, sharp dark eyes, slight stubble, confident smirk,
> wearing a deep crimson kimono jacket with chainmail underneath, carrying
> a katana, vermillion sunrise and crescent moon emblem in the background,
> Japanese cel-anime art style, 4:5 portrait, painterly shading, original character.

#### `akatsuki_suzuran.png` — 鈴蘭（すずらん）

10代後半女性巫女。朔付き。長い銀髪を白い紐で1つに束ねる。
神事の白装束に朱色の袴、首飾りに小さな鈴。穏やかで清楚な表情。
背景に朱と金の和紙質感、巫女鏡の輪郭。

> A teenage Japanese miko shrine maiden, gentle composure, long silver hair
> tied in a single low ponytail with a white cord, white kosode robe with
> vermillion hakama, small bell pendant, kind eyes, holding a folded
> ritual paper, soft red-gold paper texture background with a subtle
> sacred mirror motif, cel-anime style, 4:5 bust portrait.

#### `akatsuki_chikage.png` — 朝霧 千景（あさぎり ちかげ）

20代女性軍師。朔の従姉、冷静沈着。後ろで結った黒髪、切れ長の目。
渋い藍色の小袖に茜色の帯、軍配を片手に。やや横顔気味。

> A composed female Japanese military strategist in her mid 20s, sleek
> black hair tied back, sharp slanted eyes, slight side profile, wearing
> deep indigo kimono with vermillion sash, holding a war fan, calculating
> expression, misty muted background with faint map lines, cel-anime
> bust-up portrait, painterly cel shading.

#### `akatsuki_genba.png` — 風間 玄蕃（かざま げんば）

50代男性宿老。先代からの重臣。白髪混じりの髭、頑強な肩幅。
黒塗りの胴丸、額に切り傷の跡。寡黙で頼もしい表情。

> A grizzled veteran samurai retainer in his 50s, broad shoulders, peppered
> beard, scar across forehead, wearing matte black do-maru armor with red
> lacing, stoic dependable expression, dark earthy background with dim
> torchlight, cel-anime samurai portrait, 4:5 bust-up, original character.

### 黒鉄家（東方軍事大国・鋼鼠色 #525560）

#### `kurogane_genbu.png` — 黒鉄 玄武

40代男性当主。鉄の鎧で身を固めた強面。ヒゲは三角の濃い顎髭、
冷徹な眼光。鋼色と銀の縁取りの大鎧、肩に黒鉄の家紋。

> A formidable Japanese daimyo lord in his 40s, intimidating presence,
> triangular black goatee, cold piercing eyes, wearing heavy steel-gray
> oyoroi armor with silver trim, three-pillar emblem on the shoulder,
> dark slate background with metallic gleam, cel-anime style portrait, 4:5.

#### `kurogane_hayato.png` — 銅崎 隼人

30代男性鉄砲頭。銅色の髪を後ろで結ぶ、鋭い視線。火縄銃を肩に担ぐ。
腰には火薬入れ、灰色の道服。

> A sharpshooter samurai in his 30s, copper-tinted hair tied back, keen
> hawk-like eyes, holding a matchlock arquebus over the shoulder, gunpowder
> pouch on the belt, gray hakama and tunic, smoky overcast background,
> cel-anime bust portrait, 4:5.

#### `kurogane_narukami.png` — 鋼鉄 鳴雷

40代男性筆頭武将。長身、雷鳴を思わせる威圧感。長い黒髪を太く結ぶ。
朱色の鉢金、鋼の腕甲。顎に切り傷。

> A towering elite samurai general in his 40s, long thick black hair
> bound up high, vermillion forehead band, scarred chin, gleaming steel
> bracers, intense thunderous aura, stormy slate background with
> lightning hint, cel-anime bust portrait.

### 紫苑家（南方海運・藤紫 #7E5BA3）

#### `shion_hazuki.png` — 紫苑院 葉月

20代女性当主。商才と冷徹さで知られる。長い黒髪を結い上げ、
紫苑の花を髪飾りに。藤色の打掛に銀の刺繍。微笑むが目は冷たい。

> An elegant young female Japanese daimyo in her 20s, long black hair styled
> up with a single shion (purple aster) flower ornament, faint cold smile,
> wearing a lavender uchikake outer robe with silver embroidery, calculating
> calm gaze, soft purple twilight background with floating petals,
> cel-anime style portrait, 4:5.

#### `shion_fuuko.png` — 紫苑院 楓子

20代女性海賊頭。葉月の妹、活発。短めの黒髪、片方の耳にイヤリング。
動きやすい紫の小袖に半甲、二振りの小太刀。

> A spirited female pirate captain in her 20s, sister of a noble, short
> black bob, one earring, energetic grin, purple short kimono with light
> half-armor, dual short swords at hips, ocean spray background in dusky
> purple and silver, cel-anime bust portrait.

#### `shion_souji.png` — 鳴海 蒼司

30代男性知将。痩せ型、丸眼鏡、知的な微笑。藍紫の長着に羽織。
手には地図帳。

> A scholarly Japanese strategist in his 30s, lean build, small round
> spectacles, intelligent calm smile, indigo-purple kimono with overcoat,
> rolled map in hand, dim study background with shelved scrolls,
> cel-anime portrait, 4:5.

### 白鷺家（西方山岳・銀鼠 #A8A8B0）

#### `shirasagi_toshiro.png` — 白鷺 凍司朗

50代男性当主。古武家の誇り。白髪を1つに束ね、誇り高い表情。
白銀の鎧、肩に白鷺の翔びマーク。

> A proud aged samurai lord in his 50s, long silver-white hair tied in a
> single high tail, dignified noble expression, gleaming silvery armor
> with a flying heron emblem on the shoulder, snowy mountain ridge
> background, cel-anime bust portrait, 4:5.

#### `shirasagi_rin.png` — 鷹羽 燐

20代女性弓の名手。茶色の長髪を低い位置で1つに、鋭い目。
革の籠手、和弓を持つ。背に矢筒。

> A keen-eyed female archer in her 20s, long brown hair in a low ponytail,
> determined sharp gaze, leather bracers, holding a Japanese yumi long bow,
> quiver on the back, mountain pine background in misty silver-gray,
> cel-anime bust portrait.

#### `shirasagi_shizune.png` — 雪見 静音

20代女性騎馬隊長。クールな表情。氷青色の髪を肩で切り揃え、
小さなマフラー、白銀の馬上甲冑。

> A cool-mannered female cavalry commander in her 20s, ice-blue hair cut
> at shoulder length, calm focused expression, small white scarf, silver
> riding armor over a navy doublet, snow-swept mountain pass background,
> cel-anime bust portrait, 4:5.

### 焔ノ家（北方火山信仰・緋色 #D43818）

#### `honoo_kurenai.png` — 焔 紅葉

20代女性当主・巫女。紅蓮の長髪、神威ある表情。緋色の巫女装束、
首と腰に金の鈴。背景は火山の溶岩光と神火。

> A powerful young female fire shrine priestess in her 20s, long flowing
> crimson hair, regal divine expression, vermillion miko robes with golden
> bells, sacred flames in the background over volcanic glow, cel-anime
> portrait, 4:5.

#### `honoo_tomoshibi.png` — 焔 燈火

10代後半男性、紅葉の弟、火槍使い。短い赤毛、若々しい意気。
緋色の道着に黒の革帯、火槍を担ぐ。

> A teenage Japanese fire-spear warrior, short bright red hair, youthful
> energetic smirk, vermillion training tunic with black leather belt,
> shouldering a fire-tipped spear, ember-glowing background, cel-anime
> bust portrait, 4:5.

### 蓮華院（仏教武装・萌葱 #3F8060）

#### `rengein_kangetsu.png` — 蓮華院 観月

30代女性大導師。穏やかで威厳のある表情。淡い緑の僧衣、首に蓮華の数珠。
側頭部の髪は剃髪に近く短いが、後ろの長い髪は1つに編む。

> A serene female Buddhist temple master in her 30s, calm authoritative
> expression, pale green monastic robes, lotus prayer beads, hair shaven
> at the sides with a single long braid down the back, soft green-gold
> aura background with lotus petals, cel-anime bust portrait, 4:5.

#### `rengein_tesshin.png` — 法蓮坊 鉄心

40代男性武僧。坊主頭、太い眉、力強い表情。萌葱の僧衣に黒の袈裟、
金剛杵を握る。

> A burly Japanese warrior monk in his 40s, shaved head, thick eyebrows,
> determined fierce gaze, dark moss-green monk's robes with black kesa
> sash, gripping a vajra mace, ancient temple wall background, cel-anime
> bust portrait, 4:5.

### 妖魔の群（最大の脅威・黒墨 #1A1A1A）

#### `youma_kurobuchi.png` — 蛟王 黒淵

人外の最終ボス。年齢不詳の妖魔の王。長い黒髪、瞳が金色に輝く。
肌は青白く、額に三つ目の蛇紋。黒い和服風の装束、全身から黒い霧。

> A supernatural Japanese demon king of indeterminate age, long flowing
> black hair, glowing gold eyes, pale luminescent skin, three-eyed
> serpent crest on the forehead, ornate black flowing robes, dark mist
> emanating from the body, ominous purple-black void background, cel-anime
> dark fantasy portrait, 4:5, original supernatural character.

#### `youma_guren.png` — 夜叉姫 紅蓮

人外の女妖。長い紅蓮の髪、紅い瞳、肌に黒い文様。短い黒の道服に
朱の帯、爪が長い。妖艶だが恐ろしい表情。

> A demonic female yasha princess, long crimson hair, red glowing eyes,
> black markings on pale skin, short black tunic with vermillion sash,
> elongated claw nails, beautiful but menacing expression, smoldering
> red-black background, cel-anime dark fantasy portrait, 4:5, original
> character.

#### `youma_gaou.png` — 鬼鎧 牙王

人外の鬼大将。筋骨隆々、灰青色の肌、額に2本の太い角、口元に牙。
黒鉄の鎧、戦斧を担ぐ。

> A massive Japanese oni demon warrior, bulging muscles, gray-blue skin,
> two thick horns on the forehead, prominent fangs, black iron armor,
> shouldering a giant battle axe, blood-red wasteland background,
> cel-anime dark fantasy portrait, 4:5, original character.

### 浪人衆（中立傭兵・紺青 #1F3A6E）

#### `ronin_kagemaru.png` — 漆黒 影丸

30代男性、忍。黒装束、頭巾で口元を覆う、鋭い目だけ見える。
腰に短刀、肩に手裏剣のホルダー。

> A stealthy Japanese ninja in his 30s, all-black ninja garb, dark cloth
> mask covering the lower face revealing only sharp eyes, kunai at the
> belt, throwing-star holster on the shoulder, midnight blue moonlit
> background, cel-anime bust portrait, 4:5.

#### `ronin_yuzuriha.png` — 朔月 楪

20代女性、二刀流の女剣士。黒髪を高い位置で1つに結ぶ、不敵な笑み。
紺青の小袖に黒の帯、二振りの刀を交差して背負う。

> A confident female dual-wielding ronin swordswoman in her 20s, long
> black hair in a high ponytail, fearless smirk, navy blue kimono with
> black sash, two katanas crossed on the back, moonlit dock background,
> cel-anime bust portrait, 4:5.

---

## 汎用キャラ（trait別 8枚 + 雑兵1枚）

汎用キャラはランダム生成された汎用兵士の代表立ち絵。trait別に1枚ずつ用意し、
画像内に名前は描かない（ゲーム側で名前は動的表示）。

#### `generic_normal.png` — 平凡型

> A generic Japanese foot samurai soldier, ordinary build, plain leather
> armor, simple expression, neutral pose, generic faction-neutral palette
> (taupe and earth tones), bust-up cel-anime portrait, 4:5.

#### `generic_attacker.png` — 攻め手（武力極振り）

> An aggressive Japanese warrior with wild hair and battle scars, baring
> teeth in a snarl, gripping a heavy spear, wearing rough leather and
> chainmail armor, dynamic pose, orange-red impact background, cel-anime
> bust-up portrait, 4:5.

#### `generic_defender.png` — 守り手（統率極振り）

> A stalwart Japanese shield bearer, broad-shouldered, calm watchful
> expression, holding a large round wooden tate shield, wearing heavy
> overlapping plate armor, gray fortress wall background, cel-anime
> bust-up portrait, 4:5.

#### `generic_strategist.png` — 軍師

> A scholarly Japanese strategist with thin frame and round spectacles,
> calm intelligent gaze, holding a rolled scroll, light gray hakama and
> dark blue overcoat, study background with shelved books, cel-anime
> bust-up portrait, 4:5.

#### `generic_commander.png` — 名将

> An elite Japanese officer in his 30s, sharp confident gaze, ornate
> golden-trimmed armor, war fan in hand, dignified pose, golden-glow
> background with banners, cel-anime bust-up portrait, 4:5.

#### `generic_sniper.png` — 狙撃手

> A focused Japanese archer-marksman, one eye sighting along an arrow,
> bow drawn, leather bracers and lightweight armor, dappled forest
> background, cel-anime bust-up portrait, 4:5.

#### `generic_wild.png` — 暴れ者（武力99他極端）

> A berserker Japanese warrior with crazed eyes and unkempt hair, blood
> spatter on cheek, gripping a massive iron tetsubo club, torn clothing,
> chaotic red-orange explosion background, cel-anime bust-up portrait, 4:5.

#### `generic_gem.png` — 逸材（全能力高、激レア）

> An exceptionally gifted Japanese young samurai prodigy, beautiful
> determined gaze, gleaming silver-and-gold armor with elegant trim,
> radiant ethereal pose, divine golden aura background with cherry
> blossoms, cel-anime bust-up portrait, 4:5, exceptional rare character.

### 妖魔雑兵

#### `youma_grunt.png` — 妖魔の雑兵（夜叉・鬼・化生・蛟・骸の汎用版）

> A monstrous low-tier yokai foot soldier, hunched humanoid form with
> demonic features (horns, claws, glowing eyes), tattered dark robes,
> pale ashen skin with black veins, snarling expression, cursed swamp
> background in deep purple-black, cel-anime dark fantasy portrait, 4:5.

---

## 命名・保存規則

すべての画像を **`public/assets/portraits/`** に保存。ファイル名は
上記セクション見出しに記載の `*.png` をそのまま使用。

```
public/
└── assets/
    └── portraits/
        ├── akatsuki_saku.png
        ├── akatsuki_suzuran.png
        ├── ... (合計30ファイル)
        └── youma_grunt.png
```

## バッチ生成ヒント

- DALL·E 3 / Stable Diffusion XL / Midjourney v6+ いずれもキャラ
  プロンプトを1人ずつ投入する形で動作
- 同一スタイルでまとめて出すには、各プロンプトの末尾に
  `consistent cel-anime art style, same illustrator, same lighting`
  などのスタイル固定指示を追加すると統一感が出やすい
- 画像生成後、必要に応じて 480×600 にリサイズし、`{key}.png` で保存
- ImageMagick を使う場合: `magick input.jpg -resize 480x600^ -gravity center -extent 480x600 output.png`

## 確認チェック

- [ ] ファイル数が30以下（全部用意しなくてもOK、足りない分はSVG）
- [ ] ファイル名が portraitKey と完全一致
- [ ] 形式が PNG（または .jpg でも自動フォールバック）
- [ ] 既存商業作品からの直接引用がない
- [ ] サイズが480×600 または同じ縦横比

完成したら `git add public/assets/portraits/` `git commit` `git push` で
Cloudflare Pages へ反映されます。
