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

// FIXME: ダミーモデルを使っているので製品版に変える
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
  const compressor = spawnSync(
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
  if (compressor.status !== 0) {
    throw new Error("Failed to compress model");
  }
  // TODO: iOSにコピーする処理を追加する
};

downloadAndCompressModel();
