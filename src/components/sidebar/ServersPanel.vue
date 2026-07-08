<template>
  <div class="ctv:relative ctv:flex ctv:flex-col ctv:size-full ctv:box-border ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('servers.title') }}</span>
      <button
        :class="addBtnClass"
        :title="$t('servers.addTooltip')"
        @click="openForm()"
      >
        + {{ $t('servers.add') }}
      </button>
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-1.5 ctv:flex ctv:flex-col ctv:gap-1">
      <div
        v-if="form"
        class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2 ctv:rounded-lg
               ctv:bg-secondary-background ctv:border ctv:border-border-default"
      >
        <label class="ctv:flex ctv:flex-col ctv:gap-0.5">
          <span class="ctv:text-muted-foreground">{{ $t('servers.form.label') }}</span>
          <ComfyTVText v-model="form.label" :placeholder="$t('servers.form.labelPlaceholder')" />
        </label>
        <div class="ctv:flex ctv:gap-1.5">
          <label class="ctv:flex-1 ctv:flex ctv:flex-col ctv:gap-0.5 ctv:min-w-0">
            <span class="ctv:text-muted-foreground">{{ $t('servers.form.host') }}</span>
            <ComfyTVText v-model="form.host" placeholder="192.168.1.20" />
          </label>
          <label class="ctv:w-20 ctv:flex ctv:flex-col ctv:gap-0.5">
            <span class="ctv:text-muted-foreground">{{ $t('servers.form.port') }}</span>
            <ComfyTVText v-model="form.port" placeholder="8188" />
          </label>
        </div>

        <div
          v-if="formTest"
          class="ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-xs"
          :class="formTest.ok
            ? 'ctv:bg-emerald-500/10 ctv:text-emerald-400'
            : 'ctv:bg-destructive-background/15 ctv:text-destructive-background'"
        >
          <template v-if="formTest.ok">
            ✓ {{ $t('servers.test.ok') }}
            <span class="ctv:opacity-75">
              {{ [formTest.version, ...(formTest.devices ?? [])].filter(Boolean).join(' · ') }}
            </span>
          </template>
          <template v-else>✗ {{ formTest.error || $t('servers.test.failed') }}</template>
        </div>

        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
          <button :class="chipBtnClass" :disabled="testing || !formValid" @click="onTestForm">
            {{ testing ? $t('servers.test.testing') : $t('servers.test.action') }}
          </button>
          <span class="ctv:flex-1" />
          <button :class="chipBtnClass" @click="closeForm">{{ $t('servers.form.cancel') }}</button>
          <button :class="primaryBtnClass" :disabled="!formValid || saving" @click="onSave">
            {{ form.id == null ? $t('servers.form.create') : $t('servers.form.save') }}
          </button>
        </div>
        <div v-if="formError" class="ctv:text-destructive-background">{{ formError }}</div>
      </div>

      <div
        v-if="store.servers.length === 0 && !form"
        class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60"
      >
        {{ $t('servers.empty') }}
      </div>

      <div
        v-for="server in store.servers"
        :key="server.id"
        class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2 ctv:rounded-lg
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
        :class="{ 'ctv:opacity-50': !server.enabled }"
      >
        <div class="ctv:flex-1 ctv:min-w-0">
          <div class="ctv:font-semibold ctv:truncate">{{ server.label }}</div>
          <div class="ctv:text-muted-foreground ctv:truncate">
            {{ server.host }}:{{ server.port }}
            <span v-if="rowTests[server.id]" :class="rowTests[server.id]!.ok ? 'ctv:text-emerald-400' : 'ctv:text-destructive-background'">
              · {{ rowTests[server.id]!.ok
                ? `✓ ${rowTests[server.id]!.version || $t('servers.test.ok')}`
                : `✗ ${rowTests[server.id]!.error || $t('servers.test.failed')}` }}
            </span>
          </div>
        </div>
        <button
          :class="iconBtnClass"
          :disabled="testingId === server.id"
          :title="$t('servers.test.action')"
          @click="onTestRow(server)"
        >
          <IconLoader v-if="testingId === server.id" class="ctv:size-3.5 ctv:animate-spin" />
          <IconPlugZap v-else class="ctv:size-3.5" />
        </button>
        <button
          :class="iconBtnClass"
          :title="server.enabled ? $t('servers.disable') : $t('servers.enable')"
          @click="onToggle(server)"
        >
          <IconPower class="ctv:size-3.5" />
        </button>
        <button :class="iconBtnClass" :title="$t('servers.edit')" @click="openForm(server)">
          <IconPencil class="ctv:size-3.5" />
        </button>
        <button
          :class="[iconBtnClass, 'ctv:hover:text-destructive-background']"
          :title="$t('servers.delete')"
          @click="onDelete(server)"
        >
          <IconTrash2 class="ctv:size-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComfyServer, TestServerResult } from '@/api'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { useServerStore } from '@/stores/serverStore'

