import { Preferences } from "@capacitor/preferences";
import { v4 as uuidv4 } from "uuid";
import { VoicevoxCorePlugin } from "../plugin";
import { ApiProvider } from ".";
import { UserDictWord } from "@/openapi";

type InternalUserDict = Record<string, InternalDictWord>;

const preferenceKey = "userDict";
export const getUserDictWords = async () => {
  const userDictJson = await Preferences.get({ key: preferenceKey });
  const dict: InternalUserDict = userDictJson.value
    ? JSON.parse(userDictJson.value)
    : {};
  return dict;
};
export const useUserDictWords = async (
  corePlugin: VoicevoxCorePlugin,
  dict: InternalUserDict
) => {
  await corePlugin.useUserDict({
    wordsJson: JSON.stringify(
      Object.values(dict).map((word) => ({
        surface: word.surface,
        pronunciation: word.pronunciation,
        accent_type: word.accentType,
        priority: word.priority,
        word_type: word.wordType,
      }))
    ),
  });
};

type InternalWordType =
  | "PROPER_NOUN"
  | "COMMON_NOUN"
  | "VERB"
  | "ADJECTIVE"
  | "SUFFIX";
type InternalDictWord = {
  priority: number;
  accentType: number;
  surface: string;
  pronunciation: string;
  wordType: InternalWordType;
};
const internalWordTypeMap: Record<
  InternalWordType,
  {
    partOfSpeech: string;
    partOfSpeechDetail1: string;
    partOfSpeechDetail2: string;
    partOfSpeechDetail3: string;
  }
> = {
  PROPER_NOUN: {
    partOfSpeech: "名詞",
    partOfSpeechDetail1: "固有名詞",
    partOfSpeechDetail2: "一般",
    partOfSpeechDetail3: "*",
  },
  COMMON_NOUN: {
    partOfSpeech: "名詞",
    partOfSpeechDetail1: "一般",
    partOfSpeechDetail2: "*",
    partOfSpeechDetail3: "*",
  },
  VERB: {
    partOfSpeech: "動詞",
    partOfSpeechDetail1: "自立",
    partOfSpeechDetail2: "*",
    partOfSpeechDetail3: "*",
  },
  ADJECTIVE: {
    partOfSpeech: "形容詞",
    partOfSpeechDetail1: "自立",
    partOfSpeechDetail2: "*",
    partOfSpeechDetail3: "*",
  },
  SUFFIX: {
    partOfSpeech: "名詞",
    partOfSpeechDetail1: "接尾",
    partOfSpeechDetail2: "一般",
    partOfSpeechDetail3: "*",
  },
};
const apiWordToInternalWord = (word: UserDictWord): InternalDictWord => {
  const wordType = Object.entries(internalWordTypeMap).find(
    ([, value]) =>
      value.partOfSpeech === word.partOfSpeech &&
      value.partOfSpeechDetail1 === word.partOfSpeechDetail1 &&
      value.partOfSpeechDetail2 === word.partOfSpeechDetail2 &&
      value.partOfSpeechDetail3 === word.partOfSpeechDetail3
  )?.[0] as InternalWordType | undefined;
  if (!wordType) {
    throw new Error("wordType not found");
  }
  return {
    surface: word.surface,
    pronunciation: word.pronunciation,
    accentType: word.accentType,
    priority: word.priority,
    wordType,
  };
};

const dictProvider: ApiProvider = ({ corePlugin }) => {
  const setUserDictWords = async (dict: InternalUserDict) => {
    await Preferences.set({ key: preferenceKey, value: JSON.stringify(dict) });
    await useUserDictWords(corePlugin, dict);
  };
  return {
    async getUserDictWordsUserDictGet() {
      const dict = await getUserDictWords();

      return Object.fromEntries(
        Object.entries(dict).map<[string, UserDictWord]>(([uuid, word]) => [
          uuid,
          {
            surface: word.surface,
            pronunciation: word.pronunciation,
            accentType: word.accentType,
            priority: word.priority,
            ...internalWordTypeMap[word.wordType],
            // 本来はもっとプロパティがあるが、
            // https://github.com/VOICEVOX/voicevox_core/blob/main/crates/voicevox_core/src/user_dict/part_of_speech_data.rs のような
            // 対応表をもってくるのは面倒なので、とりあえずこれだけ用意しておく。
          } as UserDictWord,
        ])
      );
    },
    async addUserDictWordUserDictWordPost(word) {
      const uuid = uuidv4();
      const dict = await getUserDictWords();
      dict[uuid] = {
        surface: word.surface,
        pronunciation: word.pronunciation,
        accentType: word.accentType,
        priority: word.priority ?? 5,
        wordType: word.wordType ?? "COMMON_NOUN",
      };
      await setUserDictWords(dict);
      return uuid;
    },
    async deleteUserDictWordUserDictWordWordUuidDelete(req) {
      const dict = await getUserDictWords();
      delete dict[req.wordUuid];
      await setUserDictWords(dict);
      return;
    },
    async rewriteUserDictWordUserDictWordWordUuidPut(req) {
      const dict = await getUserDictWords();
      const word = dict[req.wordUuid];
      if (!word) {
        throw new Error("wordUuid not found");
      }
      dict[req.wordUuid] = {
        surface: req.surface,
        pronunciation: req.pronunciation,
        accentType: req.accentType,
        priority: req.priority || word.priority,
        wordType: req.wordType || word.wordType,
      };
      await setUserDictWords(dict);
      return;
    },
    async importUserDictWordsImportUserDictPost(req) {
      if (!req.requestBody) {
        // 型によるとnullableらしいので、nullチェックを入れる
        throw new Error("assert: requestBody is not null");
      }
      const dict = await getUserDictWords();
      for (const [uuid, word] of Object.entries(req.requestBody)) {
        if (dict[uuid] && !req.override) {
          continue;
        }
        dict[uuid] = apiWordToInternalWord(word);
      }
      return;
    },
  };
};

export default dictProvider;
