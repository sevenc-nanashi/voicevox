import engineManifestBase from "./engineManifestAssets/base.json";
import termsOfService from "./engineManifestAssets/termsOfService.md?raw";
import {
  DefaultApi,
  DefaultApiInterface,
  EngineManifest,
  EngineManifestFromJSON,
  SpeakerFromJSON,
  SpeakerInfo,
  SpeakerInfoFromJSON,
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
  let speakerInfosMap: Record<string, SpeakerInfo> | undefined;

  const coreBasedApiNaked: Partial<DefaultApiInterface> = {
    async versionVersionGet() {
      // 何故か""で囲まれているのを再現。直ったら消す。
      return JSON.stringify(corePlugin.getVersion());
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
      return JSON.parse((await corePlugin.getSupportedDevicesJson()).value);
    },
    async speakersSpeakersGet() {
      const metasJson = JSON.parse(
        (await corePlugin.getMetasJson()).value
      ) as Record<string, unknown>[];

      return metasJson.map((meta) =>
        SpeakerFromJSON({
          ...meta,
          supported_features: {
            permitted_synthesis_morphing: "NOTHING",
          },
        })
      );
    },
    async speakerInfoSpeakerInfoGet({ speakerUuid }) {
      if (!speakerInfosMap) {
        speakerInfosMap = Object.fromEntries(
          Object.entries(
            await fetch("/speakerInfos.json").then((res) => res.json())
          ).map(([key, value]) => [key, SpeakerInfoFromJSON(value)])
        );
      }
      const speakerInfo = speakerInfosMap[speakerUuid];
      if (!speakerInfo) {
        throw new Error(`SpeakerInfo not found: ${speakerUuid}`);
      }
      return speakerInfo;
    },
  };

  // コアベースのOpenAPI Connectorライクなオブジェクト。
  // - コアベースの実装がある場合は呼び出し、
  // - 本家OpenAPI Connectorに存在している、かつコアベースの実装がない場合はNot implementedエラーを投げ、
  // - 本家OpenAPI Connectorに存在していない場合はUnknown APIエラーを投げる
  coreBasedApi = new Proxy(coreBasedApiNaked, {
    get: (base, key: keyof DefaultApiInterface) => {
      if (!api) throw new Error("assert: api != null");
      if (!isCoreInitialized) throw new Error("Core is not initialized");
      if (key in base) {
        window.electron.logInfo(`Call coreBasedApi.${String(key)}`);
        return base[key];
      } else if (key in api) {
        throw new Error(`Not implemented: ${String(key)}`);
      } else {
        throw new Error(`Unknown API: ${String(key)}`);
      }
    },
  }) as DefaultApiInterface;
};

export default loadApi;
