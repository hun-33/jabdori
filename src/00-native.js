'use strict';
/* =========================================================
   00-native: 지금 '진짜 안드로이드 앱' 안에서 실행 중인지 알아내고,
   앱에서만 쓰는 네이티브 플러그인 손잡이를 준비한다.
   - 브라우저(PWA·미리보기)에서는 NATIVE.on === false → 기존 동작 그대로
   ========================================================= */
const NATIVE = (() => {
  const C = (typeof window !== 'undefined' && window.Capacitor) || null;
  const on = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  const ex = (typeof window !== 'undefined' && window.capacitorExports) || {};
  const reg = (name) => {
    if (!on || !C || typeof C.registerPlugin !== 'function') return null;
    try { return C.registerPlugin(name); } catch (e) { return null; }
  };
  return {
    on,                                   // 진짜 앱이면 true
    Kakao: reg('KakaoLogin'),             // 우리가 만든 카카오 로그인 플러그인 (KakaoLoginPlugin.kt)
    Notif: reg('LocalNotifications'),     // 시작·마감 알림 (앱이 꺼져 있어도 울림)
    Speech: reg('TextToSpeech'),          // 기기 음성으로 멘트 읽기
    Watch: reg('Distraction'),            // 딴짓 감지 (DistractionPlugin.kt + WatchService.kt)
    App: reg('App'),                      // 뒤로 가기 버튼, 앱 다시 열림 감지
    Bars: on ? (ex.SystemBars || reg('SystemBars')) : null, // 상태 표시줄 글자색
  };
})();
if (NATIVE.on && typeof document !== 'undefined') document.documentElement.classList.add('native');
