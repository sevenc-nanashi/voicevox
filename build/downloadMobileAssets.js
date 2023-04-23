// @ts-check
/**
 * voicevox/voicevox_coreのmodelディレクトリをダウンロードしてZip圧縮し、
 * またOpenJTalkの辞書をzip圧縮するスクリプト。
 */
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

let sevenZipCommand;
switch (process.platform) {
  case "win32": {
    sevenZipCommand = "7za.exe";
    break;
  }
  case "linux": {
    sevenZipCommand = "7zzs";
    break;
  }
  case "darwin": {
    sevenZipCommand = "7zz";
    break;
  }
  default: {
    throw new Error("Unsupported platform");
  }
}
const sevenZip = path.resolve(__dirname, "vendored", "7z", sevenZipCommand);

const downloadAndCompressModel = async () => {
  const modelZipPath = path.resolve(
    __dirname,
    "../android/app/src/main/assets/model.zip"
  );
  if (fs.existsSync(modelZipPath)) {
    console.log("model directory already exists. skipping download.");
    console.log(
      "If you want to download the latest model, delete the model.zip and run this script again."
    );
    return;
  }
  if (fs.existsSync(path.resolve(__dirname, "vendored/voicevox_core"))) {
    const updater = spawnSync(
      "git",
      ["-C", __dirname + "/vendored/voicevox_core", "pull", "origin", "main"],
      {
        stdio: "inherit",
      }
    );
    if (updater.status !== 0) {
      throw new Error("Failed to update VOICEVOX/voicevox_core");
    }
  } else {
    const extractor = spawnSync(
      "git",
      [
        "clone",
        "https://github.com/VOICEVOX/voicevox_core.git",
        __dirname + "/vendored/voicevox_core",
        "--depth",
        "1",
      ],
      {
        stdio: "inherit",
      }
    );
    if (extractor.status !== 0) {
      throw new Error("Failed to clone VOICEVOX/voicevox_core");
    }
  }
  const compresser = spawnSync(
    sevenZip,
    [
      "a",
      "-tzip",
      modelZipPath,
      __dirname + "/vendored/voicevox_core/model/*",
      __dirname + "/vendored/voicevox_core/LICENSE",
    ],
    {
      stdio: "inherit",
    }
  );
  if (compresser.status !== 0) {
    throw new Error("Failed to compress model");
  }
  // TODO: iOSにコピーする処理を追加する
};

const downloadOpenJtalkDict = async () => {
  // node-fetchはESModuleなので、import()で読み込む
  const { default: fetch } = await import("node-fetch");
  const rootDir = path.resolve(__dirname, "vendored", "open_jtalk_dict");

  const openJtalkDictArchivePath = path.resolve(
    rootDir,
    "open_jtalk_dic_utf_8-1.11.tar.gz"
  );

  const openJtalkDictZipPath = path.resolve(
    __dirname,
    "../android/app/src/main/assets/open_jtalk_dict.zip"
  );

  if (fs.existsSync(openJtalkDictZipPath)) {
    console.log("open_jtalk_dict.zip already exists. skipping download.");
    console.log(
      "If you want to download the latest open_jtalk_dict, delete the open_jtalk_dict.zip and run this script again."
    );
    return;
  }

  if (fs.existsSync(openJtalkDictArchivePath)) {
    console.log("open_jtalk_dict.zip already exists. skipping download.");
  } else {
    const originalDictUrl =
      "https://jaist.dl.sourceforge.net/project/open-jtalk/Dictionary/open_jtalk_dic-1.11/open_jtalk_dic_utf_8-1.11.tar.gz";
    console.log(
      "Downloading open_jtalk_dic_utf_8-1.11.tar.gz from " + originalDictUrl
    );
    const res = await fetch(originalDictUrl);
    const buffer = await res.arrayBuffer();

    await fs.promises.mkdir(rootDir, { recursive: true });

    await fs.promises.writeFile(openJtalkDictArchivePath, Buffer.from(buffer));
    console.log("Downloaded open_jtalk_dic_utf_8-1.11.tar.gz");
  }

  const openJtalkDictTarPath = path.resolve(
    rootDir,
    "open_jtalk_dic_utf_8-1.11.tar"
  );
  const decompresser = spawnSync(
    sevenZip,
    ["x", "-tgzip", openJtalkDictArchivePath, "-o" + rootDir, "-y"],
    {
      stdio: "inherit",
    }
  );

  if (decompresser.status !== 0) {
    throw new Error("Failed to decompress open_jtalk_dic_utf_8-1.11.tar.gz");
  }
  const extractor = spawnSync(
    sevenZip,
    ["x", "-ttar", openJtalkDictTarPath, "-o" + rootDir, "-y"],
    {
      stdio: "inherit",
    }
  );

  if (extractor.status !== 0) {
    throw new Error("Failed to extract open_jtalk_dic_utf_8-1.11.tar");
  }

  console.log("Extracted open_jtalk_dic_utf_8-1.11.tar.gz");

  const openJtalkDictDirPath = path.resolve(
    __dirname,
    "vendored/open_jtalk_dic_utf_8-1.11"
  );

  const compresser = spawnSync(
    sevenZip,
    ["a", "-tzip", openJtalkDictZipPath, openJtalkDictDirPath + "/*"],
    {
      stdio: "inherit",
    }
  );

  if (compresser.status !== 0) {
    throw new Error("Failed to compress open jtalk dict");
  }
  console.log("Compressed open jtalk dict");
};

downloadAndCompressModel();
downloadOpenJtalkDict();
