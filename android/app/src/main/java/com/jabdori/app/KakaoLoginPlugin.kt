package com.jabdori.app

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.kakao.sdk.auth.AuthApiClient
import com.kakao.sdk.auth.model.OAuthToken
import com.kakao.sdk.common.model.ApiError
import com.kakao.sdk.common.model.AuthError
import com.kakao.sdk.common.model.ClientError
import com.kakao.sdk.common.model.ClientErrorCause
import com.kakao.sdk.common.util.Utility
import com.kakao.sdk.user.UserApiClient
import com.kakao.sdk.user.model.User
import java.io.IOException

/**
 * 웹 화면(JS)과 카카오 공식 SDK 사이를 이어 주는 다리.
 * JS에서는 Capacitor.registerPlugin('KakaoLogin') 으로 불러서 아래 메서드를 호출한다.
 *
 *  status()            설정 상태: 키 설정 여부, 카카오톡 설치 여부, 이 앱의 키 해시, 이미 로그인돼 있는지
 *  login({mode})       카카오 로그인 → 성공하면 사용자 정보까지 돌려줌 (mode: auto | talk | account)
 *  me()                지금 로그인된 사용자 정보 다시 받기 (앱을 다시 켰을 때 로그인 유지 확인)
 *  tokenInfo()         액세스 토큰이 카카오 서버 기준으로 살아 있는지 확인 (토큰 값은 넘기지 않음)
 *  scopes()            사용자가 동의한 개인정보 항목 목록
 *  requestScopes({scopes})  나중에 추가 동의 받기 (예: 이메일)
 *  logout()            카카오 로그아웃 (토큰만 지움, 앱 연결은 유지)
 *  unlink()            카카오 연결 끊기 (앱과 카카오 계정 연결 자체를 해제)
 */
@CapacitorPlugin(name = "KakaoLogin")
class KakaoLoginPlugin : Plugin() {

    private val STOP_REASONS = setOf("AccessDenied", "Misconfigured", "InvalidClient", "UnauthorizedClient", "InvalidScope")

    private fun configured(): Boolean = BuildConfig.KAKAO_NATIVE_APP_KEY.isNotEmpty()

    private fun requireConfigured(call: PluginCall): Boolean {
        if (!configured()) {
            call.reject("카카오 네이티브 앱 키가 설정되지 않았어요. android/gradle.properties의 KAKAO_NATIVE_APP_KEY를 채워 주세요.", "NOT_CONFIGURED")
            return false
        }
        return true
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val ret = JSObject()
        val ok = configured()
        ret.put("configured", ok)
        ret.put("packageName", context.packageName)
        ret.put("keyHash", try { Utility.getKeyHash(context) } catch (e: Exception) { "" })
        ret.put("talkAvailable", if (ok) UserApiClient.instance.isKakaoTalkLoginAvailable(context) else false)
        ret.put("hasToken", if (ok) AuthApiClient.instance.hasToken() else false)
        call.resolve(ret)
    }

    @PluginMethod
    fun login(call: PluginCall) {
        if (!requireConfigured(call)) return
        val mode = call.getString("mode") ?: "auto"
        val act = activity
        act.runOnUiThread {
            // 카카오계정(브라우저)으로 로그인했을 때의 결과 처리
            val accountCallback: (OAuthToken?, Throwable?) -> Unit = { token, error ->
                finishLogin(call, token, error, "account")
            }
            val useTalk = mode != "account" && UserApiClient.instance.isKakaoTalkLoginAvailable(act)
            if (useTalk) {
                UserApiClient.instance.loginWithKakaoTalk(act) { token, error ->
                    if (error != null) {
                        // 사용자가 직접 취소(뒤로 가기) → 다른 방법으로 넘어가지 않고 취소로 끝냄
                        if (error is ClientError && error.reason == ClientErrorCause.Cancelled) {
                            rejectWith(call, error)
                            return@loginWithKakaoTalk
                        }
                        // 동의 화면에서 '취소'를 눌렀거나, 카카오 앱 설정(키 해시·앱 키 등)이 틀린 경우는
                        // 브라우저 로그인으로 넘겨도 같은 결과라서 그대로 끝내고 원인을 알려 준다
                        if (error is AuthError && error.reason.name in STOP_REASONS) {
                            rejectWith(call, error)
                            return@loginWithKakaoTalk
                        }
                        // 카카오톡에 연결된 계정이 없는 등 → 카카오계정(브라우저) 로그인으로 대체
                        if (mode == "talk") {
                            rejectWith(call, error)
                        } else {
                            UserApiClient.instance.loginWithKakaoAccount(act, callback = accountCallback)
                        }
                    } else {
                        finishLogin(call, token, null, "talk")
                    }
                }
            } else {
                UserApiClient.instance.loginWithKakaoAccount(act, callback = accountCallback)
            }
        }
    }

    /** 토큰을 받은 뒤 사용자 정보까지 받아서 JS로 돌려준다. */
    private fun finishLogin(call: PluginCall, token: OAuthToken?, error: Throwable?, method: String) {
        if (error != null) {
            rejectWith(call, error)
            return
        }
        if (token == null) {
            call.reject("토큰을 받지 못했어요.", "NO_TOKEN")
            return
        }
        UserApiClient.instance.me { user, meError ->
            if (meError != null || user == null) {
                rejectWith(call, meError ?: IllegalStateException("사용자 정보가 비어 있어요."))
            } else {
                val ret = userToJs(user)
                ret.put("method", method)
                ret.put("scopesGranted", JSArray(token.scopes ?: emptyList<String>()))
                call.resolve(ret)
            }
        }
    }

