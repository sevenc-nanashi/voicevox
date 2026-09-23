/**
 * HTMLAudioElement・AudioContextによる音声再生・停止などを担当する。
 */
import { createPartialStore } from "./vuex";
import type {
  AudioPlayerStoreState,
  AudioPlayerStoreTypes,
  CurrentPlayState,
} from "./type";
import { generateUniqueIdAndQuery } from "./audioGenerate";
import { convertAudioQueryFromEditorToEngine } from "./proxy";
import { createUILockAction } from "./ui";
import type { AudioKey } from "@/type/preload";
import { showAlertDialog } from "@/components/Dialog/Dialog";
import { Mutex } from "@/helpers/mutex";
import { createLogger } from "@/helpers/log";
import { WavStream } from "@/domain/wavStream";
import { assertNonNullable, ensureNotNullish } from "@/type/utility";
import { LruCache } from "@/helpers/lruCache";

const log = createLogger("store/audioPlayer");
let audioContext: AudioContext | null = null;
if (window.AudioContext) {
  audioContext = new AudioContext();
}

async function setAudioContextSinkId(device: string) {
  if (!audioContext?.setSinkId) return;
  await audioContext
    .setSinkId(device === "default" ? "" : device)
    .catch((err: unknown) => {
      void showAlertDialog({
        title: "エラー",
        message: "再生デバイスが見つかりません",
      });
      throw err;
    });
}

const samplesPerChunk = 256;

const cancelled = Symbol("cancelled");

const audioCache = new LruCache<
  string,
  {
    wav: Blob;
    startsAt: number;
  }
>(64);

/**
 * WavStreamの配列を順番に再生する。
 * 再生中にキャンセルされた場合、再生を中止する。
 *
 * # コールバック
 *
 * - `onStart(index: number)`: 新しいWavStreamの再生が開始されたときに呼ばれる。
 *   - `index`: 再生中のWavStreamのインデックス。
 * - `onChunkStart(index: number, time: number)`: 新しいチャンクの再生が開始されたときに呼ばれる。
 *   - `index`: 再生中のWavStreamのインデックス。
 *   - `time`: 再生中のWavStreamの再生時間（秒）。
 * - `onDelay()`: バッファが枯渇して再生が遅延したときに呼ばれる。
 * - `onFetchEnd(index: number)`: WavStreamの全てのチャンクが再生されたときに呼ばれる。
 *   - `index`: 再生中のWavStreamのインデックス。
 */
