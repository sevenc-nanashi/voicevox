<template>
  <q-toolbar class="bg-primary text-white">
    <q-btn flat round dense icon="menu" />
    <q-space />
    <q-btn
      v-for="button in headerButtons"
      :key="button.icon"
      :disable="button.disable"
      flat
      round
      dense
      @click="button.onClick"
      :icon="button.icon"
    />
  </q-toolbar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);
const canUndo = computed(() => store.getters.CAN_UNDO);
const canRedo = computed(() => store.getters.CAN_REDO);

const headerButtons = computed(() => [
  {
    icon: "file_upload",
    onClick: () => {
      alert("TODO: 一つ保存する");
    },
    disable: uiLocked.value,
  },
  {
    icon: "undo",
    onClick: () => {
      store.dispatch("UNDO");
    },
    disable: !canUndo.value,
  },
  {
    icon: "redo",
    onClick: () => {
      store.dispatch("REDO");
    },
    disable: !canRedo.value,
  },
]);
</script>
