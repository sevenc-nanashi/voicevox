// @ts-check
/**
 * voicevox/voicevox_engineのモックのSpeakerを使ってspeakerInfos.jsonを生成する
 */
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { promisify } = require("util");
const { glob: globBase } = require("glob");

const glob = promisify(globBase);

const main = async () => {
  const destPath = path.resolve(__dirname, "../public/speakerInfos.json");
  if (fs.existsSync(destPath)) {
    console.log("speakers already exists. skipping conversion.");
    return;
  }
  if (fs.existsSync(path.resolve(__dirname, "vendored/voicevox_resource"))) {
    const updater = spawnSync(
      "git",
      [
        "-C",
        __dirname + "/vendored/voicevox_resource",
        "pull",
        "origin",
        "main",
      ],
      {
        stdio: "inherit",
      }
    );
    if (updater.status !== 0) {
      throw new Error("Failed to update VOICEVOX/voicevox_resource");
    }
  } else {
    const extractor = spawnSync(
      "git",
      [
        "clone",
        "https://github.com/VOICEVOX/voicevox_resource.git",
        __dirname + "/vendored/voicevox_resource",
        "--depth",
        "1",
      ],
      {
        stdio: "inherit",
      }
    );
    if (extractor.status !== 0) {
      throw new Error("Failed to clone VOICEVOX/voicevox_resource");
    }
  }

  const speakerInfoDir = path.resolve(
    __dirname,
    "vendored/voicevox_resource/character_info"
  );

  const characters = await fs.promises.readdir(speakerInfoDir);

  const speakerInfos = {};

  for (const character of characters) {
    const characterDir = path.join(speakerInfoDir, character);
    const uuid = path.basename(character).split("_")[1];
    const policy = await fs.promises.readFile(
      path.join(characterDir, "policy.md"),
      "utf-8"
    );
    const portrait = await fs.promises.readFile(
      path.join(characterDir, "portrait.png")
    );

    const styleIcons = await fs.promises.readdir(
      path.join(characterDir, "icons")
    );
    /** @type {string[]} */
    const stylePortraits = await fs.promises
      .readdir(path.join(characterDir, "portraits"))
      .catch(() => []);

    const voiceSamples = await glob(
      path
        .join(speakerInfoDir, "*", "voice_samples", "*.wav")
        .replace(/\\/g, "/")
    );
    speakerInfos[uuid] = {
      policy: policy,
      portrait: portrait.toString("base64"),

      style_infos: await Promise.all(
        styleIcons.map(async (style) => {
          const id = style.split(".")[0];
          const portrait =
            stylePortraits.includes(`${id}.png`) &&
            (await fs.promises
              .readFile(path.join(characterDir, "portraits", `${id}.png`))
              .catch(() => undefined));

          const styleDir = path.join(characterDir, "icons", style);

          return {
            id,
            icon: await fs.promises
              .readFile(styleDir)
              .then((buf) => buf.toString("base64")),

            portrait,

            voice_samples: await Promise.all(
              voiceSamples
                .filter((voiceSample) => voiceSample.includes(`/${id}_`))
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
    };
  }

  await fs.promises.writeFile(
    destPath,
    JSON.stringify(speakerInfos, undefined, 2),
    "utf-8"
  );
  console.log(
    `generated speakerInfos.json, ${Object.keys(speakerInfos).length} speakers`
  );
};

main();
