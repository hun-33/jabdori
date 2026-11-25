import Foundation
import UIKit
import Capacitor
import KakaoSDKCommon
import KakaoSDKAuth
import KakaoSDKUser

/**
 * 아이폰용 카카오 로그인 다리. 안드로이드 KakaoLoginPlugin.kt 와 이름·메서드·돌려주는 값이 같아서
 * 웹 화면(JS)은 Capacitor.registerPlugin('KakaoLogin') 하나로 두 폰을 똑같이 쓴다.
 *
 *  status()                설정 상태: 키 설정 여부, 카카오톡 설치 여부, 번들 ID, 이미 로그인돼 있는지
 *  login({mode})           카카오 로그인 → 성공하면 사용자 정보까지 (mode: auto | talk | account)
 *  me()                    지금 로그인된 사용자 정보 다시 받기
 *  tokenInfo()             액세스 토큰이 살아 있는지 카카오 서버에 확인 (토큰 값은 넘기지 않음)
 *  scopes()                사용자가 동의한 개인정보 항목 목록
 *  requestScopes({scopes}) 나중에 추가 동의 받기
 *  logout()                카카오 로그아웃 (토큰만 지움)
 *  unlink()                카카오 연결 끊기
 *
 * 앱 키는 Info.plist 의 KAKAO_NATIVE_APP_KEY (빌드할 때 KAKAO_NATIVE_APP_KEY 빌드 설정으로 채움).
 */
