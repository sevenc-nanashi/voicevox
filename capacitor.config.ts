import { networkInterfaces } from "os";
import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig =
  process.env.IS_PRODUCTION === "true"
    ? {
        appId: "jp.hiroshiba.voicevox",
        appName: "VOICEVOX",
        webDir: "dist",
      }
    : {
        appId: "jp.hiroshiba.voicevox-dev",
        appName: "VOICEVOX Dev",
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
