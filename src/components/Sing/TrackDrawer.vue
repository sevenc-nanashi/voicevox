<template>
  <div class="track-drawer q-pa-sm">
    <character-menu-button>
      <div class="character-menu-toggle">
        <q-avatar
          v-if="selectedStyleIconPath"
          class="character-avatar"
          size="48px"
        >
          <img :src="selectedStyleIconPath" class="character-avatar-icon" />
        </q-avatar>
        <div class="character-info">
          <div class="character-name">
            {{ selectedCharacterName }}
          </div>
          <div class="character-style">
            {{ selectedCharacterStyleDescription }}
          </div>
        </div>
        <q-icon
          name="arrow_drop_down"
          size="sm"
          class="character-menu-dropdown-icon"
        />
      </div>
    </character-menu-button>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import CharacterMenuButton from "@/components/Sing/CharacterMenuButton.vue";
import { useStore } from "@/store";
import { getStyleDescription } from "@/sing/viewHelper";

const store = useStore();

const userOrderedCharacterInfos = computed(() =>
  store.getters.USER_ORDERED_CHARACTER_INFOS("singerLike")
);
const selectedCharacterInfo = computed(() => {
  const singer = store.getters.SELECTED_TRACK.singer;
  if (!userOrderedCharacterInfos.value || !singer) {
    return undefined;
  }
  return store.getters.CHARACTER_INFO(singer.engineId, singer.styleId);
});
const selectedCharacterName = computed(() => {
  return selectedCharacterInfo.value?.metas.speakerName;
});
const selectedCharacterStyleDescription = computed(() => {
  const style = selectedCharacterInfo.value?.metas.styles.find((style) => {
    const singer = store.getters.SELECTED_TRACK.singer;
    return (
      style.styleId === singer?.styleId && style.engineId === singer?.engineId
    );
  });
  return style != undefined ? getStyleDescription(style) : "";
});
const selectedStyleIconPath = computed(() => {
  const styles = selectedCharacterInfo.value?.metas.styles;
  const singer = store.getters.SELECTED_TRACK.singer;
  return styles?.find((style) => {
    return (
      style.styleId === singer?.styleId && style.engineId === singer?.engineId
    );
  })?.iconPath;
});
</script>
<style lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.track-drawer {
  border-right: 2px solid colors.$splitter;
  border-top: 1px solid colors.$sequencer-sub-divider;
  height: 100%;
}

.character-menu-toggle {
  align-items: center;
  display: flex;
  padding: 4px 8px 8px 8px;
  position: relative;
}
.character-avatar-icon {
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.character-info {
  align-items: start;
  display: flex;
  margin-left: 0.5rem;
  flex-direction: column;
  text-align: left;
  justify-content: center;
  white-space: nowrap;
}
.character-name {
  font-size: 0.875rem;
  font-weight: bold;
  line-height: 1rem;
  padding-top: 4px;
}

.character-style {
  color: rgba(colors.$display-rgb, 0.73);
  font-size: 11px;
  line-height: 1rem;
  vertical-align: text-bottom;
}

.character-menu-dropdown-icon {
  color: rgba(colors.$display-rgb, 0.73);
  margin-left: 0.25rem;
}
</style>
