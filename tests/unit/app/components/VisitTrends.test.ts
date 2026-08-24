import { describe, expect, it } from 'vitest'
import VisitTrends from '~/components/VisitTrends.vue'
import type { TrendBucket } from '~/composables/useVisitFilterEngine'
import { mountWithVuetify } from '../../support/mountWithVuetify'

function makeWeekdayTrend(overrides: Partial<Record<string, number>> = {}): TrendBucket[] {
  const labels = ['日', '月', '火', '水', '木', '金', '土']
  const max = Object.values(overrides).reduce((a, b) => Math.max(a, b ?? 0), 1)
  return labels.map((label) => {
    const count = overrides[label] ?? 0
    return { label, count, ratio: (count / max) * 100 }
  })
}

function makeHourlyTrend(): TrendBucket[] {
  return Array.from({ length: 24 }, (_, hour) => ({ label: String(hour), count: 0, ratio: 0 }))
}

describe('VisitTrends', () => {
  it('renders one bar per weekday and per hour with an accessible title showing the count', () => {
    const weekdayTrend = makeWeekdayTrend({ 日: 10, 月: 4 })
    const wrapper = mountWithVuetify(VisitTrends, {
      props: { weekdayTrend, hourlyTrend: makeHourlyTrend() }
    })

    const weekdayBars = wrapper.findAll('.trend-chart:not(.trend-chart--hourly) .trend-bar')
    expect(weekdayBars).toHaveLength(7)
    expect(weekdayBars[0]!.attributes('title')).toBe('日: 10件')
    expect(weekdayBars[1]!.attributes('title')).toBe('月: 4件')

    const hourlyBars = wrapper.findAll('.trend-chart--hourly .trend-bar')
    expect(hourlyBars).toHaveLength(24)
  })

  it('shows an empty state instead of the charts when every weekday bucket is zero', () => {
    const wrapper = mountWithVuetify(VisitTrends, {
      props: { weekdayTrend: makeWeekdayTrend(), hourlyTrend: makeHourlyTrend() }
    })

    expect(wrapper.find('.trend-chart').exists()).toBe(false)
    expect(wrapper.text()).toContain('該当するデータがありません')
  })
})
