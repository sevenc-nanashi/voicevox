import path from "path";
import { Midi } from "@tonejs/midi";
import { v4 as uuidv4 } from "uuid";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import {
  Score,
  Tempo,
  TimeSignature,
  Note,
  SingingStoreState,
  SingingStoreTypes,
  SingingCommandStoreState,
  SingingCommandStoreTypes,
  SaveResultObject,
  Singer,
  Phrase,
  PhraseState,
  transformCommandStore,
  noteSchema,
  Track,
} from "./type";
import { sanitizeFileName } from "./utility";
import { EngineId } from "@/type/preload";
import { FrameAudioQuery, Note as NoteForRequestToEngine } from "@/openapi";
import { ResultError, getValueOrThrow } from "@/type/result";
import {
  AudioEvent,
  AudioPlayer,
  AudioSequence,
  ChannelStrip,
  Clipper,
  Instrument,
  Limiter,
  NoteEvent,
  NoteSequence,
  OfflineTransport,
  Sequence,
  TrackNode,
  Transport,
} from "@/sing/audioRendering";
import {
  selectPriorPhrase,
  getMeasureDuration,
  getNoteDuration,
  isValidNote,
  isValidScore,
  isValidSnapType,
  isValidTempo,
  isValidTimeSignature,
  isValidKeyRangeAdjustment,
  isValidvolumeRangeAdjustment,
  secondToTick,
  tickToSecond,
  shouldPlay,
} from "@/sing/domain";
import {
  DEFAULT_BEATS,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BPM,
  DEFAULT_TPQN,
  FrequentlyUpdatedState,
  addNotesToOverlappingNoteInfos,
  generatePhraseHash,
  getOverlappingNoteIds,
  removeNotesFromOverlappingNoteInfos,
  updateNotesOfOverlappingNoteInfos,
} from "@/sing/storeHelper";
import { getDoremiFromNoteNumber } from "@/sing/viewHelper";
import {
  AnimationTimer,
  createPromiseThatResolvesWhen,
  round,
} from "@/sing/utility";

const generateAudioEvents = async (
  audioContext: BaseAudioContext,
  time: number,
  blob: Blob
): Promise<AudioEvent[]> => {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);
  return [{ time, buffer }];
};

const generateNoteEvents = (notes: Note[], tempos: Tempo[], tpqn: number) => {
  return notes.map((value): NoteEvent => {
    const noteOnPos = value.position;
    const noteOffPos = value.position + value.duration;
    return {
      noteNumber: value.noteNumber,
      noteOnTime: tickToSecond(noteOnPos, tempos, tpqn),
      noteOffTime: tickToSecond(noteOffPos, tempos, tpqn),
    };
  });
};

let audioContext: AudioContext | undefined;
let transport: Transport | undefined;
let globalChannelStrip: ChannelStrip | undefined;
const trackNodes: TrackNode[] = [];
let limiter: Limiter | undefined;
let clipper: Clipper | undefined;

// NOTE: テスト時はAudioContextが存在しない
if (window.AudioContext) {
  audioContext = new AudioContext();
  transport = new Transport(audioContext);
  globalChannelStrip = new ChannelStrip(audioContext);
  limiter = new Limiter(audioContext);
  clipper = new Clipper(audioContext);

  const trackNode = new TrackNode(audioContext);
  trackNodes.push(trackNode);
  trackNode.output.connect(globalChannelStrip.input);

  globalChannelStrip.output.connect(limiter.input);
  limiter.output.connect(clipper.input);
  clipper.output.connect(audioContext.destination);
}

const updateTrackMute = (shouldPlay: boolean[]) => {
  for (let i = 0; i < trackNodes.length; i++) {
    trackNodes[i].setMute(!shouldPlay[i]);
  }
};

type PhraseData = {
  blob?: Blob;
  source?: Instrument | AudioPlayer; // ひとまずPhraseDataに持たせる
  sequence?: Sequence; // ひとまずPhraseDataに持たせる
};

const playheadPosition = new FrequentlyUpdatedState(0);
const phraseDataMap = new Map<string, PhraseData>();
const phraseAudioBlobCache = new Map<string, Blob>();
const animationTimer = new AnimationTimer();

const createInitialTrack = (): Track => ({
  singer: undefined,
  keyRangeAdjustment: 0,
  volumeRangeAdjustment: 0,
  notes: [],
  pan: 0,
  volume: 1,
  mute: false,
  solo: false,
});
export const generateSingingStoreInitialScore = () => {
  return {
    tpqn: DEFAULT_TPQN,
    tempos: [
      {
        position: 0,
        bpm: DEFAULT_BPM,
      },
    ],
    timeSignatures: [
      {
        measureNumber: 1,
        beats: DEFAULT_BEATS,
        beatType: DEFAULT_BEAT_TYPE,
      },
    ],
    tracks: [createInitialTrack()],
  };
};

export const singingStoreState: SingingStoreState = {
  ...generateSingingStoreInitialScore(),
  phrases: new Map(),
  // NOTE: UIの状態は試行のためsinging.tsに局所化する+Hydrateが必要
  isShowSinger: true,
  sequencerZoomX: 0.5,
  sequencerZoomY: 0.75,
  sequencerSnapType: 16,
  selectedTrackIndex: 0,
  selectedNoteIds: new Set(),
  overlappingNoteIds: new Set(),
  overlappingNoteInfos: [new Map()],
  nowPlaying: false,
  volume: 0,
  startRenderingRequested: false,
  stopRenderingRequested: false,
  nowRendering: false,
  nowAudioExporting: false,
  cancellationOfAudioExportRequested: false,
};

