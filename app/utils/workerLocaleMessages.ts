import type { AppLocale } from '~/composables/useAppLocale'

// The parseXHistoryDatabase.ts utils run inside Web Workers (a separate
// execution context with no Vue instance), so their error/placeholder text
// can't go through vue-i18n's useI18n() the way component-level strings do.
// This file is their self-contained substitute — one shared place for all
// six per-browser/per-purpose locale maps that used to live independently in
// parseHistoryDatabase.ts, parseFirefoxHistoryDatabase.ts,
// parseChromiumHistoryDatabase.ts, and the three useXHistoryParser.ts
// composables, so a wording tweak or a new locale only needs updating here.
export interface ParserMessages {
  openFailed: string
  wrongSchema: string
  missingColumns: (table: string, missing: string) => string
  noTitle: string
}

export const PARSER_MESSAGES: Record<
  'safari' | 'firefox' | 'chromium',
  Record<AppLocale, ParserMessages>
> = {
  safari: {
    ja: {
      openFailed:
        'ファイルを開けませんでした。有効なSQLiteデータベースファイルを選択してください。',
      wrongSchema:
        'このファイルはSafariの履歴データベース(History.db)ではないようです。history_items / history_visits テーブルが見つかりませんでした。',
      missingColumns: (table, missing) =>
        `このHistory.dbのスキーマは対応していません。テーブル "${table}" に想定していた列が見つかりませんでした: ${missing}`,
      noTitle: '(タイトルなし)'
    },
    en: {
      openFailed: 'Could not open the file. Please choose a valid SQLite database file.',
      wrongSchema:
        "This file doesn't look like Safari's history database (History.db). The history_items / history_visits tables were not found.",
      missingColumns: (table, missing) =>
        `This History.db's schema isn't supported. Table "${table}" is missing expected column(s): ${missing}`,
      noTitle: '(no title)'
    },
    zh: {
      openFailed: '无法打开文件。请选择一个有效的 SQLite 数据库文件。',
      wrongSchema:
        '该文件似乎不是 Safari 的历史记录数据库 (History.db)。未找到 history_items / history_visits 表。',
      missingColumns: (table, missing) =>
        `此 History.db 的架构不受支持。表 "${table}" 缺少预期的列：${missing}`,
      noTitle: '(无标题)'
    }
  },
  firefox: {
    ja: {
      openFailed:
        'ファイルを開けませんでした。有効なSQLiteデータベースファイルを選択してください。',
      wrongSchema:
        'このファイルはFirefoxの履歴データベース(places.sqlite)ではないようです。moz_places / moz_historyvisits テーブルが見つかりませんでした。',
      missingColumns: (table, missing) =>
        `このplaces.sqliteのスキーマは対応していません。テーブル "${table}" に想定していた列が見つかりませんでした: ${missing}`,
      noTitle: '(タイトルなし)'
    },
    en: {
      openFailed: 'Could not open the file. Please choose a valid SQLite database file.',
      wrongSchema:
        "This file doesn't look like Firefox's history database (places.sqlite). The moz_places / moz_historyvisits tables were not found.",
      missingColumns: (table, missing) =>
        `This places.sqlite's schema isn't supported. Table "${table}" is missing expected column(s): ${missing}`,
      noTitle: '(no title)'
    },
    zh: {
      openFailed: '无法打开文件。请选择一个有效的 SQLite 数据库文件。',
      wrongSchema:
        '该文件似乎不是 Firefox 的历史记录数据库 (places.sqlite)。未找到 moz_places / moz_historyvisits 表。',
      missingColumns: (table, missing) =>
        `此 places.sqlite 的架构不受支持。表 "${table}" 缺少预期的列：${missing}`,
      noTitle: '(无标题)'
    }
  },
  chromium: {
    ja: {
      openFailed:
        'ファイルを開けませんでした。有効なSQLiteデータベースファイルを選択してください。',
      wrongSchema:
        'このファイルはChrome/Edgeの履歴データベース(History)ではないようです。urls / visits テーブルが見つかりませんでした。',
      missingColumns: (table, missing) =>
        `このHistoryのスキーマは対応していません。テーブル "${table}" に想定していた列が見つかりませんでした: ${missing}`,
      noTitle: '(タイトルなし)'
    },
    en: {
      openFailed: 'Could not open the file. Please choose a valid SQLite database file.',
      wrongSchema:
        "This file doesn't look like Chrome/Edge's history database (History). The urls / visits tables were not found.",
      missingColumns: (table, missing) =>
        `This History's schema isn't supported. Table "${table}" is missing expected column(s): ${missing}`,
      noTitle: '(no title)'
    },
    zh: {
      openFailed: '无法打开文件。请选择一个有效的 SQLite 数据库文件。',
      wrongSchema:
        '该文件似乎不是 Chrome/Edge 的历史记录数据库 (History)。未找到 urls / visits 表。',
      missingColumns: (table, missing) =>
        `此 History 的架构不受支持。表 "${table}" 缺少预期的列：${missing}`,
      noTitle: '(无标题)'
    }
  }
}

export const WORKER_CRASH_MESSAGES: Record<
  'safari' | 'firefox' | 'chromium',
  Record<AppLocale, string>
> = {
  safari: {
    ja: 'History.dbの解析中にエラーが発生しました。',
    en: 'An error occurred while parsing History.db.',
    zh: '解析 History.db 时发生错误。'
  },
  firefox: {
    ja: 'places.sqliteの解析中にエラーが発生しました。',
    en: 'An error occurred while parsing places.sqlite.',
    zh: '解析 places.sqlite 时发生错误。'
  },
  chromium: {
    ja: 'Historyの解析中にエラーが発生しました。',
    en: 'An error occurred while parsing History.',
    zh: '解析 History 时发生错误。'
  }
}
