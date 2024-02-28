// Include global variables to build immer source code
export * from "immer/src/types/globals";
// showDirectoryPicker などのAPIをブラウザで使用するためにimportしている
import "@types/wicg-file-system-access";
import { SandboxKey } from "./preload";
import { VoicevoxCorePlugin } from "@/backend/mobile/plugin";

declare global {
  interface HTMLAudioElement {
    setSinkId(deviceID: string): Promise<undefined>; // setSinkIdを認識してくれないため
  }

  interface Window {
    readonly [SandboxKey]: import("./preload").Sandbox;
    readonly plugins: {
      voicevoxCore: VoicevoxCorePlugin;
    };
  }

  interface Navigator {
    // navigator.userAgentDataを認識してくれないため
    userAgentData: {
      readonly platform: string;
    };
  }
}
