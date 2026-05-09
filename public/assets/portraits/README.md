# 立ち絵画像配置ディレクトリ

このフォルダに `{portraitKey}.png` の形式で武将立ち絵を配置すると、
ゲーム内でSVGプレースホルダの代わりに実画像が表示されます。

## 推奨仕様

| 項目 | 推奨 |
|---|---|
| 形式 | PNG（透過なし）または JPG |
| サイズ | 480×600px（縦横比 4:5、bust-up構図） |
| ファイル名 | `{portraitKey}.png`（小文字英数字とアンダースコアのみ） |

PNG が無ければ自動的に同名の `.jpg` を試行し、それも無ければ
SVGプレースホルダにフォールバックします。

## 必要な portraitKey 一覧（30種）

### ユニーク武将22名

| 勢力 | キー | 武将名 |
|---|---|---|
| 暁ノ家 | `akatsuki_saku.png` | 風間 朔 |
| 暁ノ家 | `akatsuki_suzuran.png` | 鈴蘭 |
| 暁ノ家 | `akatsuki_chikage.png` | 朝霧 千景 |
| 暁ノ家 | `akatsuki_genba.png` | 風間 玄蕃 |
| 黒鉄家 | `kurogane_genbu.png` | 黒鉄 玄武 |
| 黒鉄家 | `kurogane_hayato.png` | 銅崎 隼人 |
| 黒鉄家 | `kurogane_narukami.png` | 鋼鉄 鳴雷 |
| 紫苑家 | `shion_hazuki.png` | 紫苑院 葉月 |
| 紫苑家 | `shion_fuuko.png` | 紫苑院 楓子 |
| 紫苑家 | `shion_souji.png` | 鳴海 蒼司 |
| 白鷺家 | `shirasagi_toshiro.png` | 白鷺 凍司朗 |
| 白鷺家 | `shirasagi_rin.png` | 鷹羽 燐 |
| 白鷺家 | `shirasagi_shizune.png` | 雪見 静音 |
| 焔ノ家 | `honoo_kurenai.png` | 焔 紅葉 |
| 焔ノ家 | `honoo_tomoshibi.png` | 焔 燈火 |
| 蓮華院 | `rengein_kangetsu.png` | 蓮華院 観月 |
| 蓮華院 | `rengein_tesshin.png` | 法蓮坊 鉄心 |
| 妖魔の群 | `youma_kurobuchi.png` | 蛟王 黒淵 |
| 妖魔の群 | `youma_guren.png` | 夜叉姫 紅蓮 |
| 妖魔の群 | `youma_gaou.png` | 鬼鎧 牙王 |
| 浪人衆 | `ronin_kagemaru.png` | 漆黒 影丸 |
| 浪人衆 | `ronin_yuzuriha.png` | 朔月 楪 |

### 汎用キャラ8種＋妖魔雑兵

汎用キャラは特性ごとに同じ画像が共有されます。trait別に8枚＋妖魔雑兵1枚で計9枚:

| キー | 用途 |
|---|---|
| `generic_normal.png` | 平凡型 |
| `generic_attacker.png` | 攻め手 |
| `generic_defender.png` | 守り手 |
| `generic_strategist.png` | 軍師 |
| `generic_commander.png` | 名将 |
| `generic_sniper.png` | 狙撃手 |
| `generic_wild.png` | 暴れ者 |
| `generic_gem.png` | 逸材 |
| `youma_grunt.png` | 妖魔雑兵 |

## 段階的に進める場合

全30枚揃えなくても問題ありません。配置した分だけ実画像で表示され、
無いものはSVGプレースホルダのままです。
たとえば「主人公の風間 朔だけは実画像にしたい」なら
`akatsuki_saku.png` を1枚置くだけで OK です。

## 著作権の注意

- アップロードする画像は **オリジナル制作** または
  **使用許諾を得た画像** に限定してください
- 既存商業作品（戦国ランス含む）から取得した画像は配置しないこと
- AIで生成する場合は、利用規約で商用利用・配布が許可されているサービスを使用

## 反映までの流れ

1. ここに `.png` を配置
2. `git add` `git commit` `git push`
3. Cloudflare Pages が自動ビルド
4. スマホで PWA を再読み込み（Service Worker は network-first で立ち絵を取得するため、
   通常は再読み込み一回で反映される）
