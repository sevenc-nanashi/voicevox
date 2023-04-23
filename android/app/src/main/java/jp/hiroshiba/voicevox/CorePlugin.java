package jp.hiroshiba.voicevox;

import android.app.Activity;
import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "VoicevoxCore")
public class CorePlugin extends Plugin {
    VoicevoxCore core;

    @Override
    public void load() {
        core = new VoicevoxCore();

        try {
            this.extractDict();
            this.extractModel();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @PluginMethod()
    public void initialize(PluginCall call) {
        Log.i("initialize", "initialize");
        Context context = getContext();
        VoicevoxCore.InitializeOptions options = new VoicevoxCore.InitializeOptions();
        options.openJtalkDictDir = context.getFilesDir().getAbsolutePath() + "/open_jtalk_dict";
        String modelDir = context.getFilesDir().getAbsolutePath() + "/model";
        try {
            core.checkReturnCode(core.voicevoxInitialize(options, modelDir));

            call.resolve();
        } catch (VoicevoxCore.VoicevoxException e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod()
    public void getVersion(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", core.voicevoxGetVersion());
        call.resolve(ret);
    }

    @PluginMethod()
    public void getMetasJson(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", core.voicevoxGetMetasJson());
        call.resolve(ret);
    }

    @PluginMethod()
    public void getSupportedDevicesJson(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", core.voicevoxGetSupportedDevicesJson());
        call.resolve(ret);
    }

    private void extractDict() throws IOException {
        Context context = getContext();
        String filesDir = context.getFilesDir().getAbsolutePath();
        Log.i("extractDict", "filesDir: " + filesDir);
        File dictRoot = new File(filesDir, "open_jtalk_dict");
        if (dictRoot.exists()) {
            Log.i("extractDict", "dictRoot exists, skip extract");
            return;
        }
        Log.i("extractDict", "dictRoot not exists, extract");
        dictRoot.mkdir();
        Activity act = getActivity();
        AssetManager assets = act.getResources().getAssets();
        InputStream openJtalkDict = assets.open("open_jtalk_dict.zip");
        ZipInputStream in = new ZipInputStream(openJtalkDict);

        ZipEntry entry;

        while ((entry = in.getNextEntry()) != null) {
            if (entry.isDirectory()) {
                continue;
            }
            String fileName = entry.getName();
            File file = new File(dictRoot, fileName);
            file.getParentFile().mkdirs();
            FileOutputStream out = new FileOutputStream(file);
            byte[] buffer = new byte[1024];
            int len;
            Log.i("extractDict", "extracting: " + fileName);
            while ((len = in.read(buffer)) > 0) {
                out.write(buffer, 0, len);
            }
            out.close();
        }
        in.close();
        openJtalkDict.close();
        Log.i("extractDict", "dict extracted");
    }

    private void extractModel() throws IOException {
        Context context = getContext();
        String filesDir = context.getFilesDir().getAbsolutePath();
        Log.i("extractModel", "filesDir: " + filesDir);
        File modelRoot = new File(filesDir, "model");
        if (modelRoot.exists()) {
            Log.i("extractModel", "modelRoot exists, skip extract");
            return;
        }
        Log.i("extractModel", "modelRoot not exists, extract");
        modelRoot.mkdir();
        Activity act = getActivity();
        AssetManager assets = act.getResources().getAssets();
        InputStream model = assets.open("model.zip");
        ZipInputStream in = new ZipInputStream(model);

        ZipEntry entry;

        while ((entry = in.getNextEntry()) != null) {
            if (entry.isDirectory()) {
                continue;
            }
            String fileName = entry.getName();
            File file = new File(modelRoot, fileName);
            file.getParentFile().mkdirs();
            FileOutputStream out = new FileOutputStream(file);
            byte[] buffer = new byte[1024];
            int len;
            Log.i("extractModel", "extracting: " + fileName);
            while ((len = in.read(buffer)) > 0) {
                out.write(buffer, 0, len);
            }
        }
        in.close();
        model.close();
        Log.i("extractModel", "model extracted");
    }

}
