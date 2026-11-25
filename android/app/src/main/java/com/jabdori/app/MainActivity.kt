package com.jabdori.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * 앱의 첫 화면(웹뷰를 담는 액티비티).
 * 우리가 직접 만든 네이티브 플러그인은 super.onCreate 전에 등록해야 웹 코드에서 부를 수 있다.
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(KakaoLoginPlugin::class.java)
        registerPlugin(DistractionPlugin::class.java)
        registerPlugin(WidgetPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
