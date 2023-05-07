import { ApiProvider } from ".";
import { AccentPhraseFromJSON, AudioQueryFromJSON } from "@/openapi";

const queryProvider: ApiProvider = ({ corePlugin }) => {
  return {
    async audioQueryAudioQueryPost({ text, speaker }) {
      const rawQuery = await corePlugin
        .audioQuery({ text, speakerId: speaker })
        .then((res) => JSON.parse(res.value));
      return AudioQueryFromJSON({
        accent_phrases: rawQuery.accent_phrases,
        speedScale: rawQuery.speed_scale,
        pitchScale: rawQuery.pitch_scale,
        intonationScale: rawQuery.intonation_scale,
        volumeScale: rawQuery.volume_scale,
        prePhonemeLength: rawQuery.pre_phoneme_length,
        postPhonemeLength: rawQuery.post_phoneme_length,
        outputSamplingRate: rawQuery.output_sampling_rate,
        outputStereo: rawQuery.output_stereo,
        kana: rawQuery.kana,
      });
    },

    async accentPhrasesAccentPhrasesPost({ speaker, text }) {
      const rawAccentPhrases = await corePlugin
        .accentPhrases({ text, speakerId: speaker })
        .then((res) => JSON.parse(res.value));
      return rawAccentPhrases.map(AccentPhraseFromJSON);
    },
  };
};

export default queryProvider;