export async function playAudioStreams(
  audioStreams: {
    /** WAVの先頭からの再生開始位置（秒）。 */
    offset: number;
    stream: WavStream;
  }[],
  cancel: AbortSignal,
  callbacks: {
    onStart?: (index: number) => void;
    onChunkStart?: (index: number, time: number) => void;
    onDelay?: () => void;
    onFetchEnd?: (index: number) => void | Promise<void>;
  } = {},
) {
  if (!audioContext) {
    throw new Error("AudioContext is not supported in this browser.");
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  if (cancel.aborted) return;

  const bufferSources: AudioBufferSourceNode[] = [];
  const { promise: cancelledPromise, resolve: resolveCancel } =
    Promise.withResolvers<typeof cancelled>();
  cancel.addEventListener("abort", () => {
    resolveCancel(cancelled);
  });
  let lastBufferEndTime = audioContext.currentTime;
  let lastDelayNotifier: ReturnType<typeof setTimeout> | null = null;
  const chunkStartNotifiers: ReturnType<typeof setTimeout>[] = [];

  try {
    for (const [index, { offset, stream }] of audioStreams.entries()) {
      const header = await Promise.race([
        cancelledPromise,
        stream.readHeader(),
      ]);
      if (header === cancelled) return;
      const sampleRate = header.sampleRate;

      const samplesIterator = stream.readSamples(samplesPerChunk);
      let samplesToSkip = Math.floor(offset * sampleRate);
      let numTotalSamples = 0;
      while (true) {
        // 最初のチャンクは遅延通知をしない
        if (numTotalSamples > 0) {
          // 現在のバッファの終了時刻に向けて遅延通知をセットする
          lastDelayNotifier = setTimeout(
            () => {
              callbacks.onDelay?.();
            },
            Math.max(0, lastBufferEndTime - audioContext.currentTime) * 1000,
          );
        }

        //  中断されるか、次のチャンクが読み込まれるまで待つ
        const chunkOrDone = await Promise.race([
          cancelledPromise,
          samplesIterator.next(),
        ]);

        // 遅延通知をクリアする
        if (lastDelayNotifier != null) {
          clearTimeout(lastDelayNotifier);
          lastDelayNotifier = null;
        }

        if (chunkOrDone === cancelled) {
          return;
        }
        if (chunkOrDone.done) {
          break;
        }

        // offsetに達するまでのサンプルをスキップする
        const skippedSamples = Math.min(
          samplesToSkip,
          chunkOrDone.value.length,
        );
        samplesToSkip -= skippedSamples;
        const samples = chunkOrDone.value.slice(skippedSamples);
        if (samples.length === 0) continue;

        // 最初のチャンクの再生が開始されるときにonStartを呼ぶ
        if (numTotalSamples === 0) {
          callbacks.onStart?.(index);
        }

        // AudioBufferを作ってチャンクのサンプルをコピーする
        const audioBuffer = audioContext.createBuffer(
          2,
          samples.length,
          sampleRate,
        );
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        let offset = 0;
        for (const [left, right] of samples) {
          leftChannel[offset] = left;
          rightChannel[offset] = right;
          offset++;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        // 現在のバッファの終了時刻に合わせて再生を予約する
        // ただし現在のバッファがすでに終了している場合は現在時刻で再生を予約する（=今すぐ再生する）
        const baseTime = Math.max(lastBufferEndTime, audioContext.currentTime);
        source.start(baseTime);

        // 予約した再生時刻に合わせてonChunkStartを呼ぶ
        const currentSampleTime = numTotalSamples / sampleRate;
        chunkStartNotifiers.push(
          setTimeout(
            () => callbacks.onChunkStart?.(index, currentSampleTime),
            (baseTime - audioContext.currentTime) * 1000,
          ),
        );
        numTotalSamples += offset;
        lastBufferEndTime = baseTime + audioBuffer.duration;
        bufferSources.push(source);
      }

      if (!cancel.aborted) await callbacks.onFetchEnd?.(index);
    }
  } finally {
    // 後始末
    // まずディレイを通知するタイマーをクリアする
    if (lastDelayNotifier != null) clearTimeout(lastDelayNotifier);

    // キャンセルされるか、最後のバッファの再生が終了するまで待つ
    await Promise.race([
      new Promise<void>((resolve) => {
        setTimeout(
          resolve,
          (lastBufferEndTime - audioContext.currentTime) * 1000,
        );
      }),
      cancelledPromise,
    ]);

    // タイマーとかAudioBufferSourceNodeをクリアする
    for (const notifier of chunkStartNotifiers) {
      clearTimeout(notifier);
    }
    for (const source of bufferSources) {
      source.stop();
    }
  }
}

// ユニットテストが落ちるのを回避するための遅延読み込み
const getAudioElement = (() => {
  let audioElement: HTMLAudioElement | undefined = undefined;
  return () => {
    if (audioElement == undefined) {
      audioElement = new Audio();
    }
    return audioElement;
  };
})();

function createPlayAudioWithAbort() {
  let lastPlayController: AbortController | undefined = undefined;
  const mutex = new Mutex();
  return async <T>(
    callback: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    if (lastPlayController) {
      lastPlayController.abort();
    }
    const controller = new AbortController();
    lastPlayController = controller;
    getAudioElement().pause();
    await using _lock = await mutex.acquire();
    return await callback(controller.signal);
  };
}

/**
 * 現在再生されている音声を停止した後、callbackを実行する。
 *
 * callbackはAbortSignalに従って音声再生を中止すること。
 */
export const playAudioWithAbort = createPlayAudioWithAbort();

export const audioPlayerStoreState: AudioPlayerStoreState = {
  currentPlayState: { type: "stopped" },
};

export const audioPlayerStore = createPartialStore<AudioPlayerStoreTypes>({
  ACTIVE_AUDIO_ELEM_CURRENT_TIME_GETTER: {
    getter: (state) => {
      return () =>
        state.currentPlayState.type === "playing"
          ? getAudioElement().currentTime
          : state.currentPlayState.type === "streaming"
            ? state.currentPlayState.currentTime
            : undefined;
    },
  },

  NOW_PLAYING: {
    getter(state, getters) {
      const activeAudioKey = getters.ACTIVE_AUDIO_KEY;
      return (
        state.currentPlayState.type !== "stopped" &&
        state.currentPlayState.audioKey === activeAudioKey
      );
    },
  },

  SET_CURRENT_PLAY_STATE: {
    mutation(
      state,
      { currentPlayState }: { currentPlayState: CurrentPlayState },
    ) {
      state.currentPlayState = currentPlayState;
    },
  },

  SET_AUDIO_SOURCE: {
    mutation(_, { audioBlob }: { audioBlob: Blob }) {
      getAudioElement().src = URL.createObjectURL(audioBlob);
    },
  },

  PLAY_AUDIO_PLAYER: {
    async action(
      { state, mutations },
      { offset, audioKey }: { offset?: number; audioKey?: AudioKey },
    ) {
      const audioElement = getAudioElement();

      if (offset != undefined) {
        audioElement.currentTime = offset;
      }

      // 一部ブラウザではsetSinkIdが実装されていないので、その環境では無視する
      if (audioElement.setSinkId) {
        audioElement
          .setSinkId(state.savingSetting.audioOutputDevice)
          .catch((err: unknown) => {
            const stop = () => {
              audioElement.pause();
              audioElement.removeEventListener("canplay", stop);
            };
            audioElement.addEventListener("canplay", stop);
            void showAlertDialog({
              title: "エラー",
              message: "再生デバイスが見つかりません",
            });
            throw err;
          });
      }

      // 再生終了時にresolveされるPromiseを返す
      const played = async () => {
        if (audioKey) {
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: {
              type: "playing",
              audioKey,
            },
          });
        }
      };
      audioElement.addEventListener("play", played);

      let paused: () => void;
      const audioPlayPromise = new Promise<boolean>((resolve) => {
        paused = () => {
          resolve(audioElement.ended);
        };
        audioElement.addEventListener("pause", paused);
      }).finally(async () => {
        audioElement.removeEventListener("play", played);
        audioElement.removeEventListener("pause", paused);
        if (audioKey) {
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: {
              type: "stopped",
            },
          });
        }
      });

      void audioElement.play();

      return audioPlayPromise;
    },
  },

  STOP_AUDIO: {
    // 停止中でも呼び出して問題ない
    action() {
      return playAudioWithAbort(async () => {});
    },
  },

  PLAY_AUDIO_STREAMING: {
    action: createUILockAction(
      async (
        { state, getters, actions },
        { audioKey }: { audioKey: AudioKey },
      ) => {
        const engineId = state.audioItems[audioKey].voice.engineId;
        const engineManifest = state.engineManifests[engineId];
        if (!engineManifest.supportedFeatures?.streamingSynthesis) {
          throw new Error("Streaming synthesis is not supported.");
        }
        const audioItem = state.audioItems[audioKey];
        const [id, editorAudioQuery] = await generateUniqueIdAndQuery(
          state,
          audioItem,
        );
        assertNonNullable(editorAudioQuery);
        const segmentLength = {
          LOW_LATENCY: 0.3,
          BALANCED: 1.0,
          STABLE: 9999,
        }[state.streamingMode];
        const audioQuery = convertAudioQueryFromEditorToEngine(
          editorAudioQuery,
          engineManifest.defaultSamplingRate,
        );
        const accentPhraseOffsets = await actions.GET_AUDIO_PLAY_OFFSETS({
          audioKey,
        });
        const startTime =
          accentPhraseOffsets[getters.AUDIO_PLAY_START_POINT ?? 0];

        const existingCache = audioCache.get(id);
        if (existingCache && existingCache.startsAt <= startTime) {
          log.info(
            `Using cached audio for ${audioKey} starting at ${existingCache.startsAt} with offset ${startTime - existingCache.startsAt}`,
          );
          return await actions.PLAY_AUDIO_STREAMING_FROM_CACHE({
            audioKey,
            cache: existingCache,
            startTime,
          });
        }

        log.info(`Generating audio for ${audioKey} starting at ${startTime}`);

        return await actions.GENERATE_AND_PLAY_AUDIO_STREAMING({
          audioKey,
          audioItem,
          audioQuery,
          cacheKey: id,
          startTime,
          segmentLength,
        });
      },
    ),
  },

  PLAY_AUDIO_STREAMING_FROM_CACHE: {
    async action(
      { state, mutations, actions },
      { audioKey, cache, startTime },
    ) {
      return await playAudioWithAbort(async (abortSignal) => {
        if (abortSignal.aborted) return false;
        try {
          await setAudioContextSinkId(state.savingSetting.audioOutputDevice);
          if (abortSignal.aborted) return false;
          const wavBlob = cache.wav;
          const wavStreamForPlay = new WavStream(wavBlob.stream());

          await playAudioStreams(
            [
              {
                offset: startTime - cache.startsAt,
                stream: wavStreamForPlay,
              },
            ],
            abortSignal,
            {
              onChunkStart(_index, time) {
                mutations.SET_CURRENT_PLAY_STATE({
                  currentPlayState: {
                    type: "streaming",
                    audioKey,
                    currentTime: time + startTime,
                  },
                });
              },
            },
          );
          return !abortSignal.aborted;
        } catch (error) {
          if (
            abortSignal.aborted &&
            error instanceof Error &&
            error.name === "AbortError"
          )
            return false;
          throw error;
        } finally {
          void actions.RESET_PROGRESS();
          mutations.SET_AUDIO_NOW_GENERATING({
            audioKey,
            nowGenerating: false,
          });
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: { type: "stopped" },
          });
        }
      });
    },
  },

  GENERATE_AND_PLAY_AUDIO_STREAMING: {
    async action(
      { state, mutations, actions },
      { audioKey, audioItem, audioQuery, cacheKey, startTime, segmentLength },
    ) {
      return await playAudioWithAbort(async (abortSignal) => {
        if (abortSignal.aborted) return false;
        try {
          await setAudioContextSinkId(state.savingSetting.audioOutputDevice);
          if (abortSignal.aborted) return false;
          mutations.SET_AUDIO_NOW_GENERATING({
            audioKey,
            nowGenerating: true,
          });
          void actions.START_PROGRESS();
          const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
            engineId: audioItem.voice.engineId,
          });
          const response = await instance.invoke("streamingSynthesisRaw")(
            {
              audioQuery,
              speaker: audioItem.voice.styleId,
              enableInterrogativeUpspeak:
                state.experimentalSetting.enableInterrogativeUpspeak,
              startOffset: startTime,
              segmentLength,
            },
            { signal: abortSignal },
          );

          const wavBody = ensureNotNullish(response.raw.body);
          const [wavBodyForPlay, wavBodyForSave] = wavBody.tee();

          const wavStream = new WavStream(wavBodyForPlay);
          let delayNotified = false;
          await playAudioStreams(
            [{ offset: 0, stream: wavStream }],
            abortSignal,
            {
              onStart() {
                void actions.RESET_PROGRESS();
                mutations.SET_AUDIO_NOW_GENERATING({
                  audioKey,
                  nowGenerating: false,
                });
              },
              onChunkStart(_index, time) {
                mutations.SET_CURRENT_PLAY_STATE({
                  currentPlayState: {
                    type: "streaming",
                    audioKey,
                    currentTime: time + startTime,
                  },
                });
              },
              onDelay() {
                if (
                  !delayNotified &&
                  !state.confirmedTips.streamingUnrecommended
                ) {
                  delayNotified = true;

                  void actions.SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON({
                    message: "このPCではストリーミング再生が推奨されません",
                    icon: "warning",
                    tipName: "streamingUnrecommended",
                  });
                }
              },
              async onFetchEnd() {
                if (abortSignal.aborted) return;
                log.info(
                  `Caching audio for ${audioKey} starting at ${startTime}`,
                );
                const wavBlob = await new Response(wavBodyForSave).blob();
                if (abortSignal.aborted) return;
                audioCache.set(cacheKey, {
                  wav: wavBlob,
                  startsAt: startTime,
                });
              },
            },
          );
          return !abortSignal.aborted;
        } catch (error) {
          if (
            abortSignal.aborted &&
            error instanceof Error &&
            error.name === "AbortError"
          )
            return false;
          throw error;
        } finally {
          void actions.RESET_PROGRESS();
          mutations.SET_AUDIO_NOW_GENERATING({
            audioKey,
            nowGenerating: false,
          });
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: { type: "stopped" },
          });
        }
      });
    },
  },
});
