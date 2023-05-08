#include <jni.h>
#include <dlfcn.h>
#include <android/log.h>
#include <string>
#include "core_caller.cpp"
#include "logger.cpp"

#define LOG_TAG "voicevox_core_wrapper"

VoicevoxCore *voicevoxCore;

bool assertCoreLoaded(JNIEnv *env) {
    if (!voicevoxCore) {
        jclass jExceptionClass = env->FindClass("java/lang/RuntimeException");
        env->ThrowNew(jExceptionClass, "voicevoxCore is not loaded");
        return false;
    }
    return true;
}

// 成功だったらtrueを返す
bool throwExceptionIfError(JNIEnv *env, VoicevoxResultCode code) {
    if (!voicevoxCore) {
        return false;
    }
    if (code == 0) {
        return false;
    }
    jclass jExceptionClass = env->FindClass("jp/hiroshiba/voicevox/VoicevoxCore$VoicevoxException");
    auto message = voicevoxCore->voicevox_error_result_to_message(code);
    env->ThrowNew(jExceptionClass, message);
    return true;
}


extern "C"
JNIEXPORT void JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_loadLibrary(JNIEnv *env, jobject thiz) {
    __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "loadLibrary");
    voicevoxCore = new VoicevoxCore();
    startLogger();

    if (!voicevoxCore) {
        jclass jExceptionClass = env->FindClass("java/lang/RuntimeException");
        auto error = std::string(dlerror());
        env->ThrowNew(jExceptionClass, (std::string("loadLibrary failed: ") + error).c_str());
        return;
    }
    __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "loadLibrary success");
}

extern "C"
JNIEXPORT jstring
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxGetSupportedDevicesJson(
        JNIEnv *env,
        jobject thiz
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    return env->
            NewStringUTF(voicevoxCore->voicevox_get_supported_devices_json());
}

extern "C"
JNIEXPORT jstring
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxGetVersion(
        JNIEnv *env,
        jobject thiz
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    return env->
            NewStringUTF(voicevoxCore->voicevox_get_version());
}

extern "C"
JNIEXPORT jstring
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxGetMetasJson(
        JNIEnv *env,
        jobject thiz
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    return env->
            NewStringUTF(voicevoxCore->voicevox_get_metas_json());
}

extern "C"
JNIEXPORT jstring JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxErrorResultToMessage(
        JNIEnv *env,
        jobject thiz,
        jint status_code
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    auto message = voicevoxCore->voicevox_error_result_to_message(static_cast<VoicevoxResultCode>(status_code));

    return env->NewStringUTF(message);
}

extern "C"
JNIEXPORT void JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxInitialize(
        JNIEnv *env,
        jobject thiz,
        jstring openJtalkDictPath
) {
    if (!assertCoreLoaded(env)) {
        return;
    }

    auto openJtalkDictPathStr = env->GetStringUTFChars(openJtalkDictPath, nullptr);
    auto options = voicevoxCore->voicevox_make_default_initialize_options();
    options.open_jtalk_dict_dir = openJtalkDictPathStr;

    auto result = voicevoxCore->voicevox_initialize(options);
    env->ReleaseStringUTFChars(openJtalkDictPath, openJtalkDictPathStr);

    throwExceptionIfError(env, result);
}

extern "C"
JNIEXPORT void JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxLoadModel(
        JNIEnv *env,
        jobject thiz,
        jint speakerId
) {
    if (!assertCoreLoaded(env)) {
        return;
    }

    auto result = voicevoxCore->voicevox_load_model(speakerId);

    throwExceptionIfError(env, result);
}

