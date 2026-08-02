<template>
  <div
    class="ctv:relative ctv:flex ctv:shrink-0 ctv:flex-col ctv:gap-1 ctv:min-w-48 ctv:max-w-[55%]"
    :style="{ width: panelWidth + 'px' }"
    @contextmenu.prevent
  >
    <div
      data-pentrado-resize
      class="ctv:absolute ctv:left-0 ctv:top-0 ctv:z-10 ctv:h-full ctv:w-1.5 ctv:cursor-col-resize
             ctv:hover:bg-primary-background/40"
      @pointerdown="onResizeStart"
    />
    <PanelSection :title="$t('pentrado.layers')" storage-key="pentrado.layerPanelCollapsed">
      <template #actions>
        <button
          v-if="assetPicker"
          type="button"
          :class="miniBtnClass"
          :title="$t('pentrado.addFromLibrary')"
          @click.stop="pickerOpen = !pickerOpen"
        >
          <IconImagePlus class="ctv:size-3.5" />
        </button>
        <button
          type="button"
          :class="miniBtnClass"
          :title="$t('pentrado.addFromFile')"
          @click.stop="fileInput?.click()"
        >
          <IconUpload class="ctv:size-3.5" />
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="ctv:hidden"
          @change="onFilesPicked"
          @click.stop
        />
      </template>
    <component
      :is="assetPicker"
      v-if="pickerOpen && assetPicker"
      @pick="onMediaPicked"
      @close="pickerOpen = false"
    />

    <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1.5">
      <div
        class="ctv:min-w-0 ctv:flex-1"
        :class="!blendEnabled ? 'ctv:pointer-events-none ctv:opacity-40' : ''"
      >
        <ComfyTVSelect
          :model-value="active?.mode.blend ?? 'normal'"
          :options="blendOptions"
          @update:model-value="(v) => active && editor.setBlendMode(active.id, v as BlendFn)"
        />
      </div>
      <label
        class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:text-[10px] ctv:text-[#9b9b9b]"
        :class="!active ? 'ctv:pointer-events-none ctv:opacity-40' : ''"
      >
        {{ $t('pentrado.opacity') }}
        <input
          type="number" min="0" max="100" step="1"
          :class="numInputClass"
          class="ctv:w-11!"
          :value="active ? Math.round(active.opacity * 100) : 100"
          @change="(e) => active && editor.setOpacity(active.id, Math.max(0, Math.min(100, Number((e.target as HTMLInputElement).value))) / 100)"
        />%
      </label>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:py-1 ctv:text-[10px] ctv:text-[#9b9b9b]">
      <span>{{ $t('pentrado.lockLabel') }}</span>
      <button
        type="button"
        :class="[miniBtnClass, (active as any)?.lockAlpha ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active || active.kind !== 'raster'"
        :title="$t((active as any)?.lockAlpha ? 'pentrado.unlockAlpha' : 'pentrado.lockAlpha')"
        @click="active && editor.toggleLockAlpha(active.id)"
      >
        <IconDroplet class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="[miniBtnClass, active?.locks.content ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active"
        :title="$t(active?.locks.content ? 'pentrado.unlockLayer' : 'pentrado.lockLayer')"
        @click="active && editor.toggleLock(active.id)"
      >
        <IconBrush class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="[miniBtnClass, active?.locks.position ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active"
        :title="$t(active?.locks.position ? 'pentrado.unlockPosition' : 'pentrado.lockPosition')"
        @click="active && editor.toggleLockPosition(active.id)"
      >
        <IconMove class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="[miniBtnClass, active?.locks.content && active?.locks.position ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active"
        :title="$t(active?.locks.content && active?.locks.position ? 'pentrado.unlockAll' : 'pentrado.lockAll')"
        @click="active && editor.toggleLockAll(active.id)"
      >
        <IconLock class="ctv:size-3.5" />
      </button>
    </div>

    <div
      class="ctv:min-h-16 ctv:flex-1 ctv:overflow-y-auto ctv:border-y ctv:border-[#161616] ctv:bg-[#262626]"
      @dragover="onListDragOver"
      @drop="onListDrop"
    >
      <div
        v-if="displayRows.length === 0"
        class="ctv:py-4 ctv:text-center ctv:text-[10px] ctv:italic ctv:text-[#9b9b9b]/70"
      >
        {{ $t('pentrado.noLayers') }}
      </div>

      <div
        v-for="row in displayRows"
        :key="row.node.id"
        class="ctv:flex ctv:h-10 ctv:cursor-pointer ctv:items-stretch ctv:border-b ctv:border-[#1c1c1c] ctv:transition-colors"
        :class="[
          editor.selectedIds.value.has(row.node.id)
            ? (row.node.id === editor.activeId.value ? 'ctv:bg-[#44546a]' : 'ctv:bg-[#39455a]')
            : 'ctv:hover:bg-[#333333]',
          rowDropClass(row),
          dragId === row.node.id ? 'ctv:opacity-50' : '',
        ]"
        :draggable="renamingId !== row.node.id"
        @click="onRowClick(row.node, $event)"
        @dblclick="renamingId = row.node.id"
        @dragstart="onRowDragStart(row, $event)"
        @dragover="onRowDragOver(row, $event)"
        @drop="onRowDrop(row, $event)"
        @dragend="endDrag"
      >
        <button
          type="button"
          class="ctv:flex ctv:w-7 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:border-0 ctv:border-r
                 ctv:border-[#1c1c1c] ctv:bg-transparent ctv:p-0 ctv:text-[#d6d6d6] ctv:cursor-pointer"
          :title="$t(row.node.visible ? 'pentrado.hideLayer' : 'pentrado.showLayer')"
          @click.stop="editor.toggleVisible(row.node.id)"
        >
          <IconEye v-if="row.node.visible" class="ctv:size-3.5" />
          <span v-else class="ctv:size-3.5" />
        </button>

        <div class="ctv:flex ctv:min-w-0 ctv:flex-1 ctv:items-center" :style="{ paddingLeft: row.depth * 12 + 'px' }">
          <template v-if="row.node.kind === 'group'">
            <button
              type="button"
              class="ctv:ml-0.5 ctv:inline-flex ctv:size-5 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded
                     ctv:border-0 ctv:bg-transparent ctv:p-0 ctv:text-[#9b9b9b] ctv:cursor-pointer ctv:hover:text-[#d6d6d6]"
              @click.stop="toggleCollapsed(row.node.id)"
            >
              <IconChevronRight v-if="collapsedGroups.has(row.node.id)" class="ctv:size-3.5" />
              <IconChevronDown v-else class="ctv:size-3.5" />
            </button>
            <IconFolder class="ctv:mx-1 ctv:size-4 ctv:shrink-0 ctv:text-[#9b9b9b]" />
          </template>
          <template v-else>
            <canvas
              width="40"
              height="32"
              class="ctv:my-1 ctv:ml-1.5 ctv:h-8 ctv:w-10 ctv:shrink-0 ctv:rounded-xs ctv:border"
              :class="contentTargeted(row.node) ? 'ctv:border-[#1473e6]' : 'ctv:border-[#161616]'"
              :style="checkerStyle"
              :title="$t('pentrado.targetContent')"
              :ref="(el) => drawThumb(el as HTMLCanvasElement | null, row.node)"
              @click.stop="onContentThumbClick(row.node, $event)"
            />
            <canvas
              v-if="row.node.mask"
              width="32"
              height="32"
              class="ctv:my-1 ctv:ml-1 ctv:size-8 ctv:shrink-0 ctv:rounded-xs ctv:border"
              :class="maskThumbBorder(row.node)"
              :title="$t('pentrado.targetMask')"
              :ref="(el) => drawMaskThumb(el as HTMLCanvasElement | null, row.node)"
              @click.stop="onMaskThumbClick(row.node, $event)"
              @contextmenu.stop.prevent="openMaskMenu(row.node, $event)"
            />
          </template>

          <input
            v-if="renamingId === row.node.id"
            :value="row.node.name"
            class="ctv:mx-1.5 ctv:my-auto ctv:min-w-0 ctv:flex-1 ctv:rounded-xs ctv:border ctv:border-[#1473e6]
                   ctv:bg-[#1e1e1e] ctv:px-1 ctv:py-0.5 ctv:text-[11px] ctv:text-[#d6d6d6] ctv:outline-none"
            @click.stop
            @keydown.enter="commitRename(row.node.id, $event)"
            @keydown.escape="renamingId = null"
            @blur="commitRename(row.node.id, $event)"
            @vue:mounted="({ el }: any) => (el as HTMLInputElement).select()"
          />
          <span
            v-else
            class="ctv:mx-1.5 ctv:min-w-0 ctv:flex-1 ctv:truncate ctv:text-[11px]"
            :title="row.node.name"
          >
            <IconType v-if="row.node.kind === 'text'" class="ctv:mr-0.5 ctv:inline ctv:size-3 ctv:align-[-2px] ctv:text-[#9b9b9b]" />
            <IconShapes v-else-if="row.node.kind === 'vector'" class="ctv:mr-0.5 ctv:inline ctv:size-3 ctv:align-[-2px] ctv:text-[#9b9b9b]" />
            {{ row.node.name }}
          </span>

          <IconLock
            v-if="anyLocked(row.node)"
            class="ctv:mr-1.5 ctv:size-3 ctv:shrink-0 ctv:self-center"
            :class="fullyLocked(row.node) ? 'ctv:text-[#d6d6d6]' : 'ctv:text-[#9b9b9b] ctv:opacity-60'"
          />
        </div>
      </div>
    </div>

    <div v-if="active" class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-0.5 ctv:px-1.5 ctv:py-0.5">
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.moveUp')" @click="editor.moveLayer(active.id, 1)">
        <IconChevronUp class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.moveDown')" @click="editor.moveLayer(active.id, -1)">
        <IconChevronDownArrange class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.duplicateLayer')" @click="editor.duplicateLayer(active.id)">
        <IconCopy class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.groupLayers')" @click="editor.groupActiveLayer()">
        <IconFolderPlus class="ctv:size-3.5" />
      </button>
      <button
        v-if="active.kind === 'group'"
        type="button"
        :class="miniBtnClass"
        :title="$t('pentrado.ungroupLayers')"
        @click="editor.ungroupActiveLayer()"
      >
        <IconFolderMinus class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.mergeDown')" @click="editor.mergeDown(active.id)">
        <IconArrowDownToLine class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.mergeVisible')" @click="editor.mergeVisible()">
        <IconCombine class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.newFromVisible')" @click="editor.newFromVisible()">
        <IconImagePlus class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.copyVisible')" @click="editor.copyVisible()">
        <IconClipboardCopy class="ctv:size-3.5" />
      </button>
      <button
        v-if="editor.lastFilter.value"
        type="button"
        :class="miniBtnClass"
        :title="`${$t('pentrado.repeatFilter')}: ${$t(`pentrado.filter_${editor.lastFilter.value.op}`)}`"
        @click="editor.repeatLastFilter()"
      >
        <IconRepeat class="ctv:size-3.5" />
      </button>
      <template v-if="active.kind === 'vector'">
        <button type="button" :class="miniBtnClass" :title="$t('pentrado.pathToSelection')" @click="editor.pathToSelection(active.id)">
          <IconBoxSelect class="ctv:size-3.5" />
        </button>
        <button type="button" :class="miniBtnClass" :title="$t('pentrado.strokePath')" @click="editor.strokePathBrush(active.id)">
          <IconSpline class="ctv:size-3.5" />
        </button>
      </template>
      <button
        v-if="active.kind === 'text'"
        type="button"
        :class="miniBtnClass"
        :title="$t('pentrado.textToPath')"
        @click="editor.textToPath(active.id)"
      >
        <IconSpline class="ctv:size-3.5" />
      </button>
      <template v-if="active.kind === 'raster'">
        <button type="button" :class="miniBtnClass" :title="$t('pentrado.cropToContent')" @click="editor.cropToContent(active.id)">
          <IconCrop class="ctv:size-3.5" />
        </button>
        <button type="button" :class="miniBtnClass" :title="$t('pentrado.layerToCanvasSize')" @click="editor.layerToCanvasSize(active.id)">
          <IconMaximize class="ctv:size-3.5" />
        </button>
        <button
          type="button"
          :class="miniBtnClass"
          :disabled="!editor.canRasterize(active.id)"
          :title="$t('pentrado.rasterizeLayer')"
          @click="editor.rasterizeLayer(active.id)"
        >
          <IconFrame class="ctv:size-3.5" />
        </button>
      </template>
      <div class="ctv:flex-1" />
      <button type="button" :class="miniBtnClass" :title="$t('pentrado.flattenImage')" @click="editor.flattenImage()">
        <IconLayers class="ctv:size-3.5" />
      </button>
    </div>

    <template v-if="active && fxCapable">
      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:pt-1 ctv:text-[10px] ctv:text-[#9b9b9b]">
        <span class="ctv:flex-1 ctv:font-semibold ctv:uppercase ctv:tracking-wide">fx</span>
        <select :class="presetSelectClass" class="ctv:w-32!" @change="onAddFx">
          <option value="" selected>{{ $t('pentrado.fxAdd') }}</option>
          <option v-for="op in LAYER_FX_OPS" :key="op" :value="op">{{ $t(`pentrado.fx_${op}`) }}</option>
        </select>
      </div>
      <div v-for="(f, fi) in activeFx" :key="f.id" class="ctv:px-2 ctv:pt-0.5">
        <div class="ctv:flex ctv:items-center ctv:gap-0.5">
          <button type="button" :class="miniBtnClass" @click="toggleFxRow(fi)">
            <IconEye v-if="f.enabled" class="ctv:size-3" />
            <span v-else class="ctv:size-3" />
          </button>
          <span class="ctv:flex-1 ctv:truncate ctv:text-[10px]" :class="f.enabled ? 'ctv:text-[#d6d6d6]' : 'ctv:text-[#9b9b9b]/60'">
            {{ $t(`pentrado.fx_${f.op}`) }}
          </span>
          <button type="button" :class="miniBtnClass" :disabled="fi === 0" @click="moveFxRow(fi, -1)">
            <IconChevronUp class="ctv:size-3" />
          </button>
          <button type="button" :class="miniBtnClass" :disabled="fi === activeFx.length - 1" @click="moveFxRow(fi, 1)">
            <IconChevronDownArrange class="ctv:size-3" />
          </button>
          <button type="button" :class="miniBtnClass" @click="removeFxRow(fi)">
            <IconX class="ctv:size-3" />
          </button>
        </div>
        <template v-for="def in LAYER_FX_DEFS[f.op]" :key="def.key">
          <div v-if="def.color" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:pt-0.5">
            <span :class="paramLabelClass">{{ $t(`pentrado.fxParam_${def.key}`) }}</span>
            <input
              type="color"
              :class="colorInputClass"
              :value="fxColorHex(f, def.key)"
              @input="(e) => onFxColor(fi, def.key, (e.target as HTMLInputElement).value)"
            />
          </div>
          <FxSlider
            v-else
            class="ctv:pt-0.5"
            :model-value="f.params[def.key] ?? def.default"
            :label="$t(`pentrado.fxParam_${def.key}`)"
            :min="def.min"
            :max="def.max"
            :step="def.step ?? (def.max - def.min) / 200"
            :decimals="def.max > 10 ? 0 : 2"
            :reset-to="def.default"
            @update:model-value="(v) => setFxParamRow(fi, def.key, v)"
          />
        </template>
      </div>
    </template>

    <template v-if="active">
      <template v-if="active.kind === 'adjustment'">
        <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('pentrado.adjustmentOp') }}</span>
          <div class="ctv:min-w-0 ctv:flex-1">
            <ComfyTVSelect
              :model-value="active.op"
              :options="adjustOptions"
              @update:model-value="(v) => editor.updateAdjustment(active!.id, { op: v as string })"
            />
          </div>
        </div>
        <FxSlider
          v-for="def in adjustParamDefs"
          :key="def.key"
          class="ctv:px-2 ctv:pt-1"
          :model-value="(active as any).params[def.key] ?? def.default"
          :label="$t(`pentrado.adj_${def.key}`)"
          :min="def.min"
          :max="def.max"
          :step="def.step ?? (def.max - def.min) / 200"
          :decimals="def.max > 10 ? 0 : 2"
          :reset-to="def.default"
          :gradient="ADJ_GRADIENTS[def.key]"
          @update:model-value="(v) => editor.updateAdjustment(active!.id, { params: { [def.key]: v } })"
        />

        <template v-if="active.op === 'curves'">
          <div class="ctv:flex ctv:items-center ctv:gap-0.5 ctv:px-2 ctv:pt-1">
            <button
              v-for="ch in CURVE_CHANNELS"
              :key="ch.id"
              type="button"
              class="ctv:inline-flex ctv:items-center ctv:rounded-sm ctv:border-0 ctv:px-1.5 ctv:py-0.5 ctv:text-[10px]
                     ctv:cursor-pointer ctv:[font-family:inherit] ctv:transition-colors"
              :class="curveChannel === ch.id
                ? 'ctv:bg-[#4a4a4a] ctv:text-[#f0f0f0]'
                : 'ctv:bg-transparent ctv:text-[#9b9b9b] ctv:hover:text-[#d6d6d6]'"
              :style="{ color: curveChannel === ch.id ? ch.color : undefined }"
              @click="curveChannel = ch.id"
            >
              {{ $t(`pentrado.curveCh_${ch.id}`) }}
            </button>
          </div>
          <div class="ctv:px-2 ctv:pt-1">
            <CurvesCanvas
              :model-value="curvePoints"
              :color="curveColor"
              @update:model-value="onCurvePoints"
            />
          </div>
        </template>
      </template>

      <template v-if="active.kind === 'vector'">
        <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('pentrado.shapeFill') }}</span>
          <input
            type="checkbox"
            class="ctv:accent-[#1473e6]"
            :checked="!!active.fill"
            @change="onVectorFillToggle"
          />
          <input
            type="color"
            :disabled="!active.fill"
            :class="colorInputClass"
            :value="active.fill?.color ?? '#3b82f6'"
            @input="(e) => onVectorFillColor((e.target as HTMLInputElement).value)"
          />
        </div>
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('pentrado.shapeStroke') }}</span>
          <input
            type="checkbox"
            class="ctv:accent-[#1473e6]"
            :checked="!!active.stroke"
            @change="onVectorStrokeToggle"
          />
          <input
            type="color"
            :disabled="!active.stroke"
            :class="colorInputClass"
            :value="active.stroke?.color ?? '#ffffff'"
            @input="(e) => onVectorStrokeColor((e.target as HTMLInputElement).value)"
          />
          <input
            type="range" min="1" max="100" step="1"
            :disabled="!active.stroke"
            class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer ctv:disabled:opacity-30"
            :value="active.stroke?.width ?? 4"
            @input="(e) => onVectorStrokeWidth(Number((e.target as HTMLInputElement).value))"
          />
          <span :class="paramValueClass">
            {{ active.stroke?.width ?? 4 }}
          </span>
        </div>
      </template>

      <template v-if="active.kind === 'fill'">
        <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('pentrado.fillType') }}</span>
          <div class="ctv:min-w-0 ctv:flex-1">
            <ComfyTVSelect
              :model-value="active.fill.type"
              :options="fillTypeOptions"
              @update:model-value="(v) => onFillType(v as 'solid' | 'linear' | 'radial')"
            />
          </div>
        </div>
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('pentrado.fillColors') }}</span>
          <template v-if="active.fill.type === 'solid'">
            <input
              type="color"
              :class="colorInputClass"
              :value="active.fill.color"
              @input="(e) => onFillSolidColor((e.target as HTMLInputElement).value)"
            />
          </template>
          <template v-else>
            <input
              type="color"
              :class="colorInputClass"
              :value="active.fill.stops[0].color"
              @input="(e) => onFillStopColor(0, (e.target as HTMLInputElement).value)"
            />
            <input
              type="color"
              :class="colorInputClass"
              :value="active.fill.stops[active.fill.stops.length - 1].color"
              @input="(e) => onFillStopColor(1, (e.target as HTMLInputElement).value)"
            />
          </template>
        </div>
        <div v-if="active.fill.type === 'linear'" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('pentrado.fillAngle') }}</span>
          <input
            type="range" min="0" max="360" step="1"
            class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer"
            :value="active.fill.angle"
            @input="(e) => onFillAngle(Number((e.target as HTMLInputElement).value))"
          />
          <span :class="paramValueClass">
            {{ Math.round(active.fill.angle) }}°
          </span>
        </div>
        <div v-if="active.fill.type === 'radial'" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('pentrado.fillRadius') }}</span>
          <input
            type="range" min="10" max="200" step="1"
            class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer"
            :value="Math.round(active.fill.radius * 100)"
            @input="(e) => onFillRadius(Number((e.target as HTMLInputElement).value) / 100)"
          />
          <span :class="paramValueClass">
            {{ Math.round(active.fill.radius * 100) }}%
          </span>
        </div>
      </template>
    </template>

    <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:py-1 ctv:text-[10px] ctv:text-[#9b9b9b]">
      <span>{{ $t('pentrado.sectionCanvas') }}</span>
      <input
        type="number" min="64" max="4096" step="8"
        :class="numInputClass"
        :value="editor.canvasSize.value.width"
        @change="onArtboardSize($event, 'w')"
      />
      <span>×</span>
      <input
        type="number" min="64" max="4096" step="8"
        :class="numInputClass"
        :value="editor.canvasSize.value.height"
        @change="onArtboardSize($event, 'h')"
      />
      <span>px</span>
    </div>

    <div class="ctv:px-2 ctv:pb-1">
      <select
        :class="presetSelectClass"
        :title="$t('pentrado.canvasPresetHint')"
        @change="onCanvasPreset"
      >
        <option value="" selected>{{ $t('pentrado.canvasPreset') }}</option>
        <optgroup
          v-for="group in CANVAS_PRESET_GROUPS"
          :key="group.id"
          :label="$t(group.labelKey)"
        >
          <option v-for="p in group.presets" :key="p.id" :value="p.id">{{ p.label }}</option>
        </optgroup>
      </select>
    </div>

    <div
      v-if="editor.filterSession.value"
      class="ctv:border-t ctv:border-[#161616] ctv:bg-[#2f2f2f] ctv:px-2 ctv:py-1"
    >
      <div class="ctv:flex ctv:items-center ctv:justify-between ctv:pb-0.5">
        <span class="ctv:text-[10px] ctv:uppercase ctv:tracking-wide ctv:text-[#d6d6d6]">
          {{ $t(`pentrado.filter_${editor.filterSession.value.op}`) }}
        </span>
        <div class="ctv:flex ctv:items-center ctv:gap-0.5">
          <button type="button" :class="miniBtnClass" :title="$t('pentrado.filterApply')" @click="editor.applyFilter()">
            <IconCheck class="ctv:size-3.5" />
          </button>
          <button type="button" :class="miniBtnClass" :title="$t('pentrado.filterCancel')" @click="editor.cancelFilter()">
            <IconX class="ctv:size-3.5" />
          </button>
        </div>
      </div>
      <FxSlider
        v-for="def in FILTER_PARAM_DEFS[editor.filterSession.value.op]"
        :key="def.key"
        class="ctv:pt-0.5"
        :model-value="editor.filterSession.value.params[def.key] ?? def.default"
        :label="$t(`pentrado.filterParam_${def.key}`)"
        :min="def.min"
        :max="def.max"
        :step="def.step ?? (def.max - def.min) / 200"
        :decimals="def.max > 10 ? 0 : 2"
        :reset-to="def.default"
        @update:model-value="(v) => editor.updateFilterParam(def.key, v)"
      />
    </div>

    <div class="ctv:flex ctv:items-center ctv:justify-evenly ctv:border-t ctv:border-[#161616] ctv:bg-[#333333] ctv:px-1 ctv:py-0.5">
      <div class="ctv:relative">
        <button
          v-if="!active?.mask"
          type="button"
          :class="miniBtnClass"
          :disabled="!active || multiSelect"
          :title="$t('pentrado.addMask')"
          @click.stop="addMaskMenuOpen = !addMaskMenuOpen"
          @pointerdown.stop
        >
          <IconCircleDashed class="ctv:size-3.5" />
        </button>
        <button
          v-else
          type="button"
          :class="miniBtnClass"
          :title="$t('pentrado.deleteMask')"
          @click="editor.removeMask(active!.id)"
        >
          <IconCircleOff class="ctv:size-3.5" />
        </button>
        <div
          v-if="addMaskMenuOpen"
          class="ctv:absolute ctv:bottom-7 ctv:left-0 ctv:z-30 ctv:flex ctv:min-w-32 ctv:flex-col ctv:rounded-md
                 ctv:border ctv:border-[#161616] ctv:bg-[#2b2b2b] ctv:py-1 ctv:shadow-lg"
          @pointerdown.stop
        >
          <button type="button" :class="menuItemClass" @click="addMaskWith('white')">
            {{ $t('pentrado.maskInitWhite') }}
          </button>
          <button type="button" :class="menuItemClass" @click="addMaskWith('black')">
            {{ $t('pentrado.maskInitBlack') }}
          </button>
          <button
            type="button"
            :class="menuItemClass"
            :disabled="!editor.hasSelection()"
            @click="addMaskWith('selection')"
          >
            {{ $t('pentrado.maskInitSelection') }}
          </button>
          <template v-if="active?.kind === 'raster'">
            <button type="button" :class="menuItemClass" @click="addMaskWith('alpha')">
              {{ $t('pentrado.maskInitAlpha') }}
            </button>
            <button type="button" :class="menuItemClass" @click="addMaskWith('gray')">
              {{ $t('pentrado.maskInitGray') }}
            </button>
          </template>
        </div>
      </div>
      <div class="ctv:relative">
        <button
          type="button"
          :class="miniBtnClass"
          :disabled="active?.kind !== 'raster' || active?.locks.content"
          :title="$t('pentrado.filters')"
          @click.stop="filterMenuOpen = !filterMenuOpen"
          @pointerdown.stop
        >
          <IconWand class="ctv:size-3.5" />
        </button>
        <div
          v-if="filterMenuOpen"
          class="ctv:absolute ctv:bottom-7 ctv:left-0 ctv:z-30 ctv:flex ctv:min-w-32 ctv:flex-col ctv:rounded-md
                 ctv:border ctv:border-[#161616] ctv:bg-[#2b2b2b] ctv:py-1 ctv:shadow-lg"
          @pointerdown.stop
        >
          <button
            v-for="op in FILTER_OPS"
            :key="op"
            type="button"
            :class="menuItemClass"
            @click="filterMenuOpen = false; editor.startFilter(op)"
          >
            {{ $t(`pentrado.filter_${op}`) }}
          </button>
        </div>
      </div>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('pentrado.addAdjustment')"
        @click="editor.addAdjustmentLayer()"
      >
        <IconSlidersHorizontal class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('pentrado.addFill')"
        @click="editor.addFillLayer()"
      >
        <IconPaintBucket class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('pentrado.addTextLayer')"
        @click="addText"
      >
        <IconType class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('pentrado.newLayer')"
        @click="editor.addEmptyLayer()"
      >
        <IconSquarePlus class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :disabled="!active"
        :title="$t('pentrado.deleteLayer')"
        @click="active && editor.removeLayer(active.id)"
      >
        <IconTrash class="ctv:size-3.5" />
      </button>
    </div>

    <div
      v-if="maskMenu && maskMenuNode"
      class="ctv:fixed ctv:z-50 ctv:flex ctv:min-w-36 ctv:flex-col ctv:rounded-md ctv:border ctv:border-[#161616]
             ctv:bg-[#2b2b2b] ctv:py-1 ctv:shadow-lg"
      :style="{ left: maskMenu.x + 'px', top: maskMenu.y + 'px' }"
      @pointerdown.stop
    >
      <button type="button" :class="menuItemClass" @click="maskMenuAction(() => { editor.maskView.value = !editor.maskView.value })">
        {{ $t('pentrado.maskShow') }}
      </button>
      <button type="button" :class="menuItemClass" @click="maskMenuAction((id) => editor.toggleMaskEnabled(id))">
        {{ $t(maskMenuNode.mask!.enabled ? 'pentrado.maskDisable' : 'pentrado.maskEnable') }}
      </button>
      <button type="button" :class="menuItemClass" @click="maskMenuAction((id) => editor.invertMask(id))">
        {{ $t('pentrado.maskInvert') }}
      </button>
      <button
        v-if="maskMenuNode.kind === 'raster'"
        type="button"
        :class="menuItemClass"
        @click="maskMenuAction((id) => editor.applyMask(id))"
      >
        {{ $t('pentrado.maskApply') }}
      </button>
      <button type="button" :class="menuItemClass" @click="maskMenuAction((id) => editor.maskToSelection(id))">
        {{ $t('pentrado.maskToSelection') }}
      </button>
      <button type="button" :class="menuItemClass" @click="maskMenuAction((id) => editor.removeMask(id))">
        {{ $t('pentrado.deleteMask') }}
      </button>
    </div>
    </PanelSection>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line'
import IconBoxSelect from '~icons/lucide/box-select'
import IconClipboardCopy from '~icons/lucide/clipboard-copy'
import IconCombine from '~icons/lucide/combine'
import IconRepeat from '~icons/lucide/repeat'
import IconSpline from '~icons/lucide/spline'
import IconBrush from '~icons/lucide/brush'
import IconCheck from '~icons/lucide/check'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronDownArrange from '~icons/lucide/chevron-down'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconChevronUp from '~icons/lucide/chevron-up'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconCircleOff from '~icons/lucide/circle-off'
import IconCopy from '~icons/lucide/copy'
import IconCrop from '~icons/lucide/crop'
import IconDroplet from '~icons/lucide/droplet'
import IconEye from '~icons/lucide/eye'
import IconFolder from '~icons/lucide/folder'
import IconFolderMinus from '~icons/lucide/folder-minus'
import IconFolderPlus from '~icons/lucide/folder-plus'
import IconFrame from '~icons/lucide/frame'
import IconImagePlus from '~icons/lucide/image-plus'
import IconLayers from '~icons/lucide/layers'
import IconLock from '~icons/lucide/lock'
import IconMaximize from '~icons/lucide/maximize'
import IconMove from '~icons/lucide/move'
import IconPaintBucket from '~icons/lucide/paint-bucket'
import IconShapes from '~icons/lucide/shapes'
import IconSlidersHorizontal from '~icons/lucide/sliders-horizontal'
import IconSquarePlus from '~icons/lucide/square-plus'
import IconTrash from '~icons/lucide/trash-2'
import IconType from '~icons/lucide/type'
import IconUpload from '~icons/lucide/upload'
import IconWand from '~icons/lucide/wand'
import IconX from '~icons/lucide/x'

import PanelSection from './PanelSection.vue'
import ComfyTVSelect from '../primitives/PSelect.vue'
import CurvesCanvas from '../primitives/PCurves.vue'
import FxSlider from '../primitives/PSlider.vue'
import {
  CONTRAST_STOPS,
  CR_STOPS,
  GAMMA_STOPS,
  HUE_STOPS,
  LUMA_STOPS,
  MG_STOPS,
  SAT_STOPS,
  TEMP_KELVIN_STOPS,
  YB_STOPS,
  type ColorStop,
} from '../primitives/colorStops'
import type { LayerEditorController, MaskInit } from './useLayerEditorStage'
import { useLayerListPanel } from './useLayerListPanel'
import {
  createLayerFx, LAYER_FX_DEFS, LAYER_FX_OPS,
  type BlendFn, type LayerFxData, type LayerFxOp, type SceneNode,
} from '../engine'
import { CANVAS_PRESET_GROUPS } from '../canvasPresets'
import { FILTER_OPS, FILTER_PARAM_DEFS } from '../filters'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor
const assetPicker = editor.host.components.AssetPicker

const PANEL_WIDTH_KEY = 'pentrado.layerPanelWidth'
const PANEL_MIN = 192
const PANEL_MAX = 560
const storedWidth = Number(globalThis.localStorage?.getItem(PANEL_WIDTH_KEY))
const panelWidth = ref(Number.isFinite(storedWidth) && storedWidth >= PANEL_MIN ? Math.min(storedWidth, PANEL_MAX) : 224)

function onResizeStart(e: PointerEvent): void {
  e.preventDefault()
  e.stopPropagation()
  const handle = e.currentTarget as HTMLElement
  const startX = e.clientX
  const startWidth = panelWidth.value
  const scale = (handle.getBoundingClientRect().height / handle.offsetHeight) || 1
  const onMove = (ev: PointerEvent) => {
    panelWidth.value = Math.min(PANEL_MAX, Math.max(PANEL_MIN, startWidth + (startX - ev.clientX) / scale))
  }
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onUp)
    handle.removeEventListener('pointercancel', onUp)
    try { handle.releasePointerCapture(e.pointerId) } catch {}
    try { globalThis.localStorage?.setItem(PANEL_WIDTH_KEY, String(Math.round(panelWidth.value))) } catch {}
  }
  handle.setPointerCapture(e.pointerId)
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onUp)
  handle.addEventListener('pointercancel', onUp)
}
const fileInput = ref<HTMLInputElement | null>(null)

const {
  pickerOpen,
  renamingId,
  collapsedGroups,
  displayRows,
  active,
  blendOptions,
  adjustOptions,
  adjustParamDefs,
  toggleCollapsed,
  dragId,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onListDragOver,
  onListDrop,
  endDrag,
  rowDropClass,
  fillTypeOptions,
  onFillType,
  onFillSolidColor,
  onFillStopColor,
  onFillAngle,
  onFillRadius,
  onVectorFillToggle,
  onVectorFillColor,
  onVectorStrokeToggle,
  onVectorStrokeColor,
  onVectorStrokeWidth,
  onMediaPicked,
  onFilesPicked,
  addText,
  commitRename,
  onArtboardSize,
  onCanvasPreset,
  drawThumb,
  drawMaskThumb,
} = useLayerListPanel(editor)

const blendEnabled = computed(() => !!active.value && active.value.kind !== 'adjustment')

const checkerStyle = {
  backgroundImage: 'conic-gradient(#6a6a6a 25%, #4c4c4c 0 50%, #6a6a6a 0 75%, #4c4c4c 0)',
  backgroundSize: '8px 8px',
}

function selectLayer(node: SceneNode, target?: 'content' | 'mask'): void {
  editor.setActiveLayer(node.id)
  if (target) editor.paintTarget.value = target
}

const multiSelect = computed(() => editor.selectedIds.value.size > 1)

const fxCapable = computed(() =>
  !!active.value && ['raster', 'text', 'vector', 'fill'].includes(active.value.kind)
)
const activeFx = computed<LayerFxData[]>(() => {
  void editor.layers.value
  return active.value?.fx ?? []
})
function commitFx(next: LayerFxData[]): void {
  if (active.value) editor.setLayerFx(active.value.id, next)
}
function onAddFx(e: Event): void {
  const sel = e.target as HTMLSelectElement
  const op = sel.value as LayerFxOp | ''
  sel.value = ''
  if (!op) return
  commitFx([...activeFx.value, createLayerFx(op)])
}
function toggleFxRow(i: number): void {
  commitFx(activeFx.value.map((f, k) => (k === i ? { ...f, enabled: !f.enabled } : f)))
}
function removeFxRow(i: number): void {
  commitFx(activeFx.value.filter((_, k) => k !== i))
}
function moveFxRow(i: number, dir: 1 | -1): void {
  const next = [...activeFx.value]
  const j = i + dir
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j], next[i]]
  commitFx(next)
}
function setFxParamRow(i: number, key: string, v: number): void {
  commitFx(activeFx.value.map((f, k) => (k === i ? { ...f, params: { ...f.params, [key]: v } } : f)))
}
function fxColorHex(f: LayerFxData, key: string): string {
  const v = Math.max(0, Math.min(0xffffff, Math.round(f.params[key] ?? 0)))
  return `#${v.toString(16).padStart(6, '0')}`
}
function onFxColor(i: number, key: string, hex: string): void {
  setFxParamRow(i, key, parseInt(hex.replace('#', ''), 16))
}

