package jp.hiroshiba.voicevox

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    public override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(CorePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
