# Safari History Detail

[![CI](https://github.com/kytlogia/safario-historilo/actions/workflows/ci.yml/badge.svg)](https://github.com/kytlogia/safario-historilo/actions/workflows/ci.yml)

Safariのブラウズ履歴データベース（`History.db`）を読み込み、訪問履歴を詳細に確認できるWebアプリです。

- **プライバシー重視**: `History.db` はどちらの読み込み方法でも外部サーバーへ送信されません。ファイルの解析処理そのものは常にブラウザ内でWebAssembly版SQLite ([sql.js](https://sql.js.org/)) を使って行われます。
- Nuxt 4 + Vuetify 3 + Vite + pnpm で構築。
- `History.db` の読み込みは**自動読み込みとドラッグ&ドロップの両対応**です（詳細は下記）。

## 主な機能

- `pnpm dev` などNodeサーバーとして起動している場合、ボタン一つで `~/Library/Safari/History.db` を自動読み込み（後述）
- `History.db` をドラッグ&ドロップ／ファイル選択で読み込み
- 訪問履歴一覧（タイトル・URL・ドメイン・訪問日時・そのURLの累計訪問回数・状態フラグ）を仮想スクロールテーブルで表示
- タイトル/URL検索、ドメイン絞り込み、日付範囲、読み込み失敗のみ／リダイレクトのみ／自動生成履歴のみのフィルタ
- 行をクリックすると詳細ダイアログを表示（内部タイムスタンプの変換値、HTTPステータス、読み込み成否、リダイレクト元/先のvisit ID、origin/generation/attributes/scoreなどSQLiteの生データ）
- よく訪れたドメインTop 10の集計
- フィルタ後のデータをJSON/CSVでエクスポート

## History.db の読み込み方法（両対応）

### 1. 自動読み込み（Nodeサーバーとして起動している場合）

`pnpm dev` や `pnpm build && node .output/server/index.mjs` のようにNitroサーバーが起動している環境では、Nitroサーバー(Node.jsプロセス)が **`~/Library/Safari/History.db` をローカルのファイルシステムから直接読み込みます**。画面を開くと自動的に利用可否が判定され、「この Mac の History.db を自動で読み込む」ボタンが表示されます。

- 既定のパスは `~/Library/Safari/History.db` です。`NUXT_HISTORY_DB_PATH` 環境変数で上書きできます。
- 読み込みは `History.db`/`-wal`/`-shm` を手動でファイルコピーするのではなく、SQLiteの Online Backup API（`node:sqlite` の `backup()`）でホットバックアップします。Safariが実行中でWALへ書き込みが発生していても、常に論理的に一貫したスナップショットが得られるため、元ファイルを変更・破損することなく安全に読み取れます（手動でのマルチファイルコピーは書き込みタイミングによって不整合な状態になり得るため採用していません）。バックアップ自体もNode.jsのイベントループをブロックしない非同期処理です。
- サーバーは読み込んだバイト列をそのままブラウザへ返し、実際のパース処理は他の読み込み方法と同じくブラウザ内のsql.jsで行われます（サーバー側でデータの中身を解析・保持することはありません）。
- macOSでは、ターミナルアプリ（またはNodeを実行するアプリ）に「フルディスクアクセス」権限を付与する必要があります（システム設定 → プライバシーとセキュリティ → フルディスクアクセス）。付与されていない場合はファイルの存在は検出しつつ読み取り不可であることを判定し、画面上に権限付与を促すメッセージを表示します。
- この機能は `node:sqlite`（Node.js 22.5以降に付属）を使用します。利用できない環境や `History.db` が見つからない/読み取れない環境では自動的にドラッグ&ドロップのみの表示にフォールバックします。
- **セキュリティ**: `/api/local-history` 系のAPIは既定でローカルホスト（`127.0.0.1` / `::1`）かつ同一オリジンからのリクエストのみ許可されます。IPだけでなく `Origin` ヘッダーも検証しているため、同じブラウザの別タブで開いた他のWebページのJavaScriptから `fetch()` された場合でも拒否されます（IPチェックのみだと127.0.0.1判定を通過してしまうため）。Nitroサーバーを `0.0.0.0` などLAN/WAN向けにバインドして起動した場合でも、他マシンからはHistory.dbの内容はおろか存在確認すら行えません。意図的に許可する場合のみ `NUXT_HISTORY_DB_ALLOW_REMOTE=true` を設定してください（自己責任・非推奨）。
- **`pnpm dev` で試す場合**: `nuxt dev` は内部プロキシ経由でリクエストを処理するため、上記のローカルホスト判定に使う実ソケットのIPが取得できません。既定では安全側に倒して自動読み込みを無効化するので、`pnpm dev` だけではボタンは表示されません。ローカルの開発サーバーであると分かっている場合に限り、`NUXT_HISTORY_DB_TRUST_DEV_PROXY=true pnpm dev` のように環境変数を設定すると有効になります（本番ビルドではこの変数は無視されます。また `nuxt dev --host` などでLAN/コンテナに公開している場合は、他マシンからのなりすましを防ぐため設定しないでください）。

### 2. ドラッグ&ドロップ / ファイル選択

`pnpm generate` で生成した静的ホスティング環境など、Nitroサーバーが介在しない場合は自動読み込みボタンは表示されず、従来通り手動での読み込みになります。

Safariを終了してから、Finderの「移動」→「フォルダへ移動」で以下を開きます。

```
~/Library/Safari/
```

`History.db` をコピーし、このアプリの画面にドラッグ&ドロップしてください（Safari実行中はDBがロックされているため、必ずコピーしてから読み込んでください）。

## セットアップ

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

## テスト

```bash
pnpm test          # Vitest: ユニットテスト + インテグレーションテスト
pnpm test:watch    # Vitest をウォッチモードで実行
pnpm test:e2e      # Playwright: E2Eテスト（初回のみ `pnpm exec playwright install chromium` が必要）
```

- **ユニットテスト**（`tests/unit/`）: `History.db` のパース処理（Core Dataエポック変換・スキーマ検証・異常系）、CSV/JSONエクスポート、`server/utils/history-store.ts` のローカルアクセス制御（`assertLocalRequest` のセキュリティ境界）を対象にしています。
- **インテグレーションテスト**（`tests/integration/`）: [`@nuxt/test-utils`](https://nuxt.com/docs/getting-started/testing) でビルド済みのNitroサーバーを実際に起動し、`/api/local-history/*` に対するHTTPリクエスト〜レスポンスを検証します。
- **E2Eテスト**（`tests/e2e/`）: Playwrightで `nuxt dev` を起動し、ドラッグ&ドロップ/ファイル選択での読み込み、検索・フィルタ、詳細ダイアログ、CSV/JSON出力、自動読み込みボタンの表示切り替えといった主要フローをブラウザ上で検証します。
- テスト用の `History.db` は `tests/fixtures/build-history-db.ts` がsql.jsでその場に組み立てます（バイナリを直接コミットしていません）。

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