    @PluginMethod
    fun me(call: PluginCall) {
        if (!requireConfigured(call)) return
        if (!AuthApiClient.instance.hasToken()) {
            call.reject("로그인돼 있지 않아요.", "NO_TOKEN")
            return
        }
        UserApiClient.instance.me { user, error ->
            if (error != null || user == null) rejectWith(call, error ?: IllegalStateException("사용자 정보가 비어 있어요."))
            else call.resolve(userToJs(user))
        }
    }

    /** 로그인 진단용: 액세스 토큰이 유효한지 카카오 서버에 물어본다. 토큰 문자열은 JS로 넘기지 않는다. */
    @PluginMethod
    fun tokenInfo(call: PluginCall) {
        if (!requireConfigured(call)) return
        if (!AuthApiClient.instance.hasToken()) {
            call.reject("로그인돼 있지 않아요.", "NO_TOKEN")
            return
        }
        UserApiClient.instance.accessTokenInfo { info, error ->
            if (error != null || info == null) {
                rejectWith(call, error ?: IllegalStateException("토큰 정보가 비어 있어요."))
            } else {
                val ret = JSObject()
                ret.put("id", info.id?.toString() ?: "")
                ret.put("expiresIn", info.expiresIn)
                call.resolve(ret)
            }
        }
    }

    @PluginMethod
    fun scopes(call: PluginCall) {
        if (!requireConfigured(call)) return
        UserApiClient.instance.scopes { scopeInfo, error ->
            if (error != null) {
                rejectWith(call, error)
                return@scopes
            }
            val arr = JSArray()
            scopeInfo?.scopes?.forEach { s ->
                val o = JSObject()
                o.put("id", s.id)
                o.put("name", s.displayName)
                o.put("agreed", s.agreed)
                arr.put(o)
            }
            val ret = JSObject()
            ret.put("scopes", arr)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun requestScopes(call: PluginCall) {
        if (!requireConfigured(call)) return
        val list = call.getArray("scopes")?.toList<String>() ?: emptyList()
        if (list.isEmpty()) {
            call.reject("요청할 동의 항목이 없어요.", "NO_SCOPES")
            return
        }
        val act = activity
        act.runOnUiThread {
            UserApiClient.instance.loginWithNewScopes(act, list) { token, error ->
                finishLogin(call, token, error, "scopes")
            }
        }
    }

    @PluginMethod
    fun logout(call: PluginCall) {
        if (!requireConfigured(call)) return
        UserApiClient.instance.logout { error ->
            // 이미 토큰이 없어도 로그아웃은 된 것으로 본다
            if (error != null && AuthApiClient.instance.hasToken()) rejectWith(call, error)
            else call.resolve()
        }
    }

    @PluginMethod
    fun unlink(call: PluginCall) {
        if (!requireConfigured(call)) return
        UserApiClient.instance.unlink { error ->
            if (error != null) rejectWith(call, error) else call.resolve()
        }
    }

    /* ---------------- 내부 도우미 ---------------- */

    /** 카카오 User 모델 → JS 객체. 사용자가 동의하지 않은 항목은 빈 값으로 온다. */
    private fun userToJs(user: User): JSObject {
        val o = JSObject()
        val acc = user.kakaoAccount
        val profile = acc?.profile
        o.put("id", user.id?.toString() ?: "")
        o.put("nickname", profile?.nickname ?: "")
        o.put("profileImage", profile?.profileImageUrl ?: "")
        o.put("thumbnail", profile?.thumbnailImageUrl ?: "")
        o.put("email", acc?.email ?: "")
        o.put("emailNeedsAgreement", acc?.emailNeedsAgreement ?: false)
        o.put("profileNeedsAgreement", acc?.profileNicknameNeedsAgreement ?: false)
        o.put("connectedAt", user.connectedAt?.time ?: 0L)
        return o
    }

    /** 카카오 오류 → JS가 구분하기 쉬운 코드로 바꿔서 실패 처리 */
    private fun rejectWith(call: PluginCall, error: Throwable) {
        val code = when (error) {
            is ClientError -> when (error.reason) {
                ClientErrorCause.Cancelled -> "CANCELLED"
                ClientErrorCause.NotSupported -> "TALK_NOT_AVAILABLE"
                else -> "CLIENT_" + error.reason.name
            }
            is AuthError -> if (error.reason.name == "AccessDenied") "ACCESS_DENIED" else "AUTH_" + error.reason.name
            is ApiError -> "API_" + error.reason.name
            else -> if (isNetwork(error)) "NETWORK" else "UNKNOWN"
        }
        val msg = error.message ?: error.toString()
        call.reject(msg, code)
    }

    private fun isNetwork(e: Throwable?): Boolean {
        var cur = e
        var depth = 0
        while (cur != null && depth < 6) {
            if (cur is IOException) return true
            cur = cur.cause
            depth++
        }
        return false
    }
}
