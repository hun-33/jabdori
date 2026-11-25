package com.jabdori.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * 화면 코드(05d-widget.js)와 홈 화면 위젯 사이의 다리.
 *  - update({data})   앱이 만든 위젯 묶음(JSON 글자)을 보관하고 위젯을 모두 다시 그린다
 *  - pending()        위젯에서 쌓인 할 일(일반 일정 체크) 목록
 *  - ack({ids})       반영한 할 일 지우기
 *  - consumeLaunch()  위젯을 눌러 앱이 열렸다면 어디로 갈지 (한 번 읽으면 지움)
 *  - status()         홈 화면에 놓인 위젯 수, 앱에서 바로 추가 가능 여부
 *  - pin({kind})      홈 화면에 위젯 추가 요청 (안드로이드 8+, 홈 화면 앱이 지원할 때)
 * 이벤트: 'action'(위젯에서 체크함), 'launch'(앱이 켜진 채 위젯을 눌러 들어옴)
 */
@CapacitorPlugin(name = "Widget")
class WidgetPlugin : Plugin() {
    companion object {
        @Volatile var instance: WidgetPlugin? = null
    }

    override fun load() {
        instance = this
        takeTarget(activity?.intent)
    }

    override fun handleOnDestroy() {
        if (instance === this) instance = null
        super.handleOnDestroy()
    }

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        val t = takeTarget(intent) ?: return
        val ev = JSObject(); ev.put("target", t)
        notifyListeners("launch", ev)
    }

    /** 위젯이 연 인텐트면 갈 곳을 보관 (앱이 늦게 준비돼도 consumeLaunch로 받게) */
    private fun takeTarget(i: Intent?): String? {
        val t = i?.getStringExtra(WidgetRender.EXTRA_TARGET) ?: return null
        i.removeExtra(WidgetRender.EXTRA_TARGET)
        WidgetStore.setLaunch(context, t)
        return t
    }

    fun emitAction() {
        try { notifyListeners("action", JSObject()) } catch (e: Exception) { /* 무시 */ }
    }

    @PluginMethod
    fun update(call: PluginCall) {
        val raw = call.getString("data")
        if (raw.isNullOrEmpty()) { call.reject("data가 비어 있어요", "BAD_DATA"); return }
        val snap = try { JSONObject(raw) } catch (e: Exception) { call.reject("위젯 묶음을 읽지 못했어요", "BAD_DATA"); return }
        // 위젯에서 체크했는데 앱이 아직 반영하지 않은 것은 새 묶음에도 그대로 보이게 (깜빡임 방지)
        applyPendingTo(snap)
        WidgetStore.saveSnapshot(context, snap)
        WidgetRender.updateAll(context)
        call.resolve()
    }

    private fun applyPendingTo(snap: JSONObject) {
        val acts = WidgetStore.actions(context)
        if (acts.length() == 0) return
        val days = snap.optJSONObject("days") ?: return
        for (i in 0 until acts.length()) {
            val a = acts.optJSONObject(i) ?: continue
            if (a.optString("type") != "normalDone") continue
            val key = a.optString("key"); val done = a.optBoolean("done")
            val names = days.keys()
            while (names.hasNext()) {
                val arr = days.optJSONArray(names.next()) ?: continue
                for (j in 0 until arr.length()) {
                    val o = arr.optJSONObject(j) ?: continue
                    if (o.optString("k") == key && !o.optBoolean("j", false)) o.put("st", if (done) "done" else "todo")
                }
            }
        }
    }

    @PluginMethod
    fun pending(call: PluginCall) {
        val ret = JSObject()
        ret.put("actions", JSArray(WidgetStore.actions(context).toString()))
        call.resolve(ret)
    }

    @PluginMethod
    fun ack(call: PluginCall) {
        val arr = call.getArray("ids")
        val ids = HashSet<String>()
        if (arr != null) for (i in 0 until arr.length()) arr.optString(i, "").takeIf { it.isNotEmpty() }?.let { ids.add(it) }
        WidgetStore.removeActions(context, ids)
        call.resolve()
    }

    @PluginMethod
    fun consumeLaunch(call: PluginCall) {
        val ret = JSObject()
        WidgetStore.takeLaunch(context)?.let { ret.put("target", it) }
        call.resolve(ret)
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val mgr = AppWidgetManager.getInstance(context)
        val placed = JSObject()
        for ((kind, cls) in WidgetRender.KINDS) {
            val n = try { mgr.getAppWidgetIds(ComponentName(context, cls)).size } catch (e: Exception) { 0 }
            placed.put(kind, n)
        }
        val ret = JSObject()
        ret.put("placed", placed)
        var pinOK = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) pinOK = try { mgr.isRequestPinAppWidgetSupported } catch (e: Exception) { false }
        ret.put("pinSupported", pinOK)
        call.resolve(ret)
    }

    @PluginMethod
    fun pin(call: PluginCall) {
        val cls = WidgetRender.classOf(call.getString("kind") ?: "")
        val ret = JSObject()
        var ok = false
        if (cls != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = AppWidgetManager.getInstance(context)
            ok = try { mgr.isRequestPinAppWidgetSupported && mgr.requestPinAppWidget(ComponentName(context, cls), null, null) } catch (e: Exception) { false }
        }
        ret.put("ok", ok)
        call.resolve(ret)
    }
}