import IconLoader from '~icons/lucide/loader-2'
import IconPencil from '~icons/lucide/pencil'
import IconPlugZap from '~icons/lucide/plug-zap'
import IconPower from '~icons/lucide/power'
import IconTrash2 from '~icons/lucide/trash-2'

const { t } = useI18n()
const store = useServerStore()

interface ServerForm {
  id: number | null
  label: string
  host: string
  port: string
}

const form = ref<ServerForm | null>(null)
const formTest = ref<TestServerResult | null>(null)
const formError = ref('')
const testing = ref(false)
const saving = ref(false)
const testingId = ref<number | null>(null)
const rowTests = reactive<Record<number, TestServerResult>>({})

const formValid = computed(() => {
  if (!form.value) return false
  const port = Number(form.value.port)
  return form.value.label.trim() !== ''
    && form.value.host.trim() !== ''
    && Number.isInteger(port) && port > 0 && port < 65536
})

function openForm(server?: ComfyServer) {
  formTest.value = null
  formError.value = ''
  form.value = server
    ? { id: server.id, label: server.label, host: server.host, port: String(server.port) }
    : { id: null, label: '', host: '', port: '8188' }
}

function closeForm() {
  form.value = null
  formTest.value = null
  formError.value = ''
}

async function onTestForm() {
  if (!form.value || !formValid.value) return
  testing.value = true
  formTest.value = null
  try {
    formTest.value = await store.testConnection(form.value.host.trim(), Number(form.value.port))
  } finally {
    testing.value = false
  }
}

async function onTestRow(server: ComfyServer) {
  testingId.value = server.id
  try {
    rowTests[server.id] = await store.testConnection(server.host, server.port)
  } finally {
    testingId.value = null
  }
}

async function onSave() {
  if (!form.value || !formValid.value || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    const payload = {
      label: form.value.label.trim(),
      host: form.value.host.trim(),
      port: Number(form.value.port),
    }
    const result = form.value.id == null
      ? await store.create(payload)
      : await store.update(form.value.id, payload)
    if (result) closeForm()
    else formError.value = t('servers.form.saveFailed')
  } finally {
    saving.value = false
  }
}

async function onToggle(server: ComfyServer) {
  await store.update(server.id, { enabled: !server.enabled })
}

async function onDelete(server: ComfyServer) {
  const ok = await askConfirm({
    title: t('servers.delete'),
    message: t('servers.deleteConfirm', { label: server.label }),
    danger: true,
  })
  if (ok) await store.remove(server.id)
}

onMounted(() => { void store.load() })

const addBtnClass = 'ctv:shrink-0 ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit] '
  + 'ctv:rounded-lg ctv:border-none ctv:px-2 ctv:py-1 ctv:text-xs '
  + 'ctv:bg-interface-menu-component-surface-hovered ctv:text-base-foreground ctv:hover:brightness-110 '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
const chipBtnClass = 'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] '
  + 'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-2 ctv:py-1 ctv:text-xs '
  + 'ctv:text-base-foreground ctv:hover:bg-secondary-background-hover '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
const primaryBtnClass = addBtnClass
const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:shrink-0 '
  + 'ctv:rounded-md ctv:border-none ctv:bg-transparent ctv:p-1 ctv:text-muted-foreground '
  + 'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
</script>
