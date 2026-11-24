package com.jabdori.app

import android.app.Application
import com.kakao.sdk.common.KakaoSdk

/**
 * 앱 프로세스가 시작될 때 한 번 실행되는 곳.
 * 카카오 SDK는 다른 카카오 기능을 쓰기 전에 네이티브 앱 키로 초기화해야 한다.
 */
class JabdoriApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        val key = BuildConfig.KAKAO_NATIVE_APP_KEY
        if (key.isNotEmpty()) {
            KakaoSdk.init(this, key)
        }
    }
}
