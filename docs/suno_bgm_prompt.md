# Suno AI 向け BGM 生成プロンプト

このドキュメントは「群雄ノ國：掌中戦記 v2.1」の BGM 3〜5本を Suno AI で生成
するための指示書です。

## 制作概要

- 必要本数: **3本（必須）＋ オプション2本**
- ファイル形式: **MP3** （192〜320kbps 推奨）
- 保存先: **`public/assets/sounds/bgm/`** 直下
- 再生方式: ループ再生（Web Audio API の `AudioBufferSourceNode.loop = true`）
  - 後半→冒頭がスムーズに繋がるよう、フェード処理は不要だが大きな
    ブツ切りは避けて頂けるとループ感が良くなります
- 著作権: 既存楽曲の引用・サンプリングなし、完全オリジナル制作

## ファイル一覧

| 用途 | ファイル名 | 推奨長さ | 必須/任意 |
|---|---|---|---|
| タイトル画面 | `title.mp3` | 2〜3分 | 必須 |
| 地図画面（戦略フェーズ） | `map.mp3` | 3〜4分 | 必須 |
| 合戦画面 | `battle.mp3` | 2〜3分 | 必須 |
| 勝利ジングル | `victory.mp3` | 15〜30秒 | 任意（後で対応） |
| 敗北ジングル | `defeat.mp3` | 15〜30秒 | 任意（後で対応） |

すべてループ前提（`victory` `defeat` 以外）なので、エンディング感を
強く出さず、楽曲の終わりが冒頭と自然に繋がるように仕上げてください。

## Suno AI の入力

Suno AI v4 系では「Custom Mode」で以下を入力します。

- **Style of Music**: 下記の各プロンプトを入力
- **Title**: 自由（参考として日本語タイトル例を併記）
- **Lyrics**: 「Instrumental」トグルを ON、または `[Instrumental]` のみ
- **Make Instrumental**: ✓ を入れる
- **Length**: Extend を使って指定の長さまで延長

---

## 1. `title.mp3` — タイトル画面

**雰囲気**: 朱の朝日と山稜が広がる開幕シーン。荘厳で神秘的、内に秘めた緊張感。
プレイヤーが「これから戦国の世に挑むぞ」と覚悟を決める瞬間。

**参考タイトル**: 暁ノ国 / Dawn of Yashima

**Suno スタイル入力（英語）**:
```
Cinematic Japanese fantasy main theme, slow atmospheric build, traditional
shakuhachi flute lead over deep low taiko drums, koto strings, ambient pad,
distant subtle chant tones, mysterious and dignified mood, sengoku era epic,
ceremonial, contemplative opening, 65 BPM, in F minor, instrumental only,
no vocals, no lyrics
```

**日本語要旨**: ゆっくり立ち上がるシネマティック和風ファンタジー。尺八の主旋律、
低音の太鼓が遠雷のように鳴り、琴の余韻が広がる。静かに格を上げる開幕曲。
65 BPM、F マイナー、インスト。

---

## 2. `map.mp3` — 地図画面（戦略フェーズ）

**雰囲気**: 八洲全図を眺めながら次の一手を考えるフェーズ。緊張感は薄く、
内省的でアンビエントだが、底に微かに「乱世の不穏」が漂う。長時間
聴いていても疲れない、思考の邪魔をしない曲。

**参考タイトル**: 八洲思案 / Strategy of the Eight Provinces

**Suno スタイル入力（英語）**:
```
Ambient Japanese strategy soundtrack, contemplative and pensive, koto and
shamisen interplay, soft biwa plucks, light hand taiko, atmospheric warm
strings pad, gentle wind chime accents, slow sustained melodic phrases,
medium-slow 80 BPM, in D dorian, hint of subtle tension undercurrent,
loopable seamless, instrumental only, no vocals, no lyrics
```

**日本語要旨**: 思索的・アンビエントな和風戦略曲。琴と三味線が静かに対話、
琵琶の一音、軽い手太鼓、暖かいパッド、風鈴のアクセント。80 BPM、
D ドリアン。長時間流せる曲。

---

## 3. `battle.mp3` — 合戦画面

