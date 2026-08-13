<script setup lang="ts">
import type { HistoryVisit } from '~/types/history'
import { exportVisitsAsCsv, exportVisitsAsJson } from '~/utils/export'

const visits = ref<HistoryVisit[]>([])
const fileName = ref('')
const sourceItemCount = ref(0)
const isLoading = ref(false)
const isDragging = ref(false)
const loadError = ref('')

const search = ref('')
const domainFilter = ref<string | null>(null)
const dateFrom = ref('')
const dateTo = ref('')
const onlyFailed = ref(false)
const onlyRedirects = ref(false)
const onlySynthesized = ref(false)

const selectedVisit = ref<HistoryVisit | null>(null)
const detailDialog = ref(false)

const hasData = computed(() => visits.value.length > 0)

const domainOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const v of visits.value) {
    counts.set(v.domain, (counts.get(v.domain) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ title: `${domain} (${count})`, value: domain }))
})

const filteredVisits = computed(() => {
  const query = search.value.trim().toLowerCase()
  const from = dateFrom.value ? new Date(`${dateFrom.value}T00:00:00`) : null
  const to = dateTo.value ? new Date(`${dateTo.value}T23:59:59`) : null

  return visits.value.filter((v) => {
    if (query && !v.title.toLowerCase().includes(query) && !v.url.toLowerCase().includes(query)) {
      return false
    }
    if (domainFilter.value && v.domain !== domainFilter.value) return false
    if (from && v.visitTime < from) return false
    if (to && v.visitTime > to) return false
    if (onlyFailed.value && v.loadSuccessful) return false
    if (onlyRedirects.value && v.redirectSource === null && v.redirectDestination === null) return false
    if (onlySynthesized.value && !v.synthesized) return false
    return true
  })
})

const topDomains = computed(() => {
  const counts = new Map<string, number>()
  for (const v of filteredVisits.value) {
    counts.set(v.domain, (counts.get(v.domain) ?? 0) + 1)
  }
  const max = Math.max(1, ...counts.values())
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count, ratio: (count / max) * 100 }))
})

const dateRangeLabel = computed(() => {
  if (visits.value.length === 0) return '-'
  const times = visits.value.map((v) => v.visitTime.getTime())
  const min = new Date(Math.min(...times))
  const max = new Date(Math.max(...times))
  return `${formatDate(min)} 〜 ${formatDate(max)}`
})

const uniqueUrlCount = computed(() => new Set(visits.value.map((v) => v.url)).size)
const uniqueDomainCount = computed(() => new Set(visits.value.map((v) => v.domain)).size)

const headers = [
  { title: 'タイトル', key: 'title', width: '28%' },
  { title: 'URL', key: 'url' },
  { title: 'ドメイン', key: 'domain', width: 170 },
  { title: '訪問日時', key: 'visitTime', width: 190 },
  { title: 'URL累計訪問回数', key: 'visitCount', width: 130, align: 'end' as const },
  { title: '状態', key: 'flags', width: 150, sortable: false }
]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(date)
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
}

function isSafeUrl(url: string) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

async function loadFile(file: File | null | undefined) {
  if (!file) return
  isLoading.value = true
  loadError.value = ''
  try {
    const result = await parseSafariHistoryFile(file)
    visits.value = result.visits
    fileName.value = result.fileName
    sourceItemCount.value = result.sourceItemCount
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '不明なエラーが発生しました。'
  } finally {
    isLoading.value = false
  }
}

function onFileInputChange(files: File[] | File | null) {
  const file = Array.isArray(files) ? files[0] : files
  loadFile(file)
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  loadFile(file)
}

function openDetail(visit: HistoryVisit) {
  selectedVisit.value = visit
  detailDialog.value = true
}

function resetAll() {
  visits.value = []
  fileName.value = ''
  sourceItemCount.value = 0
  search.value = ''
  domainFilter.value = null
  dateFrom.value = ''
  dateTo.value = ''
  onlyFailed.value = false
  onlyRedirects.value = false
  onlySynthesized.value = false
}
</script>

