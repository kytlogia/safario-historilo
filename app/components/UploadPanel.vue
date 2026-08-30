<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    brand?:
      'safari' | 'firefox' | 'chrome' | 'edge' | 'opera' | 'arc' | 'brave' | 'vivaldi' | 'netscape'
    isLoading: boolean
    loadError: string
    serverAutoLoadAvailable: boolean
    serverDbPath: string
    serverPermissionHint: boolean
    serverStatusWarning: string
    serverProfiles?: { id: string; name: string }[]
    selectedProfileId?: string
  }>(),
  {
    brand: 'safari',
    serverProfiles: () => [],
    selectedProfileId: ''
  }
)

const emit = defineEmits<{
  'file-selected': [file: File]
  'load-from-server': []
  'update:selectedProfileId': [profileId: string]
}>()

// Safari/Firefox each have their own i18n namespace (their locationHeading,
// steps, etc. don't take any {app}/{path} params); Chrome, Edge, Opera, Arc,
// Brave and Vivaldi are all Chromium-based and share one 'chromium' namespace
// whose strings are parameterized by appName/userDataDirHint instead.
// Netscape gets its own namespace too, and is the only upload-only brand:
// it has no autoLoadButton/permissionHint strings because those branches
// can never render for it (see app/pages/netscape.vue).
// `hasProfileFolderStep` covers the one structural difference beyond text:
// Safari's history file isn't nested under a per-profile folder the way the
// Chromium-based brands' are, so its instructions skip that step entirely.
const BRAND_META = {
  safari: { namespace: 'safari', appName: '', userDataDirHint: '', hasProfileFolderStep: false },
  firefox: {
    namespace: 'firefox',
    appName: '',
    userDataDirHint: '',
    hasProfileFolderStep: true
  },
  chrome: {
    namespace: 'chromium',
    appName: 'Google Chrome',
    userDataDirHint: '~/Library/Application Support/Google/Chrome/',
    hasProfileFolderStep: true
  },
  edge: {
    namespace: 'chromium',
    appName: 'Microsoft Edge',
    userDataDirHint: '~/Library/Application Support/Microsoft Edge/',
    hasProfileFolderStep: true
  },
  opera: {
    namespace: 'chromium',
    appName: 'Opera',
    userDataDirHint: '~/Library/Application Support/com.operasoftware.Opera/',
    hasProfileFolderStep: true
  },
  arc: {
    namespace: 'chromium',
    appName: 'Arc',
    userDataDirHint: '~/Library/Application Support/Arc/User Data/',
    hasProfileFolderStep: true
  },
  brave: {
    namespace: 'chromium',
    appName: 'Brave',
    userDataDirHint: '~/Library/Application Support/BraveSoftware/Brave-Browser/',
    hasProfileFolderStep: true
  },
  vivaldi: {
    namespace: 'chromium',
    appName: 'Vivaldi',
    userDataDirHint: '~/Library/Application Support/Vivaldi/',
    hasProfileFolderStep: true
  },
  netscape: {
    namespace: 'netscape',
    appName: '',
    userDataDirHint: '',
    hasProfileFolderStep: true
  }
} as const

const brandMeta = computed(() => BRAND_META[props.brand])

// Passed to every t() call below regardless of brand: vue-i18n simply
// ignores interpolation params a given message doesn't reference, so
// Safari/Firefox's non-parameterized strings and Chrome/Edge's
// {app}/{path}-parameterized ones can share the same call shape.
const params = computed(() => ({
  app: brandMeta.value.appName,
  path: brandMeta.value.userDataDirHint
}))

function ut(key: string) {
  return t(`components.uploadPanel.${brandMeta.value.namespace}.${key}`, params.value)
}

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
          :title="ut('dragDropTitle')"
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
            {{ ut('autoLoadButton') }}
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
          {{ ut('permissionHint') }}
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
          :label="ut('fileInputLabel')"
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
            {{ ut('locationHeading') }}
          </div>
          <ol class="drop-zone__instructions-list">
            <li>{{ ut('stepQuitApp') }}</li>
            <!-- eslint-disable vue/no-v-html -- static, developer-authored locale
            strings (i18n/locales/*.json), never user input -->
            <li v-html="ut('stepFinder')" />
            <li v-if="brandMeta.hasProfileFolderStep" v-html="ut('stepOpenProfileFolder')" />
            <li v-html="ut('stepCopy')" />
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
