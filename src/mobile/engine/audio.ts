import { ApiProvider } from ".";
import { AudioQueryFromJSON } from "@/openapi";

const audioProvider: ApiProvider = ({ corePlugin }) => {
  return {
    async audioQueryAudioQueryPost({ text, speaker }) {
      const rawQuery = JSON.parse(
        (await corePlugin.audioQuery({ text, speakerId: speaker })).value
      );
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
  };
};

export default audioProvider;