function onRowClick(node: SceneNode, e: MouseEvent): void {
  if (e.shiftKey) {
    const rows = displayRows.value.map((r) => r.node.id)
    const anchor = editor.activeId.value
    const ai = anchor ? rows.indexOf(anchor) : -1
    const ci = rows.indexOf(node.id)
    if (ai >= 0 && ci >= 0 && ai !== ci) {
      const range = ai < ci ? rows.slice(ai, ci + 1) : rows.slice(ci, ai + 1).reverse()
      editor.setSelectedLayers(range)
      return
    }
  }
  if (e.ctrlKey || e.metaKey) {
    const sel = [...editor.selectedIdList.value]
    const at = sel.indexOf(node.id)
    if (at >= 0) sel.splice(at, 1)
    else sel.push(node.id)
    editor.setSelectedLayers(sel)
    return
  }
  selectLayer(node)
}

function onContentThumbClick(node: SceneNode, e: MouseEvent): void {
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    onRowClick(node, e)
    return
  }
  selectLayer(node, 'content')
}

function maskTargeted(node: SceneNode): boolean {
  return node.id === editor.activeId.value && editor.paintTarget.value === 'mask'
}

function contentTargeted(node: SceneNode): boolean {
  return node.id === editor.activeId.value && editor.paintTarget.value === 'content'
}

