// @ts-check
/**
 * VOICEVOX COREのリリースからライブラリをダウンロードし、
 * またモデルを圧縮してAndroidアプリにコピーするスクリプト。
 *
 * FIXME: ファイル名のハードコードをやめる
 */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

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

/*
 * @param {string} url
 */
const downloadRelease = async (url) => {
  const fileName = url.split("/").pop();
  const basePath = path.resolve(__dirname, "vendored/voicevox_core");
  const destPath = path.resolve(basePath, fileName.replace(".zip", ""));
  const zipDestPath = path.resolve(basePath, fileName);

  if (fs.existsSync(destPath)) {
    console.log("directory already exists. skipping download.");
    console.log(
      "If you want to download the latest model, delete the directory and run this script again."
    );
    return;
  }
  fs.mkdirSync(basePath, { recursive: true });
  if (fs.existsSync(zipDestPath)) {
    console.log("zip file already exists. skipping download.");
  } else {
    console.log(`downloading ${url}`);
    const curl = spawn("curl", ["-L", "-o", zipDestPath, url], {
      stdio: "inherit",
    });
    await new Promise((resolve) => curl.on("exit", resolve));
    if (curl.exitCode !== 0) {
      throw new Error("Failed to download");
    }
  }
  console.log(`extracting ${zipDestPath}`);
  const extractor = spawn(sevenZip, ["x", zipDestPath, "-o" + basePath], {
    stdio: "ignore",
  });
  await new Promise((resolve) => extractor.on("exit", resolve));
  if (extractor.exitCode !== 0) {
    throw new Error("Failed to extract");
  }
};

const moveFile = async () => {
  const basePath = path.resolve(__dirname, "vendored/voicevox_core");
  const jniLibsPath = path.resolve(
    __dirname,
    "../android/app/src/main/jniLibs"
  );
  for (const [src, dest] of [
    [
      basePath +
        "/voicevox_core-android-x86_64-cpu-0.15.0-android-x8664.0/libvoicevox_core.so",
      jniLibsPath + "/x86_64/libvoicevox_core.so",
    ],
    [
      basePath +
        "/voicevox_core-android-arm64-cpu-0.15.2-only-android/libvoicevox_core.so",
      jniLibsPath + "/arm64-v8a/libvoicevox_core.so",
    ],
    [
      basePath +
        "/voicevox_core-android-arm64-cpu-0.15.2-only-android/voicevox_core.h",
      jniLibsPath + "/include/voicevox_core.h",
    ],
    [
      basePath +
        "/voicevox_core-android-arm64-cpu-0.15.2-only-android/build/metas.json",
      basePath + "/metas.json",
    ],
  ]) {
    console.log(`copying ${src} to ${dest}`);
    await fs.promises.cp(src, dest);
  }
};

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
  const releasePath = path.resolve(
    __dirname,
    "vendored/voicevox_core/voicevox_core-android-arm64-cpu-0.15.2-only-android"
  );
  console.log("compressing model");
  const compressor = spawn(
    sevenZip,
    [
      "a",
      "-tzip",
      modelZipPath,
      releasePath + "/model/*",
      releasePath + "/README.txt",
    ],
    {
      stdio: "ignore",
    }
  );
  await new Promise((resolve) => compressor.on("exit", resolve));
  if (compressor.exitCode !== 0) {
    throw new Error("Failed to compress model");
  }
  // TODO: iOSにコピーする処理を追加する
};

Promise.all([
  downloadRelease(
    "https://github.com/VOICEVOX/voicevox_core/releases/download/0.15.0-preview.2/voicevox_core-android-x86_64-cpu-0.15.0-android-x8664.0.zip"
  ),
  downloadRelease(
    "https://github.com/VOICEVOX/voicevox_core/releases/download/0.15.0-preview.0/voicevox_core-android-arm64-cpu-0.15.2-only-android.zip"
  ),
])
  .then(() => downloadAndCompressModel())
  .then(() => moveFile());
