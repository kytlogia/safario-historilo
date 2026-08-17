<script setup lang="ts">
defineProps<{
  isLoading: boolean
  loadError: string
  serverAutoLoadAvailable: boolean
  serverDbPath: string
  serverPermissionHint: boolean
  serverStatusWarning: string
}>()

const emit = defineEmits<{
  'file-selected': [file: File]
  'load-from-server': []
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
        class="pa-8 text-center drop-zone"
        :class="{ 'drop-zone--active': isDragging }"
        variant="outlined"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <v-empty-state
          icon="mdi-database-search-outline"
          size="56"
          color="primary"
          title="Safariの History.db をドラッグ&ドロップ"
          text="またはファイルを選択してください。解析はすべてこのブラウザ内で行われ、データは外部に送信されません。"
          class="mb-2"
        />

        <template v-if="serverAutoLoadAvailable">
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-database-sync-outline"
            block
            class="mb-1"
            :loading="isLoading"
            @click="emit('load-from-server')"
          >
            この Mac の History.db を自動で読み込む
          </v-btn>
          <div class="text-caption text-medium-emphasis mb-6">{{ serverDbPath }}</div>
          <div class="d-flex align-center mb-6">
            <v-divider />
            <span class="mx-3 text-caption text-medium-emphasis">または</span>
            <v-divider />
          </div>
        </template>

        <v-alert
          v-else-if="serverPermissionHint"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-6 text-left"
        >
          この Mac 上の History.db
          を検出しましたが、読み取り権限がありません。macOSの場合は「システム設定 →
          プライバシーとセキュリティ →
          フルディスクアクセス」で、このアプリを実行しているターミナル（またはNode）に
          権限を付与すると自動読み込みが利用できます。
        </v-alert>

        <v-alert
          v-else-if="serverStatusWarning"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-6 text-left"
        >
          {{ serverStatusWarning }}
        </v-alert>

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
            <li>
              Finderで「移動」→「フォルダへ移動」を選び、次を入力：<br /><code
                >~/Library/Safari/</code
              >
            </li>
            <li><code>History.db</code> を任意の場所にコピーする</li>
            <li>コピーしたファイルをこの画面にドラッグ&ドロップする</li>
          </ol>
          <v-alert type="info" variant="tonal" density="compact">
            このアプリはファイルをサーバーへアップロードしません。すべての解析はブラウザ内のWebAssembly
            (sql.js) で完結します。
          </v-alert>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.drop-zone {
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}
.drop-zone--active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.06);
}
</style>
