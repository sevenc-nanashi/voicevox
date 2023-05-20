import { networkInterfaces } from "os";
import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "jp.hiroshiba.voicevox",
  appName: "VOICEVOX",
  webDir: "dist",
};

if (process.env.CAPACITOR_MODE === "serve") {
  const nets = networkInterfaces();
  const net = Object.values(nets)[0]?.find(
    (net) => net.family === "IPv4" && !net.internal
  );
  if (!net) throw new Error("assert: net != null");
  config.server = {
    url: `http://${net.address}:5173`,
    cleartext: true,
  };
}

export default config;
