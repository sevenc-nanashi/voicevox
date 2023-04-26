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
        String modelPath;
        try {
            modelPath = extractModel();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        core = new VoicevoxCore(modelPath);
    }

    @PluginMethod()
    public void getVersion(PluginCall call) {

        JSObject ret = new JSObject();
        ret.put("value", core.voicevoxGetVersion());
        call.resolve(ret);
    }

    @PluginMethod()
    public void getSupportedDevicesJson(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", core.voicevoxGetSupportedDevicesJson());
        call.resolve(ret);
    }

    @PluginMethod()
    public void getMetasJson(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", core.voicevoxGetMetasJson());
        call.resolve(ret);
    }

    private String extractModel() throws IOException {
        Context context = getContext();
        String filesDir = context.getFilesDir().getAbsolutePath();
        Log.i("extractModel", "filesDir: " + filesDir);
        File modelRoot = new File(filesDir, "model");
        if (modelRoot.exists()) {
            Log.i("extractModel", "modelRoot exists, skip extract");
            return modelRoot.getAbsolutePath();
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
        return modelRoot.getAbsolutePath();
    }
}
