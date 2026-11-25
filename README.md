# 잡도리 — 미루먼지 안드로이드 앱 (v3)

폰에 직접 설치하는 **진짜 안드로이드 앱**이에요.

빌드마다 무엇이 바뀌었는지는 [CHANGELOG.md](CHANGELOG.md)에 있어요. 다음 빌드의 릴리스 노트는 `release-notes/build-번호.md`로 미리 넣어 두면 릴리스 설명에 그대로 들어가요(없으면 커밋 설명).

- **카카오 로그인**: 카카오 공식 SDK로 진짜 카카오톡이 열리고, 카카오 동의 화면에서 동의한 개인정보(닉네임·프로필 사진·이메일)를 받아 와요.
- **시작·마감 알림**: 앱을 꺼 둬도 시작·마감 때 폰 알림으로 와요.
- **목소리**: 미루먼지 멘트를 폰의 음성으로 읽어 줘요. 나 탭에서 소리 모드(끄기·중요할 때만·모든 멘트)와 빠르기를 골라요.

| 항목 | 값 |
|---|---|
| 패키지명 | `com.jabdori.app` |
| 카카오 키 해시 (팀 공용 개발 키) | `+NLMMnMAs9uu+AA/aQ5qYLC3q6U=` |
| 최소 안드로이드 | 7.0 (API 24) |
| 만든 방식 | 화면은 기존 웹 코드 그대로 + Capacitor 8 안드로이드 껍데기 + 코틀린 네이티브 플러그인 |
| 아이폰 | 이번엔 안드로이드만. 아이폰 앱은 맥과 애플 개발자 등록(유료)이 필요해요 |

---

## 무엇이 진짜이고 무엇이 아직 흉내인가

| 기능 | 이 앱에서 | 비고 |
|---|---|---|
| 카카오 로그인 (FN01) | **진짜** | 카카오톡 앱 → 카카오 동의 화면 → 회원번호·닉네임·프로필 사진·이메일 수신. 카카오톡이 없으면 카카오계정(브라우저) 로그인 |
| 로그아웃 / 카카오 로그아웃 / 연결 끊기 / 탈퇴 | **진짜** | 카카오 서버에 logout·unlink 요청 |
| 동의 내역 보기, 이메일 추가 동의 | **진짜** | 나 탭 |
| 시작·지각·임박·마감 알림 (FN03) | **진짜** | 앱이 꺼져 있어도 폰 알림 (안드로이드 로컬 알림) |
| 목소리 (TTS) | **진짜** | 폰에 설치된 한국어 음성 엔진. 한국어 음성이 없으면 나 탭에 '음성 설치' 버튼이 나와요 |
| 일정·반복·달력·미루먼지 농도·쌓인 먼지·기록 | **진짜** | 데이터는 폰 안에만 저장 |
| 딴짓 감지 (FN07) | 흉내 | 시연 도구의 YouTube/Instagram 버튼. 진짜 감지는 '사용 기록 접근' 특수 권한이 필요해 다음 단계 |
| 서버·DB·LLM | 없음 | 기기 간 동기화 없음 |

---

## 폰에 설치하기 — 처음 한 번 (약 40분)

> 순서: ① 카카오 등록 → ② PC 프로그램 설치 → ③ 프로젝트 준비 → ④ Android Studio로 열기 → ⑤ 폰 연결 → ⑥ 실행

### ① 카카오 디벨로퍼스에 앱 등록 (10분)

진짜 카카오 로그인을 쓰려면 카카오에 "이 앱이 카카오 로그인을 쓴다"고 등록해야 해요. **팀에서 한 명만** 하면 돼요.

1. **developers.kakao.com** → 오른쪽 위 **로그인**(본인 카카오 계정)
2. 위 메뉴 **내 애플리케이션** → **애플리케이션 추가하기**
   - 앱 이름: `잡도리`
   - 회사명: 팀 이름(예: `팀 잡도리`)
   - 카테고리: 생산성/교육 중 하나
   - 저장
3. 만든 앱을 누르고 **[앱] > [플랫폼 키] > [네이티브 앱 키]**로 들어가요.
   - **네이티브 앱 키** 값을 복사해서 메모장에 붙여 둬요. (③에서 써요)
   - 같은 화면의 Android 정보에 아래 두 값을 넣고 저장해요.
     - 패키지명: `com.jabdori.app`
     - 키 해시: `+NLMMnMAs9uu+AA/aQ5qYLC3q6U=`
