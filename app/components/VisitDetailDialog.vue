<script setup lang="ts">
import { formatDateTime, isSafeUrl } from '~/utils/format'
import type { HistoryVisit } from '~/types/history'

defineProps<{
  visit: HistoryVisit | null
}>()

const open = defineModel<boolean>({ required: true })

const copiedField = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

function resetCopiedState() {
  clearTimeout(copiedTimer)
  copiedTimer = undefined
  copiedField.value = null
}

async function copyToClipboard(text: string, field: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedField.value = null
    }, 1500)
  } catch {
    // クリップボードAPIが使用不可（権限拒否など）の場合は何もしない
  }
}

watch(open, (isOpen) => {
  if (!isOpen) resetCopiedState()
})

onUnmounted(() => {
  clearTimeout(copiedTimer)
})
</script>

<template>
  <v-dialog v-model="open" max-width="640">
    <v-card v-if="visit" class="detail-dialog-card">
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-web" class="mr-2" />
        <span class="text-truncate">履歴の詳細</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="open = false" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-list density="compact">
          <v-list-item title="タイトル">
            <template #subtitle>
              <span class="subtitle-wrap">{{ visit.title }}</span>
            </template>
            <template #append>
              <v-btn
                :icon="copiedField === 'title' ? 'mdi-check' : 'mdi-content-copy'"
                variant="text"
                size="small"
                title="コピー"
                aria-label="コピー"
                @click="copyToClipboard(visit.title, 'title')"
              />
            </template>
          </v-list-item>
          <v-list-item title="URL">
            <template #subtitle>
              <a
                v-if="isSafeUrl(visit.url)"
                :href="visit.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary subtitle-wrap"
              >
                {{ visit.url }}
              </a>
              <span v-else class="subtitle-wrap">{{ visit.url }}</span>
            </template>
            <template #append>
              <v-btn
                :icon="copiedField === 'url' ? 'mdi-check' : 'mdi-content-copy'"
                variant="text"
                size="small"
                title="コピー"
                aria-label="コピー"
                @click="copyToClipboard(visit.url, 'url')"
              />
            </template>
          </v-list-item>
          <v-list-item title="ドメイン" :subtitle="visit.domain" />
          <v-list-item title="ドメイン展開情報" :subtitle="visit.domainExpansion ?? '(なし)'" />
          <v-list-item title="訪問日時" :subtitle="formatDateTime(visit.visitTime)" />
          <v-list-item
            title="内部タイムスタンプ (Core Data)"
            :subtitle="`${visit.visitTimeRaw} 秒（2001-01-01 UTCから） / ISO: ${visit.visitTime.toISOString()}`"
          />
          <v-list-item title="このURLの総訪問回数" :subtitle="visit.visitCount.toLocaleString()" />
          <v-list-item title="HTTPステータスコード" :subtitle="String(visit.statusCode)" />
          <v-list-item title="読み込み成功">
            <template #subtitle>
              <v-chip
                size="small"
                :color="visit.loadSuccessful ? 'success' : 'error'"
                variant="flat"
              >
                {{ visit.loadSuccessful ? '成功' : '失敗' }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item title="HTTPメソッド" :subtitle="visit.httpNonGet ? 'GET以外' : 'GET'" />
          <v-list-item title="自動生成された履歴 (synthesized)">
            <template #subtitle>
              <v-chip
                size="small"
                :color="visit.synthesized ? 'secondary' : 'default'"
                variant="flat"
              >
                {{ visit.synthesized ? 'はい' : 'いいえ' }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item
            title="リダイレクト元 visit ID"
            :subtitle="visit.redirectSource !== null ? String(visit.redirectSource) : '(なし)'"
          />
          <v-list-item
            title="リダイレクト先 visit ID"
            :subtitle="
              visit.redirectDestination !== null ? String(visit.redirectDestination) : '(なし)'
            "
          />
          <v-list-item title="origin (内部コード)" :subtitle="String(visit.origin)" />
          <v-list-item title="generation / attributes / score">
            <template #subtitle>
              {{ visit.generation }} / {{ visit.attributes }} / {{ visit.score }}
            </template>
          </v-list-item>
          <v-list-item
            title="visit ID / item ID"
            :subtitle="`${visit.visitId} / ${visit.itemId}`"
          />
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.detail-dialog-card {
  overscroll-behavior: contain;
}

.subtitle-wrap {
  display: block;
  width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

:deep(.v-list-item-subtitle) {
  -webkit-line-clamp: unset;
  display: block;
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
}
</style>
