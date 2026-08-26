<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime, formatNumber, isSafeUrl } from '~/utils/format'
import type { HistoryVisit } from '~/types/history'
import { useAppLocale } from '~/composables/useAppLocale'

defineProps<{
  visit: HistoryVisit | null
}>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()
const { intlLocale } = useAppLocale()

const copiedField = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
// ダイアログが閉じるたびに増やす世代カウンタ。writeText完了時にこの値が
// 呼び出し時から変わっていれば、閉じて再度開いた後の古い結果とみなして無視する
let copySession = 0

function resetCopiedState() {
  clearTimeout(copiedTimer)
  copiedTimer = undefined
  copiedField.value = null
}

async function copyToClipboard(text: string, field: string) {
  const session = copySession
  try {
    await navigator.clipboard.writeText(text)
    if (session !== copySession) return
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
  if (!isOpen) {
    copySession++
    resetCopiedState()
  }
})

onUnmounted(() => {
  clearTimeout(copiedTimer)
})
</script>

<template>
  <v-dialog v-model="open" max-width="640">
    <v-card v-if="visit" class="detail-dialog">
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-web" class="mr-2" />
        <span class="text-truncate">{{ t('components.dialog.title') }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :aria-label="t('common.close')"
          data-testid="detail-close-button"
          @click="open = false"
        />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-list density="compact">
          <v-list-item :title="t('components.dialog.fieldTitle')">
            <template #subtitle>
              <span class="detail-dialog__subtitle">{{ visit.title }}</span>
            </template>
            <template #append>
              <v-btn
                :icon="copiedField === 'title' ? 'mdi-check' : 'mdi-content-copy'"
                variant="text"
                size="small"
                :title="t('common.copy')"
                :aria-label="t('common.copy')"
                data-testid="copy-title-button"
                @click="copyToClipboard(visit.title, 'title')"
              />
            </template>
          </v-list-item>
          <v-list-item :title="t('components.dialog.fieldUrl')">
            <template #subtitle>
              <a
                v-if="isSafeUrl(visit.url)"
                :href="visit.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary detail-dialog__subtitle"
                data-testid="detail-url-link"
              >
                {{ visit.url }}
              </a>
              <span v-else class="detail-dialog__subtitle" data-testid="detail-url-text">{{
                visit.url
              }}</span>
            </template>
            <template #append>
              <v-btn
                :icon="copiedField === 'url' ? 'mdi-check' : 'mdi-content-copy'"
                variant="text"
                size="small"
                :title="t('common.copy')"
                :aria-label="t('common.copy')"
                data-testid="copy-url-button"
                @click="copyToClipboard(visit.url, 'url')"
              />
            </template>
          </v-list-item>
          <v-list-item :title="t('components.dialog.fieldDomain')" :subtitle="visit.domain" />
          <v-list-item
            :title="t('components.dialog.safari.fieldDomainExpansion')"
            :subtitle="visit.domainExpansion ?? t('common.none')"
          />
          <v-list-item
            :title="t('components.dialog.fieldVisitTime')"
            :subtitle="formatDateTime(visit.visitTime, intlLocale)"
          />
          <v-list-item
            :title="t('components.dialog.safari.fieldInternalTimestamp')"
            :subtitle="
              t('components.dialog.safari.internalTimestampValue', {
                seconds: visit.visitTimeRaw,
                iso: visit.visitTime.toISOString()
              })
            "
          />
          <v-list-item
            :title="t('components.dialog.fieldVisitCount')"
            :subtitle="formatNumber(visit.visitCount, intlLocale)"
          />
          <v-list-item
            :title="t('components.dialog.safari.fieldStatusCode')"
            :subtitle="String(visit.statusCode)"
          />
          <v-list-item :title="t('components.dialog.safari.fieldLoadSuccessful')">
            <template #subtitle>
              <v-chip
                size="small"
                :color="visit.loadSuccessful ? 'success' : 'error'"
                variant="flat"
              >
                {{
                  visit.loadSuccessful
                    ? t('components.dialog.safari.loadSuccess')
                    : t('components.dialog.safari.loadFailure')
                }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item
            :title="t('components.dialog.safari.fieldHttpMethod')"
            :subtitle="visit.httpNonGet ? t('components.dialog.safari.httpMethodNonGet') : 'GET'"
          />
          <v-list-item :title="t('components.dialog.safari.fieldSynthesized')">
            <template #subtitle>
              <v-chip
                size="small"
                :color="visit.synthesized ? 'secondary' : 'default'"
                variant="flat"
              >
                {{ visit.synthesized ? t('common.yes') : t('common.no') }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item
            :title="t('components.dialog.safari.fieldRedirectSource')"
            :subtitle="
              visit.redirectSource !== null ? String(visit.redirectSource) : t('common.none')
            "
          />
          <v-list-item
            :title="t('components.dialog.safari.fieldRedirectDestination')"
            :subtitle="
              visit.redirectDestination !== null
                ? String(visit.redirectDestination)
                : t('common.none')
            "
          />
          <v-list-item
            :title="t('components.dialog.safari.fieldOrigin')"
            :subtitle="String(visit.origin)"
          />
          <v-list-item :title="t('components.dialog.safari.fieldGenerationAttributesScore')">
            <template #subtitle>
              {{ visit.generation }} / {{ visit.attributes }} / {{ visit.score }}
            </template>
          </v-list-item>
          <v-list-item
            :title="t('components.dialog.safari.fieldVisitItemId')"
            :subtitle="`${visit.visitId} / ${visit.itemId}`"
          />
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
.detail-dialog {
  overscroll-behavior: contain;

  &__subtitle {
    display: block;
    width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  // v-list-item-subtitleはVuetifyが内部でレンダリングするため、独自クラスを付与できず要素セレクタで指定する
  :deep(.v-list-item-subtitle) {
    -webkit-line-clamp: unset;
    display: block;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
  }
}
</style>
