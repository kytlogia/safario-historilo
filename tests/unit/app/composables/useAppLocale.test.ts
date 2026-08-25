import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import { useAppLocale, useVisitFilterI18n } from '~/composables/useAppLocale'
import ja from '../../../../i18n/locales/ja.json'
import en from '../../../../i18n/locales/en.json'
import zh from '../../../../i18n/locales/zh.json'

function withSetup<T>(setup: () => T) {
  let result!: T
  const app = createApp({
    setup() {
      result = setup()
      return () => null
    }
  })
  app.use(createVuetify())
  app.use(createI18n({ legacy: false, locale: 'ja', messages: { ja, en, zh } }))
  app.mount(document.createElement('div'))
  return { result, unmount: () => app.unmount() }
}

describe('useAppLocale', () => {
  it('defaults to ja and exposes the matching Intl locale tag', () => {
    const { result } = withSetup(() => useAppLocale())

    expect(result.currentLocale.value).toBe('ja')
    expect(result.intlLocale.value).toBe('ja-JP')
  })

  it('setLocale switches the active locale and Intl tag together', () => {
    const { result } = withSetup(() => useAppLocale())

    result.setLocale('en')
    expect(result.currentLocale.value).toBe('en')
    expect(result.intlLocale.value).toBe('en-US')

    result.setLocale('zh')
    expect(result.currentLocale.value).toBe('zh')
    expect(result.intlLocale.value).toBe('zh-CN')
  })

  it('initLocale syncs <html lang> to the current locale', () => {
    const { result } = withSetup(() => useAppLocale())

    result.setLocale('en')
    result.initLocale()
    expect(document.documentElement.lang).toBe('en')

    result.setLocale('zh')
    expect(document.documentElement.lang).toBe('zh')
  })

  it('availableLocales lists all three locales with their display names', () => {
    const { result } = withSetup(() => useAppLocale())

    expect(result.availableLocales.value).toEqual([
      { code: 'ja', name: '日本語' },
      { code: 'en', name: 'English' },
      { code: 'zh', name: '中文' }
    ])
  })
})

describe('useVisitFilterI18n', () => {
  it('reflects the live locale for t()/tm()/intlLocale()', () => {
    const { result } = withSetup(() => ({
      locale: useAppLocale(),
      filterI18n: useVisitFilterI18n()
    }))

    expect(result.filterI18n.t('common.close')).toBe('閉じる')
    expect(result.filterI18n.tm('weekday')).toEqual(['日', '月', '火', '水', '木', '金', '土'])
    expect(result.filterI18n.intlLocale()).toBe('ja-JP')

    result.locale.setLocale('en')

    expect(result.filterI18n.t('common.close')).toBe('Close')
    expect(result.filterI18n.tm('weekday')).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat'
    ])
    expect(result.filterI18n.intlLocale()).toBe('en-US')
  })
})
