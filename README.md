# poc/migrate-pnpm-vite

`npm` + `vue-cli` のVoicevoxを`pnpm` + `vite`にしてみよう、というブランチ。

## 成果：npm -> pnpm

#### npm：2:29
```
voicevox on  poc/migrate-pnpm-vite [$] via  v16.17.0 took 50s                                               22:20:17
❯ measure-command { npm ci }
npm WARN ERESOLVE overriding peer dependency
   ... 警告 ...
npm WARN deprecated core-js@3.12.1: core-js@<3.23.3 is no longer maintained and not recommended for usage due to the number of issues. Because of the V8 engine whims, feature detection in old core-js versions could cause a slowdown up to 100x even if nothing is polyfilled. Some versions have web compatibility issues. Please, upgrade your dependencies to the actual version of core-js.

Days              : 0
Hours             : 0
Minutes           : 2
Seconds           : 29
Milliseconds      : 593
Ticks             : 1495935381
TotalDays         : 0.00173140669097222
TotalHours        : 0.0415537605833333
TotalMinutes      : 2.493225635
TotalSeconds      : 149.5935381
TotalMilliseconds : 149593.5381
```

#### pnpm：1:37
```
voicevox on  poc/migrate-pnpm-vite [$?] via  v16.17.0 took 2m44s                                            22:26:54
❯ measure-command { rm -re -fo node_modules ; pnpm i }
'electron-builder' is not recognized as an internal or external command,
operable program or batch file.

Days              : 0
Hours             : 0
Minutes           : 1
Seconds           : 37
Milliseconds      : 237
Ticks             : 972376315
TotalDays         : 0.00112543554976852
TotalHours        : 0.0270104531944444
TotalMinutes      : 1.62062719166667
TotalSeconds      : 97.2376315
TotalMilliseconds : 97237.6315
```
> **Note**
> 依存関係の解決のため、1度`pnpm i`を実行して`pnpm-lock.yaml`を生成してある。

> **Warning**
> 実行できるようにするには`pnpm add -D electron-builder ts-loader` `pnpm add tslib`を実行する必要があった。
> また、`.npmrc`に`enable-pre-post-scripts=true`を付け足した。


## 成果：vue-cli -> vite

結構苦戦した。
（測定：`Starting 2 engine/s...`が出るまで）

#### vue-cli：0:39
```
voicevox (85d452d 🏷  0.13.3)  [$] via  v16.17.0
❯ get-date ; npr electron:serve

2022年11月2日 20:59:27

> voicevox@999.999.999 electron:serve
> vue-cli-service electron:serve

 INFO  Starting development server...
  ...（略）...
(Use `electron --trace-warnings ...` to show where the warning was created)
[21:00:06.391] [info]  Starting 2 engine/s...
[21:00:06.396] [info]  ENGINE 074fc39e-678b-4c13-8916-ffca8d505d1d: Start launching
```

#### vite：0:15
```
voicevox on  poc/migrate-pnpm-vite [$] via  v16.17.0 took 45s                                                                                                                                                                                                       21:04:53 
❯ get-date ; npr serve

2022年11月2日 21:05:34

> voicevox@999.999.999 serve
> vite


  VITE v3.2.2  ready in 3558 ms

  ➜  Local:   http://127.0.0.1:3000/
  ➜  Network: use --host to expose
[write] 21:05:39 E:/voicevox-project/voicevox/dist_electron/background.js
[startup] Electron App

(node:152588) ExtensionLoadWarning: Warnings loading extension at C:\Users\katama\AppData\Roaming\voicevox-dev\extensions\ljjemllljcmogpfapbkkighbhhppjdbg:
  Manifest version 2 is deprecated, and support will be removed in 2023. See https://developer.chrome.com/blog/mv2-transition/ for more details.
  Permission 'contextMenus' is unknown or URL pattern is malformed.

(Use `electron --trace-warnings ...` to show where the warning was created)
[21:05:49.151] [info]  Starting 2 engine/s...
[21:05:49.154] [info]  ENGINE 074fc39e-678b-4c13-8916-ffca8d505d1d: Start launching
```


# VOICEVOX

