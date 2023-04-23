// @ts-check
/**
 * voicevox/voicevox_engineの
 */
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { glob } = require("glob");

const main = async () => {
  const destPath = path.resolve(__dirname, "../public/speakerInfos.json");
  if (fs.existsSync(destPath)) {
    console.log("speakers already exists. skipping conversion.");
    return;
  }
  if (fs.existsSync(path.resolve(__dirname, "vendored/voicevox_engine"))) {
    const updater = spawnSync(
      "git",
      [
        "-C",
        __dirname + "/vendored/voicevox_engine",
        "pull",
        "origin",
        "master",
      ],
      {
        stdio: "inherit",
      }
    );
    if (updater.status !== 0) {
      throw new Error("Failed to update VOICEVOX/voicevox_engine");
    }
  } else {
    const extractor = spawnSync(
      "git",
      [
        "clone",
        "https://github.com/VOICEVOX/voicevox_engine.git",
        __dirname + "/vendored/voicevox_engine",
        "--depth",
        "1",
      ],
      {
        stdio: "inherit",
      }
    );
    if (extractor.status !== 0) {
      throw new Error("Failed to clone VOICEVOX/voicevox_engine");
    }
  }

  const speakerInfoDir = path.resolve(
    __dirname,
    "vendored/voicevox_engine/speaker_info"
  );

  const policies = await glob(
    path.join(speakerInfoDir, "*", "policy.md").replace(/\\/g, "/")
  );
  const portraits = await glob(
    path.join(speakerInfoDir, "*", "portrait.png").replace(/\\/g, "/")
  );
  const styleIcons = await glob(
    path.join(speakerInfoDir, "*", "icons", "*.png").replace(/\\/g, "/")
  );
  // https://stackoverflow.com/a/73616013
  const stylePortraits = styleIcons.map((styleIcon) =>
    styleIcon.replace(/(icons)(?!.*\1)/, "portraits")
  );
  const voiceSamples = await glob(
    path.join(speakerInfoDir, "*", "voice_samples", "*.wav").replace(/\\/g, "/")
  );

  const metas = JSON.parse(
    await fs.promises.readFile(
      path.resolve(__dirname, "vendored/voicevox_core/model/metas.json"),
      "utf-8"
    )
  );

  /** @type {string[]} */
  const coreSpeakerUuids = metas.map((meta) => meta.speaker_uuid);

  let styleIndex = 0;

  await fs.promises.writeFile(
    destPath,
    JSON.stringify(
      Object.fromEntries(
        await Promise.all(
          coreSpeakerUuids.map(async (uuid, i) => [
            uuid,
            {
              policy: await fs.promises.readFile(policies[i], "utf-8"),
              portrait: await fs.promises
                .readFile(portraits[i])
                .then((buf) => buf.toString("base64")),
              style_infos: await Promise.all(
                metas[i].styles.map(async (style) => {
                  const index = styleIndex++;
                  return {
                    id: style.id,
                    icon: await fs.promises
                      .readFile(styleIcons[index])
                      .then((buf) => buf.toString("base64")),
                    portrait: await fs.promises
                      .readFile(stylePortraits[index])
                      .then((buf) => buf.toString("base64"))
                      .catch(() => null),
                    voice_samples: await Promise.all(
                      voiceSamples
                        .filter((voiceSample) =>
                          voiceSample.includes(`/${index}_`)
                        )
                        .map(
                          async (voiceSample) =>
                            await fs.promises
                              .readFile(voiceSample)
                              .then((buf) => buf.toString("base64"))
                        )
                    ),
                  };
                })
              ),
            },
          ])
        )
      )
    )
  );
  console.log("speakerInfos.json generated.");
};

main();