const ADJ_GRADIENTS: Record<string, ColorStop[]> = {
  brightness: LUMA_STOPS,
  contrast: CONTRAST_STOPS,
  hue: HUE_STOPS,
  saturation: SAT_STOPS,
  lightness: LUMA_STOPS,
  inBlack: LUMA_STOPS,
  inWhite: LUMA_STOPS,
  gamma: GAMMA_STOPS,
  outBlack: LUMA_STOPS,
  outWhite: LUMA_STOPS,
  temperature: TEMP_KELVIN_STOPS,
  exposure: LUMA_STOPS,
  black: LUMA_STOPS,
  shadowsR: CR_STOPS,
  midtonesR: CR_STOPS,
  highlightsR: CR_STOPS,
  shadowsG: MG_STOPS,
  midtonesG: MG_STOPS,
  highlightsG: MG_STOPS,
  shadowsB: YB_STOPS,
  midtonesB: YB_STOPS,
  highlightsB: YB_STOPS,
  amount: SAT_STOPS,
  level: LUMA_STOPS,
}

type CurveChannel = 'master' | 'red' | 'green' | 'blue'
const CURVE_CHANNELS: Array<{ id: CurveChannel; color: string }> = [
  { id: 'master', color: '#e0e0e0' },
  { id: 'red', color: '#f87171' },
  { id: 'green', color: '#4ade80' },
  { id: 'blue', color: '#60a5fa' },
]
const curveChannel = ref<CurveChannel>('master')
const curveColor = computed(() => CURVE_CHANNELS.find((c) => c.id === curveChannel.value)!.color)
const curvePoints = computed<[number, number][]>(() => {
  void editor.layers.value
  const a = active.value
  if (!a || a.kind !== 'adjustment') return [[0, 0], [1, 1]]
  const raw = (a as { curves?: Record<string, string> }).curves?.[curveChannel.value]
  if (!raw) return [[0, 0], [1, 1]]
  try {
    const parsed = JSON.parse(raw) as [number, number][]
    return Array.isArray(parsed) && parsed.length >= 2 ? parsed : [[0, 0], [1, 1]]
  } catch {
    return [[0, 0], [1, 1]]
  }
})
function onCurvePoints(v: [number, number][]): void {
  if (!active.value) return
  editor.updateAdjustment(active.value.id, { curves: { [curveChannel.value]: JSON.stringify(v) } })
}