@objc(KakaoLoginPlugin)
public class KakaoLoginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KakaoLoginPlugin"
    public let jsName = "KakaoLogin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "me", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tokenInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scopes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestScopes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlink", returnType: CAPPluginReturnPromise)
    ]

    /// 카카오톡 로그인에서 이 이유로 실패하면 브라우저 로그인으로 넘겨도 결과가 같아서 바로 끝낸다 (안드로이드와 같음)
    private let stopReasons: Set<String> = ["AccessDenied", "Misconfigured", "InvalidClient", "UnauthorizedClient", "InvalidScope"]
    private var appKey = ""

    override public func load() {
        appKey = KakaoLoginPlugin.readAppKey()
        if !appKey.isEmpty {
            KakaoSDK.initSDK(appKey: appKey)
        }
        // 카카오톡에서 로그인하고 돌아올 때 kakao<앱키>://oauth 주소로 앱이 다시 열린다 → SDK에 넘겨 로그인 마무리
        NotificationCenter.default.addObserver(self, selector: #selector(self.handleOpenUrl(_:)), name: Notification.Name.capacitorOpenURL, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    static func readAppKey() -> String {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "KAKAO_NATIVE_APP_KEY") as? String) ?? ""
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if key.isEmpty || key.contains("$(") || key == "not_configured" { return "" }
        return key
    }

    @objc func handleOpenUrl(_ notification: NSNotification) {
        guard !appKey.isEmpty,
              let obj = notification.object as? [String: Any],
              let url = obj["url"] as? URL else { return }
        Task { @MainActor in
            if AuthApi.isKakaoTalkLoginUrl(url) {
                _ = AuthController.handleOpenUrl(url: url)
            }
        }
    }

    private func requireConfigured(_ call: CAPPluginCall) -> Bool {
        if appKey.isEmpty {
            call.reject("카카오 네이티브 앱 키가 설정되지 않았어요. 빌드할 때 KAKAO_NATIVE_APP_KEY를 넣어 주세요.", "NOT_CONFIGURED")
            return false
        }
        return true
    }

    @MainActor
    private func talkAvailable() -> Bool {
        // Info.plist 의 LSApplicationQueriesSchemes 에 kakaokompassauth 가 있어야 확인할 수 있다
        guard let url = URL(string: "kakaokompassauth://authorize") else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    @objc func status(_ call: CAPPluginCall) {
        let ok = !appKey.isEmpty
        Task { @MainActor in
            call.resolve([
                "configured": ok,
                "platform": "ios",
                "packageName": Bundle.main.bundleIdentifier ?? "",
                "keyHash": "",
                "talkAvailable": ok ? self.talkAvailable() : false,
                "hasToken": ok ? AuthApi.hasToken() : false
            ])
        }
    }

    @objc func login(_ call: CAPPluginCall) {
        guard requireConfigured(call) else { return }
        let mode = call.getString("mode") ?? "auto"
        Task { @MainActor in
            let useTalk = mode != "account" && self.talkAvailable()
            if !useTalk {
                self.loginWithAccount(call)
                return
            }
            UserApi.shared.loginWithKakaoTalk { token, error in
                guard let error = error else {
                    self.finishLogin(call, token, nil, "talk")
                    return
                }
                if let sdk = error as? SdkError {
                    // 사용자가 직접 취소 → 다른 방법으로 넘어가지 않고 취소로 끝냄
                    if sdk.isClientFailed && sdk.getClientError().reason == .Cancelled {
                        self.rejectWith(call, error)
                        return
                    }
                    // 동의 화면에서 취소했거나 카카오 앱 설정(번들 ID·앱 키)이 틀림 → 브라우저로 넘겨도 같은 결과
                    if sdk.isAuthFailed && self.stopReasons.contains("\(sdk.getAuthError().reason)") {
                        self.rejectWith(call, error)
                        return
                    }
                }
                // 카카오톡에 연결된 계정이 없는 등 → 카카오계정(브라우저) 로그인으로 대체
                if mode == "talk" {
                    self.rejectWith(call, error)
                } else {
                    Task { @MainActor in self.loginWithAccount(call) }
                }
            }
        }
    }

    @MainActor
    private func loginWithAccount(_ call: CAPPluginCall) {
        UserApi.shared.loginWithKakaoAccount(prompts: nil, loginHint: nil, nonce: nil) { token, error in
            self.finishLogin(call, token, error, "account")
        }
    }

    /// 토큰을 받은 뒤 사용자 정보까지 받아서 JS로 돌려준다.
    private func finishLogin(_ call: CAPPluginCall, _ token: OAuthToken?, _ error: Error?, _ method: String) {
        if let error = error {
            rejectWith(call, error)
            return
        }
        guard let token = token else {
            call.reject("토큰을 받지 못했어요.", "NO_TOKEN")
            return
        }
        let granted = token.scopes ?? []
        UserApi.shared.me { user, meError in
            guard meError == nil, let user = user else {
                self.rejectWith(call, meError ?? KakaoLoginPlugin.plainError("사용자 정보가 비어 있어요."))
                return
            }
            var ret = self.userToJs(user)
            ret["method"] = method
            ret["scopesGranted"] = granted
            call.resolve(ret)
        }
    }

    @objc func me(_ call: CAPPluginCall) {
        guard requireConfigured(call) else { return }
        if !AuthApi.hasToken() {
            call.reject("로그인돼 있지 않아요.", "NO_TOKEN")
            return
        }
        UserApi.shared.me { user, error in
            if let user = user, error == nil {
                call.resolve(self.userToJs(user))
            } else {
                self.rejectWith(call, error ?? KakaoLoginPlugin.plainError("사용자 정보가 비어 있어요."))
            }
        }
    }

    /// 로그인 진단용: 액세스 토큰이 유효한지 카카오 서버에 물어본다. 토큰 문자열은 JS로 넘기지 않는다.
    @objc func tokenInfo(_ call: CAPPluginCall) {
        guard requireConfigured(call) else { return }
        if !AuthApi.hasToken() {
            call.reject("로그인돼 있지 않아요.", "NO_TOKEN")
            return
        }
        UserApi.shared.accessTokenInfo { info, error in
            if let info = info, error == nil {
                call.resolve([
                    "id": info.id.map { String($0) } ?? "",
                    "expiresIn": Int(info.expiresIn)
                ])
            } else {
                self.rejectWith(call, error ?? KakaoLoginPlugin.plainError("토큰 정보가 비어 있어요."))
            }
        }
    }

    @objc func scopes(_ call: CAPPluginCall) {
        guard requireConfigured(call) else { return }
        UserApi.shared.scopes { info, error in
            if let error = error {
                self.rejectWith(call, error)
                return
            }
            let list: [[String: Any]] = (info?.scopes ?? []).map { s in
                ["id": s.id, "name": s.displayName, "agreed": s.agreed]
            }
            call.resolve(["scopes": list])
        }
    }

    @objc func requestScopes(_ call: CAPPluginCall) {
        guard requireConfigured(call) else { return }
        let list = call.getArray("scopes", String.self) ?? []
        if list.isEmpty {
            call.reject("요청할 동의 항목이 없어요.", "NO_SCOPES")
            return
        }
        Task { @MainActor in
            UserApi.shared.loginWithKakaoAccount(scopes: list) { token, error in
                self.finishLogin(call, token, error, "scopes")
            }
        }
    }

    @objc func logout(_ call: CAPPluginCall) {
        guard requireConfigured(call) else { return }
        UserApi.shared.logout { error in
            // 이미 토큰이 없어도 로그아웃은 된 것으로 본다
            if let error = error, AuthApi.hasToken() {
                self.rejectWith(call, error)
            } else {
                call.resolve()
            }
        }
    }

    @objc func unlink(_ call: CAPPluginCall) {
        guard requireConfigured(call) else { return }
        UserApi.shared.unlink { error in
            if let error = error {
                self.rejectWith(call, error)
            } else {
                call.resolve()
            }
        }
    }

    /* ---------------- 내부 도우미 ---------------- */

    /// 카카오 User 모델 → JS 객체 (안드로이드와 같은 이름). 동의하지 않은 항목은 빈 값.
    private func userToJs(_ user: User) -> [String: Any] {
        let acc = user.kakaoAccount
        let profile = acc?.profile
        var connected = 0
        if let d = user.connectedAt { connected = Int(d.timeIntervalSince1970 * 1000) }
        return [
            "id": user.id.map { String($0) } ?? "",
            "nickname": profile?.nickname ?? "",
            "profileImage": profile?.profileImageUrl?.absoluteString ?? "",
            "thumbnail": profile?.thumbnailImageUrl?.absoluteString ?? "",
            "email": acc?.email ?? "",
            "emailNeedsAgreement": acc?.emailNeedsAgreement ?? false,
            "profileNeedsAgreement": acc?.profileNicknameNeedsAgreement ?? false,
            "connectedAt": connected
        ]
    }

    private static func plainError(_ message: String) -> Error {
        return NSError(domain: "com.jabdori.app.kakao", code: 0, userInfo: [NSLocalizedDescriptionKey: message])
    }

    /// 카카오 오류 → JS가 구분하기 쉬운 코드 (안드로이드 rejectWith 와 같은 이름을 쓴다)
    private func rejectWith(_ call: CAPPluginCall, _ error: Error) {
        var code = "UNKNOWN"
        var msg = error.localizedDescription
        if let sdk = error as? SdkError {
            switch sdk {
            case .ClientFailed(let reason, let message):
                switch reason {
                case .Cancelled: code = "CANCELLED"
                case .NotSupported: code = "TALK_NOT_AVAILABLE"
                default: code = "CLIENT_\(reason)"
                }
                if let m = message, !m.isEmpty { msg = m }
            case .ApiFailed(let reason, let info):
                let name: String
                switch reason {
                case .InvalidAccessToken: name = "InvalidToken"        // 안드로이드 이름에 맞춤
                case .NotSignedUpUser: name = "NotRegisteredUser"      // 안드로이드 이름에 맞춤
                default: name = "\(reason)"
                }
                code = "API_" + name
                if let m = info?.msg, !m.isEmpty { msg = m }
            case .AuthFailed(let reason, let info):
                code = reason == .AccessDenied ? "ACCESS_DENIED" : "AUTH_\(reason)"
                if let m = info?.errorDescription, !m.isEmpty { msg = m }
            case .AppsFailed(let reason, _):
                code = "APPS_\(reason)"
            }
        } else if isNetwork(error) {
            code = "NETWORK"
        }
        call.reject(msg, code)
    }

    private func isNetwork(_ error: Error) -> Bool {
        var cur: NSError? = error as NSError
        var depth = 0
        while let e = cur, depth < 6 {
            if e.domain == NSURLErrorDomain { return true }
            cur = e.userInfo[NSUnderlyingErrorKey] as? NSError
            depth += 1
        }
        let text = String(describing: error)
        return text.contains("NSURLErrorDomain") || text.contains("URLError")
    }
}
