# Safari History Detail

[![CI](https://github.com/kytlogia/safario-historilo/actions/workflows/ci.yml/badge.svg)](https://github.com/kytlogia/safario-historilo/actions/workflows/ci.yml)

SafariおよびFirefoxのブラウズ履歴データベース（`History.db` / `places.sqlite`）を読み込み、訪問履歴を詳細に確認できるWebアプリです。

- **プライバシー重視**: 履歴データベースはどちらの読み込み方法でも外部サーバーへ送信されません。ファイルの解析処理そのものは常にブラウザ内で完結します（SQLite形式の履歴はWebAssembly版SQLite [sql.js](https://sql.js.org/)、Netscapeの `history.dat` は同梱のMorkパーサー）。
- Nuxt 4 + Vuetify 4 + Vite + pnpm で構築。
- 履歴データベースの読み込みは**自動読み込みとドラッグ&ドロップの両対応**です（詳細は下記）。
- `/` がSafari向け、`/firefox` がFirefox向けのページです（画面右上のボタンで切り替え可能）。

## 主な機能

- `pnpm dev` などNodeサーバーとして起動している場合、ボタン一つで `~/Library/Safari/History.db`（Firefoxは `places.sqlite`）を自動読み込み（後述）
- 履歴データベースをドラッグ&ドロップ／ファイル選択で読み込み
- 訪問履歴一覧（タイトル・URL・ドメイン・訪問日時・そのURLの累計訪問回数・状態フラグ）を仮想スクロールテーブルで表示
- タイトル/URL検索、ドメイン絞り込み、日付範囲によるフィルタ
  - Safari: 読み込み失敗のみ／リダイレクトのみ／自動生成履歴のみ
  - Firefox: URL直接入力のみ／リダイレクトのみ／非表示の履歴のみ
- 行をクリックすると詳細ダイアログを表示（内部タイムスタンプの変換値やSQLiteの生データなど、ブラウザごとの詳細フィールド）
- よく訪れたドメインTop 10の集計
- フィルタ後のデータをJSON/CSVでエクスポート

## History.db の読み込み方法（両対応）

### 1. 自動読み込み（Nodeサーバーとして起動している場合）

`pnpm dev` や `pnpm build && node .output/server/index.mjs` のようにNitroサーバーが起動している環境では、Nitroサーバー(Node.jsプロセス)が **`~/Library/Safari/History.db` をローカルのファイルシステムから直接読み込みます**。画面を開くと自動的に利用可否が判定され、「この Mac の History.db を自動で読み込む」ボタンが表示されます。

- 既定のパスは `~/Library/Safari/History.db` です。`NUXT_HISTORY_DB_PATH` 環境変数で上書きできます。
- 読み込みは `History.db`/`-wal`/`-shm` を手動でファイルコピーするのではなく、SQLiteの Online Backup API（`node:sqlite` の `backup()`）でホットバックアップします。Safariが実行中でWALへ書き込みが発生していても、常に論理的に一貫したスナップショットが得られるため、元ファイルを変更・破損することなく安全に読み取れます（手動でのマルチファイルコピーは書き込みタイミングによって不整合な状態になり得るため採用していません）。バックアップ自体もNode.jsのイベントループをブロックしない非同期処理です。
- サーバーは読み込んだバイト列をそのままブラウザへ返し、実際のパース処理は他の読み込み方法と同じくブラウザ内のsql.jsで行われます（サーバー側でデータの中身を解析・保持することはありません）。
- macOSでは、ターミナルアプリ（またはNodeを実行するアプリ）に「フルディスクアクセス」権限を付与する必要があります（システム設定 → プライバシーとセキュリティ → フルディスクアクセス）。付与されていない場合はファイルの存在は検出しつつ読み取り不可であることを判定し、画面上に権限付与を促すメッセージを表示します。
- Windowsには「フルディスクアクセス」に相当する権限設定はありません。ファイルの存在は検出したが読み取れない場合は、対象のブラウザを完全に終了してから再試行するよう促すメッセージを表示します（詳細は下記「Windows環境について」）。
- この機能は `node:sqlite`（Node.js 22.5以降に付属）を使用します。利用できない環境や `History.db` が見つからない/読み取れない環境では自動的にドラッグ&ドロップのみの表示にフォールバックします。
- **セキュリティ**: `/api/local-history` 系のAPIは既定でローカルホスト（`127.0.0.1` / `::1`）かつ同一オリジンからのリクエストのみ許可されます。IPだけでなく `Origin` ヘッダーも検証しているため、同じブラウザの別タブで開いた他のWebページのJavaScriptから `fetch()` された場合でも拒否されます（IPチェックのみだと127.0.0.1判定を通過してしまうため）。Nitroサーバーを `0.0.0.0` などLAN/WAN向けにバインドして起動した場合でも、他マシンからはHistory.dbの内容はおろか存在確認すら行えません。意図的に許可する場合のみ `NUXT_HISTORY_DB_ALLOW_REMOTE=true` を設定してください（自己責任・非推奨）。
- **`pnpm dev` で試す場合**: `nuxt dev` は内部プロキシ経由でリクエストを処理するため、上記のローカルホスト判定に使う実ソケットのIPが取得できません。既定では安全側に倒して自動読み込みを無効化するので、`pnpm dev` だけではボタンは表示されません。ローカルの開発サーバーであると分かっている場合に限り、`NUXT_HISTORY_DB_TRUST_DEV_PROXY=true pnpm dev` のように環境変数を設定すると有効になります（本番ビルドではこの変数は無視されます。また `nuxt dev --host` などでLAN/コンテナに公開している場合は、他マシンからのなりすましを防ぐため設定しないでください）。

#### Safariの「プロファイル」機能への対応

Safari 17+ の「プロファイル」機能（用途ごとに履歴/Cookie/拡張機能を分離する機能）で作成したプロファイルも自動読み込みの対象です。

- 各プロファイルの `History.db` は `~/Library/Containers/com.apple.Safari/Data/Library/Safari/Profiles/<UUID>/History.db` に保存されています。このアプリはこのディレクトリをスキャンし、`History.db` が存在するプロファイルを自動で列挙します。
- プロファイル名は `~/Library/Containers/com.apple.Safari/Data/Library/Safari/SafariTabs.db` の `bookmarks` テーブル（プロファイルのタブバーのルートを表す行）から取得します。これはSafariの非公開の内部実装であり、macOS/Safariのバージョンによって変わる可能性があります。名前の取得に失敗した場合はプロファイルのUUIDに基づくラベル（例: `プロファイル (xxxxxxxx)`）にフォールバックします。
- 画面上では、2つ以上のプロファイルが検出された場合のみ「読み込むプロファイル」の選択欄が表示されます（プロファイル機能を使っていない場合は従来通り既定の `~/Library/Safari/History.db` のみが対象になり、UIに変化はありません）。
- `NUXT_HISTORY_DB_PATH` はプロファイル未指定（既定プロファイル）の場合のみ有効です。特定のプロファイルを選択した場合は、常に上記のコンテナ内パスが使用されます。

#### Windows環境について（1.3.0〜）

- **Safari**: Windows版Safariは2012年に開発終了しているため、Windows環境では自動読み込みの選択肢自体を表示しません（ナビメニューからもSafariへのリンクが非表示になります）。`NUXT_HISTORY_DB_PATH` で明示的にパスを指定すれば、Macからコピーしてきた `History.db` を読み込むこと自体は可能です。
- **Firefox**: Windows環境でも自動読み込みに対応します。既定のプロファイル一覧は `%APPDATA%\Mozilla\Firefox\profiles.ini` を解析して取得し、各プロファイルの `places.sqlite` は `%APPDATA%\Mozilla\Firefox\Profiles\<プロファイル>\` 以下から読み込みます。
- ファイルが存在するのに読み取れない場合、macOSでは「フルディスクアクセス」の付与を促しますが、Windowsにはこの権限機構がないため、対象のブラウザを完全に終了してから再試行するよう促すメッセージに切り替わります。
- **既知の制約**: 自動読み込みは`node:sqlite`のBackup API（`backup()`）でホットバックアップしていますが、このAPIがWindows上でも同様に安全に機能するか（特にブラウザ実行中のファイルロック挙動がmacOSと異なる可能性）は、開発環境がmacOSのみのため実機検証できていません。CIの `windows-latest` ジョブでユニット/E2Eテストは継続的に検証していますが、これは実際にFirefoxが起動中の環境での検証を代替するものではありません。問題が判明した場合はIssueで報告してください。

### 2. ドラッグ&ドロップ / ファイル選択

`pnpm generate` で生成した静的ホスティング環境など、Nitroサーバーが介在しない場合は自動読み込みボタンは表示されず、従来通り手動での読み込みになります。

Safariを終了してから、Finderの「移動」→「フォルダへ移動」で以下を開きます。

```
~/Library/Safari/
```

`History.db` をコピーし、このアプリの画面にドラッグ&ドロップしてください（Safari実行中はDBがロックされているため、必ずコピーしてから読み込んでください）。

## Firefoxのplaces.sqlite（`/firefox`）

`/firefox` ページはSafari向けページと同等のUI（フィルタ・テーブル・詳細ダイアログ・エクスポート）をFirefoxの `places.sqlite` 向けに提供します。読み込み方法もSafariと同様に自動読み込み/ドラッグ&ドロップの両対応です。

- 既定のプロファイル一覧は `~/Library/Application Support/Firefox/profiles.ini`（Windowsでは `%APPDATA%\Mozilla\Firefox\profiles.ini`）を解析して取得します（複数プロファイル対応）。`profiles.ini` の `Path` は各プロファイルの一意なIDとして扱われ、`places.sqlite` が実在するプロファイルのみが選択肢に表示されます。
- `Default=1` が設定されたプロファイルを既定として選択します。どのプロファイルにも設定がない場合は先頭のプロファイルにフォールバックします。
- 自動読み込みはSafariと同じくSQLiteのOnline Backup API（`node:sqlite`）でホットバックアップするため、Firefox実行中でも安全に読み取れます。ローカルホスト/同一オリジン制限やフルディスクアクセスに関する注意点もSafariと共通です（Windowsでの注意点は上記「Windows環境について」を参照）。
- 手動で読み込む場合は、Firefoxを終了してから `~/Library/Application Support/Firefox/Profiles/<プロファイル>/`（Windowsでは `%APPDATA%\Mozilla\Firefox\Profiles\<プロファイル>\`）内の `places.sqlite` をコピーし、画面にドラッグ&ドロップしてください。

## Netscapeのhistory.dat（`/netscape`）

`/netscape` ページは、最終版のNetscape Navigator 9（Gecko 1.8系）の履歴ファイル `history.dat` に対応します。**ドラッグ&ドロップ/ファイル選択による読み込み専用**です。

- Netscape Navigator 9は開発終了済みで、現行OS上に「実行中のNetscape」も既定の履歴ファイルパスも存在しません。そのため他ブラウザのような自動読み込み（`/api/local-history/*`）は提供せず、サーバー側のコードも追加していません。
- `history.dat` は `places.sqlite` 移行（Firefox 3 / 2008年）より前の **Mork形式**（行指向のテキストベースDB）で、SQLiteではありません。既存のsql.jsベースのパーサーは流用できないため、`app/utils/parseNetscapeHistoryDatabase.ts` にMorkパーサーを実装しています（追加の依存パッケージなし）。
- `history.dat` の場所（Netscape Navigator 9のプロファイル配下）:
  - macOS: `~/Library/Application Support/Netscape/Profiles/<プロファイル>.slt/history.dat`
  - Windows: `%APPDATA%\Netscape\Navigator\Profiles\<プロファイル>.slt\history.dat`
- Mork形式は1URL=1レコード（`FirstVisitDate` / `LastVisitDate` / `VisitCount`）で、他ブラウザのような1訪問=1行の履歴は保持していません。そのため一覧の「訪問日時」は各URLの**最終訪問日時**を表します。
- 絞り込みは `URL直接入力のみ`（`Typed`）と `非表示の履歴のみ`（`Hidden`）の2つです。Morkには訪問種別（リダイレクト等）の記録がないため、Firefox/Chromium系にある「リダイレクトのみ」に相当するフィルタはありません。

### Internet Explorer（未対応）

同じissueで検討したIE11の `WebCacheV01.dat` は **ESE（Extensible Storage Engine / Jet Blue）形式**で、ブラウザ内で完結して読めるJS/WASM実装が存在しません（既存実装はPythonの[libesedb](https://github.com/libyal/libesedb)、Goの[go-ese](https://github.com/Velocidex/go-ese)などネイティブ言語のみ）。B-treeページ・カタログ・long value圧縮まで自前実装するコストが大きいため、このリポジトリでは別issueとして切り出す方針としています。

## セットアップ

- 必要な環境: Node.js `>=22.5.0`、pnpm `11.21.0`（`package.json` の `engines` / `packageManager` を参照。Corepackの利用を推奨します）

```bash
pnpm install
```

## 開発サーバー

```bash
pnpm dev
```

`http://localhost:3000` で起動します。

## ビルド

```bash
pnpm build
```

画面（Vueアプリ）自体はクライアントサイドのみで完結するSPA (`ssr: false`) ですが、`server/api/` 以下にNitroのAPIルートを持つため、`pnpm build && node .output/server/index.mjs` のようにNodeサーバーとして起動すると自動読み込み機能が有効になります。

静的ホスティング用途では引き続き `pnpm generate` が使えます。その場合Nitro APIルートは含まれないため、自動読み込みボタンは表示されずドラッグ&ドロップのみになります（機能は自動的にフォールバックするため、コードの変更は不要です）。

## デスクトップアプリ（macOS, Electron）

これまでの自動読み込み機能を使うには `pnpm dev` でターミナルからNitroサーバーを起動する必要があり、非エンジニアには敷居が高いという課題がありました（#140）。[Electron](https://www.electronjs.org/) でラップしたデスクトップアプリとして、この自動読み込み機能一式（サーバー起動・フルディスクアクセスの案内）をダブルクリックで使えるようにしています。

```bash
pnpm electron        # ビルド＋Electronアプリを起動して動作確認
pnpm electron:build  # 未署名の .dmg を release/ に生成（macOSのみ）
```

- `pnpm electron` はビルド済みの `.output/server/index.mjs`（Nitroサーバー、既存の自動読み込みロジックそのもの）を、Electron自身に同梱されたNode.jsランタイム上で子プロセスとして起動し（`ELECTRON_RUN_AS_NODE=1`）、起動確認後にその画面を1つのウインドウで表示します。パース処理（sql.js）は他の読み込み方法と同様ブラウザ内（Electronのレンダラープロセス内のChromium）で完結します。
- フルディスクアクセスが付与されていない場合の案内は、既存のWeb版の「読み取り権限がありません」アラート（`app/components/UploadPanel.vue` の `serverPermissionHint`）がそのままデスクトップアプリのウインドウ内にも表示されます（専用のUIを別途実装していません）。System Settings → プライバシーとセキュリティ → フルディスクアクセスで、このアプリ自体に権限を付与してください。
- **未署名です**: コード署名・Notarizationは行っていません（Apple Developer Program の証明書が必要なため対象外。README/#140参照）。`pnpm electron:build` で生成した `.dmg` から初回起動する際は、Gatekeeperの警告が出るため、Finderでアプリを右クリック→「開く」から起動してください。
- Windows向け `.exe` パッケージングは対象外です（別issueで対応予定）。
- 実装は `electron/main.mjs`（メインプロセス。子プロセスの起動・起動待ち・ウインドウ表示）と `electron/serverProcess.mjs`（Nitroサーバーのエントリパス解決・起動待ちの純粋関数、`tests/unit/electron/serverProcess.test.ts` でテスト）にあります。パッケージング設定は `package.json` の `build` フィールド（[electron-builder](https://www.electron.build/)）です。

## テスト

```bash
pnpm test          # Vitest: ユニットテスト + インテグレーションテスト
pnpm test:watch    # Vitest をウォッチモードで実行
pnpm test:e2e      # Playwright: E2Eテスト（初回のみ `pnpm exec playwright install chromium` が必要）
```

- **ユニットテスト**（`tests/unit/`）: `History.db` / `places.sqlite` のパース処理（エポック変換・スキーマ検証・異常系）、CSV/JSONエクスポート、`server/utils/history-store.ts` / `server/utils/firefox-history-store.ts` のローカルアクセス制御（`assertLocalRequest` のセキュリティ境界）、`server/utils/firefox-profiles.ts` の `profiles.ini` 解析、`app/composables/useHistoryFilters.ts` / `useFirefoxHistoryFilters.ts` の検索・絞り込み・Top10集計ロジック、`isSafeUrl` によるURLプロトコルのホワイトリスト判定を対象にしています。
- **インテグレーションテスト**（`tests/integration/`）: [`@nuxt/test-utils`](https://nuxt.com/docs/getting-started/testing) でビルド済みのNitroサーバーを実際に起動し、`/api/local-history/*` に対するHTTPリクエスト〜レスポンスを検証します。
- **E2Eテスト**（`tests/e2e/`）: Playwrightで `nuxt dev` を起動し、ドラッグ&ドロップ/ファイル選択での読み込み、検索・フィルタ、詳細ダイアログ、CSV/JSON出力、自動読み込みボタンの表示切り替えといった主要フローをブラウザ上で検証します。
- テスト用の `History.db` / `places.sqlite` は `tests/fixtures/build-history-db.ts` / `build-firefox-history-db.ts` がsql.jsでその場に組み立てます（バイナリを直接コミットしていません）。

## Lint / Format / 型チェック

```bash
pnpm lint         # ESLint（@nuxt/eslint）でチェック
pnpm lint:fix      # 自動修正可能なものを修正
pnpm format        # Prettierでコード整形
pnpm format:check  # 整形が必要な箇所がないか確認（CI向け）
pnpm typecheck     # nuxt typecheck（vue-tsc）で型チェック
```

ESLintは [`@nuxt/eslint`](https://eslint.nuxt.com/) モジュールが `nuxt.config.ts` から自動生成する `eslint.config.mjs` をベースにしています。`@nuxt/eslint` はデフォルトでスタイル関連のルール（`stylistic`）を無効化しており、フォーマットはPrettierに一任する構成になっています。`eslint.config.mjs` では `eslint-config-prettier` を最後に適用し、Prettierと競合しうるESLintコアルールも無効化しています。

## 技術スタック

- [Nuxt 4](https://nuxt.com/) / [Nitro](https://nitro.build/)
- [Vite](https://vite.dev/)
- [Vuetify](https://vuetifyjs.com/)（[vuetify-nuxt-module](https://npmjs.com/package/vuetify-nuxt-module) 経由）
- [sql.js](https://sql.js.org/)（ブラウザ内SQLite/WebAssembly）
- `node:sqlite`（Node.js組み込み。自動読み込み時のWALマージに使用）
- [pnpm](https://pnpm.io/)
- [Electron](https://www.electronjs.org/) / [electron-builder](https://www.electron.build/)（macOSデスクトップアプリとしての配布。上記「デスクトップアプリ」参照）

## サプライチェーン攻撃対策

npmエコシステムでは、メンテナのアカウント/トークンが乗っ取られて悪意あるバージョンが公開され、検知・削除されるまでの短時間に多くのプロジェクトへ自動的に取り込まれてしまう攻撃が近年頻発しています。このリポジトリでは以下の対策を行っています。

### pnpmの防御機能（`pnpm-workspace.yaml`）

- **`minimumReleaseAge`**: 公開されたばかりのバージョンを一定時間（既定24時間）インストールしません。pnpm 11以降はデフォルトで有効ですが、バージョンに依存せず常に有効になるよう明示設定しています。
  - 緊急のセキュリティパッチ等ですぐ上げたい特定パッケージがある場合は `minimumReleaseAgeExclude` で除外できます（`pnpm-workspace.yaml` 内にコメントで使用例を記載）。
- **`minimumReleaseAgeStrict: true`**: 上記期間内に条件を満たすバージョンが無い場合、古いバージョンへ自動フォールバックせずインストールを失敗させます。
- **`allowBuilds`**: 明示的に許可したパッケージ以外は `postinstall` 等のビルドスクリプトを実行しません（依存パッケージ経由の任意コード実行対策）。新しい依存でビルドスクリプトの許可が必要になった場合は、本当に必要か確認してから追加してください。

参考: [pnpm: Mitigating supply chain attacks](https://pnpm.io/supply-chain-security)

### Aikido Safe Chain（開発者ローカル環境向け、任意）

[Aikido Safe Chain](https://github.com/AikidoSec/safe-chain) は `npm`/`pnpm`/`yarn`/`npx` 等のコマンドをラップし、インストール前にAikidoの脅威インテリジェンスに照らしてマルウェア判定・公開直後バージョン（既定48時間未満）のブロックを行うOSSツールです（無料・トークン不要）。リポジトリ直下の `.aikido` にプロジェクト共有設定があります。

導入する場合は、[Installationセクション](https://github.com/AikidoSec/safe-chain#installation)に従ってローカルにセットアップしてください（インストールスクリプトはバージョン固定のGitHub Releases URL＋SHA256チェックサム検証で配布されているため、READMEに直接コマンドを埋め込まず都度公式手順を参照することを推奨します）。セットアップ後はシェルの `npm`/`pnpm`/`yarn`/`npx` エイリアスとして動作し、`pnpm safe-chain-verify` で導入確認できます。

CI環境で使う場合は `--ci` フラグ付きでセットアップします（シェルエイリアスではなくPATH上の実行ファイルとして動作）。CIへの導入自体は[#11](https://github.com/kytlogia/safario-historilo/issues/11)で検討します。

## 実装メモ

- SafariのSQLiteスキーマ（`history_items` / `history_visits`）を `hv.history_item = hi.id` で結合して1訪問=1行として取得しています。
- `visit_time` はCore Dataのタイムスタンプ（2001-01-01 UTCからの秒数）のため、`+ 978307200` 秒したうえで `Date` に変換しています。
- 自動読み込み関連のサーバーコードは `server/utils/history-store.ts`（`History.db`のパス解決・読み取り権限判定・`node:sqlite`のBackup APIによるホットバックアップ・ローカル/同一オリジン判定）と `server/api/local-history/`（`status.get.ts` で利用可否判定、`index.get.ts` でバイト列を返却）にあります。フロントエンドは `GET /api/local-history/status` で利用可否を判定し、利用可能な場合のみ `GET /api/local-history` からバイト列を取得して既存の `parseSafariHistoryFile`（ドラッグ&ドロップと共通のsql.jsパーサー）に渡します。
- プロファイル対応は `server/utils/safari-profiles.ts`（`Profiles/` ディレクトリのスキャンと `SafariTabs.db` からのプロファイル名解決）と `server/api/local-history/profiles.get.ts` にあります。`status.get.ts` / `index.get.ts` はクエリパラメータ `?profileId=<UUID>` を受け取り、`resolveHistoryDbPath()` に渡すことで対象のプロファイルを切り替えます（未指定または `default` は従来通り既定プロファイル）。
- Firefoxの `moz_places` / `moz_historyvisits` テーブルを `hv.place_id = p.id` で結合して1訪問=1行として取得しています（`app/utils/parseFirefoxHistoryDatabase.ts`）。`visit_date` はUnixエポックからのマイクロ秒のため、1000で割ってミリ秒に変換したうえで `Date` に変換しています。sql.jsの初期化処理自体はSafari向けパーサーと共通化し `app/utils/sqlJs.ts` に切り出しています。
- Netscapeの `history.dat` はMork形式のため専用パーサー `app/utils/parseNetscapeHistoryDatabase.ts` を実装しています。列名辞書（`<(a=c)>` タグ付き）・値辞書・行を走査し、`\)` などのバックスラッシュエスケープと `$XX` の16進エスケープを解決します。`$XX` を含む値はMozillaが値全体をUTF-16でヘキサ化して書き出すため、`ByteOrder` セルが示すバイトオーダー（既定はLE）でUTF-16としてデコードします。`LastVisitDate` / `FirstVisitDate` はFirefoxと同じくUnixエポックからのマイクロ秒（PRTime）です。
- 上記パーサーはアップロードされた任意のファイルを読むトラストバウンダリのため、入力サイズ上限・テーブルのネスト深さ上限を設けたうえで、全ループが1イテレーションあたり必ず1文字以上進むこと（進まなければ例外）を不変条件として無限ループを防いでいます。途中で切れたファイルはエラーにせず読めたところまでを返します。
- Firefoxの自動読み込み関連のサーバーコードは `server/utils/firefox-profiles.ts`（`profiles.ini` の解析とプロファイル一覧の取得）と `server/utils/firefox-history-store.ts`（プロファイル解決・読み取り権限判定・ホットバックアップ）、`server/api/local-history/firefox/` にあります。`profileId` はプロファイルの `Path`（profiles.ini上の値）で指定し、必ず `listFirefoxProfiles()` が返した一覧と突き合わせて解決するため、未知の値がそのままファイルパスの組み立てに使われることはありません。

## 開発に参加する

Issueの起票ルール、ブランチ運用、PRフローについては [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。
