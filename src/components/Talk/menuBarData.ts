import { computed } from "vue";
import { MenuItemData } from "@/components/Menu/type";
import { st, t } from "@/domain/i18n/t";

import { useStore } from "@/store";

export const useMenuBarData = () => {
  const store = useStore();

  // 「ファイル」メニュー
  const fileSubMenuData = computed<MenuItemData[]>(() => [
    {
      type: "button",
      label: t`音声書き出し`,
      onClick: () => {
        store.dispatch("SHOW_GENERATE_AND_SAVE_ALL_AUDIO_DIALOG");
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: st("menu")`選択音声を書き出し`,
      onClick: () => {
        store.dispatch("SHOW_GENERATE_AND_SAVE_SELECTED_AUDIO_DIALOG");
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: t`音声を繋げて書き出し`,
      onClick: () => {
        store.dispatch("SHOW_GENERATE_AND_CONNECT_ALL_AUDIO_DIALOG");
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: t`テキストを繋げて書き出し`,
      onClick: () => {
        store.dispatch("SHOW_CONNECT_AND_EXPORT_TEXT_DIALOG");
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: t`テキスト読み込み`,
      onClick: () => {
        store.dispatch("COMMAND_IMPORT_FROM_FILE", {});
      },
      disableWhenUiLocked: true,
    },
  ]);

  // 「編集」メニュー
  const editSubMenuData = computed<MenuItemData[]>(() => []);

  return {
    fileSubMenuData,
    editSubMenuData,
  };
};
