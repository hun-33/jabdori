# 잡도리 — 미루먼지

미룬 일에서 태어난 구름 먼지 **미루먼지**가 일정을 지켜보며 잔소리하는 자기관리 앱이에요. 팀 찬희·규아·도훈이 만들어요.

폰에 직접 설치하는 **진짜 앱**이고, 안드로이드와 아이폰 둘 다 돼요. 화면 코드는 한 벌이라서 한 번 고치면 두 폰에 같이 들어가요.

| | 안드로이드 | 아이폰 |
|---|---|---|
| 받는 곳 | [Releases](https://github.com/hun-33/jabdori/releases)의 `build-N` → `jabdori.apk` | [Releases](https://github.com/hun-33/jabdori/releases)의 `ios-build-N` → `jabdori.ipa` |
| 항상 최신 받기 | https://github.com/hun-33/jabdori/releases/latest/download/jabdori.apk | 고정 주소 없음 (Releases에서 맨 위 `ios-build-N`) |
| 설치 방법 | 폰에서 APK를 받아 바로 설치 | Windows PC에서 Sideloadly로 설치 (7일마다 다시) |
| 앱 아이디 | 패키지명 `com.jabdori.app` | 번들 ID `com.jabdori.app` |
| 최소 버전 | 안드로이드 7.0 (API 24) | iOS 15 |

빌드마다 바뀐 점은 [CHANGELOG.md](CHANGELOG.md)에 있어요.

---

## 목차

1. [앱 소개](#1-앱-소개)
2. [무엇이 되나](#2-무엇이-되나)
3. [안드로이드에 설치하기](#3-안드로이드에-설치하기)
4. [아이폰에 설치하기](#4-아이폰에-설치하기)
5. [카카오 디벨로퍼스 설정](#5-카카오-디벨로퍼스-설정-팀에서-한-명-처음-한-번)
6. [GitHub에서 빌드·릴리스가 돌아가는 방식](#6-github에서-빌드릴리스가-돌아가는-방식)
7. [내 PC에서 직접 빌드하기](#7-내-pc에서-직접-빌드하기)
8. [안 될 때](#8-안-될-때)
9. [발표할 때 (시연 도구)](#9-발표할-때-시연-도구)
10. [코드 구조 (구역별 담당)](#10-코드-구조-구역별-담당)
11. [정식 출시하려면 (나중에)](#11-정식-출시하려면-나중에)
12. [주의 사항과 출처](#12-주의-사항과-출처)

---

## 1. 앱 소개

- **잡도리 일정**: 지켜볼 일정이에요. 시작·지각·마감을 챙기고, 끝내면 "참 잘했어" 도장, 못 끝내면 "넘쳤다" 도장이 찍혀요.
- **일반 일정**: 달력에만 적어 두는 일정이에요. 잔소리는 하지 않아요.
- **미루먼지 농도 (0~100)**: 잡도리 강도예요. 좋음·보통·나쁨·매우 나쁨·최악 다섯 단계이고, 짙을수록 미루먼지가 커지고 말이 세져요.
- **쌓인 먼지**: 잡도리를 실패하면 먼지가 한 겹 쌓여서 다음 일정이 더 짙은 농도에서 시작해요. 연속으로 해내면 먼지를 털어 내려가요.
- **기록**: 성공과 실패를 둘 다 남기고, 왜 농도가 짙어졌는지도 보여 줘요.
- 데이터는 **폰 안에만** 저장해요. 서버가 없어서 폰끼리 동기화되지 않아요.

---

## 2. 무엇이 되나

| 기능 | 안드로이드 | 아이폰 | 비고 |
|---|---|---|---|
| 카카오 로그인 | 됨 | 됨 | 카카오 공식 SDK. 카카오톡이 있으면 카카오톡으로, 없으면 카카오계정(브라우저)으로 로그인. 받는 정보는 닉네임·프로필 사진 |
| 로그아웃·카카오 로그아웃·연결 끊기·탈퇴 | 됨 | 됨 | 카카오 서버에 실제로 요청 |
| 로그인 진단 | 됨 | 됨 | 나 탭에서 '발표용 시연 도구 보이기'를 켜면 나오는 개발자 > 로그인 진단. 7단계 확인, 카카오 회원번호는 여기서만 보여요 |
| 일정 등록·반복·종일·여러 날·마감 | 됨 | 됨 | 한 폼에서 등록. 휠을 누르면 글자로 직접 입력도 돼요 |
| 달력 (일·주·월) | 됨 | 됨 | 고른 날짜를 한 번 더 누르면 그 날짜로 새 일정. 여러 날 일정은 주를 넘어 막대로 이어져요 |
| 시작·지각·마감 임박·마감 알림 | 됨 | 됨 | 앱을 꺼 둬도 폰 알림으로 와요. 고른 알림(n분 전)도 돼요 |
| 미루먼지 목소리 | 됨 | 됨 | 녹음한 대사 152개(미루먼지 v1). 녹음이 없는 말은 폰의 한국어 음성으로 읽어요 |
| 딴짓 감지 | 됨 | **안 됨** | 안드로이드: 잡도리 중 유튜브·인스타그램 등을 열면 알림, 허용하면 잡도리 화면을 앞으로 띄워요. 아이폰: Apple이 다른 앱 실행을 알 수 없게 막아 둬서 안 돼요 |
| 발표용 시연 도구 | 됨 | 됨 | 가상 시각, 딴짓 시뮬레이션, 테스트 데이터 등 |
| 웹(PWA) 버전 | | | `site` 브랜치. 브라우저에서 둘러보기용이고 카카오·알림은 흉내예요 |

---

## 3. 안드로이드에 설치하기

1. 폰에서 아래 주소를 열어요. 항상 가장 최근 빌드가 받아져요.
   `https://github.com/hun-33/jabdori/releases/latest/download/jabdori.apk`
2. 받은 파일을 열면 "출처를 알 수 없는 앱"을 허용하라고 나와요. 허용하고 **설치**를 눌러요.
3. 예전에 다른 서명 키로 설치한 잡도리가 있으면 "앱이 설치되지 않았습니다"가 떠요. 기존 앱을 지우고 다시 설치해요.

**딴짓 감지를 쓰려면** 나 탭 > 딴짓 감지를 켜고, 안내에 따라 휴대폰 설정에서 잡도리의 **사용 정보 접근**을 허용해요. **다른 앱 위에 표시**까지 허용하면 딴짓 앱 위로 잡도리 화면이 바로 떠요. 어떤 앱이 열렸는지만 확인하고 앱 안의 내용은 보지 않아요.

---

## 4. 아이폰에 설치하기

아이폰 앱은 Mac에서만 빌드할 수 있어서 **GitHub의 Mac 서버가 대신 만들어요.** 여기서 나오는 `.ipa`는 서명이 안 된 파일이라, 각자 **Windows PC + Sideloadly + 자기 Apple ID(무료)**로 서명해서 설치해요.

### ① PC 준비 (처음 한 번)

1. **iTunes**와 **iCloud**를 **Apple 홈페이지에서 받은 버전**으로 설치해요. Microsoft Store 버전은 Sideloadly가 못 써요.
2. **Sideloadly**를 sideloadly.io에서 받아 설치해요.

### ② 설치 (빌드마다)

1. [Releases](https://github.com/hun-33/jabdori/releases)에서 맨 위 `ios-build-N`의 `jabdori.ipa`를 PC에 받아요.
2. 아이폰을 USB로 PC에 연결해요. 아이폰에 "이 컴퓨터를 신뢰하겠습니까?"가 뜨면 **신뢰**를 눌러요.
3. Sideloadly를 열고 `jabdori.ipa`를 창에 끌어다 놓아요. **Apple account** 칸에 자기 Apple ID를 넣어요.
4. **Advanced options**에서 **Use automatic bundle ID** 체크를 **끄고**, 번들 ID가 `com.jabdori.app`인지 확인해요.
   - 켜 두면 번들 ID가 바뀌어서 **카카오 로그인이 안 돼요.** 카카오에는 `com.jabdori.app`만 등록돼 있어요.
5. **Start**를 누르고 Apple ID 비밀번호를 넣어요.
6. 아이폰에서 마무리해요.
   - **설정 > 일반 > VPN 및 기기 관리** → 내 Apple ID → **신뢰**
   - iOS 16 이상이면 **설정 > 개인정보 보호 및 보안 > 개발자 모드**를 켜고 재시동해요.
7. 홈 화면의 **잡도리**를 열어요.

### 알아 둘 것

- **7일마다 다시 설치해야 해요.** 무료 Apple ID로 서명한 앱은 7일 뒤에 안 열려요. 앱을 지우지 말고 ②로 덮어 설치해요. 앱을 지우면 기록도 같이 지워져요.
- 무료 Apple ID 하나로는 **앱 3개, 기기 3대**까지예요.
- **번들 ID `com.jabdori.app`은 Apple ID 하나만 쓸 수 있어요.** 처음 설치한 사람의 Apple ID에 묶여요.
  - 팀원 아이폰도 카카오 로그인까지 쓰려면, 그 Apple ID를 가진 사람의 PC에 팀원 아이폰을 연결해서 같은 방법으로 설치해요 (기기 3대까지).
  - 다른 Apple ID로 설치하면 "not available" 오류가 나요. 이때 **Use automatic bundle ID**를 켜고 설치하면 앱은 열려요. 대신 카카오 로그인은 안 되니 로그인 화면의 **흉내 모드로 둘러보기**로 써요.
- 무음 모드(옆 스위치)를 켜 두면 미루먼지 목소리가 안 들릴 수 있어요.

---

## 5. 카카오 디벨로퍼스 설정 (팀에서 한 명, 처음 한 번)

1. **developers.kakao.com** → 로그인 → **내 애플리케이션** → 잡도리 앱 (없으면 **애플리케이션 추가하기**)
2. **[앱] > [플랫폼 키] > [네이티브 앱 키]**
   - **Android 정보**: 패키지명 `com.jabdori.app`, 키 해시 `+NLMMnMAs9uu+AA/aQ5qYLC3q6U=`
   - **iOS 정보**: 번들 ID `com.jabdori.app`
   - 네이티브 앱 키 하나를 두 폰이 같이 써요. 이 키는 `android/gradle.properties`의 `KAKAO_NATIVE_APP_KEY`에 들어가 있고, GitHub 빌드가 안드로이드·아이폰 앱 둘 다에 넣어요.
3. **[카카오 로그인] > [사용 설정]**을 **ON**으로 바꿔요.
4. **[카카오 로그인] > [동의항목]**
   - 닉네임: 필수 동의
   - 프로필 사진: 선택 동의
   - 카카오계정(이메일)은 쓰지 않아요. 앱에서도 뺐어요.

> 카카오 화면의 메뉴 이름은 업데이트에 따라 조금 다를 수 있어요. 핵심은 **패키지명·키 해시·번들 ID 등록**과 **카카오 로그인 ON**이에요.

---

## 6. GitHub에서 빌드·릴리스가 돌아가는 방식

### 브랜치

| 브랜치 | 담당 |
|---|---|
| `main` | 앱 코드. 여기에 올리면 안드로이드·아이폰 릴리스가 자동으로 만들어져요 |
| `dev` | 시험용. 올리면 두 폰 다 **컴파일만** 확인하고 릴리스는 안 만들어요 |
| `site` | 웹(PWA) 버전. GitHub Pages가 이 브랜치를 보여 줘요 |
| `release-backup` | 처음 만들었던 APK 원본 백업 |

### 자동 빌드 (`.github/workflows/`)

| 파일 | 언제 | 하는 일 |
|---|---|---|
| `android-apk.yml` | `main`에 올릴 때 | Ubuntu 서버에서 APK를 만들어 `build-N` 릴리스로 올려요. **Latest** 표시가 붙어서 고정 주소가 항상 이 APK를 가리켜요 |
| `ios-ipa.yml` | `main`에 올릴 때 | Mac 서버(macos-26, Xcode 26)에서 서명 없는 `.ipa`를 만들어 `ios-build-N` 릴리스로 올려요. Latest 표시는 붙이지 않아요 |
| `dev-check.yml` | `dev`에 올릴 때 | 안드로이드 컴파일 확인. APK는 실행 결과의 Artifacts에 남아요 |
| `ios-dev-check.yml` | `dev`에 올릴 때 | 아이폰 컴파일 확인. IPA와 빌드 기록은 Artifacts에 남아요 |
| `restore-releases.yml` | 버튼으로만 | 저장소를 새로 만들 때 build-1~9 릴리스를 되살리는 데 한 번 썼어요 |

- **빌드 번호**: 지금까지 붙은 태그 중 가장 큰 번호 + 1이에요. 안드로이드는 `build-N`, 아이폰은 `ios-build-N`으로 따로 세요. 정식 출시 전이라 버전 대신 빌드 번호를 써요.
- **따로 빌드**: 아이폰 쪽 파일(`ios/`, `native/ios-kakao/`)만 바뀌면 안드로이드는 건너뛰고, 안드로이드 쪽 파일(`android/`)만 바뀌면 아이폰은 건너뛰어요. 문서(`*.md`, `release-notes/`)나 `tools/`만 바뀌면 둘 다 건너뛰어요.
- **직접 건너뛰기**: 커밋 설명에 `[android skip]`이나 `[ios skip]`을 넣으면 그쪽 빌드를 건너뛰어요. 번호도 쓰지 않아요.
- **릴리스 설명**: `release-notes/build-번호.md`(안드로이드)나 `release-notes/ios-build-번호.md`(아이폰)가 있으면 그 내용이 들어가요. 없으면 커밋 설명이 들어가요.
- **백업**: 릴리스마다 그 빌드의 앱 파일과 코드 zip(`jabdori-source-build-N.zip`, `jabdori-ios-source-build-N.zip`)이 붙어요.
- **카카오 키**: 저장소 **Settings > Secrets and variables > Actions**에 `KAKAO_NATIVE_APP_KEY`가 있으면 그걸 쓰고, 없으면 `android/gradle.properties`의 키를 써요. 로그에는 가려져서 나와요.
- 빌드가 빨간 X로 끝나면 **Actions** → 실패한 실행 → 빨간 단계를 열어 오류를 복사해 알려 주세요.

---

## 7. 내 PC에서 직접 빌드하기

GitHub 빌드만 써도 되면 이 부분은 건너뛰어도 돼요.

### 공통 준비

1. **Node.js LTS** (22 이상)를 nodejs.org에서 설치해요.
2. 저장소를 **한글·띄어쓰기가 없는 경로**에 받아요. 예: `C:\dev\jabdori`
3. 그 폴더에서 명령 프롬프트를 열고 `npm install`을 실행해요.

| 명령 | 하는 일 |
|---|---|
| `npm run web` | `src/`를 합쳐 `dist/`·`www/`를 만들어요 (화면만) |
| `npm run build` | 위 + 안드로이드 프로젝트에 복사 (`cap sync android`) |
| `npm run build:ios` | 위 + 아이폰 프로젝트에 복사 (`cap sync ios`) |
| `npm run open` / `npm run open:ios` | Android Studio / Xcode로 열기 |

### 안드로이드 (Windows·Mac)

1. **Android Studio**를 설치하고 처음 실행할 때 **Standard** 설치를 골라요.
2. `npm run build` → `npm run open`
3. 아래쪽 Gradle Sync가 끝날 때까지 기다려요. Gradle JDK는 21이어야 해요.
4. 폰에서 **설정 > 휴대전화 정보 > 소프트웨어 정보 > 빌드번호**를 7번 눌러 개발자 모드를 켜고, **개발자 옵션 > USB 디버깅**을 켜요.
5. 폰을 USB로 연결하고 ▶를 눌러요.

팀 공용 서명 키(`android/keystore/jabdori-dev.jks`)로 서명돼서 누가 빌드해도 키 해시가 같아요. 카카오 등록은 한 번이면 돼요.

### 아이폰 (Mac만)

1. **Xcode 26** 이상을 설치해요.
2. `npm run build:ios` → `npm run open:ios`
3. Xcode에서 **App** 타깃 > **Build Settings**에 `KAKAO_NATIVE_APP_KEY`를 추가하고 네이티브 앱 키를 넣어요.
4. **Signing & Capabilities**에서 자기 Apple ID 팀을 골라요.
5. 아이폰을 연결하고 ▶를 눌러요.

---

## 8. 안 될 때

| 증상 | 원인과 해결 |
|---|---|
| 로그인 화면에 "카카오 앱 키가 아직 설정되지 않았어요" | 빌드에 네이티브 앱 키가 안 들어갔어요. `android/gradle.properties`의 `KAKAO_NATIVE_APP_KEY`를 확인해요 |
| "카카오 앱 설정이 맞지 않아요" (안드로이드) | 카카오에 패키지명·키 해시가 없거나 틀렸어요. 오류 상자 아래 회색 글씨가 카카오가 보낸 원문이에요 |
| "카카오 앱 설정이 맞지 않아요" (아이폰) | 카카오에 번들 ID `com.jabdori.app`이 없거나, Sideloadly에서 **Use automatic bundle ID**가 켜져 있었어요. 로그인 진단(아래 맨 끝 줄 참고)에서 번들 ID를 확인해요 |
| `KOE004` | 카카오 로그인 사용 설정이 OFF예요 |
| 카카오톡이 열렸다가 아무 일 없이 돌아와요 | 이미 동의한 계정이면 동의 화면 없이 바로 로그인돼요. 정상이에요 |
| "로그인이 만료됐어요" | 앱을 2달쯤 안 열었거나, 카카오에서 연결을 끊었어요. 다시 로그인하면 일정과 기록은 그대로예요. (진단 화면의 "토큰 남은 시간"이 12시간 안에서 줄어드는 건 정상이고, 끝나면 자동으로 새로 받아요) |
| 알림이 안 와요 | 나 탭 > 알림이 켜져 있는지 봐요. 안드로이드는 **설정 > 애플리케이션 > 잡도리 > 알림**, 아이폰은 **설정 > 알림 > 잡도리**에서 허용해요. 시연 도구로 가상 시각을 쓰는 중이면 알림을 예약하지 않아요 |
| 목소리가 안 나요 | 나 탭 > 목소리에서 소리 모드가 "끄기"인지 봐요. 미디어 볼륨, 아이폰은 무음 스위치도 확인해요. 앱을 내려 둔 동안에는 소리 대신 알림이 와요 |
| 한국어 음성이 없다고 나와요 | 안드로이드는 나 탭 > 목소리 > **음성 설치**. 아이폰은 **설정 > 손쉬운 사용 > 읽기 및 말하기 > 음성 > 한국어**에서 내려받아요 |
| 딴짓 감지가 안 돼요 (안드로이드) | 나 탭 > 딴짓 감지에서 **사용 정보 접근**이 "허용됨"인지 봐요. 휴식 중이거나 "공부 중이야"라고 답한 동안은 알리지 않아요 |
| 아이폰 앱이 안 열려요 | 설치한 지 7일이 지났어요. Sideloadly로 다시 설치해요 |
| Sideloadly에서 "not available" | `com.jabdori.app`이 다른 Apple ID에 묶여 있어요. [4장 알아 둘 것](#알아-둘-것)을 봐요 |
| Gradle Sync 실패 (`Could not resolve`) | 인터넷을 확인하고 **File > Sync Project with Gradle Files**를 다시 해요. 학교 망은 막혀 있을 수 있어요 |
| 화면이 옛날 그대로 | 코드를 고쳤다면 `npm run build`(아이폰은 `build:ios`)를 다시 실행해요 |

오류가 계속되면 **로그인 진단** 화면(나 탭 > '발표용 시연 도구 보이기' 켜기 > 개발자 > 로그인 진단)이나 빌드 오류의 빨간 첫 줄을 캡처해서 알려 주세요.

---

## 9. 발표할 때 (시연 도구)

**나 탭 > 발표용 시연 도구 보이기**를 켜면 오른쪽 가장자리에 **시연** 탭이 생기고, 나 탭에 **개발자 > 로그인 진단**도 나타나요.

| 구역 | 할 수 있는 것 |
|---|---|
| 가상 시각 | 시각 버튼(18:00, 19:30 …)과 앞뒤로 옮기기로 시간을 바꿔 농도가 짙어지는 걸 보여 줘요. **실제 시각 쓰기**로 진짜 시간으로 돌아와요. 가상 시각 중에는 알림을 예약하지 않아요 |
| 진짜 앱 | **흉내 모드**를 켜면 다음 로그인을 카카오에 연결하지 않고 시뮬레이션해요. 인터넷이 없을 때 써요 |
| 다음 로그인 결과 | 흉내 모드일 때 카카오톡 설치 여부를 바꾸거나 토큰을 만료시켜 볼 수 있어요. **로그인 진단 열기**도 여기 있어요 |
| 딴짓 시뮬레이션 | **YouTube 실행**·**Instagram 실행**으로 딴짓 팝업을 보여 줘요. 아이폰에서도 돼요 |
| 테스트 데이터 | 등록 폼에 테스트 값 채우기, 공통 테스트 일정 넣기, 오늘 회차 되돌리기, 전체 초기화 |
| 지금 상태 · 공통 시연 순서 | 지금 상태 요약과, 발표 때 따라 할 순서 안내 |

---

## 10. 코드 구조 (구역별 담당)

### 전체 흐름

```
src/ (화면 코드 한 벌)
  └─ build.mjs ──▶ dist/index.html (웹 PWA)  =  www/index.html
                                                 ├─ cap sync android ──▶ android/ ──▶ jabdori.apk
                                                 └─ cap sync ios ──────▶ ios/ ──────▶ jabdori.ipa
```

- **화면**: HTML·CSS·순수 JavaScript로 직접 만들었어요. React 같은 프레임워크는 쓰지 않았어요.
- **앱 껍데기**: Capacitor 8이 위 화면을 앱 안의 웹 화면(안드로이드 WebView, 아이폰 WKWebView)에 띄워요.
- **폰 기능**: 웹만으로 안 되는 것만 네이티브 플러그인으로 만들었어요. 안드로이드는 Kotlin, 아이폰은 Swift예요.
- **화면이 바뀌는 원리**: `state`(저장되는 데이터)가 바뀌면 `render()`가 화면 HTML을 다시 만들어 갈아 끼워요. 버튼에는 `data-act="이름"`이 붙어 있고, 눌리면 `ACT.이름` 함수가 실행돼요.

### 화면 코드 구역 (`src/`) — 합치는 순서대로

| 파일 | 담당 | 주요 이름 |
|---|---|---|
| `index.html` | 빈 뼈대. 빌드 때 CSS·Capacitor·JS가 이 안에 들어가요 | |
| `styles.css`, `mireum.css` | 색·배치·애니메이션, 미루먼지 움직임. 글꼴은 Pretendard | |
| `00-native.js` | **어느 폰인지 알아내는 구역.** 진짜 앱인지, 안드로이드인지 아이폰인지 판단하고 플러그인 손잡이를 준비해요 | `NATIVE.on`(앱이면 참), `NATIVE.platform`(`android`·`ios`·`web`), `NATIVE.ios`, `NATIVE.Kakao`(카카오), `Notif`(알림), `Speech`(음성), `Watch`(딴짓 감지, 아이폰은 없음), `App`(뒤로 가기·앱 복귀), `Bars`(상태 표시줄) |
| `01-core.js` | **데이터와 계산 구역.** 날짜 계산, 저장, 일정·회차, 농도, 캐릭터 대사 | `state`·`save`·`load`(저장), `occursOn`·`occWindow`·`occurrencesOn`(그날 회차와 시간), `heatOf`(지금 농도), `SCALES`·`stageOf`(단계), `floorOf`(쌓인 먼지 바닥), `CHARACTERS`·`persona`(캐릭터), `pickLine`·`fillLine`(대사 고르기), `startOcc`·`finishOcc`·`logRun`(시작·끝·기록) |
| `01b-mireum.js` | **미루먼지 그리기 구역.** 표정·자세·부풂을 조합해 SVG로 그려요 | `mireumSVG`, `MR_FACES`(표정), `MR_POSES`(자세) |
| `02-views.js` | **화면 조각 구역.** 탭마다 HTML을 만들어요 | `viewLogin`(로그인), `viewOnboarding`(처음 안내), `viewToday`(오늘), `viewCalendar`·`monthGridHTML`·`weekBars`(달력·월간 막대), `viewFocus`(집중 모드), `viewRecords`(기록), `viewMe`(나), `LOGIN_ERR`(로그인 오류 안내) |
| `03-sheets.js` | **시트·팝업 구역.** 아래에서 올라오는 창과 등록 폼 | `viewForm`·`newDraft`·`validateDraft`(일정 등록), `viewResult`(성공·실패 도장), `viewSlackPopup`(딴짓 팝업), `viewConsent`(흉내 동의 화면) |
| `04-app.js` | **동작 연결 구역.** 그리기, 버튼 처리, 시연 도구 | `render`(화면 다시 그리기), `ACT`(버튼 함수 모음), `startLogin`(진짜 앱이면 `nativeLogin`으로), `toast`(짧은 안내), `consoleBody`(시연 도구), `init`(시작) |
| `04b-input.js` | **직접 입력 구역.** 휠 대신 글자로 시각·길이·날짜를 넣어요 | `parseTimeInput`(18:30, 오후 6시 반 …), `parseDurationInput`, `parseDateInput`(12/3, 내일 …), `evalInput`(범위·순서 검사) |
| `04c-voice.js` | **목소리 구역.** 녹음 파일을 틀거나 폰 음성으로 읽어요 | `voicePrefs`(소리 모드·빠르기), `speakable`(18:30 → 18시 30분), `TTS.say`(읽을지 판단), `TTS.check`(한국어 음성 확인), `TTS.install`(음성 설치 안내) |
| `04d-account.js` | **로그인 확인 구역.** 로그인이 진짜 됐는지 단계별로 확인하고 기록해요 | `DIAG_STEPS`(7단계), `diagBegin`·`diagStep`·`diagFail`(기록), `checkRealLogin`(카카오에 다시 확인), `showLoginWelcome`(확인 후 성공 안내), `viewLoginDiag`(진단 화면) |
| `05-native.js` | **진짜 앱 기능 구역.** 아래 표 참고 | |
| `05b-voice-pack.js` | 녹음 파일 152개 목록 (`tools/make_voice_pack.py`가 만들어요) | `VOICE_PACKS` |
| `05c-watch.js` | **딴짓 감지 구역 (안드로이드).** 지켜볼 잡도리를 골라 감시를 켜고 끄고, 감지되면 팝업을 띄워요 | `WATCH_APPS`(지켜볼 앱), `watchPrefs`(설정), `watchTarget`(지금 지켜볼 일정), `WATCH.sync`(감시 시작·멈춤), `slackDetected`(감지 처리, 시연 버튼과 같이 씀), `watchSection`(나 탭 설정, 아이폰은 안내만) |
| `sw.js`, `manifest.webmanifest` | 웹(PWA) 버전에서 오프라인 실행·홈 화면 설치 | |
| `voice/mireum/` | 미루먼지 녹음 `m001.mp3`~`m152.mp3` | |

### `05-native.js` 함수

| 이름 | 담당 |
|---|---|
| `nativeLogin(opt)` | 카카오 로그인 시작. 설정 상태를 확인하고, 토큰이 남아 있으면 바로 들어가요. 아니면 카카오톡이나 브라우저를 열어요 |
| `completeNativeLogin(u)` | 카카오가 준 사용자 `u`로 잡도리 회원을 찾거나 만들어요. 내부 계정은 `kakao:회원번호`로만 연결해요 |
| `applyKakaoProfile(mm, u)` | 카카오에서 받은 최신 닉네임·사진을 회원 `mm`에 반영해요 |
| `kakaoErrorToLogin(e)` | 카카오 오류 코드를 로그인 화면 안내로 바꿔요 (취소·동의 거부·키 없음·설정 오류·네트워크) |
| `nativeRestoreSession()` | 앱을 다시 켤 때 로그인이 살아 있는지 확인해요. 만료면 안내하고, 오프라인이면 그대로 써요 |
| `loadKakaoScopes()` | 나 탭에 카카오 동의 내역을 불러와요 |
| `nativeAccount(v)` | 로그아웃·카카오 로그아웃·연결 끊기·탈퇴를 카카오에 요청해요 |
| `NOTIF.plan()` | 앞으로 7일 알림 목록을 만들어요 (시작·10분 지각·마감 30분 전·마감, 고른 알림). 최대 60개라 아이폰 제한(64개) 안이에요 |
| `NOTIF.apply()` | 목록이 바뀌었을 때만 예약을 지우고 다시 예약해요 |
| `NOTIF.ask()` | 알림 권한을 요청해요 |
| `nativeBars(dark)` | 화면 색에 맞춰 상태 표시줄 글자색을 바꿔요 |
| `nativeBack()` | 안드로이드 뒤로 가기: 입력창 → 시트 → 결과 → 집중 모드 → 오늘 탭 순서로 닫고, 마지막엔 앱을 내려요 |
| `nativeBoot()` · `nativeInit()` | 처음 켤 때 실제 시각으로 맞추고 알림·딴짓 감지·앱 복귀 감지를 연결해요 |

### 안드로이드 구역 (`android/app/src/main/`)

| 파일 | 담당 |
|---|---|
| `java/.../KakaoLoginPlugin.kt` | **화면과 카카오 SDK 사이의 다리.** `status`, `login`, `me`, `tokenInfo`, `scopes`, `requestScopes`, `logout`, `unlink`. 카카오 오류는 `CANCELLED`, `ACCESS_DENIED`, `AUTH_Misconfigured`, `NETWORK` 같은 코드로 바꿔 넘겨요. 토큰 값은 화면으로 넘기지 않아요 |
| `java/.../DistractionPlugin.kt` | **딴짓 감지 다리.** 권한 확인·설정 열기(`status`, `openUsageSettings`, `openOverlaySettings`), 깔린 앱 확인(`installed`), 감시 시작·멈춤(`start`, `stop`), 놓친 감지 받기(`pending`) |
| `java/.../WatchService.kt` | **딴짓 감시 서비스.** 2초마다 지금 앞에 열린 앱을 확인하고, 정해 둔 시간 넘게 쓰면 알림을 띄워요. '다른 앱 위에 표시'를 허용했으면 잡도리 화면도 앞으로 가져와요. 계속 쓰면 5분마다 다시 알려요 |
| `java/.../JabdoriApplication.kt` | 앱이 켜질 때 카카오 SDK를 네이티브 앱 키로 준비해요 |
| `java/.../MainActivity.kt` | 웹 화면을 띄우는 첫 화면. 위 플러그인들을 등록해요 |
| `AndroidManifest.xml` | 카카오 인증 뒤 돌아오는 문(`kakao{앱키}://oauth`), 카카오톡 설치 확인, 알림·사용 정보 접근·다른 앱 위에 표시 권한, 감시 서비스 |
| `res/` | 미루먼지 앱 아이콘·알림 아이콘(`ic_stat_mireum`)·스플래시 |
| `android/gradle.properties` | `KAKAO_NATIVE_APP_KEY` (카카오 네이티브 앱 키) |
| `android/app/build.gradle` | 키를 코드와 매니페스트에 넣고, 카카오 SDK `v2-user 2.26.0`과 팀 공용 서명 키를 설정해요 |

### 아이폰 구역 (`ios/`, `native/ios-kakao/`)

| 파일 | 담당 |
|---|---|
| `native/ios-kakao/ios/Sources/KakaoLoginPlugin/KakaoLoginPlugin.swift` | **아이폰용 카카오 다리.** 안드로이드와 이름(`KakaoLogin`)·메서드 8개·오류 코드가 같아서 화면 코드는 그대로 써요. 카카오톡에서 돌아오는 주소(`kakao{앱키}://oauth`)도 여기서 받아요. 카카오 iOS SDK 2.30.0 |
| `native/ios-kakao/Package.swift` | 위 플러그인을 Swift 패키지로 묶어요. `npx cap sync ios`가 자동으로 앱에 넣어요 |
| `ios/App/App/Info.plist` | 앱 이름 `잡도리`, 세로 고정, 카카오 스킴, 카카오톡 설치 확인 목록, 앱 키 자리(`KAKAO_NATIVE_APP_KEY`) |
| `ios/App/App/Assets.xcassets` | 미루먼지 앱 아이콘(1024)·시작 화면 |
| `ios/App/App.xcodeproj` | Xcode 프로젝트. GitHub 빌드가 이걸로 `.ipa`를 만들어요 |

### 도구 구역 (`tools/`)

| 파일 | 담당 |
|---|---|
| `make_assets.py` · `make_android_assets.py` · `make_ios_assets.py` | 미루먼지 그림으로 에셋·안드로이드 아이콘·아이폰 아이콘과 시작 화면을 만들어요 |
| `build_gallery.py` · `shoot_showcase.py` | 표정·자세 갤러리, 발표용 화면 캡처 |
| `lines_dump.js` · `make_voice_script.py` | 캐릭터 대사를 꺼내 녹음 대본을 만들어요 |
| `split_voice.py` · `make_voice_pack.py` | 한 번에 녹음한 긴 음성을 대사별 파일로 자르고, 목록(`05b-voice-pack.js`)을 만들어요 |
| `run_*.py` | 화면 자동 검사 (Playwright). `run_native_mock.py`는 안드로이드 앱 흉내, `run_ios_mock.py`는 아이폰 앱 흉내, `run_watch.py`는 딴짓 감지, `run_voice_clips.py`는 녹음, `run_month_bars.py`·`run_cal_retap.py`·`run_calendar_*.py`는 달력, `run_input.py`는 직접 입력, `run_scale_voice.py`는 농도·목소리, `run_flow.py`·`run_scenarios.py`·`run_v5.py`는 전체 흐름이에요 |

> 검사 스크립트는 만든 환경의 경로(`/home/claude/jabdori-app`)를 쓰고 있어요. 다른 PC에서 돌리려면 스크립트 위쪽의 `URL` 경로를 바꿔야 해요.

### 문서

| 파일 | 담당 |
|---|---|
| `README.md` | 이 문서 |
| `CHANGELOG.md` | 빌드별 바뀐 점 (릴리스 노트와 같은 내용) |
| `DESIGN.md` | 디자인 기준 (색·글꼴·미루먼지·화면 규칙) |
| `release-notes/` | 다음 릴리스에 들어갈 노트. `builds.json`은 build-1~9가 어느 커밋인지 적은 표 |

---

## 11. 정식 출시하려면 (나중에)

**플레이 스토어**
1. Google Play Console 개발자 계정을 만들어요 (1회 $25).
2. 2023년 11월 13일 이후에 만든 개인 계정은 테스터 12명 이상이 14일 연속 참여하는 비공개 테스트를 먼저 거쳐야 해요.
3. 출시용 서명 키를 새로 만들어요. 팀 공용 개발 키는 비밀번호가 공개돼 있어서 쓰면 안 돼요.
4. Play 앱 서명을 쓰면 Play Console의 앱 서명 키 SHA-1을 Base64로 바꿔 카카오에 키 해시로 추가 등록해요.

**앱 스토어**
1. Apple Developer Program에 가입해요 (연 $99). 가입하면 TestFlight로 팀원에게 링크로 나눠 줄 수 있고, 7일 제한이 없어져요.
2. GitHub 빌드에 서명 인증서와 프로비저닝 프로필을 넣어 서명된 빌드를 만들도록 바꿔요.

**공통**: 앱 이름·아이콘·스크린샷·개인정보처리방침 URL이 필요해요. 카카오에서 개인정보를 받으니 처리방침은 꼭 있어야 해요. 녹음 목소리는 상업용으로 쓸 수 있는 조건인지 다시 확인해야 해요 (아래 참고).

---

## 12. 주의 사항과 출처

- **팀 공용 개발 키**: `android/keystore/jabdori-dev.jks`와 비밀번호가 저장소에 공개돼 있어요. 개발·시연 전용이에요.
- **카카오 네이티브 앱 키**: 공개 저장소의 `android/gradle.properties`에 들어 있어요. 앱 키는 앱 안에도 들어가는 값이라 숨길 수 없고, 카카오는 등록된 패키지명·키 해시·번들 ID로 앱을 확인해요.
- **토큰**: 카카오 액세스·리프레시 토큰은 카카오 SDK가 폰 안에 보관해요. 화면 코드나 로그에는 토큰 값을 남기지 않아요.
- **카카오 회원번호**: 일반 화면에는 보여 주지 않고 개발자 진단 화면에서만 보여 줘요.
- **미루먼지 목소리**: ElevenLabs로 만든 오리지널 목소리예요(특정 성우를 복제하지 않음). 무료 플랜이라 **비상업용**이고 **출처 표기**가 필요해서, 앱의 나 탭 > 목소리에 출처를 표시해요.
- **글꼴**: Pretendard (SIL Open Font License, `dist/fonts/Pretendard-LICENSE.txt`)
- **만든 도구**: Capacitor 8.6, 카카오 SDK(안드로이드 2.26.0, iOS 2.30.0), Kotlin, Swift