function anyLocked(node: SceneNode): boolean {
  return node.locks.content || node.locks.position || (node as { lockAlpha?: boolean }).lockAlpha === true
}

function fullyLocked(node: SceneNode): boolean {
  return node.locks.content && node.locks.position
}

function maskThumbBorder(node: SceneNode): string {
  if (!node.mask?.enabled) return 'ctv:border-[#dc2626] ctv:opacity-60'
  if (node.id === editor.activeId.value && editor.maskView.value) return 'ctv:border-[#22c55e]'
  if (maskTargeted(node)) return 'ctv:border-[#1473e6]'
  return 'ctv:border-[#161616]'
}

function onMaskThumbClick(node: SceneNode, e: MouseEvent): void {
  if (e.shiftKey) {
    editor.toggleMaskEnabled(node.id)
    return
  }
  if (e.altKey) {
    selectLayer(node, 'mask')
    editor.maskView.value = !editor.maskView.value
    return
  }
  selectLayer(node, 'mask')
}

const maskMenu = ref<{ nodeId: string; x: number; y: number } | null>(null)

function openMaskMenu(node: SceneNode, e: MouseEvent): void {
  selectLayer(node, 'mask')
  maskMenu.value = { nodeId: node.id, x: e.clientX, y: e.clientY }
}

