import { expect, test } from "vitest";
import { playAudioWithAbort } from "@/store/audioPlayer";

test("後処理の完了を待ち、待機中の再生にもキャンセルを伝える", async () => {
  const started = Promise.withResolvers<AbortSignal>();
  const cleanup = Promise.withResolvers<void>();
  const events: string[] = [];
  const first = playAudioWithAbort(async (signal) => {
    started.resolve(signal);
    await cleanup.promise;
    events.push("cleanup");
  });
  const firstSignal = await started.promise;
  const second = playAudioWithAbort(async (signal) => {
    expect(signal.aborted).toBe(true);
    events.push("cancelled");
  });
  const third = playAudioWithAbort(async (signal) => {
    expect(signal.aborted).toBe(false);
    events.push("play");
    return true;
  });

  expect(firstSignal.aborted).toBe(true);
  expect(events).toEqual([]);
  cleanup.resolve();
  expect(await Promise.all([first, second, third])).toEqual([
    undefined,
    undefined,
    true,
  ]);
  expect(events).toEqual(["cleanup", "cancelled", "play"]);
});

test("前の再生が失敗しても待機中の再生を実行できる", async () => {
  const started = Promise.withResolvers<void>();
  const failure = Promise.withResolvers<void>();
  const first = playAudioWithAbort(async () => {
    started.resolve();
    await failure.promise;
    throw new Error("再生失敗");
  });
  const rejected = first.catch((error: unknown) => error);
  await started.promise;
  const second = playAudioWithAbort(async () => true);
  failure.resolve();

  expect(await rejected).toEqual(new Error("再生失敗"));
  expect(await second).toBe(true);
});