4. **[카카오 로그인] > [사용 설정]**에서 상태를 **ON**으로 바꿔요.
5. **[카카오 로그인] > [동의항목]**에서 항목을 설정해요.
   - 닉네임 → **설정** → 필수 동의, 동의 목적(예: "잡도리 회원 표시") → 저장
   - 프로필 사진 → 선택 동의 → 저장
   - 카카오계정(이메일)은 개인 개발자 비즈 앱 전환이 먼저 필요해요(선택).
     - 전환 위치: **[앱] > [일반] > [비즈니스 정보] > 개인 개발자 비즈 앱 전환** (본인인증 필요)
     - 전환한 뒤 이메일을 **선택 동의**로 켜요.
     - 이메일 없이도 앱은 잘 돌아가요.

> 카카오 화면의 메뉴 이름은 업데이트에 따라 조금 다를 수 있어요. 핵심은 세 가지예요: **네이티브 앱 키 복사 / 패키지명·키 해시 등록 / 카카오 로그인 ON**.

### ② PC에 프로그램 두 개 설치 (15분, 처음 한 번)

1. **Node.js LTS**: nodejs.org → LTS 버튼 → 설치 파일 실행 → 계속 "다음"
2. **Android Studio**: developer.android.com/studio → 다운로드 → 설치 → 처음 실행할 때 **Standard** 설치 선택
   - 이때 안드로이드 SDK를 내려받느라 몇 분 걸려요.

### ③ 프로젝트 준비 (5분)

1. zip을 **한글과 띄어쓰기가 없는 경로**에 풀어요. 예: `C:\dev\jabdori-app`
   - 한글 경로(예: `바탕 화면`)에서는 안드로이드 빌드가 실패하는 경우가 있어요.
2. 그 폴더에서 주소창에 `cmd` 입력 → Enter (그 위치에서 명령 프롬프트가 열려요)
3. 아래 두 줄을 차례로 입력해요.
   ```
   npm install
   npm run build
   ```
   - `npm install`: 앱 껍데기(Capacitor)와 플러그인을 내려받아요.
   - `npm run build`: 화면 코드를 합쳐서 안드로이드 프로젝트에 넣어요.
4. `android\gradle.properties` 파일을 메모장으로 열어요.
   - 맨 아래 `KAKAO_NATIVE_APP_KEY=` 뒤에 ①에서 복사한 네이티브 앱 키를 붙여 넣고 저장해요.
   ```
   KAKAO_NATIVE_APP_KEY=1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
   ```

### ④ Android Studio로 열기 (첫 회 5~15분)

1. Android Studio → **Open** → `jabdori-app\android` 폴더 선택 (`android` 폴더를 열어야 해요)
2. 오른쪽 아래 진행 막대가 끝날 때까지 기다려요(**Gradle Sync**).
   - 처음엔 필요한 라이브러리를 내려받느라 오래 걸려요.
   - "Trust project?"가 나오면 **Trust**를 눌러요.
3. 키를 나중에 바꿨다면 위쪽에 뜨는 **Sync Now**를 눌러요.

### ⑤ 폰을 개발 모드로 연결 (5분)

갤럭시 기준이에요.
1. **설정 > 휴대전화 정보 > 소프트웨어 정보 > 빌드번호**를 7번 연속 눌러요 → "개발자 모드를 켰습니다"
2. **설정 > 개발자 옵션 > USB 디버깅**을 켜요.
3. USB 케이블로 PC와 연결해요.
   - 폰에 "USB 디버깅을 허용하시겠습니까?"가 뜨면 **허용**을 눌러요(항상 허용 체크).
4. Android Studio 위쪽 기기 목록에 내 폰 이름이 보이면 성공이에요.

### ⑥ 실행 ▶

1. Android Studio 위쪽의 초록 **▶ (Run 'app')** 버튼을 눌러요.
2. 1~2분 뒤 폰에 **잡도리(미루먼지 아이콘)** 가 설치되고 바로 열려요.
3. **카카오로 시작하기**를 누르면 진짜 카카오톡 → 동의 화면 → 잡도리로 돌아와 온보딩이 시작돼요.
4. 온보딩이 끝나면 "알림을 허용할까요?"가 떠요. **허용**을 눌러야 시작·마감 알림이 와요.

