# テストチェックリスト

## 自動テスト
- [x] 戦闘計算が結果を返す
- [x] 内政で石高が増える
- [x] 徴兵で兵力が増え、資源が減る
- [x] 進軍勝利時に地域支配が変わる
- [x] 制圧時に旧防衛武将が制圧地域へ残らない
- [x] 登用でAPを消費し、候補所在地に配置する
- [x] 戦闘経験値が100未満に正規化され、レベルアップする
- [x] 訓練時のレベルアップ後、新しい兵数上限を使う
- [x] 休養で負傷武将が復帰する
- [x] セーブデータのserialize/deserializeができる
- [x] 壊れたセーブデータを拒否する
- [x] 勝利条件を判定できる

## build
- [x] ルートで `npm run build`
- [x] 検証用deliverables内で `npm run build`
- [x] 現行Cloudflare最終フォルダで `npm run build`
- [x] 現行Cloudflare最終フォルダで `npm run test` 12件通過

## 起動確認
- [x] build済み `dist` のトップページを簡易HTTPサーバーで配信し、HTTP 200を確認
- [x] build済み `dist` のmanifest、Service Worker、地図画像、武将画像がHTTP 200で配信されることを確認
- [ ] 実機スマホまたはブラウザでのタップ操作確認

## パッケージ
- [x] `deliverables/gunyu_no_kuni_shochu_senki_final_20260506_110019/` を作成
- [x] 最終パッケージに `node_modules`、`dist`、`out/test-build`、`tsconfig.tsbuildinfo` が含まれないことを確認
- [x] 現行使用対象を `deliverables/gunyu_no_kuni_shochu_senki_cloudflare_final_20260506_112855/` に固定

## 既知の環境差分
- [ ] OneDrive配下ではVite dev serverの依存最適化キャッシュ操作で `EPERM` が出る場合がある
- [ ] ルートの `git init` はOneDrive権限/ロックで失敗。不完全な `.git` は最終成果物には含めていない
