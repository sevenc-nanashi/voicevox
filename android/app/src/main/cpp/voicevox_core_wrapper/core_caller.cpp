#include <dlfcn.h>
#include "voicevox_core.h"

typedef struct VoicevoxInitializeOptions (*voicevox_make_default_initialize_options_t)();

typedef VoicevoxResultCode (*voicevox_initialize_t)(struct VoicevoxInitializeOptions options);

typedef const char *(*voicevox_get_version_t)();

typedef VoicevoxResultCode (*voicevox_load_model_t)(uint32_t speaker_id);

typedef bool (*voicevox_is_gpu_mode_t)();

typedef bool (*voicevox_is_model_loaded_t)(uint32_t speaker_id);

typedef void (*voicevox_finalize_t)();

typedef const char *(*voicevox_get_metas_json_t)();

typedef const char *(*voicevox_get_supported_devices_json_t)();

typedef VoicevoxResultCode (*voicevox_predict_duration_t)(uintptr_t length,
                                                          int64_t *phoneme_vector,
                                                          uint32_t speaker_id,
                                                          uintptr_t *output_predict_duration_data_length,
                                                          float **output_predict_duration_data);

typedef void (*voicevox_predict_duration_data_free_t)(float *predict_duration_data);

typedef VoicevoxResultCode (*voicevox_predict_intonation_t)(uintptr_t length,
                                                            int64_t *vowel_phoneme_vector,
                                                            int64_t *consonant_phoneme_vector,
                                                            int64_t *start_accent_vector,
                                                            int64_t *end_accent_vector,
                                                            int64_t *start_accent_phrase_vector,
                                                            int64_t *end_accent_phrase_vector,
                                                            uint32_t speaker_id,
                                                            uintptr_t *output_predict_intonation_data_length,
                                                            float **output_predict_intonation_data);

typedef void (*voicevox_predict_intonation_data_free_t)(float *predict_intonation_data);

typedef VoicevoxResultCode (*voicevox_decode_t)(uintptr_t length,
                                                uintptr_t phoneme_size,
                                                float *f0,
                                                float *phoneme_vector,
                                                uint32_t speaker_id,
                                                uintptr_t *output_decode_data_length,
                                                float **output_decode_data);

typedef void (*voicevox_decode_data_free_t)(float *decode_data);

typedef struct VoicevoxAudioQueryOptions (*voicevox_make_default_audio_query_options_t)();

typedef VoicevoxResultCode (*voicevox_audio_query_t)(const char *text,
                                                     uint32_t speaker_id,
                                                     struct VoicevoxAudioQueryOptions options,
                                                     char **output_audio_query_json);

typedef struct VoicevoxAccentPhrasesOptions (*voicevox_make_default_accent_phrases_options_t)();

typedef VoicevoxResultCode (*voicevox_accent_phrases_t)(const char *text,
                                                        uint32_t speaker_id,
                                                        struct VoicevoxAccentPhrasesOptions options,
                                                        char **output_accent_phrases_json);

typedef VoicevoxResultCode (*voicevox_mora_length_t)(const char *accent_phrases_json,
                                                     uint32_t speaker_id,
                                                     char **output_accent_phrases_json);

typedef VoicevoxResultCode (*voicevox_mora_pitch_t)(const char *accent_phrases_json,
                                                    uint32_t speaker_id,
                                                    char **output_accent_phrases_json);

typedef VoicevoxResultCode (*voicevox_mora_data_t)(const char *accent_phrases_json,
                                                   uint32_t speaker_id,
                                                   char **output_accent_phrases_json);

typedef struct VoicevoxSynthesisOptions (*voicevox_make_default_synthesis_options_t)();

typedef VoicevoxResultCode (*voicevox_synthesis_t)(const char *audio_query_json,
                                                   uint32_t speaker_id,
                                                   struct VoicevoxSynthesisOptions options,
                                                   uintptr_t *output_wav_length,
                                                   uint8_t **output_wav);

typedef struct VoicevoxTtsOptions (*voicevox_make_default_tts_options_t)();

typedef VoicevoxResultCode (*voicevox_tts_t)(const char *text,
                                             uint32_t speaker_id,
                                             struct VoicevoxTtsOptions options,
                                             uintptr_t *output_wav_length,
                                             uint8_t **output_wav);

typedef void (*voicevox_audio_query_json_free_t)(char *audio_query_json);

typedef void (*voicevox_accent_phrases_json_free_t)(char *accented_phrase_json);

typedef void (*voicevox_wav_free_t)(uint8_t *wav);

typedef const char *(*voicevox_error_result_to_message_t)(VoicevoxResultCode result_code);

