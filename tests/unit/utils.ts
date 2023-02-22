import { VueWrapper } from "@vue/test-utils";
import { QPageContainer, QLayout } from "quasar";
import { Component, ComponentPublicInstance } from "vue";

export const wrapQPage = (page: Component) => {
  return {
    template: `
      <q-layout>
        <q-page-container>
          <page />
        </q-page-container>
      </q-layout>
    `,
    components: {
      page,
      QPageContainer,
      QLayout,
    },
  };
};

export const waitTicks = async (
  wrapper: VueWrapper<ComponentPublicInstance>,
  ticks: number
) => {
  for (let i = 0; i < ticks; i++) {
    await wrapper.vm.$nextTick();
  }
};
