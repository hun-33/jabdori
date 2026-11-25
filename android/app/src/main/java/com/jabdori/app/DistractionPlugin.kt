package com.jabdori.app

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * 딴짓 감지: 잡도리 중에 유튜브·인스타그램 같은 앱을 실제로 열었는지 알아내는 다리.
 * JS에서는 Capacitor.registerPlugin('Distraction') 으로 부른다.
 *
 *  status()               권한 상태: 사용 정보 접근(필수), 다른 앱 위에 표시(선택), 지켜보는 중인지
 *  openUsageSettings()    '사용 정보 접근 허용' 설정 화면 열기
 *  openOverlaySettings()  '다른 앱 위에 표시' 설정 화면 열기
 *  installed({packages})  주어진 앱 중 이 폰에 깔린 것과 그 이름
 *  start({...})           지켜보기 시작 (WatchService, 상단에 '지켜보는 중' 알림이 계속 보임)
 *  stop()                 지켜보기 멈춤
 *  pending()              앱이 꺼져 있던 동안 감지된 딴짓 목록을 받고 비움
 *  이벤트 'distraction'   앱이 살아 있을 때 감지되면 바로 알려 줌
 *
 * 개인정보: 어느 앱이 앞에 열렸는지(패키지 이름)만 보고, 앱 안의 내용은 보지 않는다. 기록은 이 폰에만 남는다.
 */
@CapacitorPlugin(name = "Distraction")
class DistractionPlugin : Plugin() {

    override fun load() {
        instance = this
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val ret = JSObject()
        ret.put("usageAccess", hasUsageAccess(context))
        ret.put("overlay", canOverlay(context))
        ret.put("watching", WatchService.running)
        call.resolve(ret)
    }

    @PluginMethod
    fun openUsageSettings(call: PluginCall) {
        try {
            context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            call.resolve()
        } catch (e: Exception) {
            call.reject("설정 화면을 열 수 없어요.", "NO_SETTINGS")
        }
    }

    @PluginMethod
    fun openOverlaySettings(call: PluginCall) {
        try {
            val i = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.packageName))
            context.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            call.resolve()
        } catch (e: Exception) {
            call.reject("설정 화면을 열 수 없어요.", "NO_SETTINGS")
        }
    }

    @PluginMethod
    fun installed(call: PluginCall) {
        val list = call.getArray("packages")?.toList<String>() ?: emptyList()
        val pm = context.packageManager
        val arr = JSArray()
        for (p in list) {
            if (pm.getLaunchIntentForPackage(p) == null) continue
            val o = JSObject()
            o.put("id", p)
            o.put("label", WatchService.labelOf(context, p))
            arr.put(o)
        }
        val ret = JSObject()
        ret.put("apps", arr)
        call.resolve(ret)
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (!hasUsageAccess(context)) {
            call.reject("사용 정보 접근 권한이 없어요.", "NO_USAGE_ACCESS")
            return
        }
        val d = call.data
        val pk = call.getArray("packages")?.toList<String>() ?: emptyList()
        val i = Intent(context, WatchService::class.java)
        i.putStringArrayListExtra("packages", ArrayList(pk))
        i.putExtra("labels", d.optJSONObject("labels")?.toString() ?: "{}")
        i.putExtra("delaySec", d.optInt("delaySec", 0))
        i.putExtra("repeatSec", d.optInt("repeatSec", 300))
        i.putExtra("untilMs", d.optLong("untilMs", 0L))
        i.putExtra("quietUntilMs", d.optLong("quietUntilMs", 0L))
        i.putExtra("watchTitle", d.optString("watchTitle", ""))
        i.putExtra("watchText", d.optString("watchText", ""))
        i.putExtra("alertTitle", d.optString("alertTitle", ""))
        i.putExtra("alertText", d.optString("alertText", ""))
        i.putExtra("bringToFront", d.optBoolean("bringToFront", true))
        try {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i) else context.startService(i)
            call.resolve()
        } catch (e: Exception) {
            call.reject("딴짓 감지를 시작할 수 없어요: " + (e.message ?: ""), "START_FAILED")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        context.stopService(Intent(context, WatchService::class.java))
        call.resolve()
    }

    @PluginMethod
    fun pending(call: PluginCall) {
        val events = WatchService.takeEvents(context)
        val out = JSArray()
        for (k in 0 until events.length()) out.put(events.getJSONObject(k))
        val ret = JSObject()
        ret.put("events", out)
        call.resolve(ret)
    }

    /** 감시 서비스가 딴짓을 찾았을 때 (앱이 살아 있으면) 웹 화면에 바로 알린다 */
    fun emit(ev: JSObject) {
        notifyListeners("distraction", ev, true)
    }

    companion object {
        @Volatile
        var instance: DistractionPlugin? = null

        fun hasUsageAccess(ctx: Context): Boolean {
            val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            return opMode(ops, ctx) == AppOpsManager.MODE_ALLOWED
        }

        @Suppress("DEPRECATION")
        private fun opMode(ops: AppOpsManager, ctx: Context): Int =
            if (Build.VERSION.SDK_INT >= 29) ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
            else ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)

        fun canOverlay(ctx: Context): Boolean = Settings.canDrawOverlays(ctx)
    }
}