const maskMenuNode = computed<SceneNode | null>(() => {
  if (!maskMenu.value) return null
  const row = editor.layers.value.find((r) => r.node.id === maskMenu.value!.nodeId)
  return row?.node.mask ? row.node : null
})

function maskMenuAction(fn: (id: string) => void): void {
  const m = maskMenu.value
  maskMenu.value = null
  if (m) fn(m.nodeId)
}

const addMaskMenuOpen = ref(false)
const filterMenuOpen = ref(false)

function addMaskWith(init: MaskInit): void {
  addMaskMenuOpen.value = false
  if (editor.activeId.value) editor.addMask(editor.activeId.value, init)
}

function onGlobalPointerDown(): void {
  maskMenu.value = null
  addMaskMenuOpen.value = false
  filterMenuOpen.value = false
}
onMounted(() => window.addEventListener('pointerdown', onGlobalPointerDown))
onBeforeUnmount(() => window.removeEventListener('pointerdown', onGlobalPointerDown))

const paramLabelClass = 'ctv:w-12 ctv:shrink-0 ctv:text-[10px] ctv:uppercase ctv:tracking-wide ctv:text-[#9b9b9b]'
const paramValueClass = 'ctv:w-8 ctv:text-right ctv:text-[10px] ctv:font-mono ctv:text-[#9b9b9b]'
const menuItemClass =
  'ctv:flex ctv:items-center ctv:border-0 ctv:bg-transparent ctv:px-3 ctv:py-1 ctv:text-left ctv:text-[11px] ' +
  'ctv:text-[#d6d6d6] ctv:cursor-pointer ctv:[font-family:inherit] ctv:hover:bg-[#3a3a3a] ' +
  'ctv:disabled:opacity-30 ctv:disabled:cursor-default ctv:disabled:hover:bg-transparent'