[VOICEVOX](https://voicevox.hiroshiba.jp/) のエディターです。

（エンジンは [VOICEVOX ENGINE](https://github.com/VOICEVOX/voicevox_engine/) 、
コアは [VOICEVOX CORE](https://github.com/VOICEVOX/voicevox_core/) 、
全体構成は [こちら](./docs/全体構成.md) に詳細があります。）

## ユーザーの方へ

こちらは開発用のページになります。利用方法に関しては[VOICEVOX 公式サイト](https://voicevox.hiroshiba.jp/) をご覧ください。

## 貢献者の方へ

Issue を解決するプルリクエストを作成される際は、別の方と同じ Issue に取り組むことを避けるため、
Issue 側で取り組み始めたことを伝えるか、最初に Draft プルリクエストを作成してください。

### デザインガイドライン

[UX・UIデザインの方針](./docs/UX・UIデザインの方針.md)をご参照ください。

## 環境構築

[.node-version](.node-version) に記載されているバージョンの Node.js をインストールしてください。
Node.js をインストール後、[このリポジトリ](https://github.com/VOICEVOX/voicevox.git) を
Fork して `git clone` し、次のコマンドを実行してください。

Node.js の管理ツール ([nvs](https://github.com/jasongin/nvs)など)を利用すると、
[.node-version](.node-version) を簡単にインストールすることができます。

```bash
npm ci
```

## 実行

`.env.production`をコピーして`.env`を作成し、`DEFAULT_ENGINE_INFOS`内の`executionFilePath`に`voicevox_engine`があるパスを指定します。
[製品版 VOICEVOX](https://voicevox.hiroshiba.jp/) のディレクトリのパスを指定すれば動きます。
Windowsの場合でもパスの区切り文字は`\`ではなく`/`なのでご注意ください。
VOICEVOXエディタの実行とは別にエンジンAPIのサーバを立てている場合は`executionFilePath`を指定する必要はありません。

また、エンジンAPIの宛先エンドポイントを変更する場合は`DEFAULT_ENGINE_INFOS`内の`host`を変更してください。

```bash
npm run electron:serve
```

音声合成エンジンのリポジトリはこちらです <https://github.com/VOICEVOX/voicevox_engine>

## ビルド

```bash
npm run electron:build
```

## テスト

```bash
npm run test:unit
npm run test:e2e
```

## 依存ライブラリのライセンス情報の生成

```bash
# get licenses.json from voicevox_engine as engine_licenses.json

npm run license:generate -- -o voicevox_licenses.json
npm run license:merge -- -o public/licenses.json -i engine_licenses.json -i voicevox_licenses.json
```

## コードフォーマット

コードのフォーマットを整えます。プルリクエストを送る前に実行してください。

```bash
npm run fmt
```

## タイポチェック

[typos](https://github.com/crate-ci/typos) を使ってタイポのチェックを行っています。
[typos をインストール](https://github.com/crate-ci/typos#install) した後

```bash
typos
```

でタイポチェックを行えます。
もし誤判定やチェックから除外すべきファイルがあれば
[設定ファイルの説明](https://github.com/crate-ci/typos#false-positives) に従って`_typos.toml`を編集してください。

## 型チェック

TypeScriptの型チェックを行います。
※ 現在チェック方法は2種類ありますが、将来的に1つになります。

```bash
# .tsのみ型チェック
npm run typecheck

# .vueも含めて型チェック
# ※ 現状、大量にエラーが検出されます。
npm run typecheck:vue-tsc
```

## Markdownlint

Markdown の文法チェックを行います。

```bash
npm run markdownlint
```

## Shellcheck

ShellScript の文法チェックを行います。
インストール方法は [こちら](https://github.com/koalaman/shellcheck#installing) を参照してください。

```bash
shellcheck ./build/*.sh
```

## OpenAPI generator

音声合成エンジンが起動している状態で以下のコマンドを実行してください。

```bash
curl http://127.0.0.1:50021/openapi.json >openapi.json

$(npm bin)/openapi-generator-cli generate \
    -i openapi.json \
    -g typescript-fetch \
    -o src/openapi/ \
    --additional-properties=modelPropertyNaming=camelCase,supportsES6=true,withInterfaces=true,typescriptThreePlus=true

npm run fmt
```

## ライセンス

LGPL v3 と、ソースコードの公開が不要な別ライセンスのデュアルライセンスです。
別ライセンスを取得したい場合は、ヒホ（twitter: [@hiho_karuta](https://twitter.com/hiho_karuta)）に求めてください。
