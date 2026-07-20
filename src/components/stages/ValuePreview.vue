<template>
  <div :class="rootClass">
    <span v-if="!compact" :class="typeBadgeClass">{{ shortType }}</span>

    <div v-if="!hasContent" :class="emptyClass">{{ emptyLabel }}</div>

    <pre v-else-if="type === 'COMFYTV_TEXT' && compact" :class="textClass">{{ content }}</pre>

    <div v-else-if="type === 'COMFYTV_TEXT'" class="vp-img-host ctv:group ctv:relative ctv:flex-1 ctv:min-h-[160px]">
      <div v-if="showTextMarkdown"
           @wheel.stop class="vp-text-scroll vp-md ctv:absolute ctv:inset-0 ctv:m-0 ctv:py-0.5 ctv:px-1 ctv:overflow-y-auto
                  ctv:break-words ctv:text-xs ctv:leading-normal ctv:text-base-foreground
                  ctv:select-text ctv:cursor-text"
           @pointerdown.stop
           @pointermove.stop
           @pointerup.stop
           v-html="renderedTextMarkdown" />
      <pre v-else @wheel.stop class="vp-text-scroll ctv:absolute ctv:inset-0 ctv:m-0 ctv:py-0.5 ctv:px-1 ctv:overflow-y-auto
                  ctv:whitespace-pre-wrap ctv:break-words ctv:text-[11px] ctv:leading-snug ctv:font-mono ctv:text-base-foreground
                  ctv:select-text ctv:cursor-text"
           @pointerdown.stop
           @pointermove.stop
           @pointerup.stop>{{ content }}</pre>
      <div :class="imgActionsClass">
        <button type="button" :class="mdActionBtn"
                :title="showTextMarkdown ? $t('stage.action.showRawText') : $t('stage.action.renderMarkdown')"
                @click.stop="showTextMarkdown = !showTextMarkdown"><i class="pi pi-book" /></button>
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.copyText')"
                @click.stop="onCopyText"><i :class="textCopied ? 'pi pi-check' : 'pi pi-copy'" /></button>
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.download')"
                @click.stop="onDownloadText"><i class="pi pi-download" /></button>
      </div>
    </div>

    <div
      v-else-if="(type === 'COMFYTV_IMAGE' || type === 'COMFYTV_PANORAMA') && !compact"
      ref="zoomContainer"
      class="vp-img-host ctv:group ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden ctv:rounded-sm ctv:touch-none ctv:cursor-grab"
    >
      <img
        ref="zoomImg"
        :src="String(content)"
        class="ctv:block ctv:size-full ctv:object-contain ctv:select-none"
        :alt="String(content)"
        draggable="false"
      />
      <div :class="imgActionsClass">
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.viewFull')"
                @click.stop="openViewer(String(content))"><i class="pi pi-window-maximize" /></button>
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.download')"
                @click.stop="onDownload(String(content))"><i class="pi pi-download" /></button>
        <button type="button" :class="tagActionBtn(String(content))"
                :title="$t('stage.action.addTag')"
                @click.stop="openTagMenu(String(content), nameFromUrl(String(content)), $event, previewMediaType)"><i class="pi pi-tag" /></button>
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.loadAsset')"
                @click.stop="onLoadAsset(String(content), nameFromUrl(String(content)))"><i class="pi pi-bookmark" /></button>
      </div>
    </div>
    <img
      v-else-if="type === 'COMFYTV_IMAGE' || type === 'COMFYTV_PANORAMA'"
      :src="String(content)"
      :class="imgClass"
      :alt="String(content)"
    />

    <div
      v-else-if="type === 'COMFYTV_VIDEO' && !compact"
      class="vp-img-host ctv:group ctv:relative ctv:w-full"
    >
      <ProxiedVideo
        :src="String(content)"
        :class="videoClass"
        controls muted playsinline preload="metadata"
      />
      <div :class="imgActionsClass">
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.download')"
                @click.stop="onDownload(String(content))"><i class="pi pi-download" /></button>
        <button type="button" :class="tagActionBtn(String(content))"
                :title="$t('stage.action.addTag')"
                @click.stop="openTagMenu(String(content), nameFromUrl(String(content)), $event, previewMediaType)"><i class="pi pi-tag" /></button>
        <button type="button" :class="imgActionBtn"
                :title="$t('stage.action.loadAsset')"
                @click.stop="onLoadAsset(String(content), nameFromUrl(String(content)))"><i class="pi pi-bookmark" /></button>
      </div>
    </div>
    <ProxiedVideo
      v-else-if="type === 'COMFYTV_VIDEO'"
      :src="String(content)"
      :class="videoClass"
      controls muted playsinline preload="metadata"
    />

    <template v-else-if="type === 'COMFYTV_AUDIO'">
      <div v-if="compact" :class="compactSummary">
        <span class="ctv:text-[22px] ctv:leading-none"><i class="pi pi-volume-up" /></span>
      </div>
      <audio
        v-else
        :src="String(content)"
        class="ctv:block ctv:w-full ctv:mt-3.5"
        controls preload="metadata"
      />
    </template>

    <template v-else-if="type === 'COMFYTV_MODEL'">
      <div v-if="compact" class="ctv:size-full">
        <ModelThumb :src="String(content)">
          <i class="pi pi-box ctv:text-[22px]" />
        </ModelThumb>
      </div>
      <div
        v-else
        class="vp-img-host ctv:group ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-[220px] ctv:overflow-hidden ctv:rounded-sm"
      >
        <ModelPreview
          ref="modelPreviewEl"
          :src="String(content)"
          @view-changed="scheduleModelCapture"
        />
        <div :class="imgActionsClass">
          <button type="button" :class="imgActionBtn"
                  :title="$t('stage.action.download')"
                  @click.stop="onDownload(String(content))"><i class="pi pi-download" /></button>
          <button type="button" :class="tagActionBtn(String(content))"
                  :title="$t('stage.action.addTag')"
                  @click.stop="openTagMenu(String(content), nameFromUrl(String(content)), $event, previewMediaType)"><i class="pi pi-tag" /></button>
          <button type="button" :class="imgActionBtn"
                  :title="$t('stage.action.loadAsset')"
                  @click.stop="onLoadAsset(String(content), nameFromUrl(String(content)))"><i class="pi pi-bookmark" /></button>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_MATERIAL'">
      <div v-if="compact" class="ctv:flex ctv:items-center ctv:justify-center ctv:size-full">
        <span class="ctv:size-10 ctv:rounded-full" :style="materialSwatchStyle" />
      </div>
      <div v-else class="ctv:flex ctv:items-center ctv:gap-2.5 ctv:pt-3.5 ctv:pb-1 ctv:px-1">
        <span class="ctv:size-16 ctv:shrink-0 ctv:rounded-full" :style="materialSwatchStyle" />
        <div class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:min-w-0 ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
          <span class="ctv:text-base-foreground">{{ materialParams.color }}</span>
          <span>M {{ materialParams.metalness.toFixed(2) }} · R {{ materialParams.roughness.toFixed(2) }}</span>
          <span>T {{ materialParams.transmission.toFixed(2) }} · A {{ materialParams.opacity.toFixed(2) }}</span>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_FXSPEC'">
      <div v-if="compact" :class="compactSummary">
        <span class="ctv:text-[22px] ctv:leading-none ctv:text-[#b8c4ff]"><i class="pi pi-bolt" /></span>
        <span class="ctv:max-w-full ctv:px-1 ctv:truncate ctv:text-3xs ctv:font-bold ctv:text-[#b8c4ff]">
          {{ fxSpecInfo ? fxSpecInfo.label : '…' }}
        </span>
      </div>
      <div v-else class="ctv:flex ctv:items-center ctv:gap-2 ctv:pt-3.5 ctv:pb-1 ctv:px-1">
        <span class="ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-8 ctv:rounded-sm
                     ctv:bg-[rgb(120_140_255/0.18)] ctv:text-[#b8c4ff]"><i class="pi pi-bolt" /></span>
        <div class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:min-w-0">
          <span class="ctv:truncate ctv:text-[11px] ctv:font-semibold ctv:text-base-foreground">
            {{ fxSpecInfo ? fxSpecInfo.label : $t('fxChain.unknown') }}
          </span>
          <span v-if="fxSpecInfo" class="ctv:text-3xs ctv:font-mono ctv:text-muted-foreground">
            {{ $t(`fxChain.domain.${fxSpecInfo.domain}`) }} · {{ fxSpecInfo.specCount }}
          </span>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_STORYBOARD'">
      <div v-if="compact" class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:size-full ctv:py-[3px] ctv:px-1 ctv:box-border ctv:overflow-hidden">
        <div class="ctv:flex ctv:items-baseline ctv:gap-1 ctv:shrink-0">
          <span class="ctv:text-[11px] ctv:leading-none"><i class="pi pi-copy" /></span>
          <span class="vp-sb-count ctv:text-xs ctv:font-bold ctv:leading-none ctv:text-[#d8b0ff]">{{ storyboardShots.length }}</span>
          <span v-if="storyboardTotalSec" class="ctv:ml-auto ctv:text-3xs ctv:tracking-wide ctv:text-muted-foreground">{{ storyboardTotalSec }}s</span>
        </div>
        <ul class="ctv:list-none ctv:m-0 ctv:p-0 ctv:flex ctv:flex-col ctv:gap-px ctv:flex-auto ctv:min-h-0">
          <li v-for="(shot, i) in storyboardShots.slice(0, 3)" :key="i"
              class="vp-sb-item ctv:flex ctv:items-baseline ctv:gap-[3px] ctv:text-3xs ctv:leading-tight ctv:whitespace-nowrap ctv:overflow-hidden">
            <span class="ctv:shrink-0 ctv:font-semibold ctv:text-[#d8b0ff] ctv:min-w-2">{{ shot.shot_no ?? i + 1 }}</span>
            <span class="ctv:flex-auto ctv:overflow-hidden ctv:text-ellipsis ctv:text-base-foreground/80">{{ shotSummary(shot) }}</span>
          </li>
        </ul>
        <div v-if="storyboardShots.length > 3" class="vp-sb-more ctv:text-[8px] ctv:text-right ctv:italic ctv:text-muted-foreground/60">
          {{ $t('valuePreview.moreShots', { n: storyboardShots.length - 3 }) }}
        </div>
      </div>
      <div v-else :class="storyboardListClass">
        <div v-for="(shot, i) in storyboardShots" :key="i" :class="shotRowClass">
          <span :class="shotNoClass">#{{ shot.shot_no ?? i + 1 }}</span>
          <span v-if="shot.duration" :class="shotDurClass">{{ shot.duration }}</span>
          <span :class="shotPromptClass">{{ shot.prompt }}</span>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_TIMELINE'">
      <div v-if="compact" :class="compactSummary">
        <span class="ctv:text-[22px] ctv:leading-none"><i class="pi pi-video" /></span>
        <span class="vp-compact-count-text ctv:text-sm ctv:font-bold ctv:text-[#d8b0ff]">{{ timelineSegs.length }}</span>
      </div>
      <div v-else :class="storyboardListClass">
        <div v-for="(seg, i) in timelineSegs" :key="i" :class="shotRowClass">
          <span :class="shotNoClass">#{{ i + 1 }}</span>
          <span v-if="seg.length" :class="shotDurClass">{{ seg.length }}f</span>
          <span :class="shotPromptClass">{{ seg.prompt || '—' }}</span>
        </div>
        <div v-if="timelineSegs.length === 0" :class="emptyClass">{{ $t('valuePreview.emptyTimeline') }}</div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_IMAGES'">
      <template v-if="compact">
        <img
          v-if="batchImages[0]"
          :src="batchImages[0].image_url"
          :class="imgClass"
          :alt="`${batchImages.length} items`"
        />
        <div v-else :class="emptyClass">{{ emptyLabel || '…' }}</div>
        <span v-if="batchImages.length > 0"
              class="ctv:absolute ctv:top-0.5 ctv:left-0.5 ctv:pointer-events-none ctv:py-px ctv:px-[5px]
                     ctv:text-3xs ctv:font-bold ctv:tracking-wide ctv:rounded-lg
                     ctv:bg-[rgb(255_140_200/0.85)] ctv:text-white">
          {{ batchImages.length }}
        </span>
      </template>
      <div v-else class="ctv-batch-grid">
        <div
          v-for="(img, i) in batchImages"
          :key="i"
          :class="batchCellClass(isItemSelected(img, i))"
          :title="cellTooltip(img, i)"
          :role="clickMode === 'pick' ? 'button' : undefined"
          :tabindex="clickMode === 'pick' ? 0 : undefined"
          @click="clickMode === 'pick' ? onItemClick(img, i) : undefined"
          @keydown="clickMode === 'pick' ? onCellKey(img, i, $event) : undefined"
        >
          <img :src="img.image_url" :alt="img.label || img.prompt || `item ${i + 1}`"
               class="ctv:block ctv:size-full ctv:object-cover ctv:pointer-events-none" />
          <span class="ctv:absolute ctv:bottom-0.5 ctv:left-0.5 ctv:py-px ctv:px-1 ctv:text-3xs ctv:font-bold ctv:rounded-sm
                       ctv:bg-black/70 ctv:text-[#ffb0d8]">
            {{ img.label ?? `#${img.index ?? i + 1}` }}
          </span>
          <span v-if="removable && isUpstreamItem(img)"
                class="ctv:absolute ctv:bottom-0.5 ctv:right-0.5 ctv:py-px ctv:px-1 ctv:text-3xs ctv:font-bold ctv:rounded-sm
                       ctv:bg-primary-background/85 ctv:text-white"
                :title="$t('valuePreview.fromUpstream')"><i class="pi pi-arrow-up" /></span>
          <span v-if="clickMode === 'pick' && isItemSelected(img, i)"
                class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:flex ctv:items-center ctv:justify-center
                       ctv:size-4 ctv:rounded-full ctv:text-3xs ctv:leading-none
                       ctv:bg-primary-background ctv:text-white ctv:shadow-[0_1px_3px_rgb(0_0_0/0.5)]"><i class="pi pi-check" /></span>
          <span v-else-if="clickMode === 'pick'"
                class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:py-px ctv:px-1 ctv:text-2xs ctv:rounded-sm
                       ctv:bg-black/55 ctv:opacity-0 ctv:transition-opacity ctv:duration-150 ctv:group-hover:opacity-100">
            <i :class="clickHintIcon" />
          </span>
          <div :class="imgActionsClass">
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.viewFull')"
                    @click.stop="openBatchViewer(i)"><i class="pi pi-window-maximize" /></button>
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.download')"
                    @click.stop="onDownload(img.image_url)"><i class="pi pi-download" /></button>
            <button type="button" :class="tagActionBtn(img.image_url)"
                    :title="$t('stage.action.addTag')"
                    @click.stop="openTagMenu(img.image_url, img.label || img.prompt || nameFromUrl(img.image_url), $event, previewMediaType)"><i class="pi pi-tag" /></button>
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.loadAsset')"
                    @click.stop="onLoadAsset(img.image_url, img.label || img.prompt || nameFromUrl(img.image_url))"><i class="pi pi-bookmark" /></button>
            <button v-if="canRemoveItem(img, i)" type="button" :class="removeActionBtn"
                    :title="$t('stage.action.removeFromPicker')"
                    @click.stop="onItemRemove(img, i)"><i class="pi pi-times" /></button>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_AUDIOS'">
      <div v-if="compact" :class="compactSummary">
        <span class="ctv:text-[22px] ctv:leading-none"><i class="pi pi-volume-up" /></span>
        <span v-if="batchImages.length" class="vp-compact-count-text ctv:text-sm ctv:font-bold ctv:text-[#d8b0ff]">{{ batchImages.length }}</span>
      </div>
      <div v-else class="ctv:flex ctv:flex-col ctv:gap-1">
        <div v-if="batchImages.length === 0" :class="emptyClass">{{ emptyLabel || '…' }}</div>
        <div
          v-for="(track, i) in batchImages"
          :key="i"
          :class="audioRowClass(isItemSelected(track, i))"
          :title="cellTooltip(track, i)"
        >
          <div
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:min-w-0"
            :class="clickMode === 'pick' ? 'ctv:cursor-pointer' : undefined"
            :role="clickMode === 'pick' ? 'button' : undefined"
            :tabindex="clickMode === 'pick' ? 0 : undefined"
            @click="clickMode === 'pick' ? onItemClick(track, i) : undefined"
            @keydown="clickMode === 'pick' ? onCellKey(track, i, $event) : undefined"
          >
            <span v-if="clickMode === 'pick' && isItemSelected(track, i)"
                  class="ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-4 ctv:rounded-full
                         ctv:text-3xs ctv:leading-none ctv:bg-primary-background ctv:text-white
                         ctv:shadow-[0_1px_3px_rgb(0_0_0/0.5)]"><i class="pi pi-check" /></span>
            <span v-if="removable && isUpstreamItem(track)"
                  class="ctv:shrink-0 ctv:flex ctv:items-center ctv:py-px ctv:px-1 ctv:text-3xs ctv:font-bold
                         ctv:rounded-sm ctv:bg-primary-background/85 ctv:text-white"
                  :title="$t('valuePreview.fromUpstream')"><i class="pi pi-arrow-up" /></span>
            <span class="ctv:min-w-0 ctv:flex-1 ctv:truncate ctv:text-3xs ctv:font-bold ctv:text-[#ffb0d8]">
              {{ track.label ?? `#${track.index ?? i + 1}` }}
            </span>
          </div>
          <audio :src="track.image_url" class="ctv:block ctv:w-full ctv:h-8" controls preload="metadata"
                 @click.stop />
          <div :class="imgActionsClass">
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.download')"
                    @click.stop="onDownload(track.image_url)"><i class="pi pi-download" /></button>
            <button type="button" :class="tagActionBtn(track.image_url)"
                    :title="$t('stage.action.addTag')"
                    @click.stop="openTagMenu(track.image_url, track.label || track.prompt || nameFromUrl(track.image_url), $event, previewMediaType)"><i class="pi pi-tag" /></button>
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.loadAsset')"
                    @click.stop="onLoadAsset(track.image_url, track.label || track.prompt || nameFromUrl(track.image_url))"><i class="pi pi-bookmark" /></button>
            <button v-if="canRemoveItem(track, i)" type="button" :class="removeActionBtn"
                    :title="$t('stage.action.removeFromPicker')"
                    @click.stop="onItemRemove(track, i)"><i class="pi pi-times" /></button>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'COMFYTV_VIDEOS'">
      <div v-if="compact" :class="compactSummary">
        <span class="ctv:text-[22px] ctv:leading-none"><i class="pi pi-video" /></span>
        <span v-if="batchImages.length" class="vp-compact-count-text ctv:text-sm ctv:font-bold ctv:text-[#d8b0ff]">{{ batchImages.length }}</span>
      </div>
      <div v-else class="ctv:flex ctv:flex-col ctv:gap-1">
        <div v-if="batchImages.length === 0" :class="emptyClass">{{ emptyLabel || '…' }}</div>
        <div
          v-for="(clip, i) in batchImages"
          :key="i"
          :class="audioRowClass(isItemSelected(clip, i))"
          :title="cellTooltip(clip, i)"
        >
          <div
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:min-w-0"
            :class="clickMode === 'pick' ? 'ctv:cursor-pointer' : undefined"
            :role="clickMode === 'pick' ? 'button' : undefined"
            :tabindex="clickMode === 'pick' ? 0 : undefined"
            @click="clickMode === 'pick' ? onItemClick(clip, i) : undefined"
            @keydown="clickMode === 'pick' ? onCellKey(clip, i, $event) : undefined"
          >
            <span v-if="clickMode === 'pick' && isItemSelected(clip, i)"
                  class="ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-4 ctv:rounded-full
                         ctv:text-3xs ctv:leading-none ctv:bg-primary-background ctv:text-white
                         ctv:shadow-[0_1px_3px_rgb(0_0_0/0.5)]"><i class="pi pi-check" /></span>
            <span v-if="removable && isUpstreamItem(clip)"
                  class="ctv:shrink-0 ctv:flex ctv:items-center ctv:py-px ctv:px-1 ctv:text-3xs ctv:font-bold
                         ctv:rounded-sm ctv:bg-primary-background/85 ctv:text-white"
                  :title="$t('valuePreview.fromUpstream')"><i class="pi pi-arrow-up" /></span>
            <span class="ctv:min-w-0 ctv:flex-1 ctv:truncate ctv:text-3xs ctv:font-bold ctv:text-[#ffb0d8]">
              {{ clip.label ?? `#${clip.index ?? i + 1}` }}
            </span>
          </div>
          <ProxiedVideo :src="clip.image_url" class="ctv:block ctv:w-full ctv:max-h-32 ctv:rounded-sm ctv:bg-black"
                 controls muted playsinline preload="metadata"
                 @click.stop />
          <div :class="imgActionsClass">
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.download')"
                    @click.stop="onDownload(clip.image_url)"><i class="pi pi-download" /></button>
            <button type="button" :class="tagActionBtn(clip.image_url)"
                    :title="$t('stage.action.addTag')"
                    @click.stop="openTagMenu(clip.image_url, clip.label || clip.prompt || nameFromUrl(clip.image_url), $event, previewMediaType)"><i class="pi pi-tag" /></button>
            <button type="button" :class="imgActionBtn"
                    :title="$t('stage.action.loadAsset')"
                    @click.stop="onLoadAsset(clip.image_url, clip.label || clip.prompt || nameFromUrl(clip.image_url))"><i class="pi pi-bookmark" /></button>
            <button v-if="canRemoveItem(clip, i)" type="button" :class="removeActionBtn"
                    :title="$t('stage.action.removeFromPicker')"
                    @click.stop="onItemRemove(clip, i)"><i class="pi pi-times" /></button>
          </div>
        </div>
      </div>
    </template>

    <div v-else :class="emptyClass">{{ $t('stage.empty.unsupported_type', { type }) }}</div>

    <Teleport to="body">
      <div
        v-if="tagMenu"
        class="ctv:fixed ctv:inset-0 ctv:z-[9999]"
        @click="tagMenu = null"
        @wheel.prevent.stop
      >
        <div
          class="ctv:absolute ctv:w-44 ctv:max-h-64 ctv:overflow-y-auto ctv:p-1 ctv:rounded ctv:shadow-md ctv:text-xs
                 ctv:bg-interface-menu-surface ctv:border ctv:border-border-default"
          :style="tagMenuStyle"
          @click.stop
        >
          <button
            type="button"
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer
                   ctv:text-left ctv:text-2xs ctv:bg-transparent ctv:border-none ctv:text-base-foreground
                   ctv:hover:bg-secondary-background-hover"
            @click.stop="setUncategorized"
          >
            <span class="ctv:w-3 ctv:inline-block ctv:text-primary-background"><i v-if="tagMenuIsUncategorized()" class="pi pi-check" /></span>
            <span class="ctv:flex-1 ctv:truncate ctv:italic ctv:text-muted-foreground">{{ $t('assets.category.none') }}</span>
          </button>
          <div class="ctv:my-1 ctv:border-t ctv:border-border-subtle"></div>
          <button
            v-for="cat in categories"
            :key="cat.id"
            type="button"
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer
                   ctv:text-left ctv:text-2xs ctv:bg-transparent ctv:border-none ctv:text-base-foreground
                   ctv:hover:bg-secondary-background-hover"
            @click.stop="toggleOutputTag(cat.id)"
          >
            <span class="ctv:w-3 ctv:inline-block ctv:text-primary-background"><i v-if="tagMenuHas(cat.id)" class="pi pi-check" /></span>
            <span class="ctv:flex-1 ctv:truncate">{{ cat.name }}</span>
          </button>
          <div v-if="categories.length" class="ctv:my-1 ctv:border-t ctv:border-border-subtle"></div>
          <button
            type="button"
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer
                   ctv:text-left ctv:text-2xs ctv:bg-transparent ctv:border-none ctv:text-primary-background
                   ctv:hover:bg-secondary-background-hover"
            @click.stop="onCreateCategory"
          >
            <span class="ctv:w-3 ctv:inline-block"><i class="pi pi-plus" /></span>
            <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.tagPopover.create') }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelPreview from './ModelPreview.vue'
import ModelThumb from '@/components/widgets/ModelThumb.vue'
import ProxiedVideo from '@/components/widgets/ProxiedVideo.vue'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { useImagePanZoom } from '@/composables/widgets/useImagePanZoom'
import { openLightbox } from '@/composables/useLightbox'
import { useModelViewCapture } from '@/composables/stages/useModelViewCapture'
import { useOutputAssetTagging } from '@/composables/stages/useOutputAssetTagging'
import { useTextOutputActions } from '@/composables/stages/useTextOutputActions'
import {
  batchItemPayload,
  batchItemTag,
  batchLightboxItems,
  canRemoveBatchItem,
  isActivationKey,
  isBatchItemSelected,
  isUpstreamBatchItem,
  materialSwatchStyleOf,
  previewMediaTypeOf,
  shotSummary,
  useValuePreview,
} from '@/composables/stages/useValuePreview'
import { parseFxSpec } from '@/composables/stages/useFxChain'
import { parseMaterialState } from '@/widgets/material/types'
import type {
  BatchImage,
  ItemClickPayload,
} from '@/types/payloads'
import { downloadFile } from '@/utils/download'
import { renderMarkdownToHtml } from '@/utils/markdown'

const { t } = useI18n()

const {
  tagMenu,
  categories,
  tagMenuStyle,
  nameFromUrl,
  isSaved,
  openTagMenu,
  closeTagMenu,
  tagMenuHas,
  tagMenuIsUncategorized,
  setUncategorized,
  toggleOutputTag,
  createCategoryAndTag,
} = useOutputAssetTagging()

async function onCreateCategory() {
  const name = (await askText({
    title: t('assets.category.new'),
    label: t('assets.category.newPrompt'),
  }))?.trim()
  if (!name) return
  await createCategoryAndTag(name)
}

const zoomContainer = ref<HTMLElement | null>(null)
const zoomImg = ref<HTMLImageElement | null>(null)

const MODEL_CAPTURE_SIZE = 1024
const MODEL_CAPTURE_DELAY_MS = 250

const modelPreviewEl = ref<InstanceType<typeof ModelPreview> | null>(null)

const { scheduleCapture: scheduleModelCapture, cancelCapture: cancelModelCapture } = useModelViewCapture({
  getCanvas: () => modelPreviewEl.value?.captureCanvas(MODEL_CAPTURE_SIZE, MODEL_CAPTURE_SIZE),
  filenamePrefix: 'comfytv-model-view',
  logTag: 'ModelPreview',
  delayMs: MODEL_CAPTURE_DELAY_MS,
  onCaptured: (url) => emit('capture-view', { index: '', imageUrl: url, mediaType: 'image' }),
})

function openViewer(url: string) {
  if (url) openLightbox([{ url }], 0)
}

function openBatchViewer(i: number) {
  openLightbox(batchLightboxItems(batchImages.value, nameFromUrl), i)
}

async function onDownload(url: string) {
  if (!url) return
  try {
    await downloadFile(url)
  } catch (err) {
    console.error('[ComfyTV/download] failed', err)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (tagMenu.value) closeTagMenu()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  cancelModelCapture()
})

const props = defineProps<{
  type:
    | 'COMFYTV_TEXT'
    | 'COMFYTV_IMAGE'
    | 'COMFYTV_VIDEO'
    | 'COMFYTV_PANORAMA'
    | 'COMFYTV_STORYBOARD'
    | 'COMFYTV_IMAGES'
    | string
  content?: string | null
  emptyLabel?: string
  selectedIndex?: string | number
  clickMode?: 'refine' | 'pick'
  compact?: boolean
  removable?: boolean
  upstreamUrls?: string[]
}>()

useImagePanZoom(zoomContainer, zoomImg, { resetKey: toRef(props, 'content') })

const {
  hasContent,
  shortType,
  batchImages,
  storyboardShots,
  timelineSegs,
  storyboardTotalSec,
} = useValuePreview(() => props.type, () => props.content)

const emit = defineEmits<{
  (e: 'item-click', payload: ItemClickPayload): void
  (e: 'item-remove', payload: ItemClickPayload): void
  (e: 'load-asset', payload: ItemClickPayload): void
  (e: 'capture-view', payload: ItemClickPayload): void
}>()

const materialParams = computed(() => parseMaterialState(props.content))

const fxSpecInfo = computed(() =>
  props.type === 'COMFYTV_FXSPEC' ? parseFxSpec(props.content) : null)

const materialSwatchStyle = computed(() => materialSwatchStyleOf(materialParams.value))

const previewMediaType = computed<string>(() => previewMediaTypeOf(props.type))

function onLoadAsset(url: string, label: string) {
  if (!url) return
  emit('load-asset', { index: '', imageUrl: url, label, mediaType: previewMediaType.value })
}

const showTextMarkdown = ref(false)
const renderedTextMarkdown = computed(() =>
  showTextMarkdown.value ? renderMarkdownToHtml(String(props.content ?? '')) : ''
)
const mdActionBtn = computed(() => COMFY_BTN_BASE
  + ' ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
  + (showTextMarkdown.value
    ? ' ctv:bg-primary-background ctv:text-white ctv:hover:bg-primary-background/90'
    : ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'))

const {
  textCopied,
  copyText: onCopyText,
  downloadText: onDownloadText,
} = useTextOutputActions(() => String(props.content ?? ''))

function onItemClick(img: BatchImage, i: number) {
  emit('item-click', batchItemPayload(img, i))
}

function onItemRemove(img: BatchImage, i: number) {
  emit('item-remove', batchItemPayload(img, i))
}

function onCellKey(img: BatchImage, i: number, e: KeyboardEvent) {
  if (isActivationKey(e.key)) {
    e.preventDefault()
    onItemClick(img, i)
  }
}

const clickHintIcon = computed(() => props.clickMode === 'pick' ? 'pi pi-check' : 'pi pi-pencil')

function isItemSelected(img: BatchImage, i: number): boolean {
  return isBatchItemSelected(img, i, props.selectedIndex)
}

function isUpstreamItem(img: BatchImage): boolean {
  return isUpstreamBatchItem(img, props.upstreamUrls)
}

function canRemoveItem(img: BatchImage, i: number): boolean {
  return canRemoveBatchItem(img, i, {
    removable: props.removable,
    selectedIndex: props.selectedIndex,
    upstreamUrls: props.upstreamUrls,
  })
}

function cellTooltip(img: BatchImage, i: number): string {
  const tag = batchItemTag(img, i)
  return props.clickMode === 'pick' ? t('shotCell.pick', { tag }) : t('shotCell.refine', { tag })
}

const rootClass = computed(() => {
  if (props.compact) return 'ctv:relative ctv:size-full ctv:overflow-hidden'
  return 'ctv:relative ctv:flex ctv:flex-col ctv:min-h-12 ctv:text-xs ctv:overflow-hidden'
})

const TYPE_BADGE_COLORS: Record<string, string> = {
  COMFYTV_TEXT:       'ctv:bg-[rgb(120_200_120/0.25)] ctv:text-[#b5e3a5]',
  COMFYTV_IMAGE:      'ctv:bg-[rgb(78_168_255/0.25)] ctv:text-[#9dd0ff]',
  COMFYTV_PANORAMA:   'ctv:bg-[rgb(78_168_255/0.25)] ctv:text-[#9dd0ff]',
  COMFYTV_VIDEO:      'ctv:bg-[rgb(255_171_64/0.25)] ctv:text-[#ffd089]',
  COMFYTV_AUDIO:      'ctv:bg-[rgb(255_100_100/0.22)] ctv:text-[#ffb0b0]',
  COMFYTV_STORYBOARD: 'ctv:bg-[rgb(200_130_255/0.25)] ctv:text-[#d8b0ff]',
  COMFYTV_IMAGES:     'ctv:bg-[rgb(255_140_200/0.25)] ctv:text-[#ffb0d8]',
  COMFYTV_AUDIOS:     'ctv:bg-[rgb(255_100_100/0.22)] ctv:text-[#ffb0b0]',
  COMFYTV_VIDEOS:     'ctv:bg-[rgb(255_171_64/0.25)] ctv:text-[#ffd089]',
  COMFYTV_MODEL:      'ctv:bg-[rgb(100_220_200/0.25)] ctv:text-[#a5f0e0]',
  COMFYTV_MATERIAL:   'ctv:bg-[rgb(210_180_100/0.25)] ctv:text-[#ecd9a0]',
  COMFYTV_FXSPEC:     'ctv:bg-[rgb(120_140_255/0.25)] ctv:text-[#b8c4ff]',
}
const typeBadgeClass = computed(() => {
  const palette = TYPE_BADGE_COLORS[props.type] ?? 'ctv:bg-white/10 ctv:text-white/70'
  return `ctv:absolute ctv:top-[3px] ctv:right-[3px] ctv:py-px ctv:px-[5px] ctv:text-3xs ctv:tracking-wide ctv:rounded-sm ctv:pointer-events-none ${palette}`
})

const emptyClass = computed(() =>
  props.compact
    ? 'ctv:flex ctv:items-center ctv:justify-center ctv:h-full ctv:p-1 ctv:text-3xs ctv:italic ctv:opacity-50'
    : 'ctv:flex ctv:items-center ctv:justify-center ctv:h-full ctv:min-h-10 ctv:text-[11px] ctv:italic ctv:opacity-50'
)

const textClass = computed(() =>
  'ctv:m-0 ctv:p-1 ctv:max-h-full ctv:text-2xs ctv:leading-[1.3] ctv:overflow-hidden ctv:whitespace-pre-wrap ctv:font-mono ctv:break-words ctv:text-base-foreground'
  + ' ctv:[display:-webkit-box] ctv:[-webkit-line-clamp:5] ctv:[-webkit-box-orient:vertical]'
)

const imgClass = computed(() =>
  props.compact
    ? 'ctv:block ctv:size-full ctv:object-cover'
    : 'ctv:block ctv:w-full ctv:max-h-40 ctv:object-contain ctv:rounded-sm'
)

const videoHasAlpha = computed(() =>
  String(props.content ?? '').split('?')[0].toLowerCase().endsWith('.webm'))

const videoClass = computed(() => {
  const bg = videoHasAlpha.value ? 'ctv-checker' : 'ctv:bg-black'
  return props.compact
    ? `ctv:block ctv:size-full ctv:object-cover ${bg}`
    : `ctv:block ctv:w-full ctv:max-h-52 ctv:rounded-sm ${bg}`
})

const compactSummary = 'ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:size-full ctv:gap-0.5'

const storyboardListClass = 'ctv:flex ctv:flex-col ctv:gap-1 ctv:pt-3.5 ctv:max-h-56 ctv:overflow-auto'
const shotRowClass = 'ctv:flex ctv:items-baseline ctv:gap-1.5 ctv:py-[3px] ctv:px-[5px] ctv:text-[11px] ctv:rounded-sm'
  + ' ctv:bg-base-foreground/[0.03] ctv:border-l-2 ctv:border-[rgb(200_130_255/0.4)]'
const shotNoClass     = 'ctv:shrink-0 ctv:font-bold ctv:text-[#d8b0ff]'
const shotDurClass    = 'ctv:shrink-0 ctv:py-px ctv:px-1 ctv:text-2xs ctv:rounded-sm ctv:bg-base-foreground/5 ctv:text-muted-foreground'
const shotPromptClass = 'ctv:flex-auto ctv:break-words ctv:text-base-foreground'

const COMFY_BTN_BASE = 'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-2 ctv:cursor-pointer'
  + ' ctv:touch-manipulation ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'

const imgActionsClass = 'vp-img-actions ctv:absolute ctv:top-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1'

const imgActionBtn = COMFY_BTN_BASE
  + ' ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
  + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'

const removeActionBtn = COMFY_BTN_BASE
  + ' ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-xs'
  + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-destructive-background ctv:hover:text-white'

function tagActionBtn(url: string) {
  const saved = isSaved(url)
  return COMFY_BTN_BASE
    + ' ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
    + (saved
      ? ' ctv:bg-primary-background ctv:text-white ctv:hover:bg-primary-background/90'
      : ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90')
}

function batchCellClass(selected: boolean) {
  const base = 'vp-img-host ctv:group ctv:relative ctv:aspect-video ctv:rounded-sm ctv:overflow-hidden ctv:p-0 ctv:bg-black ctv:border ctv:transition-colors'
  const interactive = props.clickMode === 'pick' ? ' ctv:cursor-pointer' : ' ctv:cursor-default'
  if (selected) {
    return base + interactive + ' ctv:border-primary-background ctv:ring-[5px] ctv:ring-inset ctv:ring-primary-background'
  }
  return base + interactive
    + ' ctv:border-border-default'
    + (props.clickMode === 'pick' ? ' ctv:hover:border-primary-background' : '')
}

function audioRowClass(selected: boolean) {
  const base = 'vp-img-host ctv:group ctv:relative ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-1.5 ctv:rounded-sm ctv:border ctv:transition-colors'
  if (selected) {
    return base + ' ctv:border-primary-background ctv:bg-primary-background/10'
  }
  return base + ' ctv:border-border-default ctv:bg-base-foreground/[0.03]'
    + (props.clickMode === 'pick' ? ' ctv:hover:border-primary-background' : '')
}
</script>

<style scoped>
.ctv-checker {
  background-image:
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}

.vp-text-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.vp-text-scroll::-webkit-scrollbar {
  width: 10px;
}
.vp-text-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.vp-text-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.35);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.vp-text-scroll:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.55);
}

.vp-md :deep(h1),
.vp-md :deep(h2),
.vp-md :deep(h3),
.vp-md :deep(h4),
.vp-md :deep(h5),
.vp-md :deep(h6) {
  margin: 0.6em 0 0.3em;
  font-weight: 700;
  line-height: 1.25;
}
.vp-md :deep(h1) { font-size: 1.35em; }
.vp-md :deep(h2) { font-size: 1.2em; }
.vp-md :deep(h3) { font-size: 1.1em; }
.vp-md :deep(h4),
.vp-md :deep(h5),
.vp-md :deep(h6) { font-size: 1em; }
.vp-md :deep(p) {
  margin: 0.35em 0;
}
.vp-md :deep(ul),
.vp-md :deep(ol) {
  margin: 0.35em 0;
  padding-left: 1.4em;
}
.vp-md :deep(li) {
  margin: 0.15em 0;
}
.vp-md :deep(code) {
  padding: 0.1em 0.3em;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  font-family: monospace;
  font-size: 0.92em;
}
.vp-md :deep(pre) {
  margin: 0.4em 0;
  padding: 0.5em;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.vp-md :deep(pre code) {
  padding: 0;
  background: none;
}
.vp-md :deep(blockquote) {
  margin: 0.4em 0;
  padding: 0.1em 0.8em;
  border-left: 3px solid rgba(255, 255, 255, 0.25);
  opacity: 0.85;
}
.vp-md :deep(a) {
  color: #9dd0ff;
  text-decoration: underline;
}
.vp-md :deep(table) {
  margin: 0.4em 0;
  border-collapse: collapse;
}
.vp-md :deep(th),
.vp-md :deep(td) {
  padding: 0.2em 0.5em;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.vp-md :deep(hr) {
  margin: 0.6em 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}
.vp-md :deep(img) {
  max-width: 100%;
}

.ctv-batch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 4px;
  padding-top: 14px;
  max-height: 320px;
  overflow: auto;
}

.vp-img-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.vp-img-host:hover .vp-img-actions,
.vp-img-host:focus-within .vp-img-actions {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none), (pointer: coarse) {
  .vp-img-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
