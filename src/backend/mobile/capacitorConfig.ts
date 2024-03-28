import AsyncLock from "async-lock";
import { Preferences } from "@capacitor/preferences";
import { defaultEngine } from "@/backend/browser/contract";

import { BaseConfigManager, Metadata } from "@/backend/common/ConfigManager";
import { ConfigType, EngineId, engineSettingSchema } from "@/type/preload";

let configManager: MobileConfigManager | undefined;
const entryKey = `${import.meta.env.VITE_APP_NAME}-config`;

const configManagerLock = new AsyncLock();
const defaultEngineId = EngineId(defaultEngine.uuid);

export async function getConfigManager() {
  await configManagerLock.acquire("configManager", async () => {
    if (!configManager) {
      configManager = new MobileConfigManager();
      await configManager.initialize();
    }
  });

  if (!configManager) {
    throw new Error("configManager is undefined");
  }

  return configManager;
}

class MobileConfigManager extends BaseConfigManager {
  protected getAppVersion() {
    return import.meta.env.VITE_APP_VERSION;
  }
  protected async exists() {
    return !!(await Preferences.get({ key: entryKey }).then((v) => v.value));
  }
  protected async load(): Promise<Record<string, unknown> & Metadata> {
    const db = await Preferences.get({ key: entryKey });
    return JSON.parse(db.value || "{}");
  }

  protected async save(data: ConfigType & Metadata) {
    await Preferences.set({ key: entryKey, value: JSON.stringify(data) });
  }

  protected getDefaultConfig() {
    const baseConfig = super.getDefaultConfig();
    baseConfig.engineSettings[defaultEngineId] ??= engineSettingSchema.parse(
      {}
    );
    return baseConfig;
  }
}
