<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number | string }>(), { size: 18 });
</script>

<template>
  <span class="ui-icon" :class="`ui-icon--${name}`" :style="{ '--icon-size': `${size}px` }" aria-hidden="true">
    <i></i><i></i><i></i>
  </span>
</template>

<style scoped>
.ui-icon { --icon-size: 18px; width: var(--icon-size); height: var(--icon-size); position: relative; display: inline-block; flex: 0 0 var(--icon-size); color: currentColor; }
.ui-icon i, .ui-icon::before, .ui-icon::after { position: absolute; display: block; content: ""; box-sizing: border-box; }
.ui-icon--plus::before, .ui-icon--plus::after { left: 50%; top: 50%; width: 12px; height: 2px; border-radius: 2px; background: currentColor; transform: translate(-50%, -50%); }.ui-icon--plus::after { transform: translate(-50%, -50%) rotate(90deg); }
.ui-icon--refresh::before { inset: 2px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; }.ui-icon--refresh::after { right: 0; top: 1px; width: 6px; height: 6px; border-top: 2px solid currentColor; border-right: 2px solid currentColor; transform: rotate(18deg); }
.ui-icon--gear::before { inset: 4px; border: 2px solid currentColor; border-radius: 50%; }.ui-icon--gear::after { inset: 1px; border: 2px dotted currentColor; border-radius: 50%; }
.ui-icon--user::before { left: 50%; top: 2px; width: 7px; height: 7px; border-radius: 50%; background: currentColor; transform: translateX(-50%); }.ui-icon--user::after { left: 50%; bottom: 1px; width: 14px; height: 8px; border-radius: 9px 9px 4px 4px; background: currentColor; transform: translateX(-50%); }
.ui-icon--search::before { left: 1px; top: 1px; width: 11px; height: 11px; border: 2px solid currentColor; border-radius: 50%; }.ui-icon--search::after { right: 1px; bottom: 2px; width: 7px; height: 2px; border-radius: 2px; background: currentColor; transform: rotate(45deg); transform-origin: right center; }
.ui-icon--file::before { inset: 1px 3px 1px 3px; border: 2px solid currentColor; border-radius: 3px; }.ui-icon--file::after { left: 6px; top: 6px; width: 6px; height: 2px; background: currentColor; box-shadow: 0 4px 0 currentColor; }
.ui-icon--list::before { left: 6px; top: 2px; width: 10px; height: 2px; border-radius: 2px; background: currentColor; box-shadow: 0 5px 0 currentColor, 0 10px 0 currentColor; }.ui-icon--list::after { left: 1px; top: 2px; width: 3px; height: 3px; border-radius: 1px; background: currentColor; box-shadow: 0 5px 0 currentColor, 0 10px 0 currentColor; }
.ui-icon--play::before { left: 4px; top: 2px; width: 0; height: 0; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid currentColor; }
.ui-icon--pause::before { left: 4px; top: 2px; width: 4px; height: 14px; border-radius: 2px; background: currentColor; box-shadow: 6px 0 0 currentColor; }
.ui-icon--stop::before { inset: 4px; border-radius: 2px; background: currentColor; }
.ui-icon--folder::before { left: 1px; right: 1px; top: 5px; bottom: 2px; border: 2px solid currentColor; border-radius: 2px; }.ui-icon--folder::after { left: 2px; top: 2px; width: 7px; height: 5px; border: 2px solid currentColor; border-bottom: 0; border-radius: 3px 3px 0 0; }
.ui-icon--terminal::before { left: 2px; top: 4px; width: 6px; height: 6px; border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); }.ui-icon--terminal::after { right: 1px; bottom: 3px; width: 7px; height: 2px; border-radius: 2px; background: currentColor; }
.ui-icon--database::before { left: 2px; right: 2px; top: 2px; height: 14px; border: 2px solid currentColor; border-radius: 50% / 22%; }.ui-icon--database::after { left: 3px; right: 3px; top: 7px; height: 4px; border-top: 2px solid currentColor; border-bottom: 2px solid currentColor; }
.ui-icon--clock::before { inset: 1px; border: 2px solid currentColor; border-radius: 50%; }.ui-icon--clock::after { left: 8px; top: 4px; width: 2px; height: 6px; border-radius: 2px; background: currentColor; box-shadow: 3px 4px 0 -0.2px currentColor; transform-origin: bottom center; }
.ui-icon--shield::before { left: 3px; top: 1px; width: 12px; height: 15px; border: 2px solid currentColor; border-radius: 7px 7px 8px 8px; clip-path: polygon(50% 0, 100% 16%, 92% 70%, 50% 100%, 8% 70%, 0 16%); }.ui-icon--shield::after { left: 7px; top: 7px; width: 5px; height: 3px; border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); }
.ui-icon--book::before { left: 1px; top: 3px; width: 8px; height: 12px; border: 2px solid currentColor; border-right-width: 1px; border-radius: 2px 0 0 2px; }.ui-icon--book::after { right: 1px; top: 3px; width: 8px; height: 12px; border: 2px solid currentColor; border-left-width: 1px; border-radius: 0 2px 2px 0; }
.ui-icon--upload::before { left: 8px; top: 2px; width: 2px; height: 10px; background: currentColor; }.ui-icon--upload::after { left: 5px; top: 1px; width: 7px; height: 7px; border-left: 2px solid currentColor; border-top: 2px solid currentColor; transform: rotate(45deg); box-shadow: 5px 7px 0 -1px currentColor; }
.ui-icon--download::before { left: 8px; top: 2px; width: 2px; height: 10px; background: currentColor; }.ui-icon--download::after { left: 5px; top: 7px; width: 7px; height: 7px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); }
.ui-icon--sliders::before { left: 3px; top: 3px; width: 2px; height: 12px; background: currentColor; box-shadow: 5px 0 0 currentColor, 10px 0 0 currentColor; }.ui-icon--sliders::after { left: 1px; top: 6px; width: 6px; height: 4px; border: 2px solid currentColor; border-radius: 3px; box-shadow: 5px 4px 0 -0.5px #fff, 10px -2px 0 -0.5px #fff; }
.ui-icon--chevron::before { left: 4px; top: 5px; width: 8px; height: 8px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); }
.ui-icon--spark::before { left: 8px; top: 1px; width: 2px; height: 16px; border-radius: 2px; background: currentColor; }.ui-icon--spark::after { left: 1px; top: 8px; width: 16px; height: 2px; border-radius: 2px; background: currentColor; transform: rotate(45deg); }
.ui-icon--check::before { left: 3px; top: 8px; width: 6px; height: 3px; border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); }.ui-icon--check::after { left: 7px; top: 6px; width: 8px; height: 3px; border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); }
.ui-icon--alert::before { left: 3px; top: 1px; width: 12px; height: 14px; border: 2px solid currentColor; border-radius: 50%; }.ui-icon--alert::after { left: 8px; top: 4px; width: 2px; height: 6px; border-radius: 2px; background: currentColor; box-shadow: 0 4px 0 -0.2px currentColor; }
.ui-icon--calendar::before { left: 2px; top: 3px; width: 14px; height: 13px; border: 2px solid currentColor; border-radius: 3px; }.ui-icon--calendar::after { left: 2px; top: 7px; width: 14px; height: 2px; background: currentColor; box-shadow: 4px -6px 0 -0.5px currentColor, 10px -6px 0 -0.5px currentColor; }
.ui-icon--close::before, .ui-icon--close::after { left: 3px; top: 8px; width: 12px; height: 2px; border-radius: 2px; background: currentColor; transform: rotate(45deg); }.ui-icon--close::after { transform: rotate(-45deg); }
.ui-icon--more::before { left: 2px; top: 7px; width: 3px; height: 3px; border-radius: 50%; background: currentColor; box-shadow: 5px 0 0 currentColor, 10px 0 0 currentColor; }
.ui-icon--chevron-left::before { left: 7px; top: 5px; width: 8px; height: 8px; border-bottom: 2px solid currentColor; border-left: 2px solid currentColor; transform: rotate(45deg); }.ui-icon--chevron-right::before { left: 3px; top: 5px; width: 8px; height: 8px; border-top: 2px solid currentColor; border-right: 2px solid currentColor; transform: rotate(45deg); }
</style>