extern "C"
JNIEXPORT jboolean JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxIsModelLoaded(
        JNIEnv *env,
        jobject thiz,
        jint speakerId
) {
    if (!assertCoreLoaded(env)) {
        return false;
    }

    auto result = voicevoxCore->voicevox_is_model_loaded(speakerId);

    return result;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxAudioQuery(
        JNIEnv *env,
        jobject thiz,
        jstring text,
        jint speakerId
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    auto textCStr = env->GetStringUTFChars(text, nullptr);
    auto options = voicevoxCore->voicevox_make_default_audio_query_options();
    options.kana = false;

    char *result;

    auto resultCode = voicevoxCore->voicevox_audio_query(textCStr, speakerId, options, &result);
    env->ReleaseStringUTFChars(text, textCStr);

    if (throwExceptionIfError(env, resultCode)) {
        return nullptr;
    }

    auto resultJStr = env->NewStringUTF(result);
    voicevoxCore->voicevox_audio_query_json_free(result);

    return resultJStr;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxAccentPhrases(
        JNIEnv *env,
        jobject thiz,
        jstring text,
        jint speakerId
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    auto textCStr = env->GetStringUTFChars(text, nullptr);
    auto options = voicevoxCore->voicevox_make_default_accent_phrases_options();
    options.kana = false;

    char *result;

    auto resultCode = voicevoxCore->voicevox_accent_phrases(textCStr, speakerId, options, &result);
    env->ReleaseStringUTFChars(text, textCStr);

    if (throwExceptionIfError(env, resultCode)) {
        return nullptr;
    }

    auto resultJStr = env->NewStringUTF(result);
    voicevoxCore->voicevox_accent_phrases_json_free(result);

    return resultJStr;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxMoraLength(
        JNIEnv *env,
        jobject thiz,
        jstring accentPhrases,
        jint speakerId
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    auto accentPhrasesCStr = env->GetStringUTFChars(accentPhrases, nullptr);

    char *result;

    auto resultCode = voicevoxCore->voicevox_mora_length(accentPhrasesCStr, speakerId, &result);
    env->ReleaseStringUTFChars(accentPhrases, accentPhrasesCStr);

    if (throwExceptionIfError(env, resultCode)) {
        return nullptr;
    }

    auto resultJStr = env->NewStringUTF(result);
    voicevoxCore->voicevox_accent_phrases_json_free(result);

    return resultJStr;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxMoraPitch(
        JNIEnv *env,
        jobject thiz,
        jstring accentPhrases,
        jint speakerId
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    auto accentPhrasesCStr = env->GetStringUTFChars(accentPhrases, nullptr);

    char *result;

    auto resultCode = voicevoxCore->voicevox_mora_pitch(accentPhrasesCStr, speakerId, &result);
    env->ReleaseStringUTFChars(accentPhrases, accentPhrasesCStr);

    if (throwExceptionIfError(env, resultCode)) {
        return nullptr;
    }

    auto resultJStr = env->NewStringUTF(result);
    voicevoxCore->voicevox_accent_phrases_json_free(result);

    return resultJStr;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxMoraData(
        JNIEnv *env,
        jobject thiz,
        jstring accentPhrases,
        jint speakerId
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    auto accentPhrasesCStr = env->GetStringUTFChars(accentPhrases, nullptr);

    char *result;

    auto resultCode = voicevoxCore->voicevox_mora_data(accentPhrasesCStr, speakerId, &result);
    env->ReleaseStringUTFChars(accentPhrases, accentPhrasesCStr);

    if (throwExceptionIfError(env, resultCode)) {
        return nullptr;
    }

    auto resultJStr = env->NewStringUTF(result);
    voicevoxCore->voicevox_accent_phrases_json_free(result);

    return resultJStr;
}

extern "C"
JNIEXPORT jbyteArray JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxSynthesis(
        JNIEnv *env,
        jobject thiz,
        jstring audioQuery,
        jint speakerId,
        jboolean enableInterrogativeUpspeak
) {
    if (!assertCoreLoaded(env)) {
        return nullptr;
    }

    auto audioQueryCStr = env->GetStringUTFChars(audioQuery, nullptr);
    auto options = voicevoxCore->voicevox_make_default_synthesis_options();
    options.enable_interrogative_upspeak = enableInterrogativeUpspeak;

    uint8_t *result;
    uintptr_t resultSize;

    auto resultCode = voicevoxCore->voicevox_synthesis(audioQueryCStr, speakerId, options, &resultSize, &result);
    env->ReleaseStringUTFChars(audioQuery, audioQueryCStr);

    if (throwExceptionIfError(env, resultCode)) {
        return nullptr;
    }

    auto resultByteArray = env->NewByteArray(static_cast<int>(resultSize));
    auto resultByteArrayElements = env->GetByteArrayElements(resultByteArray, nullptr);
    memcpy(resultByteArrayElements, result, resultSize);
    env->ReleaseByteArrayElements(resultByteArray, resultByteArrayElements, 0);
    voicevoxCore->voicevox_wav_free(result);

    return resultByteArray;
}