export const singingStore = createPartialStore<SingingStoreTypes>({
  SET_SHOW_SINGER: {
    mutation(state, { isShowSinger }: { isShowSinger: boolean }) {
      state.isShowSinger = isShowSinger;
    },
    async action({ commit }, { isShowSinger }) {
      commit("SET_SHOW_SINGER", {
        isShowSinger,
      });
    },
  },

  SETUP_SINGER: {
    async action({ dispatch }, { singer }: { singer: Singer }) {
      // 指定されたstyleIdに対して、エンジン側の初期化を行う
      const isInitialized = await dispatch(
        "IS_INITIALIZED_ENGINE_SPEAKER",
        singer
      );
      if (!isInitialized) {
        await dispatch("INITIALIZE_ENGINE_SPEAKER", singer);
      }
    },
  },

  SET_SINGER: {
    mutation(state, { singer, trackIndex }) {
      state.tracks[trackIndex].singer = singer;
    },
    async action({ state, getters, dispatch, commit }, { singer, trackIndex }) {
      if (state.defaultStyleIds == undefined)
        throw new Error("state.defaultStyleIds == undefined");
      const userOrderedCharacterInfos =
        getters.USER_ORDERED_CHARACTER_INFOS("singerLike");
      if (userOrderedCharacterInfos == undefined)
        throw new Error("userOrderedCharacterInfos == undefined");

      const engineId = singer?.engineId ?? state.engineIds[0];

      // 最初のスタイルをソングエディタにおける仮のデフォルトスタイルとする
      // TODO: ソングエディタ向けのデフォルトスタイルをどうするか考える
      const defaultStyleId =
        userOrderedCharacterInfos[0].metas.styles[0].styleId;

      const styleId = singer?.styleId ?? defaultStyleId;

      dispatch("SETUP_SINGER", { singer: { engineId, styleId } });
      commit("SET_SINGER", { trackIndex, singer: { engineId, styleId } });

      dispatch("RENDER");
    },
  },

  SET_KEY_RANGE_ADJUSTMENT: {
    mutation(state, { keyRangeAdjustment, trackIndex }) {
      state.tracks[trackIndex].keyRangeAdjustment = keyRangeAdjustment;
    },
    async action({ dispatch, commit }, { keyRangeAdjustment, trackIndex }) {
      if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
        throw new Error("The keyRangeAdjustment is invalid.");
      }
      commit("SET_KEY_RANGE_ADJUSTMENT", { trackIndex, keyRangeAdjustment });

      dispatch("RENDER");
    },
  },

  SET_VOLUME_RANGE_ADJUSTMENT: {
    mutation(state, { volumeRangeAdjustment, trackIndex }) {
      state.tracks[trackIndex].volumeRangeAdjustment = volumeRangeAdjustment;
    },
    async action({ dispatch, commit }, { volumeRangeAdjustment, trackIndex }) {
      if (!isValidvolumeRangeAdjustment(volumeRangeAdjustment)) {
        throw new Error("The volumeRangeAdjustment is invalid.");
      }
      commit("SET_VOLUME_RANGE_ADJUSTMENT", {
        volumeRangeAdjustment,
        trackIndex,
      });

      dispatch("RENDER");
    },
  },

  SET_SCORE: {
    mutation(state, { score }: { score: Score }) {
      state.overlappingNoteIds.clear();
      state.editingLyricNoteId = undefined;
      state.selectedNoteIds.clear();
      state.tpqn = score.tpqn;
      state.tempos = score.tempos;
      state.timeSignatures = score.timeSignatures;
      state.overlappingNoteInfos = [];
      trackNodes.length = 0;
      // state.tracks = score.notes.map(() => createInitialTrack());
      // にしたいが、これをやるとシンガーの設定が全部吹っ飛ぶので
      // tracks.length = score.notes.length; にする。
      // そもそもSET_SCOREがシンガーの設定を残すように作られているのがおかしい？
      state.tracks.length = score.notes.length;
      for (const [i, notes] of score.notes.entries()) {
        if (state.tracks[i] == undefined) {
          state.tracks[i] = createInitialTrack();
        }
        state.tracks[i].notes = notes;
        state.overlappingNoteInfos.push(new Map());
        addNotesToOverlappingNoteInfos(
          state.overlappingNoteInfos[i],
          score.notes[i]
        );
        if (audioContext && globalChannelStrip) {
          const node = new TrackNode(audioContext);
          node.output.connect(globalChannelStrip.input);
          trackNodes.push(node);
        }
      }
      if (state.tracks.length === 0) {
        state.tracks.push(createInitialTrack());
        state.overlappingNoteInfos.push(new Map());
        if (audioContext && globalChannelStrip) {
          const node = new TrackNode(audioContext);
          node.output.connect(globalChannelStrip.input);
          trackNodes.push(node);
        }
      }
      state.selectedTrackIndex = 0;
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos
      );
    },
    async action(
      { state, getters, commit, dispatch },
      { score }: { score: Score }
    ) {
      if (!isValidScore(score)) {
        throw new Error("The score is invalid.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        await dispatch("SING_STOP_AUDIO");
      }
      commit("SET_SCORE", { score });
      transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

      dispatch("RENDER");
    },
  },

  SET_TEMPO: {
    mutation(state, { tempo }: { tempo: Tempo }) {
      const index = state.tempos.findIndex((value) => {
        return value.position === tempo.position;
      });
      const tempos = [...state.tempos];
      if (index !== -1) {
        tempos.splice(index, 1, tempo);
      } else {
        tempos.push(tempo);
        tempos.sort((a, b) => a.position - b.position);
      }
      state.tempos = tempos;
    },
  },

  REMOVE_TEMPO: {
    mutation(state, { position }: { position: number }) {
      const index = state.tempos.findIndex((value) => {
        return value.position === position;
      });
      if (index === -1) {
        throw new Error("The tempo does not exist.");
      }
      const tempos = [...state.tempos];
      if (index === 0) {
        tempos.splice(index, 1, {
          position: 0,
          bpm: DEFAULT_BPM,
        });
      } else {
        tempos.splice(index, 1);
      }
      state.tempos = tempos;
    },
  },

  SET_TIME_SIGNATURE: {
    mutation(state, { timeSignature }: { timeSignature: TimeSignature }) {
      const index = state.timeSignatures.findIndex((value) => {
        return value.measureNumber === timeSignature.measureNumber;
      });
      const timeSignatures = [...state.timeSignatures];
      if (index !== -1) {
        timeSignatures.splice(index, 1, timeSignature);
      } else {
        timeSignatures.push(timeSignature);
        timeSignatures.sort((a, b) => a.measureNumber - b.measureNumber);
      }
      state.timeSignatures = timeSignatures;
    },
  },

  REMOVE_TIME_SIGNATURE: {
    mutation(state, { measureNumber }: { measureNumber: number }) {
      const index = state.timeSignatures.findIndex((value) => {
        return value.measureNumber === measureNumber;
      });
      if (index === -1) {
        throw new Error("The time signature does not exist.");
      }
      const timeSignatures = [...state.timeSignatures];
      if (index === 0) {
        timeSignatures.splice(index, 1, {
          measureNumber: 1,
          beats: DEFAULT_BEATS,
          beatType: DEFAULT_BEAT_TYPE,
        });
      } else {
        timeSignatures.splice(index, 1);
      }
      state.timeSignatures = timeSignatures;
    },
  },

  NOTE_IDS: {
    getter(state) {
      const selectedTrack = state.tracks[state.selectedTrackIndex];
      const noteIds = selectedTrack.notes.map((value) => value.id);
      return new Set(noteIds);
    },
  },

  ADD_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      const selectedTrack = state.tracks[state.selectedTrackIndex];
      const newNotes = [...selectedTrack.notes, ...notes];
      newNotes.sort((a, b) => a.position - b.position);
      selectedTrack.notes = newNotes;
      addNotesToOverlappingNoteInfos(
        state.overlappingNoteInfos[state.selectedTrackIndex],
        notes
      );
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos
      );
    },
  },

  UPDATE_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      const notesMap = new Map<string, Note>();
      for (const note of notes) {
        notesMap.set(note.id, note);
      }
      const selectedTrack = state.tracks[state.selectedTrackIndex];
      selectedTrack.notes = selectedTrack.notes
        .map((value) => notesMap.get(value.id) ?? value)
        .sort((a, b) => a.position - b.position);
      updateNotesOfOverlappingNoteInfos(
        state.overlappingNoteInfos[state.selectedTrackIndex],
        notes
      );
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos
      );
    },
  },

  REMOVE_NOTES: {
    mutation(state, { noteIds }: { noteIds: string[] }) {
      const noteIdsSet = new Set(noteIds);
      const selectedTrack = state.tracks[state.selectedTrackIndex];
      const notes = selectedTrack.notes.filter((value) => {
        return noteIdsSet.has(value.id);
      });
      removeNotesFromOverlappingNoteInfos(
        state.overlappingNoteInfos[state.selectedTrackIndex],
        notes
      );
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos
      );
      if (
        state.editingLyricNoteId != undefined &&
        noteIdsSet.has(state.editingLyricNoteId)
      ) {
        state.editingLyricNoteId = undefined;
      }
      for (const noteId of noteIds) {
        state.selectedNoteIds.delete(noteId);
      }
      selectedTrack.notes = selectedTrack.notes.filter((value) => {
        return !noteIdsSet.has(value.id);
      });
    },
  },

  SELECT_NOTES: {
    mutation(state, { noteIds }: { noteIds: string[] }) {
      for (const noteId of noteIds) {
        state.selectedNoteIds.add(noteId);
      }
    },
    async action({ getters, commit }, { noteIds }: { noteIds: string[] }) {
      const existingNoteIds = getters.NOTE_IDS;
      const isValidNoteIds = noteIds.every((value) => {
        return existingNoteIds.has(value);
      });
      if (!isValidNoteIds) {
        throw new Error("The note ids are invalid.");
      }
      commit("SELECT_NOTES", { noteIds });
    },
  },

  SELECT_ALL_NOTES: {
    mutation(state) {
      const currentTrack = state.tracks[state.selectedTrackIndex];
      const allNoteIds = currentTrack.notes.map((note) => note.id);
      state.selectedNoteIds = new Set(allNoteIds);
    },
    async action({ commit }) {
      commit("SELECT_ALL_NOTES");
    },
  },

  DESELECT_ALL_NOTES: {
    mutation(state) {
      state.editingLyricNoteId = undefined;
      state.selectedNoteIds = new Set();
    },
    async action({ commit }) {
      commit("DESELECT_ALL_NOTES");
    },
  },

  SET_EDITING_LYRIC_NOTE_ID: {
    mutation(state, { noteId }: { noteId?: string }) {
      if (noteId != undefined && !state.selectedNoteIds.has(noteId)) {
        state.selectedNoteIds.clear();
        state.selectedNoteIds.add(noteId);
      }
      state.editingLyricNoteId = noteId;
    },
    async action({ getters, commit }, { noteId }: { noteId?: string }) {
      if (noteId != undefined && !getters.NOTE_IDS.has(noteId)) {
        throw new Error("The note id is invalid.");
      }
      commit("SET_EDITING_LYRIC_NOTE_ID", { noteId });
    },
  },

  SET_PHRASE: {
    mutation(
      state,
      { phraseKey, phrase }: { phraseKey: string; phrase: Phrase }
    ) {
      state.phrases.set(phraseKey, phrase);
    },
  },

  DELETE_PHRASE: {
    mutation(state, { phraseKey }: { phraseKey: string }) {
      state.phrases.delete(phraseKey);
    },
  },

  SET_STATE_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        phraseState,
      }: { phraseKey: string; phraseState: PhraseState }
    ) {
      const phrase = state.phrases.get(phraseKey);
      if (phrase == undefined) {
        throw new Error("phrase is undefined.");
      }
      phrase.state = phraseState;
    },
  },

  SET_FRAME_AUDIO_QUERY_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        frameAudioQuery,
      }: { phraseKey: string; frameAudioQuery: FrameAudioQuery }
    ) {
      const phrase = state.phrases.get(phraseKey);
      if (phrase == undefined) {
        throw new Error("phrase is undefined.");
      }
      phrase.query = frameAudioQuery;
    },
  },

  SET_START_TIME_TO_PHRASE: {
    mutation(
      state,
      { phraseKey, startTime }: { phraseKey: string; startTime: number }
    ) {
      const phrase = state.phrases.get(phraseKey);
      if (phrase == undefined) {
        throw new Error("phrase is undefined.");
      }
      phrase.startTime = startTime;
    },
  },

  SET_SELECTED_TRACK_INDEX: {
    mutation(state, { trackIndex }: { trackIndex: number }) {
      state.selectedTrackIndex = trackIndex;
      state.selectedNoteIds.clear();
    },
    async action({ commit }, { trackIndex }) {
      commit("SET_SELECTED_TRACK_INDEX", { trackIndex });
    },
  },

  SELECTED_TRACK: {
    getter(state) {
      return state.tracks[state.selectedTrackIndex];
    },
  },

  SET_SNAP_TYPE: {
    mutation(state, { snapType }) {
      state.sequencerSnapType = snapType;
    },
    async action({ state, commit }, { snapType }) {
      const tpqn = state.tpqn;
      if (!isValidSnapType(snapType, tpqn)) {
        throw new Error("The snap type is invalid.");
      }
      commit("SET_SNAP_TYPE", { snapType });
    },
  },

  SET_ZOOM_X: {
    mutation(state, { zoomX }: { zoomX: number }) {
      state.sequencerZoomX = zoomX;
    },
    async action({ commit }, { zoomX }) {
      commit("SET_ZOOM_X", {
        zoomX,
      });
    },
  },

  SET_ZOOM_Y: {
    mutation(state, { zoomY }: { zoomY: number }) {
      state.sequencerZoomY = zoomY;
    },
    async action({ commit }, { zoomY }) {
      commit("SET_ZOOM_Y", {
        zoomY,
      });
    },
  },

  TICK_TO_SECOND: {
    getter: (state) => (position) => {
      return tickToSecond(position, state.tempos, state.tpqn);
    },
  },

  SECOND_TO_TICK: {
    getter: (state) => (time) => {
      return secondToTick(time, state.tempos, state.tpqn);
    },
  },

  GET_PLAYHEAD_POSITION: {
    getter: (state, getters) => () => {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
      }
      return playheadPosition.value;
    },
  },

  SET_PLAYHEAD_POSITION: {
    async action({ getters }, { position }: { position: number }) {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      playheadPosition.value = position;
      transport.time = getters.TICK_TO_SECOND(position);
    },
  },

  ADD_PLAYHEAD_POSITION_CHANGE_LISTENER: {
    async action(_, { listener }: { listener: (position: number) => void }) {
      playheadPosition.addValueChangeListener(listener);
    },
  },

  REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER: {
    async action(_, { listener }: { listener: (position: number) => void }) {
      playheadPosition.removeValueChangeListener(listener);
    },
  },

  SET_PLAYBACK_STATE: {
    mutation(state, { nowPlaying }) {
      state.nowPlaying = nowPlaying;
    },
  },

  SING_PLAY_AUDIO: {
    async action({ state, getters, commit }) {
      if (state.nowPlaying) {
        return;
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      commit("SET_PLAYBACK_STATE", { nowPlaying: true });

      transport.start();
      animationTimer.start(() => {
        playheadPosition.value = getters.GET_PLAYHEAD_POSITION();
      });
    },
  },

  SING_STOP_AUDIO: {
    async action({ state, getters, commit }) {
      if (!state.nowPlaying) {
        return;
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      commit("SET_PLAYBACK_STATE", { nowPlaying: false });

      transport.stop();
      animationTimer.stop();
      playheadPosition.value = getters.GET_PLAYHEAD_POSITION();
    },
  },

  SET_VOLUME: {
    mutation(state, { volume }) {
      state.volume = volume;
      if (!globalChannelStrip) {
        throw new Error("globalChannelStrip is undefined.");
      }
      globalChannelStrip.volume = volume;
    },
    async action({ commit }, { volume }) {
      commit("SET_VOLUME", { volume });
    },
  },

  PLAY_PREVIEW_SOUND: {
    async action(
      { state },
      { noteNumber, duration }: { noteNumber: number; duration?: number }
    ) {
      if (!audioContext) {
        throw new Error("audioContext is undefined.");
      }
      const previewSynth = trackNodes[state.selectedTrackIndex].previewSynth;
      previewSynth.noteOn("immediately", noteNumber, duration);
    },
  },

  STOP_PREVIEW_SOUND: {
    async action({ state }, { noteNumber }: { noteNumber: number }) {
      if (!audioContext) {
        throw new Error("audioContext is undefined.");
      }
      const previewSynth = trackNodes[state.selectedTrackIndex].previewSynth;
      previewSynth.noteOff("immediately", noteNumber);
    },
  },

  SET_IS_DRAG: {
    mutation(state, { isDrag }: { isDrag: boolean }) {
      state.isDrag = isDrag;
    },
    async action({ commit }, { isDrag }) {
      commit("SET_IS_DRAG", {
        isDrag,
      });
    },
  },

  SET_START_RENDERING_REQUESTED: {
    mutation(state, { startRenderingRequested }) {
      state.startRenderingRequested = startRenderingRequested;
    },
  },

  SET_STOP_RENDERING_REQUESTED: {
    mutation(state, { stopRenderingRequested }) {
      state.stopRenderingRequested = stopRenderingRequested;
    },
  },

  SET_NOW_RENDERING: {
    mutation(state, { nowRendering }) {
      state.nowRendering = nowRendering;
    },
  },

  /**
   * レンダリングを行う。レンダリング中だった場合は停止して再レンダリングする。
   */
  RENDER: {
    async action({ state, getters, commit, dispatch }) {
      const searchPhrases = async (
        singer: Singer | undefined,
        keyRangeAdjustment: number,
        volumeRangeAdjustment: number,
        tpqn: number,
        tempos: Tempo[],
        notes: Note[],
        trackIndex: number
      ) => {
        const foundPhrases = new Map<string, Phrase>();
        let phraseNotes: Note[] = [];
        for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
          const note = notes[noteIndex];

          phraseNotes.push(note);

          // ノートが途切れていたら別のフレーズにする
          const currentNoteEnd = note.position + note.duration;
          const nextNoteStart =
            noteIndex + 1 < notes.length ? notes[noteIndex + 1].position : null;
          if (
            noteIndex === notes.length - 1 ||
            nextNoteStart == null ||
            currentNoteEnd !== nextNoteStart
          ) {
            const phraseFirstNote = phraseNotes[0];
            const phraseLastNote = phraseNotes[phraseNotes.length - 1];
            const params = {
              singer,
              keyRangeAdjustment,
              volumeRangeAdjustment,
              tpqn,
              tempos,
              notes: phraseNotes,
              trackIndex,
            };
            const hash = await generatePhraseHash(params);
            foundPhrases.set(hash, {
              ...params,
              startTicks: phraseFirstNote.position,
              endTicks: phraseLastNote.position + phraseLastNote.duration,
              state: "WAITING_TO_BE_RENDERED",
            });

            phraseNotes = [];
          }
        }
        return foundPhrases;
      };

      const fetchQuery = async (
        engineId: EngineId,
        notes: Note[],
        tempos: Tempo[],
        tpqn: number,
        keyRangeAdjustment: number,
        frameRate: number,
        restDurationSeconds: number
      ) => {
        const restFrameLength = Math.round(restDurationSeconds * frameRate);
        const notesForRequestToEngine: NoteForRequestToEngine[] = [];

        // 先頭に休符を追加
        notesForRequestToEngine.push({
          key: undefined,
          frameLength: restFrameLength,
          lyric: "",
        });
        // ノートを変換
        const firstNoteOnTime = tickToSecond(notes[0].position, tempos, tpqn);
        let frame = 0;
        for (const note of notes) {
          const noteOffTime = tickToSecond(
            note.position + note.duration,
            tempos,
            tpqn
          );
          const noteOffFrame = Math.round(
            (noteOffTime - firstNoteOnTime) * frameRate
          );
          const noteFrameLength = Math.max(1, noteOffFrame - frame);
          // TODO: 助詞や拗音の扱いはあとで考える
          const lyric = note.lyric
            .replace("じょ", "ジョ")
            .replace("うぉ", "ウォ")
            .replace("は", "ハ")
            .replace("へ", "ヘ");
          // トランスポーズする
          const key = note.noteNumber - keyRangeAdjustment;
          notesForRequestToEngine.push({
            key,
            frameLength: noteFrameLength,
            lyric,
          });
          frame += noteFrameLength;
        }
        // 末尾に休符を追加
        notesForRequestToEngine.push({
          key: undefined,
          frameLength: restFrameLength,
          lyric: "",
        });

        try {
          if (!getters.IS_ENGINE_READY(engineId)) {
            throw new Error("Engine not ready.");
          }
          const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId,
          });
          return await instance.invoke(
            "singFrameAudioQuerySingFrameAudioQueryPost"
          )({
            score: { notes: notesForRequestToEngine },
            speaker: 6000, // TODO: 設定できるようにする
          });
        } catch (error) {
          const lyrics = notesForRequestToEngine
            .map((value) => value.lyric)
            .join("");
          window.backend.logError(
            error,
            `Failed to fetch FrameAudioQuery. Lyrics of score are "${lyrics}".`
          );
          throw error;
        }
      };

      const getPhonemes = (frameAudioQuery: FrameAudioQuery) => {
        return frameAudioQuery.phonemes.map((value) => value.phoneme).join(" ");
      };

      const shiftGuidePitch = (
        pitchShift: number,
        frameAudioQuery: FrameAudioQuery
      ) => {
        frameAudioQuery.f0 = frameAudioQuery.f0.map((value) => {
          return value * Math.pow(2, pitchShift / 12);
        });
      };

      const scaleGuideVolume = (
        volumeRangeAdjustment: number,
        frameAudioQuery: FrameAudioQuery
      ) => {
        frameAudioQuery.volume = frameAudioQuery.volume.map((value) => {
          return value * Math.pow(10, volumeRangeAdjustment / 20);
        });
      };

      const calcStartTime = (
        notes: Note[],
        tempos: Tempo[],
        tpqn: number,
        restDurationSeconds: number
      ) => {
        let startTime = tickToSecond(notes[0].position, tempos, tpqn);
        startTime -= restDurationSeconds;
        return startTime;
      };

      const synthesize = async (singer: Singer, query: FrameAudioQuery) => {
        if (!getters.IS_ENGINE_READY(singer.engineId)) {
          throw new Error("Engine not ready.");
        }

        try {
          const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId: singer.engineId,
          });
          return await instance.invoke("frameSynthesisFrameSynthesisPost")({
            frameAudioQuery: query,
            speaker: singer.styleId,
          });
        } catch (error) {
          const phonemes = query.phonemes
            .map((value) => value.phoneme)
            .join(" ");
          window.backend.logError(
            error,
            `Failed to synthesis. Phonemes are "${phonemes}".`
          );
          throw error;
        }
      };

      // NOTE: 型推論でawaitの前か後かが考慮されないので、関数を介して取得する（型がbooleanになるようにする）
      const startRenderingRequested = () => state.startRenderingRequested;
      const stopRenderingRequested = () => state.stopRenderingRequested;

      const render = async () => {
        if (!audioContext || !transport) {
          throw new Error("audioContext or transport is undefined.");
        }
        const audioContextRef = audioContext;
        const transportRef = transport;

        const allFoundPhrases = new Map<string, Phrase>();
        for (const [i, track] of state.tracks.entries()) {
          // レンダリング中に変更される可能性のあるデータをコピーする
          // 重なっているノートの削除も行う
          const tpqn = state.tpqn;
          const tempos = state.tempos.map((value) => ({ ...value }));
          const singer = track.singer ? { ...track.singer } : undefined;
          const keyRangeAdjustment = track.keyRangeAdjustment;
          const volumeRangeAdjustment = track.volumeRangeAdjustment;
          const notes = track.notes
            .map((value) => ({ ...value }))
            .filter((value) => !state.overlappingNoteIds.has(value.id));

          // フレーズを更新する
          const foundPhrases = await searchPhrases(
            singer,
            keyRangeAdjustment,
            volumeRangeAdjustment,
            tpqn,
            tempos,
            notes,
            i
          );
          for (const [hash, phrase] of foundPhrases) {
            const phraseKey = hash;
            allFoundPhrases.set(phraseKey, phrase);
            if (!state.phrases.has(phraseKey)) {
              commit("SET_PHRASE", { phraseKey, phrase });

              // フレーズ追加時の処理
              const noteEvents = generateNoteEvents(
                phrase.notes,
                phrase.tempos,
                phrase.tpqn
              );
              const polySynth = trackNodes[i].previewSynth;
              const noteSequence: NoteSequence = {
                type: "note",
                instrument: polySynth,
                noteEvents,
              };
              transportRef.addSequence(noteSequence);
              phraseDataMap.set(phraseKey, {
                source: polySynth,
                sequence: noteSequence,
              });
            }
          }
        }
        for (const key of state.phrases.keys()) {
          if (!allFoundPhrases.has(key)) {
            commit("DELETE_PHRASE", { phraseKey: key });

            // フレーズ削除時の処理
            const phraseData = phraseDataMap.get(key);
            if (!phraseData) {
              throw new Error("phraseData is undefined");
            }
            if (phraseData.sequence) {
              transportRef.removeSequence(phraseData.sequence);
            }
            phraseDataMap.delete(key);
          }
        }

        window.backend.logInfo("Phrases updated.");

        if (startRenderingRequested() || stopRenderingRequested()) {
          return;
        }

        const phrasesToBeRendered = new Map(
          [...state.phrases.entries()].filter(([, phrase]) => {
            return (
              (phrase.state === "WAITING_TO_BE_RENDERED" ||
                phrase.state === "COULD_NOT_RENDER") &&
              phrase.singer
            );
          })
        );
        // 各フレーズのレンダリングを行う
        while (
          !(startRenderingRequested() || stopRenderingRequested()) &&
          phrasesToBeRendered.size > 0
        ) {
          const [phraseKey, phrase] = selectPriorPhrase(
            phrasesToBeRendered,
            playheadPosition.value
          );
          if (!phrase.singer) {
            throw new Error("assert: phrase.singer != undefined");
          }
          phrasesToBeRendered.delete(phraseKey);

          if (
            phrase.state === "WAITING_TO_BE_RENDERED" ||
            phrase.state === "COULD_NOT_RENDER"
          ) {
            commit("SET_STATE_TO_PHRASE", {
              phraseKey,
              phraseState: "NOW_RENDERING",
            });
          }

          // 推論（クエリのフェッチ）、キーシフト、フレーズの開始時刻の計算を行う

          if (!phrase.query) {
            const engineId = phrase.singer.engineId;
            const frameRate = state.engineManifests[engineId].frameRate;
            const restDurationSeconds = 1; // 前後の休符の長さはとりあえず1秒に設定

            const frameAudioQuery = await fetchQuery(
              phrase.singer.engineId,
              phrase.notes,
              phrase.tempos,
              phrase.tpqn,
              phrase.keyRangeAdjustment,
              frameRate,
              restDurationSeconds
            ).catch((error) => {
              commit("SET_STATE_TO_PHRASE", {
                phraseKey,
                phraseState: "COULD_NOT_RENDER",
              });
              throw error;
            });

            const phonemes = getPhonemes(frameAudioQuery);
            window.backend.logInfo(
              `Fetched frame audio query. Phonemes are "${phonemes}".`
            );

            shiftGuidePitch(phrase.keyRangeAdjustment, frameAudioQuery);
            scaleGuideVolume(phrase.volumeRangeAdjustment, frameAudioQuery);

            const startTime = calcStartTime(
              phrase.notes,
              phrase.tempos,
              phrase.tpqn,
              restDurationSeconds
            );

            commit("SET_FRAME_AUDIO_QUERY_TO_PHRASE", {
              phraseKey,
              frameAudioQuery,
            });
            commit("SET_START_TIME_TO_PHRASE", { phraseKey, startTime });
          }

          if (startRenderingRequested() || stopRenderingRequested()) {
            if (phrase.state === "NOW_RENDERING") {
              commit("SET_STATE_TO_PHRASE", {
                phraseKey,
                phraseState: "WAITING_TO_BE_RENDERED",
              });
            }
            return;
          }

          // 音声合成を行って、音声を再生できるようにする

          const phraseData = phraseDataMap.get(phraseKey);
          if (!phraseData) {
            throw new Error("phraseData is undefined");
          }
          if (!phrase.query) {
            throw new Error("query is undefined.");
          }
          if (phrase.startTime == undefined) {
            throw new Error("startTime is undefined.");
          }
          if (!phraseData.blob) {
            phraseData.blob = phraseAudioBlobCache.get(phraseKey);
            if (phraseData.blob) {
              window.backend.logInfo(`Loaded audio buffer from cache.`);
            } else {
              const blob = await synthesize(phrase.singer, phrase.query).catch(
                (error) => {
                  commit("SET_STATE_TO_PHRASE", {
                    phraseKey,
                    phraseState: "COULD_NOT_RENDER",
                  });
                  throw error;
                }
              );

              phraseData.blob = blob;
              phraseAudioBlobCache.set(phraseKey, phraseData.blob);

              window.backend.logInfo(`Synthesized.`);
            }

            // 音源とシーケンスを作成し直して、再接続する
            if (phraseData.sequence) {
              transportRef.removeSequence(phraseData.sequence);
            }
            const audioPlayer = new AudioPlayer(audioContextRef);
            const audioEvents = await generateAudioEvents(
              audioContextRef,
              phrase.startTime,
              phraseData.blob
            );
            const audioSequence: AudioSequence = {
              type: "audio",
              audioPlayer,
              audioEvents,
            };
            audioPlayer.output.connect(
              trackNodes[phrase.trackIndex].channelStrip.input
            );
            transportRef.addSequence(audioSequence);
            phraseData.source = audioPlayer;
            phraseData.sequence = audioSequence;
          }

          if (phrase.state === "NOW_RENDERING") {
            commit("SET_STATE_TO_PHRASE", {
              phraseKey,
              phraseState: "PLAYABLE",
            });
          }
        }
      };

      commit("SET_START_RENDERING_REQUESTED", {
        startRenderingRequested: true,
      });
      if (state.nowRendering) {
        return;
      }

      commit("SET_NOW_RENDERING", { nowRendering: true });
      try {
        while (startRenderingRequested()) {
          commit("SET_START_RENDERING_REQUESTED", {
            startRenderingRequested: false,
          });
          await render();
          if (stopRenderingRequested()) {
            break;
          }
        }
      } catch (e) {
        window.backend.logError(e);
        throw e;
      } finally {
        commit("SET_STOP_RENDERING_REQUESTED", {
          stopRenderingRequested: false,
        });
        commit("SET_NOW_RENDERING", { nowRendering: false });
      }
    },
  },

  /**
   * レンダリング停止をリクエストし、停止するまで待機する。
   */
  STOP_RENDERING: {
    action: createUILockAction(async ({ state, commit }) => {
      if (state.nowRendering) {
        window.backend.logInfo("Waiting for rendering to stop...");
        commit("SET_STOP_RENDERING_REQUESTED", {
          stopRenderingRequested: true,
        });
        await createPromiseThatResolvesWhen(() => !state.nowRendering);
        window.backend.logInfo("Rendering stopped.");
      }
    }),
  },

  IMPORT_MIDI_FILE: {
    action: createUILockAction(
      async (
        { dispatch },
        { filePath, trackIndex = 0 }: { filePath: string; trackIndex: number }
      ) => {
        const convertPosition = (
          position: number,
          sourceTpqn: number,
          targetTpqn: number
        ) => {
          return Math.round(position * (targetTpqn / sourceTpqn));
        };

        const convertDuration = (
          startPosition: number,
          endPosition: number,
          sourceTpqn: number,
          targetTpqn: number
        ) => {
          const convertedEndPosition = convertPosition(
            endPosition,
            sourceTpqn,
            targetTpqn
          );
          const convertedStartPosition = convertPosition(
            startPosition,
            sourceTpqn,
            targetTpqn
          );
          return Math.max(1, convertedEndPosition - convertedStartPosition);
        };

        const getTopNotes = (notes: Note[]) => {
          const topNotes: Note[] = [];
          for (const note of notes) {
            if (topNotes.length === 0) {
              topNotes.push(note);
              continue;
            }
            const topNote = topNotes[topNotes.length - 1];
            const topNoteEndPos = topNote.position + topNote.duration;
            if (topNoteEndPos <= note.position) {
              topNotes.push(note);
              continue;
            }
            if (topNote.noteNumber < note.noteNumber) {
              topNotes.pop();
              topNotes.push(note);
            }
          }
          return topNotes;
        };

        const removeDuplicateTempos = (tempos: Tempo[]) => {
          return tempos.filter((value, index, array) => {
            return (
              index === array.length - 1 ||
              value.position !== array[index + 1].position
            );
          });
        };

        const removeDuplicateTimeSignatures = (
          timeSignatures: TimeSignature[]
        ) => {
          return timeSignatures.filter((value, index, array) => {
            return (
              index === array.length - 1 ||
              value.measureNumber !== array[index + 1].measureNumber
            );
          });
        };

        // NOTE: トラック選択のために一度ファイルを読み込んでいるので、Midiを渡すなどでもよさそう
        const midiData = getValueOrThrow(
          await window.backend.readFile({ filePath })
        );
        const midi = new Midi(midiData);
        const midiTpqn = midi.header.ppq;
        const midiTempos = [...midi.header.tempos];
        const midiTimeSignatures = [...midi.header.timeSignatures];

        const midiNotes = [...midi.tracks[trackIndex].notes];

        midiTempos.sort((a, b) => a.ticks - b.ticks);
        midiTimeSignatures.sort((a, b) => a.ticks - b.ticks);
        midiNotes.sort((a, b) => a.ticks - b.ticks);

        const tpqn = DEFAULT_TPQN;

        let notes = midiNotes.map((value): Note => {
          return {
            id: uuidv4(),
            position: convertPosition(value.ticks, midiTpqn, tpqn),
            duration: convertDuration(
              value.ticks,
              value.ticks + value.durationTicks,
              midiTpqn,
              tpqn
            ),
            noteNumber: value.midi,
            lyric: getDoremiFromNoteNumber(value.midi),
          };
        });
        // ノートの重なりを考慮して、一番音が高いノート（トップノート）のみインポートする
        notes = getTopNotes(notes);

        let tempos = midiTempos.map((value): Tempo => {
          return {
            position: convertPosition(value.ticks, midiTpqn, tpqn),
            bpm: round(value.bpm, 2),
          };
        });
        tempos.unshift({
          position: 0,
          bpm: DEFAULT_BPM,
        });
        tempos = removeDuplicateTempos(tempos);

        let timeSignatures: TimeSignature[] = [];
        let tsPosition = 0;
        let measureNumber = 1;
        for (let i = 0; i < midiTimeSignatures.length; i++) {
          const midiTs = midiTimeSignatures[i];
          const beats = midiTs.timeSignature[0];
          const beatType = midiTs.timeSignature[1];
          timeSignatures.push({ measureNumber, beats, beatType });
          if (i < midiTimeSignatures.length - 1) {
            const nextTsTicks = midiTimeSignatures[i + 1].ticks;
            const nextTsPos = convertPosition(nextTsTicks, midiTpqn, tpqn);
            const tsDuration = nextTsPos - tsPosition;
            const measureDuration = getMeasureDuration(beats, beatType, tpqn);
            tsPosition = nextTsPos;
            measureNumber += tsDuration / measureDuration;
          }
        }
        timeSignatures.unshift({
          measureNumber: 1,
          beats: DEFAULT_BEATS,
          beatType: DEFAULT_BEAT_TYPE,
        });
        timeSignatures = removeDuplicateTimeSignatures(timeSignatures);

        tempos.splice(1, tempos.length - 1); // TODO: 複数テンポに対応したら削除
        timeSignatures.splice(1, timeSignatures.length - 1); // TODO: 複数拍子に対応したら削除

        await dispatch("SET_SCORE", {
          score: {
            tpqn,
            tempos,
            timeSignatures,
            notes: [notes],
          },
        });
      }
    ),
  },

  IMPORT_MUSICXML_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        if (!filePath) {
          filePath = await window.backend.showImportFileDialog({
            title: "MusicXML読み込み",
            name: "MusicXML",
            extensions: ["musicxml", "xml"],
          });
          if (!filePath) return;
        }

        let xmlStr = new TextDecoder("utf-8").decode(
          getValueOrThrow(await window.backend.readFile({ filePath }))
        );
        if (xmlStr.indexOf("\ufffd") > -1) {
          xmlStr = new TextDecoder("shift-jis").decode(
            getValueOrThrow(await window.backend.readFile({ filePath }))
          );
        }

        const tpqn = DEFAULT_TPQN;
        const tempos: Tempo[] = [
          {
            position: 0,
            bpm: DEFAULT_BPM,
          },
        ];
        const timeSignatures: TimeSignature[] = [
          {
            measureNumber: 1,
            beats: DEFAULT_BEATS,
            beatType: DEFAULT_BEAT_TYPE,
          },
        ];
        const notes: Note[] = [];

        let divisions = 1;
        let position = 0;
        let measureNumber = 1;
        let measurePosition = 0;
        let measureDuration = getMeasureDuration(
          timeSignatures[0].beats,
          timeSignatures[0].beatType,
          tpqn
        );
        let tieStartNote: Note | undefined;

        const getChild = (element: Element | undefined, tagName: string) => {
          if (element) {
            for (const childElement of element.children) {
              if (childElement.tagName === tagName) {
                return childElement;
              }
            }
          }
          return undefined;
        };

        const getValueAsNumber = (element: Element) => {
          const value = Number(element.textContent);
          if (Number.isNaN(value)) {
            throw new Error("The value is invalid.");
          }
          return value;
        };

        const getAttributeAsNumber = (
          element: Element,
          qualifiedName: string
        ) => {
          const value = Number(element.getAttribute(qualifiedName));
          if (Number.isNaN(value)) {
            throw new Error("The value is invalid.");
          }
          return value;
        };

        const getStepNumber = (stepElement: Element) => {
          const stepNumberDict: { [key: string]: number } = {
            C: 0,
            D: 2,
            E: 4,
            F: 5,
            G: 7,
            A: 9,
            B: 11,
          };
          const stepChar = stepElement.textContent;
          if (stepChar == null) {
            throw new Error("The value is invalid.");
          }
          return stepNumberDict[stepChar];
        };

        const getDuration = (durationElement: Element) => {
          const duration = getValueAsNumber(durationElement);
          return Math.round((tpqn * duration) / divisions);
        };

        const getTie = (elementThatMayBeTied: Element) => {
          let tie: boolean | undefined;
          for (const childElement of elementThatMayBeTied.children) {
            if (
              childElement.tagName === "tie" ||
              childElement.tagName === "tied"
            ) {
              const tieType = childElement.getAttribute("type");
              if (tieType === "start") {
                tie = true;
              } else if (tieType === "stop") {
                tie = false;
              } else {
                throw new Error("The value is invalid.");
              }
            }
          }
          return tie;
        };

        const parseSound = (soundElement: Element) => {
          if (!soundElement.hasAttribute("tempo")) {
            return;
          }
          if (tempos.length !== 0) {
            const lastTempo = tempos[tempos.length - 1];
            if (lastTempo.position === position) {
              tempos.pop();
            }
          }
          const tempo = getAttributeAsNumber(soundElement, "tempo");
          tempos.push({
            position: position,
            bpm: round(tempo, 2),
          });
        };

        const parseDirection = (directionElement: Element) => {
          for (const childElement of directionElement.children) {
            if (childElement.tagName === "sound") {
              parseSound(childElement);
            }
          }
        };

        const parseDivisions = (divisionsElement: Element) => {
          divisions = getValueAsNumber(divisionsElement);
        };

        const parseTime = (timeElement: Element) => {
          const beatsElement = getChild(timeElement, "beats");
          if (!beatsElement) {
            throw new Error("beats element does not exist.");
          }
          const beatTypeElement = getChild(timeElement, "beat-type");
          if (!beatTypeElement) {
            throw new Error("beat-type element does not exist.");
          }
          const beats = getValueAsNumber(beatsElement);
          const beatType = getValueAsNumber(beatTypeElement);
          measureDuration = getMeasureDuration(beats, beatType, tpqn);
          if (timeSignatures.length !== 0) {
            const lastTimeSignature = timeSignatures[timeSignatures.length - 1];
            if (lastTimeSignature.measureNumber === measureNumber) {
              timeSignatures.pop();
            }
          }
          timeSignatures.push({
            measureNumber,
            beats,
            beatType,
          });
        };

        const parseAttributes = (attributesElement: Element) => {
          for (const childElement of attributesElement.children) {
            if (childElement.tagName === "divisions") {
              parseDivisions(childElement);
            } else if (childElement.tagName === "time") {
              parseTime(childElement);
            } else if (childElement.tagName === "sound") {
              parseSound(childElement);
            }
          }
        };

        const parseNote = (noteElement: Element) => {
          // TODO: ノートの重なり・和音を考慮していないので、
          //       それらが存在する場合でも読み込めるようにする

          const durationElement = getChild(noteElement, "duration");
          if (!durationElement) {
            throw new Error("duration element does not exist.");
          }
          let duration = getDuration(durationElement);
          let noteEnd = position + duration;
          const measureEnd = measurePosition + measureDuration;
          if (noteEnd > measureEnd) {
            // 小節に収まらない場合、ノートの長さを変えて小節に収まるようにする
            duration = measureEnd - position;
            noteEnd = position + duration;
          }

          if (getChild(noteElement, "rest")) {
            position += duration;
            return;
          }

          const pitchElement = getChild(noteElement, "pitch");
          if (!pitchElement) {
            throw new Error("pitch element does not exist.");
          }
          const octaveElement = getChild(pitchElement, "octave");
          if (!octaveElement) {
            throw new Error("octave element does not exist.");
          }
          const stepElement = getChild(pitchElement, "step");
          if (!stepElement) {
            throw new Error("step element does not exist.");
          }
          const alterElement = getChild(pitchElement, "alter");

          const octave = getValueAsNumber(octaveElement);
          const stepNumber = getStepNumber(stepElement);
          let noteNumber = 12 * (octave + 1) + stepNumber;
          if (alterElement) {
            noteNumber += getValueAsNumber(alterElement);
          }

          const lyricElement = getChild(noteElement, "lyric");
          const lyric = getChild(lyricElement, "text")?.textContent ?? "";

          let tie = getTie(noteElement);
          for (const childElement of noteElement.children) {
            if (childElement.tagName === "notations") {
              tie = getTie(childElement);
            }
          }

          const note: Note = {
            id: uuidv4(),
            position,
            duration,
            noteNumber,
            lyric,
          };

          if (tieStartNote) {
            if (tie === false) {
              tieStartNote.duration = noteEnd - tieStartNote.position;
              notes.push(tieStartNote);
              tieStartNote = undefined;
            }
          } else {
            if (tie === true) {
              tieStartNote = note;
            } else {
              notes.push(note);
            }
          }
          position += duration;
        };

        const parseMeasure = (measureElement: Element) => {
          measurePosition = position;
          measureNumber = getAttributeAsNumber(measureElement, "number");
          for (const childElement of measureElement.children) {
            if (childElement.tagName === "direction") {
              parseDirection(childElement);
            } else if (childElement.tagName === "sound") {
              parseSound(childElement);
            } else if (childElement.tagName === "attributes") {
              parseAttributes(childElement);
            } else if (childElement.tagName === "note") {
              if (position < measurePosition + measureDuration) {
                parseNote(childElement);
              }
            }
          }
          const measureEnd = measurePosition + measureDuration;
          if (position !== measureEnd) {
            tieStartNote = undefined;
            position = measureEnd;
          }
        };

        const parsePart = (partElement: Element) => {
          for (const childElement of partElement.children) {
            if (childElement.tagName === "measure") {
              parseMeasure(childElement);
            }
          }
        };

        const parseMusicXml = (xmlStr: string) => {
          const parser = new DOMParser();
          const dom = parser.parseFromString(xmlStr, "application/xml");
          const partElements = dom.getElementsByTagName("part");
          if (partElements.length === 0) {
            throw new Error("part element does not exist.");
          }
          // TODO: UIで読み込むパートを選択できるようにする
          parsePart(partElements[0]);
        };

        parseMusicXml(xmlStr);

        tempos.splice(1, tempos.length - 1); // TODO: 複数テンポに対応したら削除
        timeSignatures.splice(1, timeSignatures.length - 1); // TODO: 複数拍子に対応したら削除

        await dispatch("SET_SCORE", {
          score: {
            tpqn,
            tempos,
            timeSignatures,
            notes: [notes],
          },
        });
      }
    ),
  },

  IMPORT_UST_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        // USTファイルの読み込み
        if (!filePath) {
          filePath = await window.backend.showImportFileDialog({
            title: "UST読み込み",
            name: "UST",
            extensions: ["ust"],
          });
          if (!filePath) return;
        }
        // ファイルの読み込み
        const fileData = getValueOrThrow(
          await window.backend.readFile({ filePath })
        );

        // ファイルフォーマットに応じてエンコーディングを変える
        // UTF-8とShiftJISの2種類に対応
        let ustData;
        try {
          ustData = new TextDecoder("utf-8").decode(fileData);
          // ShiftJISの場合はShiftJISでデコードし直す
          if (ustData.includes("\ufffd")) {
            ustData = new TextDecoder("shift-jis").decode(fileData);
          }
        } catch (error) {
          throw new Error("Failed to decode UST file.", { cause: error });
        }
        if (!ustData || typeof ustData !== "string") {
          throw new Error("Failed to decode UST file.");
        }

        // 初期化
        const tpqn = DEFAULT_TPQN;
        const tempos: Tempo[] = [
          {
            position: 0,
            bpm: DEFAULT_BPM,
          },
        ];
        const timeSignatures: TimeSignature[] = [
          {
            measureNumber: 1,
            beats: DEFAULT_BEATS,
            beatType: DEFAULT_BEAT_TYPE,
          },
        ];
        const notes: Note[] = [];

        // USTファイルのセクションをパース
        const parseSection = (section: string): { [key: string]: string } => {
          const sectionNameMatch = section.match(/\[(.+)\]/);
          if (!sectionNameMatch) {
            throw new Error("UST section name not found");
          }
          const params = section.split(/[\r\n]+/).reduce((acc, line) => {
            const [key, value] = line.split("=");
            if (key && value) {
              acc[key] = value;
            }
            return acc;
          }, {} as { [key: string]: string });
          return {
            ...params,
            sectionName: sectionNameMatch[1],
          };
        };

        // セクションを分割
        const sections = ustData.split(/^(?=\[)/m);
        // ポジション
        let position = 0;
        // セクションごとに処理
        sections.forEach((section) => {
          const params = parseSection(section);
          // SETTINGセクション
          if (params.sectionName === "#SETTING") {
            const tempo = Number(params["Tempo"]);
            if (tempo) tempos[0].bpm = tempo;
          }
          // ノートセクション
          // #以降に数字の場合はノートセクション ex: #0, #0000
          if (params.sectionName.match(/^#\d+$/)) {
            // テンポ変更があれば追加
            const tempo = Number(params["Tempo"]);
            if (tempo) tempos.push({ position, bpm: tempo });
            const noteNumber = Number(params["NoteNum"]);
            const duration = Number(params["Length"]);
            // 歌詞の前に連続音が含まれている場合は除去
            const lyric = params["Lyric"].includes(" ")
              ? params["Lyric"].split(" ")[1]
              : params["Lyric"];
            // 休符であればポジションを進めるのみ
            if (lyric === "R") {
              position += duration;
            } else {
              // それ以外の場合はノートを追加
              notes.push({
                id: uuidv4(),
                position,
                duration,
                noteNumber,
                lyric,
              });
              position += duration;
            }
          }
        });

        await dispatch("SET_SCORE", {
          score: {
            tpqn,
            tempos,
            timeSignatures,
            notes: [notes],
          },
        });
      }
    ),
  },

  SET_NOW_AUDIO_EXPORTING: {
    mutation(state, { nowAudioExporting }) {
      state.nowAudioExporting = nowAudioExporting;
    },
  },

  SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED: {
    mutation(state, { cancellationOfAudioExportRequested }) {
      state.cancellationOfAudioExportRequested =
        cancellationOfAudioExportRequested;
    },
  },

  EXPORT_WAVE_FILE: {
    action: createUILockAction(
      async ({ state, getters, commit, dispatch }, { filePath }) => {
        const convertToWavFileData = (audioBuffer: AudioBuffer) => {
          const bytesPerSample = 4; // Float32
          const formatCode = 3; // WAVE_FORMAT_IEEE_FLOAT

          const numberOfChannels = audioBuffer.numberOfChannels;
          const numberOfSamples = audioBuffer.length;
          const sampleRate = audioBuffer.sampleRate;
          const byteRate = sampleRate * numberOfChannels * bytesPerSample;
          const blockSize = numberOfChannels * bytesPerSample;
          const dataSize = numberOfSamples * numberOfChannels * bytesPerSample;

          const buffer = new ArrayBuffer(44 + dataSize);
          const dataView = new DataView(buffer);

          let pos = 0;
          const writeString = (value: string) => {
            for (let i = 0; i < value.length; i++) {
              dataView.setUint8(pos, value.charCodeAt(i));
              pos += 1;
            }
          };
          const writeUint32 = (value: number) => {
            dataView.setUint32(pos, value, true);
            pos += 4;
          };
          const writeUint16 = (value: number) => {
            dataView.setUint16(pos, value, true);
            pos += 2;
          };
          const writeSample = (offset: number, value: number) => {
            dataView.setFloat32(pos + offset * 4, value, true);
          };

          writeString("RIFF");
          writeUint32(36 + dataSize); // RIFFチャンクサイズ
          writeString("WAVE");
          writeString("fmt ");
          writeUint32(16); // fmtチャンクサイズ
          writeUint16(formatCode);
          writeUint16(numberOfChannels);
          writeUint32(sampleRate);
          writeUint32(byteRate);
          writeUint16(blockSize);
          writeUint16(bytesPerSample * 8); // 1サンプルあたりのビット数
          writeString("data");
          writeUint32(dataSize);

          for (let i = 0; i < numberOfChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            for (let j = 0; j < numberOfSamples; j++) {
              writeSample(j * numberOfChannels + i, channelData[j]);
            }
          }

          return buffer;
        };

        const generateWriteErrorMessage = (writeFileResult: ResultError) => {
          if (writeFileResult.code) {
            const code = writeFileResult.code.toUpperCase();

            if (code.startsWith("ENOSPC")) {
              return "空き容量が足りません。";
            }

            if (code.startsWith("EACCES")) {
              return "ファイルにアクセスする許可がありません。";
            }

            if (code.startsWith("EBUSY")) {
              return "ファイルが開かれています。";
            }
          }

          return `何らかの理由で失敗しました。${writeFileResult.message}`;
        };

        const calcRenderDuration = () => {
          const lastNoteEndTimes = state.tracks.map((track) => {
            const notes = track.notes;
            if (notes.length === 0) {
              return 1;
            }
            const lastNote = notes[notes.length - 1];
            const lastNoteEndPosition = lastNote.position + lastNote.duration;
            const lastNoteEndTime = getters.TICK_TO_SECOND(lastNoteEndPosition);

            return lastNoteEndTime;
          });
          return Math.max(1, Math.max(...lastNoteEndTimes) + 1);
        };

        const generateDefaultSongFileName = () => {
          const projectName = getters.PROJECT_NAME;
          if (projectName) {
            return projectName.split(".")[0] + ".wav";
          }

          const singer = getters.SELECTED_TRACK.singer;
          if (singer) {
            const singerName = getters.CHARACTER_INFO(
              singer.engineId,
              singer.styleId
            )?.metas.speakerName;
            if (singerName) {
              const notes = getters.SELECTED_TRACK.notes.slice(0, 5);
              const beginningPartLyrics = notes
                .map((note) => note.lyric)
                .join("");
              return sanitizeFileName(
                `${singerName}_${beginningPartLyrics}.wav`
              );
            }
          }

          return "Untitled.wav";
        };

        const exportWaveFile = async (): Promise<SaveResultObject> => {
          const fileName = generateDefaultSongFileName();
          const numberOfChannels = 2;
          const sampleRate = 48000; // TODO: 設定できるようにする
          const withLimiter = false; // TODO: 設定できるようにする

          const renderDuration = calcRenderDuration();

          if (state.nowPlaying) {
            await dispatch("SING_STOP_AUDIO");
          }

          if (state.savingSetting.fixedExportEnabled) {
            filePath = path.join(state.savingSetting.fixedExportDir, fileName);
          } else {
            filePath ??= await window.backend.showAudioSaveDialog({
              title: "音声を保存",
              defaultPath: fileName,
            });
          }
          if (!filePath) {
            return { result: "CANCELED", path: "" };
          }

          if (state.savingSetting.avoidOverwrite) {
            let tail = 1;
            const name = filePath.slice(0, filePath.length - 4);
            while (await window.backend.checkFileExists(filePath)) {
              filePath = name + "[" + tail.toString() + "]" + ".wav";
              tail += 1;
            }
          }

          if (state.nowRendering) {
            await createPromiseThatResolvesWhen(() => {
              return (
                !state.nowRendering || state.cancellationOfAudioExportRequested
              );
            });
            if (state.cancellationOfAudioExportRequested) {
              return { result: "CANCELED", path: "" };
            }
          }

          const offlineAudioContext = new OfflineAudioContext(
            numberOfChannels,
            sampleRate * renderDuration,
            sampleRate
          );
          const offlineTransport = new OfflineTransport();
          const globalChannelStrip = new ChannelStrip(offlineAudioContext);
          const limiter = withLimiter
            ? new Limiter(offlineAudioContext)
            : undefined;
          const clipper = new Clipper(offlineAudioContext);
          const tracksShouldPlay = shouldPlay(state.tracks);
          const trackNodes = state.tracks.map((track, i) => {
            const trackNode = new TrackNode(offlineAudioContext);
            trackNode.channelStrip.volume = track.volume;
            trackNode.channelStrip.pan = track.pan;
            trackNode.setMute(!tracksShouldPlay[i]);
            trackNode.output.connect(globalChannelStrip.input);

            return trackNode;
          });

          for (const [phraseKey, phrase] of state.phrases) {
            const phraseData = phraseDataMap.get(phraseKey);
            if (!phraseData) {
              throw new Error("phraseData is undefined");
            }
            if (
              !phraseData.blob ||
              phrase.startTime == undefined ||
              phrase.state !== "PLAYABLE"
            ) {
              continue;
            }
            // TODO: この辺りの処理を共通化する
            const audioEvents = await generateAudioEvents(
              offlineAudioContext,
              phrase.startTime,
              phraseData.blob
            );
            const audioPlayer = new AudioPlayer(offlineAudioContext);
            audioPlayer.output.connect(
              trackNodes[phrase.trackIndex].channelStrip.input
            );
            const audioSequence: AudioSequence = {
              type: "audio",
              audioPlayer,
              audioEvents,
            };
            offlineTransport.addSequence(audioSequence);
          }
          globalChannelStrip.volume = 1;
          if (limiter) {
            globalChannelStrip.output.connect(limiter.input);
            limiter.output.connect(clipper.input);
          } else {
            globalChannelStrip.output.connect(clipper.input);
          }
          clipper.output.connect(offlineAudioContext.destination);

          // スケジューリングを行い、オフラインレンダリングを実行
          // TODO: オフラインレンダリング後にメモリーがきちんと開放されるか確認する
          offlineTransport.schedule(0, renderDuration);
          const audioBuffer = await offlineAudioContext.startRendering();
          const waveFileData = convertToWavFileData(audioBuffer);

          try {
            await window.backend
              .writeFile({
                filePath,
                buffer: waveFileData,
              })
              .then(getValueOrThrow);
          } catch (e) {
            window.backend.logError(e);
            if (e instanceof ResultError) {
              return {
                result: "WRITE_ERROR",
                path: filePath,
                errorMessage: generateWriteErrorMessage(e),
              };
            }
            return {
              result: "UNKNOWN_ERROR",
              path: filePath,
              errorMessage:
                (e instanceof Error ? e.message : String(e)) ||
                "不明なエラーが発生しました。",
            };
          }

          return { result: "SUCCESS", path: filePath };
        };

        commit("SET_NOW_AUDIO_EXPORTING", { nowAudioExporting: true });
        return exportWaveFile().finally(() => {
          commit("SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED", {
            cancellationOfAudioExportRequested: false,
          });
          commit("SET_NOW_AUDIO_EXPORTING", { nowAudioExporting: false });
        });
      }
    ),
  },

  CANCEL_AUDIO_EXPORT: {
    async action({ state, commit, dispatch }) {
      if (!state.nowAudioExporting) {
        dispatch("LOG_WARN", "CANCEL_AUDIO_EXPORT on !nowAudioExporting");
        return;
      }
      commit("SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED", {
        cancellationOfAudioExportRequested: true,
      });
    },
  },

  COPY_NOTES_TO_CLIPBOARD: {
    async action({ state, getters }) {
      const currentTrack = getters.SELECTED_TRACK;
      const noteIds = state.selectedNoteIds;
      // ノートが選択されていない場合は何もしない
      if (noteIds.size === 0) {
        return;
      }
      // 選択されたノートのみをコピーする
      const selectedNotes = currentTrack.notes
        .filter((note: Note) => noteIds.has(note.id))
        .map((note: Note) => {
          // idのみコピーしない
          const { id, ...noteWithoutId } = note;
          return noteWithoutId;
        });
      // ノートをJSONにシリアライズしてクリップボードにコピーする
      const serializedNotes = JSON.stringify(selectedNotes);
      // クリップボードにテキストとしてコピーする
      // NOTE: Electronのclipboardも使用する必要ある？
      await navigator.clipboard.writeText(serializedNotes);
      window.backend.logInfo("Copied to clipboard.", serializedNotes);
    },
  },

  COMMAND_CUT_NOTES_TO_CLIPBOARD: {
    async action({ dispatch }) {
      await dispatch("COPY_NOTES_TO_CLIPBOARD");
      await dispatch("COMMAND_REMOVE_SELECTED_NOTES");
    },
  },

  COMMAND_PASTE_NOTES_FROM_CLIPBOARD: {
    async action({ commit, state, getters, dispatch }) {
      // クリップボードからテキストを読み込む
      let clipboardText;
      try {
        clipboardText = await navigator.clipboard.readText();
      } catch (error) {
        throw new Error("Failed to read the clipboard text.", {
          cause: error,
        });
      }

      // クリップボードのテキストをJSONとしてパースする(失敗した場合はエラーを返す)
      let notes;
      try {
        notes = noteSchema
          .omit({ id: true })
          .array()
          .parse(JSON.parse(clipboardText));
      } catch (error) {
        throw new Error("Failed to parse the clipboard text as JSON.", {
          cause: error,
        });
      }

      // パースしたJSONのノートの位置を現在の再生位置に合わせてクオンタイズして貼り付ける
      const currentPlayheadPosition = getters.GET_PLAYHEAD_POSITION();
      const firstNotePosition = notes[0].position;
      // TODO: クオンタイズの処理を共通化する
      const snapType = state.sequencerSnapType;
      const tpqn = state.tpqn;
      const snapTicks = getNoteDuration(snapType, tpqn);
      const notesToPaste: Note[] = notes.map((note) => {
        // 新しい位置を現在の再生位置に合わせて計算する
        const pasteOriginPos =
          Number(note.position) - firstNotePosition + currentPlayheadPosition;
        // クオンタイズ
        const quantizedPastePos =
          Math.round(pasteOriginPos / snapTicks) * snapTicks;
        return {
          id: uuidv4(),
          position: quantizedPastePos,
          duration: Number(note.duration),
          noteNumber: Number(note.noteNumber),
          lyric: String(note.lyric),
        };
      });
      const pastedNoteIds = notesToPaste.map((note) => note.id);
      // ノートを追加してレンダリングする
      commit("COMMAND_ADD_NOTES", { notes: notesToPaste });
      dispatch("RENDER");
      // 貼り付けたノートを選択する
      commit("DESELECT_ALL_NOTES");
      commit("SELECT_NOTES", { noteIds: pastedNoteIds });
    },
  },

  COMMAND_QUANTIZE_SELECTED_NOTES: {
    action({ state, commit, getters, dispatch }) {
      const currentTrack = getters.SELECTED_TRACK;
      const selectedNotes = currentTrack.notes.filter((note: Note) => {
        return state.selectedNoteIds.has(note.id);
      });
      // TODO: クオンタイズの処理を共通化する
      const snapType = state.sequencerSnapType;
      const tpqn = state.tpqn;
      const snapTicks = getNoteDuration(snapType, tpqn);
      const quantizedNotes = selectedNotes.map((note: Note) => {
        const quantizedPosition =
          Math.round(note.position / snapTicks) * snapTicks;
        return { ...note, position: quantizedPosition };
      });
      commit("COMMAND_UPDATE_NOTES", { notes: quantizedNotes });
      dispatch("RENDER");
    },
  },

  CREATE_TRACK: {
    mutation(state, { singer }) {
      const track: Track = {
        ...createInitialTrack(),
        singer,
      };
      state.tracks.push(track);
      state.overlappingNoteInfos.push(new Map());
      if (trackNodes.length < state.tracks.length) {
        if (!audioContext || !globalChannelStrip) {
          throw new Error("audioContext or globalChannelStrip is undefined.");
        }
        const node = new TrackNode(audioContext);
        node.output.connect(globalChannelStrip.input);

        trackNodes.push(node);
      }
      trackNodes[state.tracks.length - 1].channelStrip.volume = track.volume;
      trackNodes[state.tracks.length - 1].channelStrip.pan = track.pan;
    },
  },

  SET_TRACK_PAN: {
    mutation(state, { trackIndex, pan }) {
      state.tracks[trackIndex].pan = pan;
      trackNodes[trackIndex].channelStrip.pan = pan;
    },
    action({ commit }, { trackIndex, pan }) {
      commit("SET_TRACK_PAN", { trackIndex, pan });
    },
  },

  SET_TRACK_VOLUME: {
    mutation(state, { trackIndex, volume }) {
      state.tracks[trackIndex].volume = volume;
      trackNodes[trackIndex].channelStrip.volume = volume;
    },
    action({ commit }, { trackIndex, volume }) {
      commit("SET_TRACK_VOLUME", { trackIndex, volume });
    },
  },

  SET_TRACK_MUTE: {
    mutation(state, { trackIndex, mute }) {
      state.tracks[trackIndex].mute = mute;
      updateTrackMute(shouldPlay(state.tracks));
    },
    action({ commit }, { trackIndex, mute }) {
      commit("SET_TRACK_MUTE", { trackIndex, mute });
    },
  },

  SET_TRACK_SOLO: {
    mutation(state, { trackIndex, solo }) {
      state.tracks[trackIndex].solo = solo;
      updateTrackMute(shouldPlay(state.tracks));
    },
    action({ commit }, { trackIndex, solo }) {
      commit("SET_TRACK_SOLO", { trackIndex, solo });
    },
  },

  DELETE_TRACK: {
    mutation(state, { trackIndex }) {
      state.tracks.splice(trackIndex, 1);
      state.overlappingNoteInfos.splice(trackIndex, 1);
      if (state.selectedTrackIndex === trackIndex) {
        state.selectedTrackIndex = Math.min(
          state.selectedTrackIndex,
          state.tracks.length - 1
        );
      }
      // Undoした時に壊れるので、TrackNodeはあえて消さない。
      // TODO: もっとスマートな方法を考える
    },
  },
});

