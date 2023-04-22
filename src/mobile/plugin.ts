import { registerPlugin } from "@capacitor/core";

export type VoicevoxCorePlugin = {
  getVersion: () => Promise<{ value: string }>;
};

const loadPlugin = () => {
  const corePlugin = registerPlugin<VoicevoxCorePlugin>("VoicevoxCore");

  corePlugin.getVersion().then((value) => {
    alert(value.value);
  });

  // @ts-expect-error 定義時だけは無視する
  window.plugins = {
    voicevoxCore: corePlugin,
  };
};

export default loadPlugin;
