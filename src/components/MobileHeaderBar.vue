<!-- TODO: PC版ヘッダーと統合する -->
<template>
  <q-toolbar class="bg-primary text-white">
    <q-btn flat round dense>
      <q-icon name="menu" />
      <q-menu transition-show="none" transition-hide="none">
        <q-list dense>
          <menu-item
            v-for="(item, index) in menudata"
            :key="item.label"
            v-model:selected="subMenuOpenFlags[index]"
            :menudata="item"
          />
        </q-list>
      </q-menu>
    </q-btn>
    <q-space />
    <q-btn
      v-for="button in headerButtons"
      :key="button.icon"
      :disable="button.disable"
      flat
      round
      dense
      :icon="button.icon"
      @click="button.onClick"
    />
  </q-toolbar>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { MenuItemData } from "./Menu/type";
import MenuItem from "./Menu/MenuItem.vue";
import { useStore } from "@/store";
const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);
const canUndo = computed(() => store.getters.CAN_UNDO);
const canRedo = computed(() => store.getters.CAN_REDO);

const headerButtons = computed(() => [
  {
    icon: "svguse:toolbarIcons.svg#saveVoice",
    onClick: () => {
      alert("TODO: 音声書きだし");
    },
    disable: uiLocked.value,
  },
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

const menudata = ref<MenuItemData[]>([
  {
    type: "button",
    label: "選択している音声を書き出し",
    onClick: () => {
      alert("TODO");
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "すべての音声を書き出し",
    onClick: () => {
      alert("TODO");
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "すべての音声を繋げて書き出し",
    onClick: () => {
      alert("TODO");
    },
    disableWhenUiLocked: true,
  },
  {
    type: "separator",
  },
  {
    type: "button",
    label: "テキストを繋げて書き出し",
    onClick: () => {
      alert("TODO");
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "テキスト読み込み",
    onClick: () => {
      alert("TODO");
    },
    disableWhenUiLocked: true,
  },
  {
    type: "separator",
  },
  {
    type: "button",
    label: "メニューに戻る",
    onClick: () => {
      alert("TODO");
    },
    disableWhenUiLocked: true,
  },
]);

const subMenuOpenFlags = ref<boolean[]>(
  [...Array(menudata.value.length)].map(() => false)
);
</script>