<template>
  <v-app-bar flat density="comfortable" color="surface">
    <v-app-bar-title>
      <v-icon icon="mdi-compass-outline" class="mr-2" />
      Safari History Detail
    </v-app-bar-title>
    <template v-if="hasData" #append>
      <span class="text-body-2 text-medium-emphasis mr-4">{{ fileName }}</span>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="resetAll">別のファイルを読み込む</v-btn>
    </template>
  </v-app-bar>

  <v-main>
    <v-container fluid class="py-6">
      <!-- Upload state -->
      <template v-if="!hasData">
        <v-row justify="center">
          <v-col cols="12" md="8" lg="6">
            <v-card
              class="pa-8 text-center drop-zone"
              :class="{ 'drop-zone--active': isDragging }"
              variant="outlined"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="onDrop"
            >
              <v-icon icon="mdi-database-search-outline" size="56" color="primary" class="mb-4" />
              <div class="text-h6 mb-2">Safariの History.db をドラッグ&ドロップ</div>
              <div class="text-body-2 text-medium-emphasis mb-6">
                またはファイルを選択してください。解析はすべてこのブラウザ内で行われ、データは外部に送信されません。
              </div>

              <v-file-input
                label="History.db を選択"
                prepend-icon="mdi-file-upload-outline"
                variant="outlined"
                density="comfortable"
                hide-details
                :loading="isLoading"
                @update:model-value="onFileInputChange"
              />

              <v-alert v-if="loadError" type="error" variant="tonal" class="mt-4 text-left">
                {{ loadError }}
              </v-alert>

              <v-divider class="my-6" />

              <div class="text-left text-body-2">
                <div class="font-weight-medium mb-2">History.db の場所（macOS / Safari）</div>
                <ol class="pl-5 mb-3">
                  <li>Safariを終了する（DBがロックされているため）</li>
                  <li>Finderで「移動」→「フォルダへ移動」を選び、次を入力：<br /><code>~/Library/Safari/</code></li>
                  <li><code>History.db</code> を任意の場所にコピーする</li>
                  <li>コピーしたファイルをこの画面にドラッグ&ドロップする</li>
                </ol>
                <v-alert type="info" variant="tonal" density="compact">
                  このアプリはファイルをサーバーへアップロードしません。すべての解析はブラウザ内のWebAssembly (sql.js) で完結します。
                </v-alert>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </template>

      <!-- Data state -->
      <template v-else>
        <v-row>
          <v-col cols="6" sm="3">
            <v-card variant="tonal" color="primary">
              <v-card-text>
                <div class="text-caption">総訪問数</div>
                <div class="text-h5 font-weight-bold">{{ visits.length.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="6" sm="3">
            <v-card variant="tonal">
              <v-card-text>
                <div class="text-caption">ユニークURL数</div>
                <div class="text-h5 font-weight-bold">{{ uniqueUrlCount.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="6" sm="3">
            <v-card variant="tonal">
              <v-card-text>
                <div class="text-caption">ドメイン数</div>
                <div class="text-h5 font-weight-bold">{{ uniqueDomainCount.toLocaleString() }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="6" sm="3">
            <v-card variant="tonal">
              <v-card-text>
                <div class="text-caption">期間</div>
                <div class="text-body-1 font-weight-medium">{{ dateRangeLabel }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mt-2">
          <v-col cols="12" md="9">
            <v-card>
              <v-card-text>
                <v-row>
                  <v-col cols="12" sm="6" md="4">
                    <v-text-field
                      v-model="search"
                      label="タイトル・URLで検索"
                      prepend-inner-icon="mdi-magnify"
                      variant="outlined"
                      density="comfortable"
                      clearable
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" sm="6" md="4">
                    <v-select
                      v-model="domainFilter"
                      :items="domainOptions"
                      label="ドメインで絞り込み"
                      variant="outlined"
                      density="comfortable"
                      clearable
                      hide-details
                    />
                  </v-col>
                  <v-col cols="6" md="2">
                    <v-text-field
                      v-model="dateFrom"
                      type="date"
                      label="開始日"
                      variant="outlined"
                      density="comfortable"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="6" md="2">
                    <v-text-field
                      v-model="dateTo"
                      type="date"
                      label="終了日"
                      variant="outlined"
                      density="comfortable"
                      hide-details
                    />
                  </v-col>
                </v-row>
                <v-row class="mt-1">
                  <v-col cols="12" class="d-flex flex-wrap ga-2 align-center">
                    <v-checkbox v-model="onlyFailed" label="読み込み失敗のみ" density="compact" hide-details />
                    <v-checkbox v-model="onlyRedirects" label="リダイレクトのみ" density="compact" hide-details />
                    <v-checkbox v-model="onlySynthesized" label="自動生成された履歴のみ" density="compact" hide-details />
                    <v-spacer />
                    <span class="text-body-2 text-medium-emphasis">
                      {{ filteredVisits.length.toLocaleString() }} / {{ visits.length.toLocaleString() }} 件を表示
                    </span>
                    <v-btn
                      variant="text"
                      size="small"
                      prepend-icon="mdi-code-json"
                      @click="exportVisitsAsJson(filteredVisits)"
                    >
                      JSON出力
                    </v-btn>
                    <v-btn
                      variant="text"
                      size="small"
                      prepend-icon="mdi-file-delimited-outline"
                      @click="exportVisitsAsCsv(filteredVisits)"
                    >
                      CSV出力
                    </v-btn>
                  </v-col>
                </v-row>
              </v-card-text>

              <v-divider />

              <v-data-table-virtual
                :headers="headers"
                :items="filteredVisits"
                item-value="visitId"
                height="600"
                fixed-header
                @click:row="(_e: Event, row: { item: HistoryVisit }) => openDetail(row.item)"
              >
                <template #item.title="{ item }">
                  <div class="text-truncate" style="max-width: 320px" :title="item.title">{{ item.title }}</div>
                </template>
                <template #item.url="{ item }">
                  <div class="text-truncate text-medium-emphasis" style="max-width: 420px" :title="item.url">
                    {{ item.url }}
                  </div>
                </template>
                <template #item.visitTime="{ item }">
                  {{ formatDateTime(item.visitTime) }}
                </template>
                <template #item.visitCount="{ item }">
                  {{ item.visitCount.toLocaleString() }}
                </template>
                <template #item.flags="{ item }">
                  <v-chip v-if="!item.loadSuccessful" size="x-small" color="error" variant="flat" class="mr-1">失敗</v-chip>
                  <v-chip
                    v-if="item.redirectSource !== null || item.redirectDestination !== null"
                    size="x-small"
                    color="warning"
                    variant="flat"
                    class="mr-1"
                  >
                    リダイレクト
                  </v-chip>
                  <v-chip v-if="item.synthesized" size="x-small" color="secondary" variant="flat">自動</v-chip>
                </template>
              </v-data-table-virtual>
            </v-card>
          </v-col>

          <v-col cols="12" md="3">
            <v-card>
              <v-card-title class="text-subtitle-1">よく訪れたドメイン Top 10</v-card-title>
              <v-card-text>
                <div v-for="d in topDomains" :key="d.domain" class="mb-3">
                  <div class="d-flex justify-space-between text-body-2 mb-1">
                    <span class="text-truncate" style="max-width: 180px">{{ d.domain }}</span>
                    <span class="text-medium-emphasis">{{ d.count }}</span>
                  </div>
                  <v-progress-linear :model-value="d.ratio" color="primary" height="6" rounded />
                </div>
                <div v-if="topDomains.length === 0" class="text-body-2 text-medium-emphasis">
                  該当するデータがありません
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>
    </v-container>
  </v-main>

  <!-- Detail dialog -->
  <v-dialog v-model="detailDialog" max-width="640">
    <v-card v-if="selectedVisit">
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-web" class="mr-2" />
        <span class="text-truncate">履歴の詳細</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="detailDialog = false" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-list density="compact">
          <v-list-item title="タイトル" :subtitle="selectedVisit.title" />
          <v-list-item title="URL">
            <template #subtitle>
              <a
                v-if="isSafeUrl(selectedVisit.url)"
                :href="selectedVisit.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary"
              >
                {{ selectedVisit.url }}
              </a>
              <span v-else>{{ selectedVisit.url }}</span>
            </template>
          </v-list-item>
          <v-list-item title="ドメイン" :subtitle="selectedVisit.domain" />
          <v-list-item title="ドメイン展開情報" :subtitle="selectedVisit.domainExpansion ?? '(なし)'" />
          <v-list-item title="訪問日時" :subtitle="formatDateTime(selectedVisit.visitTime)" />
          <v-list-item
            title="内部タイムスタンプ (Core Data)"
            :subtitle="`${selectedVisit.visitTimeRaw} 秒（2001-01-01 UTCから） / ISO: ${selectedVisit.visitTime.toISOString()}`"
          />
          <v-list-item title="このURLの総訪問回数" :subtitle="selectedVisit.visitCount.toLocaleString()" />
          <v-list-item title="HTTPステータスコード" :subtitle="String(selectedVisit.statusCode)" />
          <v-list-item title="読み込み成功">
            <template #subtitle>
              <v-chip size="small" :color="selectedVisit.loadSuccessful ? 'success' : 'error'" variant="flat">
                {{ selectedVisit.loadSuccessful ? '成功' : '失敗' }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item title="HTTPメソッド" :subtitle="selectedVisit.httpNonGet ? 'GET以外' : 'GET'" />
          <v-list-item title="自動生成された履歴 (synthesized)">
            <template #subtitle>
              <v-chip size="small" :color="selectedVisit.synthesized ? 'secondary' : 'default'" variant="flat">
                {{ selectedVisit.synthesized ? 'はい' : 'いいえ' }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item
            title="リダイレクト元 visit ID"
            :subtitle="selectedVisit.redirectSource !== null ? String(selectedVisit.redirectSource) : '(なし)'"
          />
          <v-list-item
            title="リダイレクト先 visit ID"
            :subtitle="selectedVisit.redirectDestination !== null ? String(selectedVisit.redirectDestination) : '(なし)'"
          />
          <v-list-item title="origin (内部コード)" :subtitle="String(selectedVisit.origin)" />
          <v-list-item title="generation / attributes / score">
            <template #subtitle>
              {{ selectedVisit.generation }} / {{ selectedVisit.attributes }} / {{ selectedVisit.score }}
            </template>
          </v-list-item>
          <v-list-item title="visit ID / item ID" :subtitle="`${selectedVisit.visitId} / ${selectedVisit.itemId}`" />
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.drop-zone {
  transition: border-color 0.2s ease, background-color 0.2s ease;
}
.drop-zone--active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.06);
}
:deep(tr) {
  cursor: pointer;
}
</style>
