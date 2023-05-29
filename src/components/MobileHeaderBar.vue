<template>
  <q-toolbar class="bg-primary text-white">
    <q-btn flat round dense>
      <q-icon name="menu" />
      <q-menu transition-show="none" transition-hide="none">
        <q-list dense>
          <menu-item
            v-for="(item, index) in menudata"
            :key="item.label"
            :menudata="item"
            v-model:selected="subMenuOpenFlags[index]"
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
      @click="button.onClick"
      :icon="button.icon"
    />
  </q-toolbar>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { MenuItemData } from "./MenuBar.vue";
import MenuItem from "./MenuItem.vue";
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

const menudata = ref<MenuItemData[]>([
  {
    type: "button",
    label: "音声書き出し",
    onClick: () => {
      alert("TODO: 音声書き出し");
    },
    disableWhenUiLocked: true,
  },
]);

const subMenuOpenFlags = ref<boolean[]>(
  [...Array(menudata.value.length)].map(() => false)
);
</script>
