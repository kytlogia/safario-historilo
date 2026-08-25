<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatNumber } from '~/utils/format'
import { useAppLocale } from '~/composables/useAppLocale'

const { t } = useI18n()
const { intlLocale } = useAppLocale()

withDefaults(
  defineProps<{
    label: string
    icon: string
    color: string
    isLoading: boolean
    loadError: string
    hasData: boolean
    visitCount: number
    fileName: string
    serverAutoLoadAvailable: boolean
    serverDbPath: string
    serverPermissionHint: boolean
    serverStatusWarning: string
    serverProfiles?: { id: string; name: string }[]
    selectedProfileId?: string
  }>(),
  {
    serverProfiles: () => [],
    selectedProfileId: ''
  }
)

const emit = defineEmits<{
  'file-selected': [file: File]
  'load-from-server': []
  'update:selectedProfileId': [profileId: string]
  reset: []
}>()

function onFileInputChange(files: File[] | File | null) {
  const file = Array.isArray(files) ? files[0] : files
  if (file) emit('file-selected', file)
}
</script>

<template>
  <v-card variant="outlined" :data-testid="`source-card-${label}`">
    <v-card-item>
      <template #prepend>
        <v-icon :icon="icon" :color="color" />
      </template>
      <v-card-title class="text-subtitle-1">{{ label }}</v-card-title>
      <template #append>
        <v-chip v-if="hasData" size="small" :color="color" variant="tonal">
          {{
            t('components.unifiedSourceCard.visitCountSuffix', {
              count: formatNumber(visitCount, intlLocale)
            })
          }}
        </v-chip>
      </template>
    </v-card-item>

    <v-card-text>
      <template v-if="hasData">
        <div class="text-body-2 text-medium-emphasis text-truncate mb-2">{{ fileName }}</div>
        <v-btn
          variant="tonal"
          size="small"
          prepend-icon="mdi-refresh"
          block
          data-testid="source-card-reset-button"
          @click="emit('reset')"
        >
          {{ t('components.unifiedSourceCard.reload') }}
        </v-btn>
      </template>

      <template v-else>
        <v-select
          v-if="serverProfiles.length > 1"
          :model-value="selectedProfileId"
          :items="serverProfiles"
          item-title="name"
          item-value="id"
          :label="t('components.unifiedSourceCard.profileLabel')"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-3"
          data-testid="source-card-profile-select"
          @update:model-value="emit('update:selectedProfileId', $event)"
        />

        <template v-if="serverAutoLoadAvailable">
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            prepend-icon="mdi-database-sync-outline"
            block
            class="mb-1"
            data-testid="source-card-server-load-button"
            :loading="isLoading"
            :disabled="isLoading"
            @click="emit('load-from-server')"
          >
            {{ t('components.unifiedSourceCard.autoLoad') }}
          </v-btn>
          <div
            class="text-caption text-medium-emphasis mb-2 text-truncate"
            data-testid="source-card-server-db-path"
          >
            {{ serverDbPath }}
          </div>
        </template>

        <v-alert
          v-else-if="serverPermissionHint"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
          data-testid="source-card-permission-hint"
        >
          {{ t('components.unifiedSourceCard.permissionHint') }}
        </v-alert>

        <v-alert
          v-else-if="serverStatusWarning"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
          data-testid="source-card-status-warning"
        >
          {{ serverStatusWarning }}
        </v-alert>

        <v-file-input
          :label="t('components.unifiedSourceCard.fileInputLabel')"
          prepend-icon="mdi-file-upload-outline"
          variant="outlined"
          density="compact"
          hide-details
          data-testid="source-card-file-input"
          :loading="isLoading"
          :disabled="isLoading"
          @update:model-value="onFileInputChange"
        />

        <v-alert
          v-if="loadError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-2"
          data-testid="source-card-load-error"
        >
          {{ loadError }}
        </v-alert>
      </template>
    </v-card-text>
  </v-card>
</template>
