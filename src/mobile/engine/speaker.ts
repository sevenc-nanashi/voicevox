import { ApiProvider } from ".";
import { SpeakerFromJSON, SpeakerInfo, SpeakerInfoFromJSON } from "@/openapi";

const speakerProvider: ApiProvider = ({ corePlugin }) => {
  let speakerInfosMap: Record<string, SpeakerInfo> | undefined;

  return {
    async speakersSpeakersGet() {
      const metasJson = JSON.parse(
        (await corePlugin.getMetasJson()).value
      ) as Record<string, unknown>[];

      return metasJson.map((meta) =>
        SpeakerFromJSON({
          ...meta,
          supported_features: {
            // FIXME: とりあえず無効化
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

    async initializeSpeakerInitializeSpeakerPost({ speaker }) {
      await corePlugin.loadModel({ speakerId: speaker });
    },
    async isInitializedSpeakerIsInitializedSpeakerGet({ speaker }) {
      return await corePlugin
        .isModelLoaded({ speakerId: speaker })
        .then((res) => res.value);
    },
  };
};

export default speakerProvider;
