'use strict';
/* =========================================================
   00-native: 지금 '진짜 앱'(안드로이드·아이폰) 안에서 실행 중인지 알아내고,
   앱에서만 쓰는 네이티브 플러그인 손잡이를 준비한다.
   - 브라우저(PWA·미리보기)에서는 NATIVE.on === false → 기존 동작 그대로
   - 아이폰(NATIVE.ios)은 다른 앱 실행을 알아낼 방법이 없어 딴짓 감지(Watch)가 없다
   ========================================================= */
const NATIVE = (() => {
  const C = (typeof window !== 'undefined' && window.Capacitor) || null;
  const on = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  const platform = on && typeof C.getPlatform === 'function' ? C.getPlatform() : 'web'; // 'android' | 'ios' | 'web'
  const ex = (typeof window !== 'undefined' && window.capacitorExports) || {};
  const reg = (name) => {
    if (!on || !C || typeof C.registerPlugin !== 'function') return null;
    try { return C.registerPlugin(name); } catch (e) { return null; }
  };
  return {
    on,                                   // 진짜 앱이면 true
    platform,
    ios: platform === 'ios',              // 아이폰 앱이면 true
    Kakao: reg('KakaoLogin'),             // 우리가 만든 카카오 로그인 플러그인 (안드로이드 KakaoLoginPlugin.kt · 아이폰 KakaoLoginPlugin.swift)
    Notif: reg('LocalNotifications'),     // 시작·마감 알림 (앱이 꺼져 있어도 울림)
    Speech: reg('TextToSpeech'),          // 기기 음성으로 멘트 읽기
    Watch: platform === 'ios' ? null : reg('Distraction'), // 딴짓 감지 (안드로이드만: DistractionPlugin.kt + WatchService.kt)
    App: reg('App'),                      // 뒤로 가기 버튼, 앱 다시 열림 감지
    Bars: on ? (ex.SystemBars || reg('SystemBars')) : null, // 상태 표시줄 글자색
  };
})();
if (NATIVE.on && typeof document !== 'undefined') document.documentElement.classList.add('native', 'pf-' + NATIVE.platform);
