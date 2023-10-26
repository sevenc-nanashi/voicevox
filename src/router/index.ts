import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
  RouteRecordRaw,
} from "vue-router";
import EditorHome from "@/views/EditorHome.vue";
import { isBrowser } from "@/type/preload";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/home",
    component: EditorHome,
    props: (route) => ({ projectFilePath: route.query["projectFilePath"] }),
    alias: "/",
  },
];

const router = createRouter({
  history: isBrowser
    ? createWebHistory(import.meta.env.BASE_URL)
    : createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
