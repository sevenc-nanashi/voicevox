#include <jni.h>
#include <dlfcn.h>
#include <android/log.h>
#include <string>
#include "functype.cpp"
#include <stdlib.h>
#include <jni.h>

#define LOG_TAG "voicevox_core_wrapper"
#define ASSERT_CORE_LOADED if (!assertCoreLoaded(env)) return NULL

void *voicevoxCore = NULL;

bool assertCoreLoaded(JNIEnv *env) {
    if (!voicevoxCore) {
        jclass jExceptionClass = env->FindClass("java/lang/RuntimeException");
        env->ThrowNew(jExceptionClass, "voicevoxCore is not loaded");
        return false;
    }
    return true;
}

extern "C"
JNIEXPORT void JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_loadLibrary(JNIEnv
                                                    *env,
                                                    jclass clazz
) {
    __android_log_print(ANDROID_LOG_INFO,
                        LOG_TAG, "loadLibrary");
    voicevoxCore = dlopen("libvoicevox_core.so", RTLD_LAZY);

    if (!voicevoxCore) {
        jclass jExceptionClass = env->FindClass("java/lang/RuntimeException");
        auto error = std::string(dlerror());
        env->
                ThrowNew(jExceptionClass, (std::string("loadLibrary failed: ")
                                           + error).

                c_str()

        );
        return;
    }
    __android_log_print(ANDROID_LOG_INFO,
                        LOG_TAG, "loadLibrary success");
}

extern "C"
JNIEXPORT jstring
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxErrorResultToMessage(
        JNIEnv
        *env,
        jobject thiz,
        jint
        error_code
) {
    ASSERT_CORE_LOADED;

    auto voicevox_error_result_to_message =
            (voicevox_error_result_to_message_t) dlsym(voicevoxCore, "voicevox_error_result_to_message");
    return env->
            NewStringUTF(
            voicevox_error_result_to_message(
                    static_cast<VoicevoxResultCode>(
                            error_code
                    )
            )
    );
}

extern "C"
JNIEXPORT jstring
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxGetVersion(JNIEnv
                                                           *env,
                                                           jobject thiz
) {
    ASSERT_CORE_LOADED;

    auto voicevox_get_version = (voicevox_get_version_t) dlsym(voicevoxCore, "voicevox_get_version");

    return env->

            NewStringUTF(voicevox_get_version());
//    return env->NewStringUTF("0.1.0");
}

extern "C"
JNIEXPORT jint
JNICALL
Java_jp_hiroshiba_voicevox_VoicevoxCore_voicevoxInitialize(JNIEnv *env, jobject
thiz,
                                                           jobject options,
                                                           jstring modelDir
) {
    ASSERT_CORE_LOADED;

    jclass optionsClass = env->GetObjectClass(options);

    jfieldID accelerationModeField = env->GetFieldID(optionsClass, "accelerationMode", "I");
    jfieldID cpuNumThreadsField = env->GetFieldID(optionsClass, "cpuNumThreads", "I");
    jfieldID loadAllModelsField = env->GetFieldID(optionsClass, "loadAllModels", "Z");
    jfieldID openJtalkDictDirField = env->GetFieldID(optionsClass, "openJtalkDictDir", "Ljava/lang/String;");

    auto voicevox_initialize = (voicevox_initialize_t) dlsym(voicevoxCore, "voicevox_initialize");

    jstring openJtalkDictDirObj = (jstring)
            env->
                    GetObjectField(options, openJtalkDictDirField
            );
    const char *openJtalkDictDir = env->GetStringUTFChars(openJtalkDictDirObj, NULL);

    VoicevoxInitializeOptions initOptions = {
            (VoicevoxAccelerationMode) env->GetIntField(options, accelerationModeField),
            (uint16_t) env->GetIntField(options, cpuNumThreadsField),
            (bool) env->GetBooleanField(options, loadAllModelsField),
            openJtalkDictDir,
    };

    const char *cModelDir = env->GetStringUTFChars(modelDir, NULL);
    setenv("VV_MODELS_ROOT_DIR", cModelDir,
           1);
    env->ReleaseStringUTFChars(modelDir, cModelDir);
    VoicevoxResultCode initializeResult = voicevox_initialize(initOptions);

    env->
            ReleaseStringUTFChars(openJtalkDictDirObj, openJtalkDictDir
    );
    return static_cast
            <jint>(initializeResult
    );
}
