<script
  setup
  lang="ts"
  generic="
    T extends { title: string; url: string; domain: string; visitTime: Date; visitCount: number }
  "
>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime, formatNumber } from '~/utils/format'
import { useAppLocale } from '~/composables/useAppLocale'
import TruncatedCell from './TruncatedCell.vue'

export interface VisitsTableHeader {
  title: string
  key: string
  width?: string | number
  sortable?: boolean
  align?: 'start' | 'end' | 'center'
}

const props = defineProps<{
  headers: VisitsTableHeader[]
  items: T[]
  itemValue: string
  height?: string | number
  // Safari/Chromium/Firefox all append an identical detail-button column;
  // Unified has no per-row detail action, so this stays opt-in rather than
  // always-on.
  showActions?: boolean
}>()

const emit = defineEmits<{
  'row-click': [item: T]
}>()

const { t } = useI18n()

const resolvedHeaders = computed<VisitsTableHeader[]>(() =>
  props.showActions
    ? [
        ...props.headers,
        {
          title: t('components.visitsTable.headerActions'),
          key: 'actions',
          width: 56,
          sortable: false,
          align: 'center'
        }
      ]
    : props.headers
)

// Vuetify (v4.1.9時点)には列リサイズのネイティブ機能が無いため自前実装する
// (#127)。公式実装が入ったら剥がして置き換えること。
// ドラッグ中のヘッダー幅はheaders propとは別にpx指定で保持し、それ以外の列は
// headersで指定された幅(%指定含む)をそのまま使う。
const MIN_COLUMN_WIDTH = 60
const columnWidthOverrides = ref<Record<string, number>>({})

const resizableHeaders = computed<VisitsTableHeader[]>(() =>
  resolvedHeaders.value.map((header) => {
    const width = columnWidthOverrides.value[header.key]
    return width == null ? header : { ...header, width }
  })
)

let resizingKey: string | null = null
let resizeStartX = 0
let resizeStartWidth = 0

function onColumnResizeMove(event: MouseEvent) {
  if (resizingKey === null) return
  const width = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth + (event.clientX - resizeStartX))
  columnWidthOverrides.value = { ...columnWidthOverrides.value, [resizingKey]: width }
}

function stopColumnResize() {
  resizingKey = null
  window.removeEventListener('mousemove', onColumnResizeMove)
  window.removeEventListener('mouseup', stopColumnResize)
}

function startColumnResize(key: string, event: MouseEvent) {
  const th = (event.currentTarget as HTMLElement).closest('th')
  if (!th) return
  event.preventDefault()
  resizingKey = key
  resizeStartX = event.clientX
  resizeStartWidth = th.getBoundingClientRect().width
  window.addEventListener('mousemove', onColumnResizeMove)
  window.addEventListener('mouseup', stopColumnResize)
}

onBeforeUnmount(stopColumnResize)

// Any extra column beyond title/url/domain/visitTime/visitCount (flags,
// actions, the unified "source" chip, ...) is caller-specific — declared
// here so callers get a properly typed `item: T` in their `#item.xxx="{
// item }"` templates instead of falling back to `any` through the generic
// slot passthrough below.
defineSlots<{
  [key: string]: (props: { item: T }) => unknown
}>()

const { intlLocale } = useAppLocale()
</script>

<template>
  <v-data-table-virtual
    :headers="resizableHeaders"
    :items="items"
    :item-value="itemValue"
    :height="height ?? 600"
    fixed-header
    @click:row="(_e: Event, row: { item: T }) => emit('row-click', row.item)"
  >
    <template
      v-for="header in resolvedHeaders"
      :key="`header.${header.key}`"
      #[`header.${header.key}`]="{ column, getSortIcon }"
    >
      <div class="v-data-table-header__content">
        <span>{{ column.title }}</span>
        <v-icon
          v-if="column.sortable"
          class="v-data-table-header__sort-icon"
          :icon="getSortIcon(column)"
        />
      </div>
      <span
        class="column-resize-handle"
        aria-hidden="true"
        @mousedown.stop="startColumnResize(header.key, $event)"
        @click.stop
      />
    </template>
    <template #item.title="{ item }">
      <TruncatedCell :text="item.title" />
    </template>
    <template #item.url="{ item }">
      <TruncatedCell :text="item.url" class="text-medium-emphasis" />
    </template>
    <template #item.domain="{ item }">
      <TruncatedCell :text="item.domain" />
    </template>
    <template #item.visitTime="{ item }">
      {{ formatDateTime(item.visitTime, intlLocale) }}
    </template>
    <template #item.visitCount="{ item }">
      {{ formatNumber(item.visitCount, intlLocale) }}
    </template>
    <template v-if="showActions" #item.actions="{ item }">
      <v-btn
        icon="mdi-information-outline"
        variant="text"
        size="small"
        :aria-label="t('components.visitsTable.detailAriaLabel')"
        data-testid="row-detail-button"
        @click.stop="emit('row-click', item)"
      />
    </template>
    <template v-for="(_, slotName) in $slots" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </v-data-table-virtual>
</template>

<style scoped>
/* tr/tableはVuetifyが内部でレンダリングするため、独自クラスを付与できず要素セレクタで指定する */
:deep(tr) {
  cursor: pointer;
}
:deep(table) {
  table-layout: fixed;
}
/* ドラッグハンドルの絶対配置の基点。装飾要素なのでキーボード操作・
   フォーカス順序には影響しない(tabindexを持たせない、aria-hiddenを付与)。 */
:deep(th.v-data-table__th) {
  position: relative;
}
.column-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
}
/* 親がflexで残り高さを配ってきても、デフォルトのmin-height:autoは
   全行分(仮想スクロールの上下パディングを含む)の実コンテンツ高さを
   最小値にしてしまい縮小できない(#126)。0にリセットしてflex-growに
   応じた高さで収まるようにする。 */
.v-table {
  min-height: 0;
}
</style>
