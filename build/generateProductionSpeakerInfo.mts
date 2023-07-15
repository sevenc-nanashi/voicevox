/**
 * VOICEVOX RESOURCEとコアのmetas.jsonから製品版のspeakerInfo.jsonを作成する
 */
import path from "path";
import fs from "fs";
import { promisify } from "util";
import yargs from "yargs";
import globPkg from "glob";
import { __dirname } from "./utils.mjs";

const glob = promisify(globPkg.glob);

const main = async () => {
  const args = yargs(process.argv.slice(2)).options({
    "speaker-info-dir": {
      type: "string",
      demandOption: true,
    },
  });
  const argv = await args.argv;

  const speakerInfoDir = argv.speakerInfoDir;
  if (!speakerInfoDir || !fs.existsSync(speakerInfoDir)) {
    throw new Error(`speaker-info-dir not found: ${speakerInfoDir}`);
  }
  const destPath = path.resolve(__dirname, "../public/speakerInfos.json");
  await fs.promises.writeFile(
    destPath,
    JSON.stringify(
      await Promise.all(
        await fs.promises.readdir(speakerInfoDir).then((d) =>
          d.map(async (dirName) => {
            const dir = path.resolve(speakerInfoDir, dirName);
            const uuid = dirName.split("_")[1];
            const data = {
              policy: await fs.promises.readFile(dir + "/policy.md", "utf-8"),
              portrait: await fs.promises
                .readFile(dir + "/portrait.png")
                .then((buf) => buf.toString("base64")),
              style_infos: await Promise.all(
                await fs.promises.readdir(dir + "/icons").then((icons) =>
                  icons.map(async (icon) => {
                    const id = parseInt(icon.split(".")[0]);
                    return {
                      id,
                      icon: await fs.promises
                        .readFile(dir + `/icons/${icon}`)
                        .then((buf) => buf.toString("base64")),
                      portrait: await fs.promises
                        .readFile(dir + `/portraits/${id}.png`)
                        .then((buf) => buf.toString("base64"))
                        .catch(() => null),
                      voice_samples: await Promise.all(
                        await glob(dir + `/voice_samples/${id}_*.wav`).then(
                          (voiceSamples) =>
                            voiceSamples
                              .sort((a, b) => {
                                const aNum = parseInt(
                                  path.basename(a).split(".")[0].split("_")[1]
                                );
                                const bNum = parseInt(
                                  path.basename(b).split(".")[0].split("_")[1]
                                );
                                return aNum - bNum;
                              })
                              .map(async (voiceSample) => {
                                return await fs.promises
                                  .readFile(voiceSample)
                                  .then((buf) => buf.toString("base64"));
                              })
                        )
                      ),
                    };
                  })
                )
              ),
            };
            return [uuid, data];
          })
        )
      )
    )
  );
  console.log("speakerInfos generated.");
};

main();