이제 USB를 뽑아도 폰에 앱이 남아 있어요. 홈 화면 아이콘으로 실행하면 돼요.

---

## 팀원 폰에 깔 APK 파일 만들기

1. Android Studio 메뉴 **Build > Generate App Bundles or APKs > Generate APKs**
   - 버전에 따라 메뉴 이름이 **Build APK(s)** 일 수 있어요.
2. 끝나면 오른쪽 아래 알림의 **locate**를 누르거나, 아래 위치에서 파일을 찾아요.
   `android\app\build\outputs\apk\debug\app-debug.apk`
3. 이 파일을 카톡·드라이브로 팀원 폰에 보내요.
4. 팀원 폰에서 파일을 열면 "출처를 알 수 없는 앱"을 허용하라고 나와요. 허용하고 **설치**를 눌러요.

- 팀 공용 서명 키로 서명돼서 **누가 어느 PC에서 빌드해도 키 해시가 같아요.** 카카오 등록은 한 번이면 돼요.
- 예전에 다른 키로 설치한 잡도리가 폰에 있으면 "앱이 설치되지 않았습니다"가 떠요. 기존 앱을 지우고 다시 설치하세요.

## (추천) Android Studio 없이 GitHub에서 APK 받기
PC에 아무것도 설치하지 않고, 폰에서 링크를 눌러 APK를 받는 방법이에요.
1. github.com 로그인 → **+ → New repository** → 이름 `jabdori-app` → **Public** → **Create repository**
2. **uploading an existing file** → `잡도리_GitHub업로드용.zip`을 푼 `jabdori-app` 폴더 **안의 것 전부**(`.github` 포함 90개 파일)를 끌어다 놓기 → **Commit changes**
3. (카카오 키가 있으면) **Settings > Secrets and variables > Actions > New repository secret**
   - Name: `KAKAO_NATIVE_APP_KEY`
   - Secret: 네이티브 앱 키
   - 키가 없어도 APK는 만들어지고, 앱에서 **흉내 모드로 둘러보기**로 써 볼 수 있어요.
4. **Actions** 탭 → 초록 버튼이 나오면 **I understand… enable** → 왼쪽 **안드로이드 APK 만들기** → **Run workflow**
5. 5~10분 뒤 초록 체크가 뜨면 저장소 첫 화면 오른쪽 **Releases**에 `jabdori.apk`가 생겨요.
6. 폰에서 아래 주소를 열고 파일을 받아 설치해요(출처를 알 수 없는 앱 허용).
   `https://github.com/<내 아이디>/jabdori-app/releases/latest/download/jabdori.apk`

빨간 X가 뜨면 실행 기록 → **build** → 빨간 줄이 있는 단계를 열어 오류 내용을 복사해 보내 주세요.

---

## 안 될 때

