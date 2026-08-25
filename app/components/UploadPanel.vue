<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SafariProfile } from '~/types/history'
import { DEFAULT_PROFILE_ID } from '../../shared/utils/profile'

const { t } = useI18n()

withDefaults(
  defineProps<{
    isLoading: boolean
    loadError: string
    serverAutoLoadAvailable: boolean
    serverDbPath: string
    serverPermissionHint: boolean
    serverStatusWarning: string
    serverProfiles?: SafariProfile[]
    selectedProfileId?: string
  }>(),
  {
    serverProfiles: () => [],
    selectedProfileId: DEFAULT_PROFILE_ID
  }
)

const emit = defineEmits<{
  'file-selected': [file: File]
  'load-from-server': []
  'update:selectedProfileId': [profileId: string]
}>()

const isDragging = ref(false)

function onFileInputChange(files: File[] | File | null) {
  const file = Array.isArray(files) ? files[0] : files
  if (file) emit('file-selected', file)
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) emit('file-selected', file)
}

function onDragLeave(event: DragEvent) {
  const target = event.currentTarget as Node
  const related = event.relatedTarget as Node | null
  if (!related || !target.contains(related)) {
    isDragging.value = false
  }
}
</script>

<template>
  <v-row justify="center">
    <v-col cols="12" md="8" lg="6">
      <v-card
        class="drop-zone"
        :class="{ 'drop-zone--active': isDragging }"
        data-testid="drop-zone"
        variant="outlined"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <v-empty-state
          icon="mdi-database-search-outline"
          size="56"
          color="primary"
          :title="t('components.uploadPanel.safari.dragDropTitle')"
          :text="t('components.uploadPanel.common.subtitle')"
          class="mb-2"
        />

        <v-select
          v-if="serverProfiles.length > 1"
          :model-value="selectedProfileId"
          :items="serverProfiles"
          item-title="name"
          item-value="id"
          :label="t('components.uploadPanel.common.profileLabel')"
          variant="outlined"
          density="comfortable"
          hide-details
          class="mb-4 text-left"
          data-testid="profile-select"
          @update:model-value="emit('update:selectedProfileId', $event)"
        />

        <template v-if="serverAutoLoadAvailable">
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-database-sync-outline"
            block
            class="mb-1"
            data-testid="load-from-server-button"
            :loading="isLoading"
            :disabled="isLoading"
            @click="emit('load-from-server')"
          >
            {{ t('components.uploadPanel.safari.autoLoadButton') }}
          </v-btn>
          <div class="text-caption text-medium-emphasis drop-zone__local-path">
            {{ serverDbPath }}
          </div>
          <div class="drop-zone__divider">
            <v-divider />
            <span class="text-caption text-medium-emphasis drop-zone__divider-label">{{
              t('common.or')
            }}</span>
            <v-divider />
          </div>
        </template>

        <v-alert
          v-else-if="serverPermissionHint"
          type="warning"
          variant="tonal"
          density="compact"
          class="drop-zone__alert drop-zone__alert--spaced"
          data-testid="permission-hint-alert"
        >
          {{ t('components.uploadPanel.safari.permissionHint') }}
        </v-alert>

        <v-alert
          v-else-if="serverStatusWarning"
          type="warning"
          variant="tonal"
          density="compact"
          class="drop-zone__alert drop-zone__alert--spaced"
          data-testid="status-warning-alert"
        >
          {{ serverStatusWarning }}
        </v-alert>

        <v-file-input
          :label="t('components.uploadPanel.safari.fileInputLabel')"
          prepend-icon="mdi-file-upload-outline"
          variant="outlined"
          density="comfortable"
          hide-details
          data-testid="history-file-input"
          :loading="isLoading"
          :disabled="isLoading"
          @update:model-value="onFileInputChange"
        />

        <v-alert
          v-if="loadError"
          type="error"
          variant="tonal"
          class="drop-zone__alert mt-4"
          data-testid="load-error-alert"
        >
          {{ loadError }}
        </v-alert>

        <v-divider class="drop-zone__instructions-divider" />

        <div class="text-body-2 drop-zone__instructions">
          <div class="font-weight-medium mb-2">
            {{ t('components.uploadPanel.safari.locationHeading') }}
          </div>
          <ol class="drop-zone__instructions-list">
            <li>{{ t('components.uploadPanel.safari.stepQuitApp') }}</li>
            <!-- eslint-disable vue/no-v-html -- static, developer-authored locale
            strings (i18n/locales/*.json), never user input -->
            <li v-html="t('components.uploadPanel.safari.stepFinder')" />
            <li v-html="t('components.uploadPanel.safari.stepCopy')" />
            <!-- eslint-enable vue/no-v-html -->
            <li>{{ t('components.uploadPanel.common.dragDropFinalStep') }}</li>
          </ol>
          <v-alert type="info" variant="tonal" density="compact">
            {{ t('components.uploadPanel.common.privacyNote') }}
          </v-alert>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped lang="scss">
.drop-zone {
  padding: 32px; // pa-8
  text-align: center; // text-center
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;

  &--active {
    border-color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.06);
  }

  &__local-path {
    margin-bottom: 24px; // mb-6
  }

  &__divider {
    display: flex; // d-flex
    align-items: center; // align-center
    margin-bottom: 24px; // mb-6
  }

  &__divider-label {
    margin-inline: 12px; // mx-3
  }

  &__alert {
    text-align: left; // text-left

    &--spaced {
      margin-bottom: 24px; // mb-6
    }
  }

  &__instructions-divider {
    margin-block: 24px; // my-6
  }

  &__instructions {
    text-align: left; // text-left
  }

  &__instructions-list {
    padding-inline-start: 20px; // pl-5
    margin-bottom: 12px; // mb-3
  }
}
</style>
