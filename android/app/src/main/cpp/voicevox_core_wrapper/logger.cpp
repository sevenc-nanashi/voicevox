// https://stackoverflow.com/questions/10531050/redirect-stdout-to-logcat-in-android-ndk
#include <android/log.h>
#include <unistd.h>

struct LogParams {
    int fd;
    android_LogPriority priority;
};
static LogParams stdoutParams;
static LogParams stderrParams;

static void *logInBackground(void *rawParams) {
    LogParams params = *static_cast<LogParams *>(rawParams);
    ssize_t rdsz;
    char buf[1024];
    while ((rdsz = read(params.fd, buf, sizeof buf - 1)) > 0) {
        if (buf[rdsz - 1] == '\n') --rdsz;
        buf[rdsz] = 0;
        __android_log_write(params.priority, "voicevox_core", buf);
    }
    return 0;
}

int startLogger() {
    int stdoutPfd[2];
    int stderrPfd[2];
    pthread_t thr[2];
    pipe(stdoutPfd);
    dup2(stdoutPfd[1], 1);
    pipe(stderrPfd);
    dup2(stderrPfd[1], 2);

    stdoutParams = {
            .fd = stdoutPfd[0],
            .priority = ANDROID_LOG_INFO
    };

    if (pthread_create(
            &thr[0], 0, logInBackground, &stdoutParams
    ) == -1)
        return -1;
    pthread_detach(thr[0]);

    stderrParams = {
            .fd = stderrPfd[0],
            .priority = ANDROID_LOG_WARN
    };

    if (pthread_create(
            &thr[1], 0, logInBackground, &stderrParams
    ) == -1)
        return -1;
    pthread_detach(thr[1]);
    return 0;
}
