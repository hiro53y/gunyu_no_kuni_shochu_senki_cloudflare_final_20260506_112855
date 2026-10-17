# 引継ぎ v5.1

v5.1完了・公開中（2026-10-17）。実装dcc21edのCloudflare Pagesビルド成功、既存URLのv5.1と配信7ファイルの一致、旧版の中断合戦再開→勝利→地図→開戦準備を確認。6eae8edで主操作の補足文字のコントラストを調整し、Cloudflareビルドと最終5ファイル一致、公開ブラウザーで文字色を確認済み。仕様はdocs/spec.md、検証はtests/test_checklist.mdと_VERIFY.md。CLAUDE向け文書は変更しない。

戦闘描画はbattle/view/presentation.tsの11兵種/全技プロフィール、field.tsの演出進行と予算・待機解除に分離。元256pxセル・DPR描画・固定戦場を維持する。戦闘エンジンの計算と乱数は変更していない。元の立ち絵94点とv5素材48点は変更なし。

地図のSelectedCountryと開戦Commandが共通のactionGuide/warProgressを使う。Honjinが画面入口を一元管理し、WarCouncilの外交へ選択勢力を渡す。勢力別進捗の変換済み印はflags.warProgressFaction。旧国別進捗は削除しない。保存キー・PWA識別情報・APP HUB登録を維持し、起動時の保存確認・復元画面は設けない。

`npm test`で155件。`$env:V5_RUNS='20'; npm test`で3ルート各20seedを含む215件。CPUを長く使用するキャンペーン検証と他ファイルの競合によるworker RPCタイムアウトを防ぐため、fileParallelism:falseを設定した。通しボットは複製上で編成候補を比較する検証ソルバーで、人間の難易度評価とは区別する。資源・領土・勝利の注入なし。

開発用 `?qa=effects/battle/council/ending` は製品ビルドに含めない。通常の中断再開確認はqaなしURLで行う。Pixel 9a実機の操作感・発熱・インストール済みPWA更新は未確認。サブエージェント：未使用。
