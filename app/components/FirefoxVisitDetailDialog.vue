<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatDateTime, formatNumber, isSafeUrl } from '~/utils/format'
import { formatFirefoxVisitType } from '~/utils/firefoxVisitType'
import type { FirefoxHistoryVisit } from '~/types/history'
import { useAppLocale } from '~/composables/useAppLocale'
import { useCopyFeedback } from '~/composables/useCopyFeedback'

defineProps<{
  visit: FirefoxHistoryVisit | null
}>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()
const { intlLocale } = useAppLocale()
const { copyToClipboard, copyIcon, copyColor } = useCopyFeedback(open)
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
                :icon="copyIcon('title')"
                :color="copyColor('title')"
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
                :icon="copyIcon('url')"
                :color="copyColor('url')"
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
            :title="t('components.dialog.fieldVisitTime')"
            :subtitle="formatDateTime(visit.visitTime, intlLocale)"
          />
          <v-list-item
            :title="t('components.dialog.firefox.fieldInternalTimestamp')"
            :subtitle="
              t('components.dialog.firefox.internalTimestampValue', {
                microseconds: visit.visitTimeRaw,
                iso: visit.visitTime.toISOString()
              })
            "
          />
          <v-list-item
            :title="t('components.dialog.fieldVisitCount')"
            :subtitle="formatNumber(visit.visitCount, intlLocale)"
          />
          <v-list-item :title="t('components.dialog.firefox.fieldVisitType')">
            <template #subtitle>
              {{ formatFirefoxVisitType(visit.visitType, t) }} ({{ visit.visitType }})
            </template>
          </v-list-item>
          <v-list-item :title="t('components.dialog.firefox.fieldHidden')">
            <template #subtitle>
              <v-chip size="small" :color="visit.hidden ? 'secondary' : 'default'" variant="flat">
                {{ visit.hidden ? t('common.yes') : t('common.no') }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item :title="t('components.dialog.firefox.fieldTyped')">
            <template #subtitle>
              <v-chip size="small" :color="visit.typed ? 'success' : 'default'" variant="flat">
                {{ visit.typed ? t('common.yes') : t('common.no') }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item
            :title="t('components.dialog.firefox.fieldFromVisit')"
            :subtitle="visit.fromVisit !== null ? String(visit.fromVisit) : t('common.none')"
          />
          <v-list-item
            :title="t('components.dialog.firefox.fieldSession')"
            :subtitle="String(visit.session)"
          />
          <v-list-item
            :title="t('components.dialog.firefox.fieldFrecency')"
            :subtitle="formatNumber(visit.frecency, intlLocale)"
          />
          <v-list-item
            :title="t('components.dialog.firefox.fieldGuid')"
            :subtitle="visit.guid || t('common.none')"
          />
          <v-list-item
            :title="t('components.dialog.firefox.fieldVisitPlaceId')"
            :subtitle="`${visit.visitId} / ${visit.placeId}`"
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