| 증상 | 원인과 해결 |
|---|---|
| 로그인 화면에 "카카오 앱 키가 아직 설정되지 않았어요" | ③-4의 `KAKAO_NATIVE_APP_KEY`가 비어 있어요. 넣고 **Sync Now** → 다시 ▶ |
| "카카오 앱 설정이 맞지 않아요" + `invalid android_key_hash` | ①-3의 패키지명·키 해시가 틀렸거나 비어 있어요. 오류 상자 아래 회색 글씨가 카카오가 보낸 원문이에요 |
| `KOE004` | ①-4 카카오 로그인 사용 설정이 OFF예요 |
| 카카오톡이 열렸다가 아무 일 없이 돌아옴 | 이미 동의한 계정이면 동의 화면이 다시 안 뜨고 바로 로그인돼요. 정상이에요 |
| 이메일이 "제공 안 함" | 이메일 동의항목이 꺼져 있거나 사용자가 선택 동의를 안 했어요. **나 > 이메일 제공에 동의하기**로 다시 물어볼 수 있어요 |
| 알림이 안 와요 | **나 > 시작·마감 알림**이 켜져 있는지, 폰 **설정 > 애플리케이션 > 잡도리 > 알림**이 허용인지 확인해요. 시연 도구로 가상 시각을 쓰는 중이면 알림을 예약하지 않아요 |
| 로그인이 진짜 됐는지 모르겠어요 | 나 탭 > '발표용 시연 도구 보이기'를 켜고 '로그인 진단'을 열어요. 7단계가 모두 초록이면 진짜 카카오 로그인이에요. 빨간 단계와 오류 코드를 알려 주세요 |
| 멘트 소리가 안 나요 | 나 탭 > 목소리에서 소리 모드가 '끄기'인지 봐요. 한국어 음성이 없다고 나오면 '음성 설치'를 눌러요(또는 폰 설정에서 '텍스트 음성 변환' 검색). 미디어 볼륨도 확인해요. 앱을 내려 둔 동안에는 소리 대신 알림이 와요 |
| Gradle Sync 실패 (`Could not resolve`) | 인터넷 연결을 확인하고 **File > Sync Project with Gradle Files**를 다시 해요. 회사·학교 망이면 막혀 있을 수 있어요 |
| `Unsupported class file major version` / JDK 오류 | **Settings > Build Tools > Gradle > Gradle JDK**를 **JetBrains Runtime 21**(또는 JDK 21)로 바꿔요 |
| 화면이 옛날 그대로 | 코드를 고쳤다면 `npm run build`를 다시 실행한 뒤 ▶을 눌러요 |

오류가 계속되면 Android Studio 아래쪽 **Build** 창의 빨간 첫 줄을 복사해서 알려 주세요.

---

## 발표할 때 (시연 도구)

- **나 > 발표용 시연 도구 보이기**를 켜면 오른쪽 가장자리에 **시연** 탭이 생겨요.
- 시연 탭 안에서 할 수 있는 것:
  - 시각 버튼(18:00, 19:30…): 가상 시각으로 바꿔 농도 변화를 보여 줘요. 이때는 알림을 예약하지 않아요.
  - **실제 시각 쓰기**: 다시 진짜 시간으로 돌아와요.
  - **카카오 로그인 흉내 모드**: 인터넷이 없을 때 로그인 시뮬레이션으로 발표해요.
  - **YouTube 실행**: 딴짓 팝업을 보여 줘요.

---

## 플레이 스토어에 올리려면 (나중에)

1. **Google Play Console** 개발자 계정을 만들어요. 1회 $25예요.
2. 2023년 11월 13일 이후에 만든 개인 계정은 바로 출시가 안 돼요. 테스터 12명 이상이 14일 연속 참여하는 **비공개 테스트**를 먼저 거쳐야 해요.
3. 출시용으로는 새 업로드 키를 만들어야 해요. 팀 공용 개발 키는 비밀번호가 공개돼 있어서 출시에 쓰면 안 돼요.
4. Play 앱 서명을 쓰면 Play Console에 나오는 **앱 서명 키의 SHA-1**을 Base64로 바꿔 카카오에 키 해시로 **추가** 등록해요.
5. 앱 이름·아이콘·스크린샷·개인정보처리방침 URL이 필요해요. 카카오에서 개인정보를 받으니 처리방침은 꼭 있어야 해요.

---

## 폴더와 코드 담당

### 전체 흐름
```
src/ (화면 코드)  ──npm run build──▶  www/ (합친 화면)  ──cap sync──▶  android/ (안드로이드 프로젝트)  ──▶  APK
                                        └ dist/ (같은 내용, 웹 PWA용)
```

