/// <reference types="@capacitor/splash-screen" />
import dotenv from "dotenv";
import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "jp.hiroshiba.voicevox",
  appName: "VOICEVOX",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

if (process.env.CAPACITOR_MODE === "serve") {
  dotenv.config();
  const address = process.env.CAPACITOR_ADDRESS;
  if (!address) {
    throw new Error("環境変数 CAPACITOR_ADDRESS が設定されていません");
  }
  config.server = {
    url: `http://${address}:5173`,
    cleartext: true,
  };
}

export default config;
