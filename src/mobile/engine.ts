import engineManifestBase from "./engineManifestAssets/base.json";
import termsOfService from "./engineManifestAssets/termsOfService.md?raw";
import {
  DefaultApi,
  DefaultApiInterface,
  EngineManifest,
  EngineManifestFromJSON,
} from "@/openapi";

let api: DefaultApi | undefined;
export let coreBasedApi: DefaultApiInterface | undefined;

const loadApi = () => {
  api = new DefaultApi();
  const corePlugin = window.plugins?.voicevoxCore;
  if (!corePlugin) throw new Error("assert: corePlugin != null");
  let isCoreInitialized = false;
  corePlugin.initialize().then(() => {
    isCoreInitialized = true;
  });

  let engineManifest: EngineManifest | undefined;

  // コアベースのOpenAPI Connectorライクなオブジェクト。
  // - コアベースの実装がある場合は呼び出し、
  // - 本家OpenAPI Connectorに存在している、かつコアベースの実装がない場合はNot implementedエラーを投げ、
  // - 本家OpenAPI Connectorに存在していない場合はUnknown APIエラーを投げる
  coreBasedApi = new Proxy(
    {
      async versionVersionGet() {
        return corePlugin.getVersion();
      },
      async engineManifestEngineManifestGet() {
        if (!engineManifest) {
          engineManifest = EngineManifestFromJSON({
            ...engineManifestBase,
            icon: await fetch("/icon.png")
              .then((res) => res.blob())
              .then((blob) => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                return new Promise<string>((resolve) => {
                  reader.onloadend = () => {
                    if (typeof reader.result === "string") {
                      resolve(reader.result);
                    }
                  };
                });
              }),
            updateInfos: await fetch("/updateInfos.json").then((res) =>
              res.json()
            ),
            terms_of_service: termsOfService,
            dependency_licenses: await fetch("/licenses.json").then((res) =>
              res.json()
            ),
          });
        }

        return engineManifest;
      },
      async supportedDevicesSupportedDevicesGet() {
        return { cpu: true, cuda: false, dml: false };
      },
    } as Partial<DefaultApiInterface>,
    {
      get: (base, key: keyof DefaultApiInterface) => {
        if (!api) throw new Error("assert: api != null");
        if (!isCoreInitialized) throw new Error("Core is not initialized");
        if (key in base) {
          return base[key];
        } else if (key in api) {
          throw new Error(`Not implemented: ${String(key)}`);
        } else {
          throw new Error(`Unknown API: ${String(key)}`);
        }
      },
    }
  ) as DefaultApiInterface;
};

export default loadApi;