const miniBtnClass =
  'ctv:inline-flex ctv:size-6 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded ctv:border-0 ' +
  'ctv:bg-transparent ctv:p-0 ctv:text-[#9b9b9b] ctv:cursor-pointer ctv:transition-colors ' +
  'ctv:hover:bg-[#3a3a3a] ctv:hover:text-[#d6d6d6] ' +
  'ctv:disabled:opacity-30 ctv:disabled:cursor-default ctv:disabled:hover:bg-transparent'
const numInputClass =
  'ctv-num-input ctv:w-14 ctv:rounded-xs ctv:border ctv:border-[#3d3d3d] ctv:bg-[#1e1e1e] ' +
  'ctv:px-1 ctv:py-0.5 ctv:text-[11px] ctv:font-mono ctv:text-[#d6d6d6]'
const presetSelectClass =
  'ctv:w-full ctv:cursor-pointer ctv:rounded-xs ctv:border ctv:border-[#3d3d3d] ctv:bg-[#1e1e1e] ' +
  'ctv:px-1 ctv:py-0.5 ctv:text-[10px] ctv:text-[#9b9b9b] ctv:[font-family:inherit]'
const colorInputClass =
  'ctv:size-6 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-[#161616] ctv:bg-transparent ctv:p-0 ctv:disabled:opacity-30'
</script>
