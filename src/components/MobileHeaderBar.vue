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
import { computed, ComputedRef } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "@/store";
import { setHotkeyFunctions } from "@/store/setting";
import {
  HotkeyAction,
  HotkeyReturnType,
  ToolbarButtonTagType,
} from "@/type/preload";
import {
  generateAndConnectAndSaveAudioWithDialog,
  generateAndSaveAllAudioWithDialog,
  generateAndSaveOneAudioWithDialog,
} from "@/components/Dialog";
import { getToolbarButtonName } from "@/store/utility";

type ButtonContent = {
  text: string;
  click(): void;
  disable: ComputedRef<boolean>;
};

type SpacerContent = {
  text: null;
};

const store = useStore();
const $q = useQuasar();

const uiLocked = computed(() => store.getters.UI_LOCKED);
const canUndo = computed(() => store.getters.CAN_UNDO);
const canRedo = computed(() => store.getters.CAN_REDO);
const activeAudioKey = computed(() => store.getters.ACTIVE_AUDIO_KEY);
const nowPlayingContinuously = computed(
  () => store.state.nowPlayingContinuously
);

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
