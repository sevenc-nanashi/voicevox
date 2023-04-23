import { ApiProvider } from ".";
import { UserDictWord } from "@/openapi";

const userDictProvider: ApiProvider = () => {
  return {
    async getUserDictWordsUserDictGet() {
      // TODO: 実装する
      return {} as Record<string, UserDictWord>;
    },
    async importUserDictWordsImportUserDictPost() {
      // TODO: 実装する
      return;
    },
  };
};

export default userDictProvider;
