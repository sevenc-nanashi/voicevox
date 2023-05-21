package jp.hiroshiba.voicevox

import android.app.Activity
import android.system.Os
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.Base64
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream

@CapacitorPlugin(name = "VoicevoxCore")
class CorePlugin : Plugin() {
    var core: VoicevoxCore? = null
    override fun load() {
        core = VoicevoxCore()
    }

    @PluginMethod
    fun getVersion(call: PluginCall) {
        val ret = JSObject()
        ret.put("value", core!!.voicevoxGetVersion())
        call.resolve(ret)
    }

    @PluginMethod
    fun getSupportedDevicesJson(call: PluginCall) {
        val ret = JSObject()
        ret.put("value", core!!.voicevoxGetSupportedDevicesJson())
        call.resolve(ret)
    }

    @PluginMethod
    fun getMetasJson(call: PluginCall) {
        val ret = JSObject()
        ret.put("value", core!!.voicevoxGetMetasJson())
        call.resolve(ret)
    }

    @PluginMethod
    fun initialize(call: PluginCall) {
        val dictPath: String = try {
            // assets内のフォルダにパスでアクセスする方法が見付からなかったので
            // 1度filesに展開している。もっといい解決法があるかも。
            extractIfNotFound("openjtalk_dict.zip")
        } catch (e: IOException) {
            throw RuntimeException(e)
        }
        val modelPath = try {
            extractIfNotFound("model.zip")
        } catch (e: IOException) {
            throw RuntimeException(e)
        }
        Os.setenv("VV_MODELS_ROOT_DIR", modelPath, true)
        try {
            core!!.voicevoxInitialize(
                    dictPath,
            )
            call.resolve()
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun loadModel(call: PluginCall) {
        val speakerId = call.getInt("speakerId")
        if (speakerId == null) {
            call.reject("Type mismatch")
            return
        }

        try {
            core!!.voicevoxLoadModel(speakerId)
            call.resolve()
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun isModelLoaded(call: PluginCall) {
        val speakerId = call.getInt("speakerId")
        if (speakerId == null) {
            call.reject("Type mismatch")
            return
        }

        try {
            val result = core!!.voicevoxIsModelLoaded(speakerId)
            val ret = JSObject()
            ret.put("value", result)
            call.resolve(ret)
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun audioQuery(call: PluginCall) {
        val text = call.getString("text")
        val speakerId = call.getInt("speakerId")
        if (text == null || speakerId == null) {
            call.reject("Type mismatch")
            return
        }

        try {
            val audioQuery = core!!.voicevoxAudioQuery(text, speakerId)
            val ret = JSObject()
            ret.put("value", audioQuery)
            call.resolve(ret)
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun accentPhrases(call: PluginCall) {
        val text = call.getString("text")
        val speakerId = call.getInt("speakerId")
        if (text == null || speakerId == null) {
            call.reject("Type mismatch")
            return
        }

        try {
            val accentPhrases = core!!.voicevoxAccentPhrases(text, speakerId)
            val ret = JSObject()
            ret.put("value", accentPhrases)
            call.resolve(ret)
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun moraPitch(call: PluginCall) {
        val accentPhrases = call.getString("accentPhrases")
        val speakerId = call.getInt("speakerId")
        if (accentPhrases == null || speakerId == null) {
            call.reject("Type mismatch")
            return
        }

        try {
            val newAccentPhrases = core!!.voicevoxMoraPitch(accentPhrases, speakerId)
            val ret = JSObject()
            ret.put("value", newAccentPhrases)
            call.resolve(ret)
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun moraLength(call: PluginCall) {
        val accentPhrases = call.getString("accentPhrases")
        val speakerId = call.getInt("speakerId")
        if (accentPhrases == null || speakerId == null) {
            call.reject("Type mismatch")
            return
        }

        try {
            val newAccentPhrases = core!!.voicevoxMoraLength(accentPhrases, speakerId)
            val ret = JSObject()
            ret.put("value", newAccentPhrases)
            call.resolve(ret)
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun moraData(call: PluginCall) {
        val accentPhrases = call.getString("accentPhrases")
        val speakerId = call.getInt("speakerId")
        if (accentPhrases == null || speakerId == null) {
            call.reject("Type mismatch")
            return
        }

        try {
            val newAccentPhrases = core!!.voicevoxMoraData(accentPhrases, speakerId)
            val ret = JSObject()
            ret.put("value", newAccentPhrases)
            call.resolve(ret)
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun synthesis(call: PluginCall) {
        val audioQuery = call.getString("audioQuery")
        val speakerId = call.getInt("speakerId")
        val enableInterrogativeUpspeak = call.getBoolean("enableInterrogativeUpspeak")
        if (audioQuery == null || speakerId == null || enableInterrogativeUpspeak == null) {
            call.reject("Type mismatch")
            return
        }

        try {
            val result = core!!.voicevoxSynthesis(audioQuery, speakerId, enableInterrogativeUpspeak)
            val ret = JSObject()
            val encodedResult = Base64.getEncoder().encodeToString(result)
            ret.put("value", encodedResult)
            call.resolve(ret)
        } catch (e: VoicevoxCore.VoicevoxException) {
            call.reject(e.message)
        }
    }

    @Throws(IOException::class)
    private fun extractIfNotFound(archiveName: String): String {
        val filesDir = context.filesDir.absolutePath
        val dirName = File(archiveName).nameWithoutExtension

        val act: Activity = activity
        val archive = act.assets.open(archiveName)
        val shaSumFile = act.assets.open("$archiveName.sha256")
        val shaSumReader = shaSumFile.bufferedReader()
        val shaSum = shaSumReader.readLine()
        shaSumReader.close()
        shaSumFile.close()

        val destRoot = File(filesDir, dirName)
        val destHash = File(destRoot, ".sha256")
        if (destHash.exists() && destHash.readText() == shaSum) {
            Log.i("extractIfNotFound", "Up to date (${destRoot.absolutePath})")
            return destRoot.absolutePath
        } else if (destHash.exists()) {
            Log.i("extractIfNotFound", "Outdated (Hashes don't match)")
            destRoot.deleteRecursively()
        } else {
            Log.i("extractIfNotFound", "Not exists")
        }
        Log.i("extractIfNotFound", "Extracting to ${destRoot.absolutePath}")
        destRoot.mkdir()
        val input = ZipInputStream(archive)
        var entry: ZipEntry?

        while (input.nextEntry.also { entry = it } != null) {
            if (entry!!.isDirectory) {
                continue
            }
            val fileName = entry!!.name
            val file = File(destRoot, fileName)
            file.parentFile?.mkdirs()
            val out = FileOutputStream(file)
            val buffer = ByteArray(1024)
            var len: Int
            Log.i("extractIfNotFound", "Extracting $fileName")
            while (input.read(buffer).also { len = it } > 0) {
                out.write(buffer, 0, len)
            }
        }
        input.close()
        archive.close()
        destHash.writeText(shaSum)
        Log.i("extractIfNotFound", "Done")
        return destRoot.absolutePath
    }
}
