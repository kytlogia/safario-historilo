# Contributing

このドキュメントは開発フローに関する取り決めをまとめたものです。詳しい経緯・検討過程は [#51](https://github.com/kytlogia/safario-historilo/issues/51) を参照してください。

## ブランチ運用

トランクベース開発を採用しています。`develop` や `release/*` のような長命ブランチは作らず、`main` のみを唯一の長命ブランチとします（[SECURITY.md](.github/SECURITY.md) の対応バージョンも同じ前提に基づいています。将来 `release/*` を切った場合は両方のドキュメントを更新してください）。

- 作業ブランチは Issue 単位で `main` から作成し、マージ後は削除する短命ブランチとします。
- 命名規則：`<type>/<issue番号>-<slug>`（`type` は `feature` / `fix` / `chore` / `docs` / `refactor` など）を基本とします。
  - Claude Codeが自動生成する `claude/issue-<N>-<slug>` はそのまま許容します（誰が作業したブランチかが分かる利点があるため）。
  - 共通の必須ルールは「ブランチ名にissue番号を含める」ことのみです（本ドキュメント制定後に作成するブランチが対象です。制定以前にマージ済みの `copilot/*` ブランチ等は対象外です）。
- リリースは `main` 上に `v1.0.0` のようなタグを打つ方式とし、別ブランチは維持しません。将来パッチ対応が必要になった時点で、タグから `release/1.0.x` を都度切ります。

## Issueの起票

- Issueは必ず [Issue Forms](https://github.com/kytlogia/safario-historilo/issues/new/choose) のテンプレートから作成する（Blank issueは無効化済み）。
  - `バグ報告`（`bug`ラベルが自動付与）
  - `機能要望・改善提案`（`enhancement`ラベルが自動付与）
  - `ドキュメント・運用改善`（`documentation`ラベルが自動付与）
- 上記のいずれにも当てはまらない場合（質問など）は、最も近いテンプレートを選び、内容に応じてラベルを手動調整する。
- 種別ラベルは作成時点で必ず1つ付与された状態にする（テンプレート経由なら自動で満たされる）。
- milestone（対象バージョン）は作成時点では未設定でよい。トリアージ時にリポジトリオーナーが設定する。
- Claude Codeなどのエージェントが自律的にIssueを起票する場合も、同じテンプレート・ルールに従う。

## Issue → ブランチ → PR フロー

- 原則、すべての変更はIssueから始めます（typoなどごく軽微な修正を除く）。
- ブランチは `main` から作成します（命名規則は上記「ブランチ運用」参照）。
- PRのタイトルまたは本文に `Closes #<N>` のようなキーワードを明記し、マージ時に対象Issueが自動クローズされるようにします。
- PRを作成する際は [`.github/pull_request_template.md`](.github/pull_request_template.md) のチェックリストに従います。
- milestoneの扱いは上記「Issueの起票」を参照してください。

## コミットメッセージ

- 1コミット（またはPR全体としてのsquashコミット）が「何を」「なぜ」変更したのかを一文で説明できるタイトルにします。
- 挙動の変更を伴う場合は `fix:` / `feat:` / `refactor:` のような接頭辞を付け、それ以外（ドキュメントのみ、CI設定のみ等）は `docs:` / `chore:` を使うことを推奨します（必須ではありません）。日本語・英語どちらでも構いません。
- マージはSquash mergeで統一しています。`main` に設定したRepository rulesetでSquash merge以外のマージ方式を選べないよう強制しているため（詳細は下記「PRのマージ」参照）、通常操作では選択ミスは起きません。これにより実質的にはPRタイトルがそのまま `main` 上のコミットメッセージになります。PRタイトルを上記の基準で書けば、個々のコミットメッセージの厳密さは重視しません。

## PRのマージ

目標は「誰か（エージェント含む）が確認なしに `main` へ直接pushしたり、勝手にPRをマージできない」状態を保つことです。

- `main` への直接pushは禁止です。すべての変更はPR経由で行います。リポジトリのPublic化に合わせて `main` に Repository ruleset を設定済みで、直push禁止・必須ステータスチェック・squash mergeのみ許可・線形履歴をGitHub側でも強制しています（詳細は [#51](https://github.com/kytlogia/safario-historilo/issues/51) 参照）。
- CIの必須ステータスチェック（`Lint / Format / Typecheck / Test / Build`、`E2E tests (Playwright)`、いずれも[ci.yml](.github/workflows/ci.yml)のジョブ名）を通過していないPRはマージできません。
- Claude Codeなどのエージェントは `gh pr merge` を実行しません。PRの作成までを行い、マージはユーザー本人の明示的な承認を得てから、ユーザー自身（またはユーザーの指示を受けたエージェント）がボタンを押します。マージボタンを押す行為そのものが、オーナー本人の最終確認ポイントとして機能します。（現時点ではこのルールを技術的に強制する仕組みはなく、運用上の約束事です）
- このリポジトリは現状コラボレーターがオーナー1名のため、GitHubの「Require approvals」機能（他者によるレビュー承認必須化）は有効化していません。外部コントリビューターを受け入れ始めた時点で見直します。

## Vueコンポーネントのスタイル記述

背景・検討過程の詳細は [#54](https://github.com/kytlogia/safario-historilo/issues/54) を参照してください。

### 方針：ユーティリティクラスとscoped SCSSの併用（折衷案）

`<template>` にVuetifyのユーティリティクラス（`mr-2` `pa-8` `d-flex` `ga-2` 等）をすべて排除して `<style>` に寄せる、という完全移行は行いません。技術検証の結果、以下の理由からユーティリティクラスと `<style scoped lang="scss">` を併用する折衷案を採用します。

- **VuetifyのユーティリティクラスをSCSS側から`@extend`する方式は採用しない。** `vuetify/lib/styles/utilities` はクラスをその場で動的生成するSassモジュールで、`@use` すると（実際に使うクラスが数個でも）レスポンシブ対応を含む全ユーティリティ分＝約240KBのCSSがそのまま出力される。Vue SFCの `<style scoped>` はコンポーネントごとに独立したスタイルシートとしてコンパイルされ、`data-v-*` 属性でスコープされたセレクタは他コンポーネントの出力と重複除去（dedupe）されないため、これをコンポーネント数分繰り返すとバンドルサイズが破綻する。
- `text-medium-emphasis` `text-caption` `text-h5` のような色・タイポグラフィ系のユーティリティクラスは、Vuetifyのテーマシステム（`--v-theme-*` 等のCSSカスタムプロパティ、ライト/ダーク切り替え）と密結合している。独自CSSに書き直すと同じCSS変数を自分で参照し直す必要があり、劣化コピーになりがちなので、**これらはテンプレート側にユーティリティクラスとして残すのが基本**。
- グリッド・フレックスレイアウト（`v-row`/`v-col` の間隔、`d-flex` `ga-2` `align-center` 等）や、1箇所だけの軽微な余白調整（単発の `mb-1` `mr-2` など）も、複数プロパティの組み合わせとして名前を与える意味が薄いため、テンプレート側に残してよい。

一方で、次のようなケースは `<style scoped lang="scss">` に寄せます。

- 複数のユーティリティクラス・生のCSSが組み合わさって、そのコンポーネント固有の「見た目のまとまり」を構成している部分（例: ドラッグ&ドロップ領域の見た目、状態に応じた配色変化）
- `:hover` やトランジションなど、ユーティリティクラスで表現できない振る舞い
- Vuetifyのデザイントークンを再利用したい場合は、ユーティリティクラス生成器（`vuetify/lib/styles/utilities`）ではなく、変数のみを持つ設定ファイル（例: `@use 'vuetify/lib/styles/settings/_variables' as vuetify;` で `vuetify.$spacers` などを参照）や、`--v-theme-primary` のようなCSSカスタムプロパティを直接使う。こちらは生成CSSを伴わないため肥大化しない。

`lang="scss"` を使うため `sass-embedded` を devDependencies に追加済みです。既存の `<style scoped>`（プレーンCSS）のコンポーネントは、ネストや変数が必要になったタイミングで `lang="scss"` に切り替えれば十分で、一括変換の必要はありません。

比較検討した他の選択肢：

- **`<style scoped>`（プレーンCSS）**：追加の依存が不要な一方、ネスト記法・変数・`map.get()` のようなVuetifyトークン参照ができない。BEM風の命名（`drop-zone__alert` 等）を素のCSSで書くと修飾子のたびにセレクタ全体を書き直すことになり冗長。
- **CSS Modules（`<style module>`）**：クラス名の衝突をビルド時にハッシュ化して防げるが、このプロジェクトは各コンポーネントが1ファイル完結でクラス名の衝突リスクが低く、すでに `scoped` 属性で同等の分離ができている。`class="drop-zone"` のような静的な文字列でテンプレートに書けなくなり（`$style.dropZone` のような参照が必要）、既存コードとの差分・学習コストの割に得られる利点が小さいため見送る。

以上より `<style scoped lang="scss">` を基本方針として採用します。

適用サンプルは [`app/components/UploadPanel.vue`](app/components/UploadPanel.vue) を参照してください。

### CSSクラスの命名規則

Vue公式スタイルガイドには要素セレクタよりクラスセレクタを優先すべきというルール（[Element selectors with `scoped`](https://vuejs.org/style-guide/rules-use-with-caution.html#element-selectors-with-scoped)）はありますが、クラス名自体の命名規則は定めていないため、このプロジェクトでは軽量なBEM風の規則を採用します。

- ブロック名＝そのスタイルのまとまりを代表する要素につけるクラス名（ケバブケース）。`scoped` により重複はコンポーネント間で衝突しないため、コンポーネント名と一致させる必要はない（例: `drop-zone`）。
- 子要素は `block__element`（例: `drop-zone__divider`）。
- 状態・バリエーションは `block--modifier` または `block__element--modifier`（例: `drop-zone--active`）。既存コードのパターンを踏襲し、状態の接頭辞に `is-*` は使わない。
- BEMのネストは1階層まで（`block__element__sub-element` のような多段ネストは避け、必要なら別のelement名を検討する）。
- `:hover` `:focus-visible` など疑似クラスで表現できる状態にはクラスを追加しない。

stylelintなど機械的なチェックの導入は本issueでは見送り、必要になった時点で別issueとして検討します。

## Dependabotが作成するPRの運用

- Dependabotが作成する依存パッケージ更新PRも、他のPRと同様に常に手動でレビューしてからマージします（リポジトリ全体のAuto-merge機能は無効のままにしています）。
- `package.json` のバージョン更新・gitタグの作成はDependabotの依存更新PRとは別に行います。依存更新1件ごとにパッチバージョンを上げるのではなく、ある程度まとまった時点でオーナーが判断してパッチリリース（例: `v1.0.1`）を切ります。
- 依存更新の件数が増えて手動レビューの負担が大きくなった場合は、パッチバージョンのみ等の条件付き自動マージ導入をあらためて検討します（[#53](https://github.com/kytlogia/safario-historilo/issues/53)参照）。