### 화면 코드 구역 (`src/`)
| 파일 | 담당 |
|---|---|
| `00-native.js` | **진짜 앱 감지 구역.** `NATIVE.on`이 true면 안드로이드 앱 안이에요. `NATIVE.Kakao`·`Notif`·`Speech`·`App`·`Bars`는 각 네이티브 플러그인을 부르는 손잡이예요 |
| `01-core.js` | 유틸(숫자 조사 `josa`), 세기 정책(`HEAT_POLICY`), **눈금**(`SCALES` — 미루먼지 농도·공통 강도, `scaleOf`·`stageOf`·`lv`·`lvs`), **캐릭터 목록**(`CHARACTERS`, `charOf`·`persona`), 저장(`save`), 일정·회차·농도 계산, 로그(`logRun`·`logText`) |
| `01b-mireum.js` | 미루먼지 그림 생성기(`mireumSVG`) |
| `02-views.js` | 화면 그리기. 로그인 오류 안내(`LOGIN_ERR`)와 나 탭(`viewMe`)이 진짜 카카오 정보를 보여 줘요 |
| `03-sheets.js` | 시트·팝업·등록 폼 |
| `04-app.js` | 동작 연결. `startLogin`은 진짜 앱이면 `nativeLogin`으로 넘기고, `doAcct`는 진짜 앱이면 `nativeAccount`를 불러요. `scaleMode`는 단계 이름 설정 |
| `04b-input.js` | 휠 **직접 입력** 구역. `parseTimeInput`·`parseDurationInput`·`parseDateInput`이 글자를 시각·길이·날짜로 바꾸고, `evalInput`이 범위·순서를 검사해요 |
| `04c-voice.js` | **목소리 구역.** `voicePrefs`(소리 모드·빠르기), `speakable`(읽기 다듬기), `TTS.say`(모드·중복·우선순위 판단), `TTS.speak`(직접 듣기), `TTS.check`(한국어 음성 확인), `voiceSection`(나 탭 설정) |
| `04d-account.js` | **로그인 상태 확인 구역.** `diagBegin/diagStep/diagFail`(단계별 기록), `checkRealLogin`(카카오 서버에 토큰·사용자 정보 확인 후 회원·세션과 대조), `showLoginWelcome`(검증 후 성공 안내), `accountStatusBlock`(나 탭 로그인 상태), `viewLoginDiag`(개발자 진단) |
| `05b-voice-pack.js` | 캐릭터 목소리 파일 목록(`VOICE_PACKS`). `tools/make_voice_pack.py`가 만든다 |
| `05-native.js` | **진짜 앱 기능 구역.** 아래 표 참고 |

### `05-native.js` 함수
| 이름 | 담당 |
|---|---|
| `nativeLogin(opt)` | 카카오 로그인 시작. 설정 상태(`status`)를 확인하고, 토큰이 남아 있으면 바로 들어가요. 아니면 `KakaoLogin.login`으로 카카오톡이나 브라우저를 열어요 |
| `completeNativeLogin(u)` | 카카오가 준 사용자 `u`(회원번호·닉네임·사진·이메일)로 잡도리 회원을 찾거나 만들어요. 내부 계정은 `kakao:회원번호`로만 연결해요 |
| `applyKakaoProfile(mm, u)` | 카카오에서 받은 최신 정보를 회원 `mm`에 반영해요. 동의 안 한 항목은 빈 값이에요 |
| `kakaoErrorToLogin(e)` | 카카오 오류 코드를 로그인 화면 안내로 바꿔요. 취소·동의 거부·키 미설정·키 해시·네트워크를 구분해요 |
| `nativeRestoreSession()` | 앱을 다시 켤 때 토큰이 살아 있는지 확인해요. 만료면 "로그인이 만료됐어요"를 보여 주고, 오프라인이면 그대로 써요 |
| `loadKakaoScopes()` | 나 탭에서 카카오 동의 내역을 불러와요 |
| `nativeAccount(v)` | 로그아웃·카카오 로그아웃·연결 끊기·탈퇴를 카카오 서버에 실제로 요청해요 |
| `NOTIF.plan()` | 앞으로 7일 동안의 잡도리 일정에서 알림 목록을 만들어요. 알림은 시작, 10분 지각, 마감 30분 전, 마감 네 가지예요 |
| `NOTIF.apply()` | 목록이 바뀌었을 때만 기존 예약을 지우고 다시 예약해요 |
| `NOTIF.ask()` | 알림 권한을 요청해요. 안드로이드 13 이상에서 시스템 창이 떠요 |
| `nativeBars(dark)` | 화면이 숯색이면 상태 표시줄 글자를 밝게, 종이색이면 어둡게 해요 |
| `nativeBack()` | 안드로이드 뒤로 가기 처리. 메뉴 → 시트 → 결과 → 집중 모드 → 오늘 탭 순서로 닫고, 마지막엔 앱을 내려요 |
| `nativeBoot()` / `nativeInit()` | 첫 실행 때 실제 시각으로 맞추고, 알림·뒤로 가기·앱 복귀 감지를 연결해요 |

