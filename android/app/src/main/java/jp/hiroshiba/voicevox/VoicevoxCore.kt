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
    external fun voicevoxLoadModel(speakerId: Int)
    external fun voicevoxIsModelLoaded(speakerId: Int): Boolean

    @Throws(VoicevoxException::class)
    external fun voicevoxAudioQuery(text: String, speakerId: Int): String

    @Throws(VoicevoxException::class)
    external fun voicevoxAccentPhrases(text: String, speakerId: Int): String

    @Throws(VoicevoxException::class)
    external fun voicevoxMoraPitch(accentPhrases: String, speakerId: Int): String

    @Throws(VoicevoxException::class)
    external fun voicevoxMoraLength(accentPhrases: String, speakerId: Int): String

    @Throws(VoicevoxException::class)
    external fun voicevoxMoraData(accentPhrases: String, speakerId: Int): String

    @Throws(VoicevoxException::class)
    external fun voicevoxSynthesis(audioQuery: String, speakerId: Int, enableInterrogativeUpspeak: Boolean): ByteArray

    class VoicevoxException(override val message: String) : Exception(message)

    constructor() {
        loadLibrary()
    }

    private external fun loadLibrary()

    init {
        // System.loadLibrary("voicevox_core");
        System.loadLibrary("voicevox_core_wrapper")
    }
}
