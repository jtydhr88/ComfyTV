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
        <div
          v-if="formCapsInfo"
          class="ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-xs"
          :class="formCapsInfo.kind === 'comfytv'
            ? 'ctv:bg-emerald-500/10 ctv:text-emerald-400'
            : 'ctv:bg-amber-400/10 ctv:text-amber-400'"
        >
          {{ formCapsInfo.label }}
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
        class="ctv:flex ctv:flex-col ctv:gap-1 ctv:py-1.5 ctv:px-2 ctv:rounded-lg
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
        :class="{ 'ctv:opacity-50': !server.enabled }"
      >
        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
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
          <div
            v-if="server.enabled"
            class="ctv:flex ctv:items-center ctv:gap-1 ctv:shrink-0 ctv:mr-0.5"
            :title="statusTitle(server)"
          >
            <span class="ctv:size-1.5 ctv:rounded-full" :class="statusDotClass(server)" />
            <span
              v-if="statusBadge(server)"
              class="ctv:text-2xs ctv:tabular-nums ctv:text-muted-foreground"
            >{{ statusBadge(server) }}</span>
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
        <div
          v-if="capsInfo(server)"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:flex-wrap"
        >
          <span
            class="ctv:inline-flex ctv:items-center ctv:rounded ctv:px-1.5 ctv:py-0.5 ctv:text-2xs"
            :class="capsInfo(server)!.kind === 'comfytv'
              ? 'ctv:bg-emerald-500/10 ctv:text-emerald-400'
              : 'ctv:bg-amber-400/10 ctv:text-amber-400'"
          >{{ capsInfo(server)!.label }}</span>
          <button
            v-if="capsInfo(server)!.missing.length"
            class="ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:rounded ctv:border-none
                   ctv:bg-amber-400/10 ctv:text-amber-400 ctv:px-1.5 ctv:py-0.5 ctv:text-2xs
                   ctv:hover:brightness-110"
            :title="$t('servers.caps.missingTitle') + '\n' + capsInfo(server)!.missing.join('\n')"
            @click="toggleCapsExpand(server)"
          >
            {{ $t('servers.caps.missingNodes', { n: capsInfo(server)!.missing.length }) }}
          </button>
        </div>
        <div
          v-if="expandedCapsId === server.id && capsInfo(server)?.missing.length"
          class="ctv:rounded ctv:bg-base-background/40 ctv:p-1.5 ctv:text-2xs ctv:text-muted-foreground"
        >
          <div class="ctv:mb-0.5">{{ $t('servers.caps.missingTitle') }}</div>
          <div v-for="nodeId in capsInfo(server)!.missing" :key="nodeId" class="ctv:truncate">
            {{ nodeId }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComfyServer } from '@/api'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import { useServersPanel, type ServerStatusKind } from '@/composables/sidebar/useServersPanel'

import IconLoader from '~icons/lucide/loader-2'
import IconPencil from '~icons/lucide/pencil'
import IconPlugZap from '~icons/lucide/plug-zap'
import IconPower from '~icons/lucide/power'
import IconTrash2 from '~icons/lucide/trash-2'

const {
  store,
  form,
  formTest,
  formCapsInfo,
  formError,
  formValid,
  testing,
  saving,
  testingId,
  rowTests,
  expandedCapsId,
  openForm,
  closeForm,
  onTestForm,
  onTestRow,
  onSave,
  onToggle,
  onDelete,
  statusKind,
  statusBadge,
  statusTitle,
  capsInfo,
  toggleCapsExpand,
} = useServersPanel()

const STATUS_DOT_CLASS: Record<ServerStatusKind, string> = {
  unknown: 'ctv:bg-muted-foreground/40',
  offline: 'ctv:bg-destructive-background',
  busy:    'ctv:bg-amber-400',
  idle:    'ctv:bg-emerald-400',
}

function statusDotClass(server: ComfyServer): string {
  return STATUS_DOT_CLASS[statusKind(server)]
}

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
