<template>
  <QDialog ref="dialogRef" auto-scroll @before-show="initializeValues">
    <QLayout container view="hHh lpr fFf" class="q-dialog-plugin bg-background">
      <QHeader>
        <QToolbar>
          <QToolbarTitle class="text-display"
            >外部ファイルのインポート</QToolbarTitle
          >
        </QToolbar>
      </QHeader>
      <QPageContainer class="q-px-lg q-py-md">
        <QFile
          v-model="externalFile"
          label="インポートするファイル"
          class="q-my-sm"
          :accept="extensions"
          :error-message="externalFileError"
          :error="!!externalFileError"
          placeholder="ファイルを選択してください"
          @input="handleMidiFileChange"
        />
        <QSelect
          v-if="external"
          v-model="selectedTrack"
          :options="tracks"
          :disable="externalFileError != undefined"
          emit-value
          map-options
          label="インポートするトラック"
        />
      </QPageContainer>
      <QFooter>
        <QToolbar>
          <QSpace />
          <QBtn
            unelevated
            align="right"
            label="キャンセル"
            color="toolbar-button"
            text-color="toolbar-button-display"
            class="text-no-wrap text-bold q-mr-sm"
            @click="handleCancel"
          />
          <QBtn
            unelevated
            align="right"
            label="インポート"
            color="toolbar-button"
            text-color="toolbar-button-display"
            class="text-no-wrap text-bold q-mr-sm"
            :disabled="selectedTrack === null || externalFileError != undefined"
            @click="handleImportTrack"
          />
        </QToolbar>
      </QFooter>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import { Project, parseFunctions } from "@sevenc-nanashi/utaformatix-ts";
import { useStore } from "@/store";

const extensions = [...Object.keys(parseFunctions)]
  .map((ext) => `.${ext}`)
  .join(",");

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const store = useStore();

// MIDIファイル
const externalFile = ref<File | null>(null);

// MIDIファイルエラー
const externalFileError = computed(() => {
  if (externalFile.value && !external.value) {
    return "外部ファイルの読み込みに失敗しました";
  } else if (externalFile.value && external.value) {
    if (!external.value.tracks.length) {
      return "トラックがありません";
    } else if (
      external.value.tracks.every((track) => track.notes.length === 0)
    ) {
      return "ノートがありません";
    }
  }
  return undefined;
});
// MIDIデータ
const external = ref<Project | null>(null);
// トラック
const tracks = computed(() => {
  if (!external.value) {
    return [];
  }
  // トラックリストを生成
  // "トラックNo: トラック名 / ノート数" の形式で表示
  return external.value.tracks.map((track, index) => ({
    label: `${index + 1}: ${track.name || "（トラック名なし）"} / ノート数：${
      track.notes.length
    }`,
    value: index,
    disable: track.notes.length === 0,
  }));
});
// 選択中のトラック
const selectedTrack = ref<string | number | null>(null);

// データ初期化
const initializeValues = () => {
  externalFile.value = null;
  external.value = null;
  selectedTrack.value = null;
};

// MIDIファイル変更時
const handleMidiFileChange = async (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    throw new Error("Event target is not an HTMLInputElement");
  }

  const input = event.target;

  // 入力ファイルが存在しない場合はエラー
  if (!input.files || input.files.length === 0) {
    throw new Error("No file selected");
  }

  // 既存のMIDIデータおよび選択中のトラックをクリア
  external.value = null;
  selectedTrack.value = null;

  const file = input.files[0];
  try {
    // 外部ファイルをパース
    external.value = await Project.fromAny(file);
    selectedTrack.value = external.value.tracks.findIndex(
      (track) => track.notes.length > 0,
    );
    if (selectedTrack.value === -1) {
      selectedTrack.value = 0;
    }
  } catch (error) {
    throw new Error("Failed to parse file", { cause: error });
  }
};

// トラックインポート実行時
const handleImportTrack = () => {
  // ファイルまたは選択中のトラックが未設定の場合はエラー
  if (
    externalFile.value == null ||
    typeof selectedTrack.value !== "number" ||
    external.value == null
  ) {
    throw new Error("External file or selected track is not set");
  }
  // トラックをインポート
  store.dispatch("IMPORT_EXTERNAL_FILE", {
    data: external.value,
    trackIndex: selectedTrack.value,
  });
  onDialogOK();
};

// キャンセルボタンクリック時
const handleCancel = () => {
  onDialogCancel();
};
</script>
