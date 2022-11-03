import {
  createRouter,
  // createWebHistory,
  createWebHashHistory,
  RouteRecordRaw,
} from "vue-router";
import EditorHome from "../views/EditorHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/home",
    component: EditorHome,
  },
];

const router = createRouter({
  // history: import.meta.env.IS_ELECTRON
  //   ? createWebHashHistory(import.meta.env.BASE_URL)
  //   : createWebHistory(import.meta.env.BASE_URL),
  // FIXME: vue-cli-electron-builderでIS_ELECTRONを実装する方法があったら置き換える。
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
