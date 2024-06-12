/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_7Z_BIN_NAME: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_DEFAULT_ENGINE_INFOS: string;
  readonly VITE_OFFICIAL_WEBSITE_URL: string;
  readonly VITE_LATEST_UPDATE_INFOS_URL: string;
  readonly VITE_GTM_CONTAINER_ID: string;
  readonly VITE_TARGET: "electron" | "browser";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.yaml" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value: any;
  export default value;
}

declare module "*.yml" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value: any;
  export default value;
}
