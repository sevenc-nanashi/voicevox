package jp.hiroshiba.voicevox;

import android.system.ErrnoException;
import android.system.Os;

public class VoicevoxCore {
    public VoicevoxCore(String modelPath) {
        try {
            Os.setenv("VV_MODELS_ROOT_DIR", modelPath, true);
        } catch (ErrnoException e) {
            throw new RuntimeException(e);
        }

        loadLibrary();
    }

    native String voicevoxGetVersion();
    native String voicevoxGetSupportedDevicesJson();

    native String voicevoxGetMetasJson();

    native static void loadLibrary();

    static {
        // System.loadLibrary("voicevox_core");
        System.loadLibrary("voicevox_core_wrapper");
    }
}
