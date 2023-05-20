import { ApiProvider } from ".";
import { SpeakerFromJSON, SpeakerInfoFromJSON } from "@/openapi";

const speakerProvider: ApiProvider = ({ corePlugin }) => {
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
      const speakerInfo = await fetch(`/speakerInfos/${speakerUuid}.json`).then(
        (res) => SpeakerInfoFromJSON(res.json())
      );
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
        // PC版エンジンの処理では、OpenAPI Generatorが生成する型としてはbooleanであるが、
        // 実際の値は"true"/"false"というstringであるというバグが存在する。
        // OpenAPI Generatorのバグに合わせた挙動を再現するため、
        // このような変換処理・型キャストを行っている。
        // ref: https://github.com/VOICEVOX/voicevox/blob/d4cd95ad3ce7ee98b60b6e1c9b3a76b9d65c3da4/src/store/engine.ts#L276-L299
        .then((res) => JSON.stringify(res.value) as unknown as boolean);
    },
  };
};

export default speakerProvider;