**雰囲気**: 3×3指揮官カード戦闘の緊迫感。太鼓主体、攻めの推進力、
迫力。プレイヤーが「次の手で決めるぞ」と前のめりになる音。

**参考タイトル**: 合戦の章 / Clash at Yashima

**Suno スタイル入力（英語）**:
```
Intense Japanese war percussion battle theme, driving heavy taiko drums
foreground, sharp transverse fue flute calls, urgent shamisen tremolo,
rapid biwa runs, low brass swells, militaristic chant pad without lyrics,
fast 140 BPM, in E phrygian, dramatic and aggressive, building tension
into looping climax, sengoku battlefield epic, instrumental only,
no vocals, no lyrics
```

**日本語要旨**: 戦国合戦の太鼓主体な疾走曲。重低音の太鼓が前面、横笛
の鋭い呼び声、三味線のトレモロ、琵琶の駆け、低音金管のスウェル。
140 BPM、E フリギアン。

---

## 4. `victory.mp3` — 勝利ジングル（任意）

**雰囲気**: 合戦勝利の瞬間に流れる短い達成感のファンファーレ。

**参考タイトル**: 凱旋 / Triumph

**Suno スタイル入力（英語）**:
```
Short Japanese victory fanfare jingle, 20 second piece, triumphant ascending
shakuhachi melody resolving to bright koto cadence, single decisive taiko
hit at start, joyful and noble, in C major, instrumental only, no vocals,
no lyrics
```

**日本語要旨**: 20秒の勝利ファンファーレ。尺八の上昇旋律から琴の明るい
カデンツへ。冒頭に一発決定的な太鼓。ハ長調、インスト。

---

## 5. `defeat.mp3` — 敗北ジングル（任意）

**雰囲気**: 敗北・退却シーンの短い哀悼。

**参考タイトル**: 落日 / Sunset of the Banner

**Suno スタイル入力（英語）**:
```
Short Japanese defeat sting jingle, 20 second piece, somber descending
shakuhachi solo over sparse low koto chord, distant single low taiko,
melancholic but dignified, in A minor, instrumental only, no vocals,
no lyrics
```

**日本語要旨**: 20秒の敗北スティング。尺八の下降ソロ、琴の低音和音、
遠い太鼓一音。哀しみと品格を併せ持つ。イ短調、インスト。

---

## 共通の注意事項

- **ボーカル禁止**: いずれも「Make Instrumental ON」必須。歌詞は付けない。
- **特定楽曲の引用禁止**: 既存ゲーム・アニメの BGM を Suno に再現させようと
  しないこと。「○○風」のリクエストはせず、ジャンル・楽器・テンポ・
  ムードで指定する。
- **書き出しはMP3で**: Suno の WAV/MP3 ダウンロードから MP3 を選択。
- **音量レベル**: ピーク -3dB 以下推奨。ゲーム内の SFX を喰わないよう。
- **ループポイント**: 必須3本（title/map/battle）は楽曲の最後と最初が
  自然に繋がるように。Suno の Continue/Extend 機能を使う場合は
  ループ感を意識して終わらせる。

## 反映までの流れ

1. Suno で各プロンプトを投入し、気に入ったテイクを MP3 でダウンロード
2. ファイル名を上記の表に揃えてリネーム（`title.mp3` 等）
3. `public/assets/sounds/bgm/` 直下に配置

```
public/
└── assets/
    └── sounds/
        └── bgm/
            ├── title.mp3
            ├── map.mp3
            └── battle.mp3
```

4. `git add public/assets/sounds/` `git commit` `git push`
5. Cloudflare Pages 自動デプロイ後、PWA をリロード

ゲーム側は AudioManager が自動で読み込みを試行し、ファイルが無ければ無音、
あれば自動ループ再生します。BGM 音量はタイトル画面の「設定」から変更可能。

## 確認チェック

- [ ] ファイル名が title.mp3 / map.mp3 / battle.mp3 と一致
- [ ] MP3 形式（192kbps 以上推奨）
- [ ] ボーカルなし（インスト）
- [ ] ループ再生で違和感が少ない
- [ ] 既存楽曲のサンプリング・引用を含まない

問題があれば再生成を繰り返し、納得いくテイクを保存してください。
