/// <reference types="@capacitor/splash-screen" />
import { networkInterfaces } from "os";
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
  const nets = networkInterfaces();
  const net = Object.entries(nets)
    .flatMap(([name, nets]) =>
      name.includes("WSL") ||
      name.includes("VirtualBox") ||
      name.includes("Loopback")
        ? []
        : nets
    )
    .find(
      (net) =>
        net &&
        net.family === "IPv4" &&
        !net.internal &&
        net.address.startsWith("192.168.")
    );
  if (!net) throw new Error("assert: net != null");
  config.server = {
    url: `http://${net.address}:5173`,
    cleartext: true,
  };
}

export default config;
