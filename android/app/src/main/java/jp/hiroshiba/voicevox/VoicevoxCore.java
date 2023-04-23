package jp.hiroshiba.voicevox;

public class VoicevoxCore {
    native String voicevoxGetVersion();
    native String voicevoxGetMetasJson();
    native String voicevoxGetSupportedDevicesJson();

    native String voicevoxErrorResultToMessage(int errorCode);

    static class InitializeOptions {
        public int accelerationMode = 0; // AUTO
        public int cpuNumThreads = 0;
        public boolean loadAllModels = false;
        public String openJtalkDictDir = "";
    }

    native int voicevoxInitialize(InitializeOptions options, String modelDir);

    native static void loadLibrary();

    static {
        // System.loadLibrary("voicevox_core");
        System.loadLibrary("voicevox_core_wrapper");

        loadLibrary();
    }

    void checkReturnCode(int returnCode) throws VoicevoxException {
        if (returnCode != 0) {
            throw new VoicevoxException(voicevoxErrorResultToMessage(returnCode));
        }
    }

    public class VoicevoxException extends RuntimeException {
        public VoicevoxException(String message) {
            super(message);
        }
    }
}
