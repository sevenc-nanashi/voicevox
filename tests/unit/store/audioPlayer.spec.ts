import { describe, expect, test } from "vitest";
import { playAudioWithAbort } from "@/store/audioPlayer";

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe(
  "playAudioWithAbort",
  {
    concurrent: false,
  },
  () => {
    test("後処理が終わる前に次の再生が開始されると前の再生はキャンセルされる", async () => {
      const cleanup = Promise.withResolvers<void>();
      const events: string[] = [];

      const first = playAudioWithAbort(async () => {
        events.push("first");
        await cleanup.promise;
        events.push("firstDone");
      });
      const second = playAudioWithAbort(async (signal) => {
        expect(signal.aborted).toBe(true);
        events.push("second");
      });
      const third = playAudioWithAbort(async (signal) => {
        expect(signal.aborted).toBe(false);
        events.push("third");
      });

      // この時点ではfirstが後処理で待機中で、
      // secondとthirdがfirstの後処理が終わるのを待機中
      await flushPromises();
      expect(events).toEqual(["first"]);
      cleanup.resolve();
      await Promise.allSettled([first, second, third]);
      expect(events).toEqual(["first", "firstDone", "second", "third"]);
    });

    test("前の再生が失敗しても次の再生はキャンセルされない", async () => {
      const first = playAudioWithAbort(async () => {
        throw new Error("再生失敗");
      });
      let secondPlayed = false;
      const second = playAudioWithAbort(async () => {
        secondPlayed = true;
      });

      await expect(first).rejects.toThrow("再生失敗");
      await expect(second).resolves.toBeUndefined();
      expect(secondPlayed).toBe(true);
    });
  },
);
