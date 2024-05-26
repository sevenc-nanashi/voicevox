import { EngineInfo, envEngineInfoSchema } from "@/type/preload";

const baseEngineInfos = envEngineInfoSchema
  .array()
  .parse(JSON.parse(import.meta.env.VITE_DEFAULT_ENGINE_INFOS));

export const defaultEngines: EngineInfo[] = baseEngineInfos.map((info) => ({
  ...info,
  type: "default",
}));
export const directoryHandleStoreKey = "directoryHandle";