class VoicevoxCore {
public:
    VoicevoxCore() {
        auto core =
                dlopen("libvoicevox_core.so", RTLD_LAZY);
        voicevox_make_default_initialize_options = (voicevox_make_default_initialize_options_t) dlsym(core,
                                                                                                      "voicevox_make_default_initialize_options");
        voicevox_initialize = (voicevox_initialize_t) dlsym(core, "voicevox_initialize");
        voicevox_get_version = (voicevox_get_version_t) dlsym(core, "voicevox_get_version");
        voicevox_load_model = (voicevox_load_model_t) dlsym(core, "voicevox_load_model");
        voicevox_is_gpu_mode = (voicevox_is_gpu_mode_t) dlsym(core, "voicevox_is_gpu_mode");
        voicevox_is_model_loaded = (voicevox_is_model_loaded_t) dlsym(core, "voicevox_is_model_loaded");
        voicevox_finalize = (voicevox_finalize_t) dlsym(core, "voicevox_finalize");
        voicevox_get_metas_json = (voicevox_get_metas_json_t) dlsym(core, "voicevox_get_metas_json");
        voicevox_get_supported_devices_json = (voicevox_get_supported_devices_json_t) dlsym(core,
                                                                                            "voicevox_get_supported_devices_json");
        voicevox_predict_duration = (voicevox_predict_duration_t) dlsym(core, "voicevox_predict_duration");
        voicevox_predict_duration_data_free = (voicevox_predict_duration_data_free_t) dlsym(core,
                                                                                            "voicevox_predict_duration_data_free");
        voicevox_predict_intonation = (voicevox_predict_intonation_t) dlsym(core, "voicevox_predict_intonation");
        voicevox_predict_intonation_data_free = (voicevox_predict_intonation_data_free_t) dlsym(core,
                                                                                                "voicevox_predict_intonation_data_free");
        voicevox_decode = (voicevox_decode_t) dlsym(core, "voicevox_decode");
        voicevox_decode_data_free = (voicevox_decode_data_free_t) dlsym(core, "voicevox_decode_data_free");
        voicevox_make_default_audio_query_options = (voicevox_make_default_audio_query_options_t) dlsym(core,
                                                                                                        "voicevox_make_default_audio_query_options");
        voicevox_audio_query = (voicevox_audio_query_t) dlsym(core, "voicevox_audio_query");
        voicevox_make_default_accent_phrases_options = (voicevox_make_default_accent_phrases_options_t) dlsym(core,
                                                                                                              "voicevox_make_default_accent_phrases_options");
        voicevox_accent_phrases = (voicevox_accent_phrases_t) dlsym(core, "voicevox_accent_phrases");
        voicevox_mora_length = (voicevox_mora_length_t) dlsym(core, "voicevox_mora_length");
        voicevox_mora_pitch = (voicevox_mora_pitch_t) dlsym(core, "voicevox_mora_pitch");
        voicevox_mora_data = (voicevox_mora_data_t) dlsym(core, "voicevox_mora_data");
        voicevox_make_default_synthesis_options = (voicevox_make_default_synthesis_options_t) dlsym(core,
                                                                                                    "voicevox_make_default_synthesis_options");
        voicevox_synthesis = (voicevox_synthesis_t) dlsym(core, "voicevox_synthesis");
        voicevox_make_default_tts_options = (voicevox_make_default_tts_options_t) dlsym(core,
                                                                                        "voicevox_make_default_tts_options");
        voicevox_tts = (voicevox_tts_t) dlsym(core, "voicevox_tts");
        voicevox_audio_query_json_free = (voicevox_audio_query_json_free_t) dlsym(core,
                                                                                  "voicevox_audio_query_json_free");
        voicevox_accent_phrases_json_free = (voicevox_accent_phrases_json_free_t) dlsym(core,
                                                                                        "voicevox_accent_phrases_json_free");
        voicevox_wav_free = (voicevox_wav_free_t) dlsym(core, "voicevox_wav_free");
        voicevox_error_result_to_message = (voicevox_error_result_to_message_t) dlsym(core,
                                                                                      "voicevox_error_result_to_message");
    }

    voicevox_make_default_initialize_options_t voicevox_make_default_initialize_options;
    voicevox_initialize_t voicevox_initialize;
    voicevox_get_version_t voicevox_get_version;
    voicevox_load_model_t voicevox_load_model;
    voicevox_is_gpu_mode_t voicevox_is_gpu_mode;
    voicevox_is_model_loaded_t voicevox_is_model_loaded;
    voicevox_finalize_t voicevox_finalize;
    voicevox_get_metas_json_t voicevox_get_metas_json;
    voicevox_get_supported_devices_json_t voicevox_get_supported_devices_json;
    voicevox_predict_duration_t voicevox_predict_duration;
    voicevox_predict_duration_data_free_t voicevox_predict_duration_data_free;
    voicevox_predict_intonation_t voicevox_predict_intonation;
    voicevox_predict_intonation_data_free_t voicevox_predict_intonation_data_free;
    voicevox_decode_t voicevox_decode;
    voicevox_decode_data_free_t voicevox_decode_data_free;
    voicevox_make_default_audio_query_options_t voicevox_make_default_audio_query_options;
    voicevox_audio_query_t voicevox_audio_query;
    voicevox_make_default_accent_phrases_options_t voicevox_make_default_accent_phrases_options;
    voicevox_accent_phrases_t voicevox_accent_phrases;
    voicevox_mora_length_t voicevox_mora_length;
    voicevox_mora_pitch_t voicevox_mora_pitch;
    voicevox_mora_data_t voicevox_mora_data;
    voicevox_make_default_synthesis_options_t voicevox_make_default_synthesis_options;
    voicevox_synthesis_t voicevox_synthesis;
    voicevox_make_default_tts_options_t voicevox_make_default_tts_options;
    voicevox_tts_t voicevox_tts;
    voicevox_audio_query_json_free_t voicevox_audio_query_json_free;
    voicevox_accent_phrases_json_free_t voicevox_accent_phrases_json_free;
    voicevox_wav_free_t voicevox_wav_free;
    voicevox_error_result_to_message_t voicevox_error_result_to_message;
};