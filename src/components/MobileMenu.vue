<template>
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
  <q-separator vertical spaced inset color="background" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import { MenuItemData } from "./MenuBar.vue";
import MenuItem from "./MenuItem.vue";

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
