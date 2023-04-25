package jp.hiroshiba.voicevox;

public class VoicevoxCore {
    native String voicevoxGetVersion();
    native String voicevoxGetSupportedDevicesJson();

    native static void loadLibrary();

    static {
        // System.loadLibrary("voicevox_core");
        System.loadLibrary("voicevox_core_wrapper");

        loadLibrary();
    }
}