export const singingCommandStoreState: SingingCommandStoreState = {};

export const singingCommandStore = transformCommandStore(
  createPartialStore<SingingCommandStoreTypes>({
    COMMAND_SET_SINGER: {
      mutation(draft, { singer, trackIndex }) {
        singingStore.mutations.SET_SINGER(draft, { singer, trackIndex });
      },
      async action({ dispatch, commit }, { singer, trackIndex }) {
        dispatch("SETUP_SINGER", { singer });
        commit("COMMAND_SET_SINGER", { singer, trackIndex });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_KEY_RANGE_ADJUSTMENT: {
      mutation(draft, { keyRangeAdjustment, trackIndex }) {
        singingStore.mutations.SET_KEY_RANGE_ADJUSTMENT(draft, {
          keyRangeAdjustment,
          trackIndex,
        });
      },
      async action({ dispatch, commit }, { keyRangeAdjustment, trackIndex }) {
        if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
          throw new Error("The keyRangeAdjustment is invalid.");
        }
        commit("COMMAND_SET_KEY_RANGE_ADJUSTMENT", {
          trackIndex,
          keyRangeAdjustment,
        });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_VOLUME_RANGE_ADJUSTMENT: {
      mutation(draft, { trackIndex, volumeRangeAdjustment }) {
        singingStore.mutations.SET_VOLUME_RANGE_ADJUSTMENT(draft, {
          volumeRangeAdjustment,
          trackIndex,
        });
      },
      async action(
        { dispatch, commit },
        { volumeRangeAdjustment, trackIndex }
      ) {
        if (!isValidvolumeRangeAdjustment(volumeRangeAdjustment)) {
          throw new Error("The volumeRangeAdjustment is invalid.");
        }
        commit("COMMAND_SET_VOLUME_RANGE_ADJUSTMENT", {
          volumeRangeAdjustment,
          trackIndex,
        });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_TEMPO: {
      mutation(draft, { tempo }) {
        singingStore.mutations.SET_TEMPO(draft, { tempo });
      },
      // テンポを設定する。既に同じ位置にテンポが存在する場合は置き換える。
      action(
        { state, getters, commit, dispatch },
        { tempo }: { tempo: Tempo }
      ) {
        if (!transport) {
          throw new Error("transport is undefined.");
        }
        if (!isValidTempo(tempo)) {
          throw new Error("The tempo is invalid.");
        }
        if (state.nowPlaying) {
          playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
        }
        tempo.bpm = round(tempo.bpm, 2);
        commit("COMMAND_SET_TEMPO", { tempo });
        transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

        dispatch("RENDER");
      },
    },
    COMMAND_REMOVE_TEMPO: {
      mutation(draft, { position }) {
        singingStore.mutations.REMOVE_TEMPO(draft, { position });
      },
      // テンポを削除する。先頭のテンポの場合はデフォルトのテンポに置き換える。
      action(
        { state, getters, commit, dispatch },
        { position }: { position: number }
      ) {
        const exists = state.tempos.some((value) => {
          return value.position === position;
        });
        if (!exists) {
          throw new Error("The tempo does not exist.");
        }
        if (!transport) {
          throw new Error("transport is undefined.");
        }
        if (state.nowPlaying) {
          playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
        }
        commit("COMMAND_REMOVE_TEMPO", { position });
        transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

        dispatch("RENDER");
      },
    },
    COMMAND_SET_TIME_SIGNATURE: {
      mutation(draft, { timeSignature }) {
        singingStore.mutations.SET_TIME_SIGNATURE(draft, { timeSignature });
      },
      // 拍子を設定する。既に同じ位置に拍子が存在する場合は置き換える。
      action({ commit }, { timeSignature }: { timeSignature: TimeSignature }) {
        if (!isValidTimeSignature(timeSignature)) {
          throw new Error("The time signature is invalid.");
        }
        commit("COMMAND_SET_TIME_SIGNATURE", { timeSignature });
      },
    },
    COMMAND_REMOVE_TIME_SIGNATURE: {
      mutation(draft, { measureNumber }) {
        singingStore.mutations.REMOVE_TIME_SIGNATURE(draft, { measureNumber });
      },
      // 拍子を削除する。先頭の拍子の場合はデフォルトの拍子に置き換える。
      action({ state, commit }, { measureNumber }: { measureNumber: number }) {
        const exists = state.timeSignatures.some((value) => {
          return value.measureNumber === measureNumber;
        });
        if (!exists) {
          throw new Error("The time signature does not exist.");
        }
        commit("COMMAND_REMOVE_TIME_SIGNATURE", { measureNumber });
      },
    },
    COMMAND_ADD_NOTES: {
      mutation(draft, { notes }) {
        singingStore.mutations.ADD_NOTES(draft, { notes });
      },
      action({ getters, commit, dispatch }, { notes }: { notes: Note[] }) {
        const existingNoteIds = getters.NOTE_IDS;
        const isValidNotes = notes.every((value) => {
          return !existingNoteIds.has(value.id) && isValidNote(value);
        });
        if (!isValidNotes) {
          throw new Error("The notes are invalid.");
        }
        commit("COMMAND_ADD_NOTES", { notes });

        dispatch("RENDER");
      },
    },
    COMMAND_UPDATE_NOTES: {
      mutation(draft, { notes }) {
        singingStore.mutations.UPDATE_NOTES(draft, { notes });
      },
      action({ getters, commit, dispatch }, { notes }: { notes: Note[] }) {
        const existingNoteIds = getters.NOTE_IDS;
        const isValidNotes = notes.every((value) => {
          return existingNoteIds.has(value.id) && isValidNote(value);
        });
        if (!isValidNotes) {
          throw new Error("The notes are invalid.");
        }
        commit("COMMAND_UPDATE_NOTES", { notes });

        dispatch("RENDER");
      },
    },
    COMMAND_REMOVE_NOTES: {
      mutation(draft, { noteIds }) {
        singingStore.mutations.REMOVE_NOTES(draft, { noteIds });
      },
      action({ getters, commit, dispatch }, { noteIds }) {
        const existingNoteIds = getters.NOTE_IDS;
        const isValidNoteIds = noteIds.every((value) => {
          return existingNoteIds.has(value);
        });
        if (!isValidNoteIds) {
          throw new Error("The note ids are invalid.");
        }
        commit("COMMAND_REMOVE_NOTES", { noteIds });

        dispatch("RENDER");
      },
    },
    COMMAND_REMOVE_SELECTED_NOTES: {
      action({ state, commit, dispatch }) {
        commit("COMMAND_REMOVE_NOTES", { noteIds: [...state.selectedNoteIds] });

        dispatch("RENDER");
      },
    },
    COMMAND_CREATE_TRACK: {
      mutation(draft, { singer }) {
        singingStore.mutations.CREATE_TRACK(draft, { singer });
      },
      action({ commit }, { singer }) {
        commit("COMMAND_CREATE_TRACK", { singer });
      },
    },
    COMMAND_DELETE_TRACK: {
      mutation(draft, { trackIndex }) {
        singingStore.mutations.DELETE_TRACK(draft, { trackIndex });
      },
      action({ commit }, { trackIndex }) {
        commit("COMMAND_DELETE_TRACK", { trackIndex });
      },
    },

    COMMAND_SET_TRACK_PAN: {
      mutation(state, { trackIndex, pan }) {
        singingStore.mutations.SET_TRACK_PAN(state, { trackIndex, pan });
        trackNodes[trackIndex].channelStrip.pan = pan;
      },
      action({ commit }, { trackIndex, pan }) {
        commit("COMMAND_SET_TRACK_PAN", { trackIndex, pan });
      },
    },

    COMMAND_SET_TRACK_VOLUME: {
      mutation(state, { trackIndex, volume }) {
        singingStore.mutations.SET_TRACK_VOLUME(state, { trackIndex, volume });
        trackNodes[trackIndex].channelStrip.volume = volume;
      },
      action({ commit }, { trackIndex, volume }) {
        commit("COMMAND_SET_TRACK_VOLUME", { trackIndex, volume });
      },
    },

    COMMAND_SET_TRACK_MUTE: {
      mutation(draft, { trackIndex, mute }) {
        singingStore.mutations.SET_TRACK_MUTE(draft, { trackIndex, mute });
      },
      action({ commit }, { trackIndex, mute }) {
        commit("COMMAND_SET_TRACK_MUTE", { trackIndex, mute });
      },
    },

    COMMAND_SET_TRACK_SOLO: {
      mutation(draft, { trackIndex, solo }) {
        singingStore.mutations.SET_TRACK_SOLO(draft, { trackIndex, solo });
      },
      action({ commit }, { trackIndex, solo }) {
        commit("COMMAND_SET_TRACK_SOLO", { trackIndex, solo });
      },
    },
  }),
  "song"
);
