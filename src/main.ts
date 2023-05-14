import { createApp } from "vue";
import { createGtm } from "@gtm-support/vue-gtm";
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import { Capacitor } from "@capacitor/core";
import App from "./App.vue";
import router from "./router";
import { store, storeKey } from "./store";
import { ipcMessageReceiver } from "./plugins/ipcMessageReceiverPlugin";
// eslint-disable-next-line no-restricted-imports
import loadElectronMock from "./electron/mock";
import * as mobile from "./mobile";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "./styles/_index.scss";

// NOTE: 起動後、設定を読み込んでからvue-gtmを有効化する関係上、dataLayerの用意が間に合わず、値が欠落してしまう箇所が存在する
//       ため、それを防止するため自前でdataLayerをあらかじめ用意する
window.dataLayer = [];

if (Capacitor.isNativePlatform()) {
  // eslint-disable-next-line no-console
  console.log("Running in Capacitor");
  mobile.loadMock();
  mobile.loadPlugin();
  mobile.loadCoreBasedApi();
} else if (!window.electron) {
  // eslint-disable-next-line no-console
  console.log("Running in browser");
  loadElectronMock();
} else {
  // eslint-disable-next-line no-console
  console.log("Running in Electron");
}

createApp(App)
  .use(store, storeKey)
  .use(router)
  .use(
    createGtm({
      id: import.meta.env.VITE_GTM_CONTAINER_ID ?? "GTM-DUMMY",
      vueRouter: router,
      // NOTE: 最初はgtm.jsを読まず、プライバシーポリシーに同意後に読み込む
      enabled: false,
    })
  )
  .use(Quasar, {
    config: {
      brand: {
        primary: "#a5d4ad",
        secondary: "#212121",
        negative: "var(--color-warning)",
      },
    },
    iconSet,
    plugins: {
      Dialog,
      Loading,
      Notify,
    },
  })
  .use(ipcMessageReceiver, { store })
  .use(markdownItPlugin)
  .mount("#app");