### 안드로이드 구역 (`android/app/src/main/`)
| 파일 | 담당 |
|---|---|
| `java/com/jabdori/app/KakaoLoginPlugin.kt` | **웹과 카카오 SDK 사이의 다리.** 메서드 7개를 제공해요: `status`, `login`, `me`, `scopes`, `requestScopes`, `logout`, `unlink`. 카카오 오류는 `CANCELLED`, `ACCESS_DENIED`, `AUTH_Misconfigured`, `NETWORK` 같은 코드로 바꿔 넘겨요 |
| `java/com/jabdori/app/JabdoriApplication.kt` | 앱이 켜질 때 `KakaoSdk.init(네이티브 앱 키)`로 카카오 SDK를 준비해요 |
| `java/com/jabdori/app/MainActivity.kt` | 웹 화면을 띄우는 첫 화면이에요. `KakaoLoginPlugin`을 등록해요 |
| `AndroidManifest.xml` | `AuthCodeHandlerActivity`(카카오 인증 뒤 돌아오는 문, 스킴 `kakao{앱키}://oauth`)와 카카오톡 설치 확인(`queries`)을 선언해요 |
| `res/` | 미루먼지 앱 아이콘·적응형 아이콘·알림 아이콘(`ic_stat_mireum`)·스플래시 |

### 빌드 설정
| 파일 | 담당 |
|---|---|
| `android/gradle.properties` | `KAKAO_NATIVE_APP_KEY`: 카카오 네이티브 앱 키를 넣는 곳 |
| `android/app/build.gradle` | 키를 코드(`BuildConfig.KAKAO_NATIVE_APP_KEY`)와 매니페스트에 넣어요. 카카오 SDK `v2-user 2.26.0`과 팀 공용 서명 키(`keystore/jabdori-dev.jks`)를 설정해요 |
| `android/build.gradle`, `variables.gradle` | 코틀린 2.3.0, 카카오 SDK 저장소(`devrepo.kakao.com`), 버전 값 |
| `build.mjs` | `src/`를 한 파일로 합쳐 `dist/`·`www/`에 써요 |
| `.github/workflows/android-apk.yml` | GitHub에서 APK를 자동으로 만들어요 |
| `tools/run_native_mock.py` | 진짜 앱 환경을 흉내 내 로그인·알림·TTS·뒤로 가기를 검사해요 |
| `tools/run_scale_voice.py` | 미루먼지 농도·단계 이름 전환·쌓인 먼지·숫자 조사·목소리 모드를 검사해요(57개) |
| `tools/run_input.py` | 휠 직접 입력의 형식·예외 처리를 검사해요 |
| `tools/run_calendar_login.py` | 일요일 시작 달력(1일 위치·주 이동·반복 요일)과 로그인 상태 화면·진단을 검사해요(40개) |
| `tools/run_calendar_v5.py` | v5 일정 구조(시작·종료·종일·여러 날·반복·마감)·한 폼 등록·일/주/월 달력·옛 데이터 변환을 검사해요(40개) |
| `tools/run_month_bars.py` | 월간 막대(여러 날 일정이 주마다 이어진 막대 + 제목 가운데, +N), 종일 버튼(잡도리 → 일반 일정/잡도리 끔) 검수 22개 |
| `tools/lines_dump.js` · `tools/make_voice_script.py` | 캐릭터 대사를 꺼내 목소리 대본(`voice/clips.json`, `voice/batchN.txt`)을 만들어요 |
| `tools/split_voice.py` | 한 번에 만든 긴 음성을 대사별 파일로 잘라요. ElevenLabs 기록의 글자별 시각(`voice/batchN.align.json`)으로 경계를 잡고, 줄 사이 숨소리는 버려요(짧은 소리 묶음은 가까운 무음에 맞춤) |
| `tools/make_voice_pack.py` | 잘린 음성 파일로 `05b-voice-pack.js` 목록을 만들어요 |
| `tools/run_voice_clips.py` | 미루먼지 v1 녹음 152개 검수: 파일 디코딩·대사 연결·말하기 버튼 → 녹음 재생·기기 음성 전환(14개) |

> 팀 공용 개발 키(`android/keystore/jabdori-dev.jks`, 비밀번호 `jabdori123`)는 **개발·시연 전용**이에요. 정식 출시에는 새 키를 쓰세요.
