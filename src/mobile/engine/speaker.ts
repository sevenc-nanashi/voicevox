import { ApiProvider } from ".";
import { SpeakerFromJSON, SpeakerInfo, SpeakerInfoFromJSON } from "@/openapi";

const speakerProvider: ApiProvider = ({ corePlugin }) => {
  const speakerInfosMap: Record<string, SpeakerInfo> = {};

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
      if (!speakerInfosMap[speakerUuid]) {
        const speakerInfo = await fetch(`/speakerInfos/${speakerUuid}.json`)
          .then((res) => {
            if (res.ok) {
              return res.json();
            } else {
              throw new Error(`SpeakerInfo not found: ${speakerUuid}`);
            }
          })
          .then(SpeakerInfoFromJSON);
        speakerInfosMap[speakerUuid] = speakerInfo;
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
