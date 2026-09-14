<script setup lang="ts">
import { computed } from "vue";
import {
  PhArrowClockwise,
  PhBookOpen,
  PhCalendar,
  PhCaretDown,
  PhCaretLeft,
  PhCaretRight,
  PhCheck,
  PhClock,
  PhCode,
  PhCylinder,
  PhDatabase,
  PhDotsThree,
  PhDownloadSimple,
  PhFile,
  PhFolder,
  PhGear,
  PhList,
  PhMagnifyingGlass,
  PhPause,
  PhPlay,
  PhPlus,
  PhQuestion,
  PhShieldCheck,
  PhSparkle,
  PhSlidersHorizontal,
  PhStop,
  PhTerminalWindow,
  PhUploadSimple,
  PhUser,
  PhWarningCircle,
  PhX,
} from "@phosphor-icons/vue";

const props = withDefaults(defineProps<{ name: string; size?: number | string }>(), { size: 18 });

const iconMap = {
  plus: PhPlus,
  refresh: PhArrowClockwise,
  gear: PhGear,
  user: PhUser,
  search: PhMagnifyingGlass,
  file: PhFile,
  list: PhList,
  play: PhPlay,
  pause: PhPause,
  stop: PhStop,
  folder: PhFolder,
  terminal: PhTerminalWindow,
  command: PhTerminalWindow,
  database: PhDatabase,
  clock: PhClock,
  shield: PhShieldCheck,
  book: PhBookOpen,
  upload: PhUploadSimple,
  download: PhDownloadSimple,
  sliders: PhSlidersHorizontal,
  chevron: PhCaretDown,
  spark: PhSparkle,
  python: PhCode,
  conda: PhCylinder,
  check: PhCheck,
  alert: PhWarningCircle,
  calendar: PhCalendar,
  close: PhX,
  more: PhDotsThree,
  "chevron-left": PhCaretLeft,
  "chevron-right": PhCaretRight,
} as const;

const iconComponent = computed(() => iconMap[props.name as keyof typeof iconMap] ?? PhQuestion);
</script>

<template>
  <component :is="iconComponent" class="ui-icon" :size="size" weight="regular" aria-hidden="true" />
</template>

<style scoped>
.ui-icon { display: inline-block; flex: 0 0 auto; color: currentColor; vertical-align: middle; }
</style>
