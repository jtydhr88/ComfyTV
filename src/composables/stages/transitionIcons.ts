import type { Component } from 'vue'
import IconBlend from '~icons/lucide/blend'
import IconSparkles from '~icons/lucide/sparkles'
import IconMoon from '~icons/lucide/moon'
import IconSun from '~icons/lucide/sun'
import IconContrast from '~icons/lucide/contrast'
import IconGauge from '~icons/lucide/gauge'
import IconTimer from '~icons/lucide/timer'
import IconArrowLeft from '~icons/lucide/arrow-left'
import IconArrowRight from '~icons/lucide/arrow-right'
import IconArrowUp from '~icons/lucide/arrow-up'
import IconArrowDown from '~icons/lucide/arrow-down'
import IconArrowUpLeft from '~icons/lucide/arrow-up-left'
import IconArrowUpRight from '~icons/lucide/arrow-up-right'
import IconArrowDownLeft from '~icons/lucide/arrow-down-left'
import IconArrowDownRight from '~icons/lucide/arrow-down-right'
import IconChevronsLeft from '~icons/lucide/chevrons-left'
import IconChevronsRight from '~icons/lucide/chevrons-right'
import IconChevronsUp from '~icons/lucide/chevrons-up'
import IconChevronsDown from '~icons/lucide/chevrons-down'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconChevronUp from '~icons/lucide/chevron-up'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconCircleDot from '~icons/lucide/circle-dot'
import IconSquareDashed from '~icons/lucide/square-dashed'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconCircle from '~icons/lucide/circle'
import IconUnfoldHorizontal from '~icons/lucide/unfold-horizontal'
import IconFoldHorizontal from '~icons/lucide/fold-horizontal'
import IconUnfoldVertical from '~icons/lucide/unfold-vertical'
import IconFoldVertical from '~icons/lucide/fold-vertical'
import IconMoveDiagonal from '~icons/lucide/move-diagonal'
import IconMoveDiagonal2 from '~icons/lucide/move-diagonal-2'
import IconColumns3 from '~icons/lucide/columns-3'
import IconRows3 from '~icons/lucide/rows-3'
import IconWind from '~icons/lucide/wind'
import IconArrowLeftToLine from '~icons/lucide/arrow-left-to-line'
import IconArrowRightToLine from '~icons/lucide/arrow-right-to-line'
import IconArrowUpToLine from '~icons/lucide/arrow-up-to-line'
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line'
import IconArrowLeftFromLine from '~icons/lucide/arrow-left-from-line'
import IconArrowRightFromLine from '~icons/lucide/arrow-right-from-line'
import IconArrowUpFromLine from '~icons/lucide/arrow-up-from-line'
import IconArrowDownFromLine from '~icons/lucide/arrow-down-from-line'
import IconChevronsDownUp from '~icons/lucide/chevrons-down-up'
import IconChevronsRightLeft from '~icons/lucide/chevrons-right-left'
import IconZoomIn from '~icons/lucide/zoom-in'
import IconMaximize from '~icons/lucide/maximize'
import IconGrid3x3 from '~icons/lucide/grid-3x3'
import IconLoaderPinwheel from '~icons/lucide/loader-pinwheel'
import IconDroplet from '~icons/lucide/droplet'

const TRANSITION_ICONS: Record<string, Component> = {
  fade: IconBlend,
  dissolve: IconSparkles,
  fadeblack: IconMoon,
  fadewhite: IconSun,
  fadegrays: IconContrast,
  fadefast: IconGauge,
  fadeslow: IconTimer,
  wipeleft: IconArrowLeft,
  wiperight: IconArrowRight,
  wipeup: IconArrowUp,
  wipedown: IconArrowDown,
  wipetl: IconArrowUpLeft,
  wipetr: IconArrowUpRight,
  wipebl: IconArrowDownLeft,
  wipebr: IconArrowDownRight,
  slideleft: IconChevronsLeft,
  slideright: IconChevronsRight,
  slideup: IconChevronsUp,
  slidedown: IconChevronsDown,
  smoothleft: IconChevronLeft,
  smoothright: IconChevronRight,
  smoothup: IconChevronUp,
  smoothdown: IconChevronDown,
  circlecrop: IconCircleDot,
  rectcrop: IconSquareDashed,
  circleopen: IconCircleDashed,
  circleclose: IconCircle,
  vertopen: IconUnfoldHorizontal,
  vertclose: IconFoldHorizontal,
  horzopen: IconUnfoldVertical,
  horzclose: IconFoldVertical,
  diagtl: IconMoveDiagonal2,
  diagtr: IconMoveDiagonal,
  diagbl: IconMoveDiagonal,
  diagbr: IconMoveDiagonal2,
  hlslice: IconColumns3,
  hrslice: IconColumns3,
  vuslice: IconRows3,
  vdslice: IconRows3,
  hlwind: IconWind,
  hrwind: IconWind,
  vuwind: IconWind,
  vdwind: IconWind,
  coverleft: IconArrowLeftToLine,
  coverright: IconArrowRightToLine,
  coverup: IconArrowUpToLine,
  coverdown: IconArrowDownToLine,
  revealleft: IconArrowLeftFromLine,
  revealright: IconArrowRightFromLine,
  revealup: IconArrowUpFromLine,
  revealdown: IconArrowDownFromLine,
  squeezeh: IconChevronsDownUp,
  squeezev: IconChevronsRightLeft,
  zoomin: IconZoomIn,
  distance: IconMaximize,
  pixelize: IconGrid3x3,
  radial: IconLoaderPinwheel,
  hblur: IconDroplet,
}

export function getTransitionIcon(name: string): Component {
  return TRANSITION_ICONS[name] ?? IconBlend
}
