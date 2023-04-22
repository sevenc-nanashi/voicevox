# android/app/src/main/jniLibs

このディレクトリにはそれぞれのアーキテクチャの外部ライブラリが入ります。
以下のように配置して下さい。

```yml
jniLibs:
  include:
    .gitkeep
    voicevox_core.h
  x86_64:
    .gitkeep
    libvoicevox_core.so
    libonnxruntime.so
  arm64-v8a:
    .gitkeep
    libvoicevox_core.so
    libonnxruntime.so
```

| ライブラリ                                                 | ダウンロードリンク                                                                                                     |
|------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| [VOICEVOX CORE](https://github.com/voicevox/voicevox_core) | <https://github.com/VOICEVOX/voicevox_core/releases/tag/0.15.0-preview.0>                                              |
| [ONNX Runtime](https://onnxruntime.ai)                     | <https://repo1.maven.org/maven2/com/microsoft/onnxruntime/onnxruntime-android/1.13.1/>(onnxruntime-android-1.13.1.aar) |
