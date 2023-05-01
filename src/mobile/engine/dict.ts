import { ApiProvider } from ".";

const dictProvider: ApiProvider = () => {
  // TODO:
  //   ユーザー辞書機能がCoreに実装されるまで、必要最低限のモックにしておく。
  //   cf: https://github.com/VOICEVOX/voicevox_core/issues/265
  return {
    async getUserDictWordsUserDictGet() {
      return {};
    },
    // async addUserDictWordUserDictWordPost() {
    //   return;
    // },
    // async deleteUserDictWordUserDictWordWordUuidDelete() {
    //   return;
    // },
    // async rewriteUserDictWordUserDictWordWordUuidPut() {
    //   return;
    // },
    async importUserDictWordsImportUserDictPost() {
      return;
    },
  };
};

export default dictProvider;
