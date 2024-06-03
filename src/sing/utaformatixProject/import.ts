import { Project as UfProject } from "@sevenc-nanashi/utaformatix-ts";
import { v4 as uuidv4 } from "uuid";
import { SongState } from "./common";
import { DEFAULT_TPQN, createDefaultTrack } from "@/sing/domain";
import { round } from "@/sing/utility";
import { getDoremiFromNoteNumber } from "@/sing/viewHelper";
import { NoteId } from "@/type/preload";
import { Note, Tempo, TimeSignature, Track } from "@/store/type";

/** UtaformatixのプロジェクトをVoicevoxの楽譜データに変換する */
export const importUtaformatixProject = (project: UfProject): SongState => {
  const convertPosition = (
    position: number,
    sourceTpqn: number,
    targetTpqn: number,
  ) => {
    return Math.round(position * (targetTpqn / sourceTpqn));
  };

  const convertDuration = (
    startPosition: number,
    endPosition: number,
    sourceTpqn: number,
    targetTpqn: number,
  ) => {
    const convertedEndPosition = convertPosition(
      endPosition,
      sourceTpqn,
      targetTpqn,
    );
    const convertedStartPosition = convertPosition(
      startPosition,
      sourceTpqn,
      targetTpqn,
    );
    return Math.max(1, convertedEndPosition - convertedStartPosition);
  };

  const removeDuplicateTempos = (tempos: Tempo[]) => {
    return tempos.filter((value, index, array) => {
      return (
        index === array.length - 1 ||
        value.position !== array[index + 1].position
      );
    });
  };

  const removeDuplicateTimeSignatures = (timeSignatures: TimeSignature[]) => {
    return timeSignatures.filter((value, index, array) => {
      return (
        index === array.length - 1 ||
        value.measureNumber !== array[index + 1].measureNumber
      );
    });
  };

  // 歌詞をひらがなの単独音に変換する
  // TODO: 手動で変換元を選べるようにする
  const convertedProject = project.convertJapaneseLyrics("auto", "KanaCv", {
    convertVowelConnections: true,
  });

  // 480は固定値。
  // https://github.com/sdercolin/utaformatix-data?tab=readme-ov-file#value-conventions
  const projectTpqn = 480;
  const projectTempos = convertedProject.tempos;
  const projectTimeSignatures = convertedProject.timeSignatures;

  const hasLyric = convertedProject.tracks
    .flatMap((value) => value.notes)
    .some((value) => value.lyric !== "");

  const tpqn = DEFAULT_TPQN;

  const tracks: Track[] = convertedProject.tracks.map((projectTrack) => {
    const trackNotes = projectTrack.notes;

    trackNotes.sort((a, b) => a.tickOn - b.tickOn);

    const notes = trackNotes.map((value): Note => {
      return {
        id: NoteId(uuidv4()),
        position: convertPosition(value.tickOn, projectTpqn, tpqn),
        duration: convertDuration(
          value.tickOn,
          value.tickOff,
          projectTpqn,
          tpqn,
        ),
        noteNumber: value.key,
        lyric: hasLyric
          ? // UtaFormatixは「っ」を空文字で表現する
            value.lyric === ""
            ? "っ"
            : value.lyric
          : getDoremiFromNoteNumber(value.key),
      };
    });

    return {
      ...createDefaultTrack(),
      notes,
    };
  });

  let tempos = projectTempos.map((value): Tempo => {
    return {
      position: convertPosition(value.tickPosition, projectTpqn, tpqn),
      bpm: round(value.bpm, 2),
    };
  });
  tempos = removeDuplicateTempos(tempos);

  let timeSignatures: TimeSignature[] = [];
  for (const ts of projectTimeSignatures) {
    const beats = ts.numerator;
    const beatType = ts.denominator;
    timeSignatures.push({
      measureNumber: ts.measurePosition,
      beats,
      beatType,
    });
  }
  timeSignatures = removeDuplicateTimeSignatures(timeSignatures);

  return {
    tracks,
    tpqn,
    tempos,
    timeSignatures,
  };
};
