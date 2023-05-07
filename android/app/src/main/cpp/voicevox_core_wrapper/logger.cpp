// https://stackoverflow.com/questions/10531050/redirect-stdout-to-logcat-in-android-ndk
#include <android/log.h>
#include <unistd.h>

static int stdoutPfd[2];
static int stderrPfd[2];

static pthread_t thr[2];

static void *logStdoutInBackground(void *rawParams) {
    ssize_t rdsz;
    char buf[1024];
    while ((rdsz = read(stdoutPfd[0], buf, sizeof buf - 1)) > 0) {
        if (buf[rdsz - 1] == '\n') --rdsz;
        buf[rdsz] = 0;
        __android_log_write(ANDROID_LOG_INFO, "voicevox_core", buf);
    }
    return 0;
}
static void *logStderrInBackground(void *rawParams) {
    ssize_t rdsz;
    char buf[1024];
    while ((rdsz = read(stderrPfd[0], buf, sizeof buf - 1)) > 0) {
        if (buf[rdsz - 1] == '\n') --rdsz;
        buf[rdsz] = 0;
        __android_log_write(ANDROID_LOG_WARN, "voicevox_core", buf);
    }
    return 0;
}

int startLogger() {
    pipe(stdoutPfd);
    dup2(stdoutPfd[1], 1);
    pipe(stderrPfd);
    dup2(stderrPfd[1], 2);

    if (pthread_create(
            &thr[0], 0, logStdoutInBackground, nullptr
    ) == -1)
        return -1;
    pthread_detach(thr[0]);

    if (pthread_create(
            &thr[1], 0, logStderrInBackground, nullptr
    ) == -1)
        return -1;
    pthread_detach(thr[1]);
    return 0;
}
