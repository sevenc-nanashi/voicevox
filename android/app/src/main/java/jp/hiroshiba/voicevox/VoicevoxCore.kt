package jp.hiroshiba.voicevox

import android.system.ErrnoException
import android.system.Os

class VoicevoxCore {
    external fun voicevoxGetVersion(): String
    external fun voicevoxGetSupportedDevicesJson(): String
    external fun voicevoxGetMetasJson(): String

    external fun voicevoxErrorResultToMessage(statusCode: Int): String

    @Throws(VoicevoxException::class)
    external fun voicevoxInitialize(openJtalkDictPath: String)

    @Throws(VoicevoxException::class)
    external fun voicevoxAudioQuery(text: String, speakerId: Int): String

    class VoicevoxException(override val message: String) : Exception(message)

    constructor(modelPath: String) {
        try {
            Os.setenv("VV_MODELS_ROOT_DIR", modelPath, true)
        } catch (e: ErrnoException) {
            throw RuntimeException(e)
        }
        loadLibrary()
    }

    private external fun loadLibrary()

    init {
        // System.loadLibrary("voicevox_core");
        System.loadLibrary("voicevox_core_wrapper")
    }
}
