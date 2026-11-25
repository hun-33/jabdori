// swift-tools-version: 5.9
// 잡도리 아이폰 앱 전용 카카오 로그인 플러그인.
// npx cap sync ios 가 이 패키지를 ios/App/CapApp-SPM/Package.swift 에 자동으로 넣는다.
import PackageDescription

let package = Package(
    name: "JabdoriIosKakao",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "JabdoriIosKakao",
            targets: ["KakaoLoginPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        // 카카오 공식 iOS SDK (안드로이드는 v2-user 2.26.0, 아이폰은 SPM 2.30.0)
        .package(url: "https://github.com/kakao/kakao-ios-sdk.git", exact: "2.30.0")
    ],
    targets: [
        .target(
            name: "KakaoLoginPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "KakaoSDKCommon", package: "kakao-ios-sdk"),
                .product(name: "KakaoSDKAuth", package: "kakao-ios-sdk"),
                .product(name: "KakaoSDKUser", package: "kakao-ios-sdk")
            ],
            path: "ios/Sources/KakaoLoginPlugin")
    ]
)
