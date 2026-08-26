<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatDateTime, formatNumber, isSafeUrl } from '~/utils/format'
import type { UnifiedHistoryVisit } from '~/types/history'
import { unifiedSourceMeta } from '~/utils/unifiedHistory'
import { useAppLocale } from '~/composables/useAppLocale'
import { useCopyFeedback } from '~/composables/useCopyFeedback'

defineProps<{
  visit: UnifiedHistoryVisit | null
}>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()
const { intlLocale } = useAppLocale()
const { copiedField, copyToClipboard } = useCopyFeedback(open)
</script>

<template>
  <v-dialog v-model="open" max-width="640">
    <v-card v-if="visit" class="detail-dialog">
      <v-card-title class="d-flex align-center">
        <v-icon :icon="unifiedSourceMeta(visit.source).icon" class="mr-2" />
        <span class="text-truncate">{{
          t('components.dialog.titleWithSource', { source: visit.sourceLabel })
        }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :aria-label="t('common.close')"
          data-testid="unified-detail-close-button"
          @click="open = false"
        />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-list density="compact">
          <v-list-item :title="t('components.dialog.fieldSource')">
            <template #subtitle>
              <v-chip
                size="small"
                variant="tonal"
                :color="unifiedSourceMeta(visit.source).color"
                :prepend-icon="unifiedSourceMeta(visit.source).icon"
              >
                {{ visit.sourceLabel }}
              </v-chip>
            </template>
          </v-list-item>
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
                data-testid="unified-copy-title-button"
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
                data-testid="unified-detail-url-link"
              >
                {{ visit.url }}
              </a>
              <span v-else class="detail-dialog__subtitle" data-testid="unified-detail-url-text">{{
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
                data-testid="unified-copy-url-button"
                @click="copyToClipboard(visit.url, 'url')"
              />
            </template>
          </v-list-item>
          <v-list-item :title="t('components.dialog.fieldDomain')" :subtitle="visit.domain" />
          <v-list-item
            :title="t('components.dialog.fieldVisitTime')"
            :subtitle="formatDateTime(visit.visitTime, intlLocale)"
          />
          <v-list-item
            :title="t('components.dialog.fieldVisitCountUnified')"
            :subtitle="formatNumber(visit.visitCount, intlLocale)"
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
