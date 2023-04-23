import engineManifestBase from "./manifestAssets/base.json";
import termsOfService from "./manifestAssets/termsOfService.md?raw";
import { ApiProvider } from ".";
import {
  EngineManifest,
  SpeakerInfo,
  EngineManifestFromJSON,
  SpeakerFromJSON,
  SpeakerInfoFromJSON,
} from "@/openapi";

const infoProvider: ApiProvider = ({ corePlugin }) => {
  let engineManifest: EngineManifest | undefined;
  let speakerInfosMap: Record<string, SpeakerInfo> | undefined;

  return {
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
};

export default infoProvider;
