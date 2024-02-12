<template>
  <div class="track-drawer">
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
    <q-separator spaced />
    <q-list separator>
      <q-item
        v-for="(track, i) in tracks"
        :key="i"
        v-ripple
        clickable
        :active="selectedTrackIndex === i"
        active-class="selected-track"
        @click="selectTrack(i)"
      >
        <q-item-section avatar>
          <q-avatar rounded size="2rem" class="q-mr-md">
            <img
              :src="getSingerIconPathFromTrack(track)"
              class="character-avatar-icon"
            />
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label overline>トラック {{ i + 1 }}</q-item-label>
          <q-item-label>{{ getSingerNameFromTrack(track) }}</q-item-label>
          <q-item-label caption>{{
            getStyleDescriptionFromTrack(track)
          }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item v-ripple clickable @click="createAndSelectNewTrack">
        <q-item-section avatar>
          <q-avatar rounded icon="add" size="2rem" />
        </q-item-section>
        <q-item-section>
          <q-item-label>新規追加</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import CharacterMenuButton from "@/components/Sing/CharacterMenuButton.vue";
import { useStore } from "@/store";
import { getStyleDescription } from "@/sing/viewHelper";
import { Track } from "@/store/type";

const store = useStore();

const tracks = computed(() => store.state.tracks);
const getSingerIconPathFromTrack = (track: Track) => {
  if (!track.singer) {
    return "";
  }
  return store.getters
    .CHARACTER_INFO(track.singer.engineId, track.singer.styleId)
    ?.metas.styles.find((style) => {
      if (!track.singer) {
        return false;
      }
      return (
        style.styleId === track.singer.styleId &&
        style.engineId === track.singer.engineId
      );
    })?.iconPath;
};
const getSingerNameFromTrack = (track: Track) => {
  if (!track.singer) {
    return "";
  }
  return store.getters.CHARACTER_INFO(
    track.singer.engineId,
    track.singer.styleId
  )?.metas.speakerName;
};
const getStyleDescriptionFromTrack = (track: Track) => {
  if (!track.singer) {
    return "";
  }
  const style = store.getters
    .CHARACTER_INFO(track.singer.engineId, track.singer.styleId)
    ?.metas.styles.find((style) => {
      if (!track.singer) {
        return false;
      }
      return (
        style.styleId === track.singer.styleId &&
        style.engineId === track.singer.engineId
      );
    });
  return style != undefined ? getStyleDescription(style) : "";
};
const selectedTrackIndex = computed(() => store.state.selectedTrackIndex);
const selectTrack = (index: number) => {
  store.dispatch("SELECT_TRACK", { index });
};
const createAndSelectNewTrack = () => {
  const singer = store.getters.SELECTED_TRACK.singer;
  if (!singer) {
    return;
  }
  store.dispatch("CREATE_NEW_TRACK", {
    singer,
  });
  store.dispatch("SELECT_TRACK", { index: tracks.value.length - 1 });
};

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
  position: relative;

  display: flex;
  flex-direction: column;
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

.selected-track {
  background-color: rgba(colors.$primary-rgb, 0.4);
  color: colors.$display;
}
</style>
