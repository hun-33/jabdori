package com.jabdori.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject

/**
 * 잡도리 중에만 켜지는 '딴짓 지켜보기' 서비스.
 * 2초마다 '사용 정보'에서 맨 앞에 열린 앱이 무엇인지 확인하고,
 * 지켜보는 앱(유튜브 등)을 정해 둔 시간(바로·1분·3분·5분) 넘게 쓰면
 *   1) 딴짓 기록을 저장하고 (앱을 다시 열면 pending()으로 넘어감)
 *   2) '다른 앱 위에 표시'가 허용돼 있으면 지금 쓰는 앱 위에 미루먼지 창을 띄운다 (잡도리 앱으로 넘어가지 않음).
 *      진행 중: 공부 중이야 · 잠깐 쉴게 · 다시 집중할게 / 시작 전: 지금 시작할게 · 조금만 있다가 — 고른 답은 앱에 기록
 *   3) 허용돼 있지 않으면 소리 나는 알림으로 알린다.
 * 계속 그 앱에 있으면 repeatSec(기본 5분)마다 다시 알린다. 다른 앱으로 가면 처음부터 다시 잰다.
 * untilMs(마감)가 지나면 스스로 멈춘다. quietUntilMs(휴식·'공부 중이야') 전에는 알리지 않는다.
 */
class WatchService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var packages: Set<String> = emptySet()
    private var labels = JSONObject()
    private var delayMs = 0L
    private var repeatMs = 300_000L
    private var untilMs = 0L
    private var quietUntilMs = 0L
    private var watchTitle = ""
    private var watchText = ""
    private var alertTitle = ""
    private var alertText = ""
    private var bringToFront = false
    private var useOverlay = true
    private var late = false              // 아직 시작 전(지각)인 잡도리를 지켜보는 중
    private var popLine = ""              // 미루먼지 창 첫 줄 ({app} = 앱 이름)
    private var popInfo = ""              // 둘째 줄 (일정 이름 등)
    private var replies = JSONObject()    // 답을 고른 뒤 잠깐 보여 줄 한마디 {study, rest, focus, later}
    private var studyMin = 10
    private var restMin = 5
    private var overlay: View? = null

    private var current: String? = null   // 지금 맨 앞에 있는 앱
    private var since = 0L                 // 그 앱을 연 때
    private var lastFire = 0L              // 마지막으로 알린 때
    private var lastQuery = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        packages = (intent.getStringArrayListExtra("packages") ?: arrayListOf<String>()).toSet()
        labels = try { JSONObject(intent.getStringExtra("labels") ?: "{}") } catch (e: Exception) { JSONObject() }
        delayMs = intent.getIntExtra("delaySec", 0) * 1000L
        repeatMs = maxOf(60, intent.getIntExtra("repeatSec", 300)) * 1000L
        untilMs = intent.getLongExtra("untilMs", 0L)
        quietUntilMs = intent.getLongExtra("quietUntilMs", 0L)
        watchTitle = intent.getStringExtra("watchTitle") ?: ""
        watchText = intent.getStringExtra("watchText") ?: ""
        alertTitle = intent.getStringExtra("alertTitle") ?: ""
        alertText = intent.getStringExtra("alertText") ?: ""
        bringToFront = intent.getBooleanExtra("bringToFront", false)
        useOverlay = intent.getBooleanExtra("overlay", true)
        late = intent.getBooleanExtra("late", false)
        popLine = intent.getStringExtra("popLine") ?: ""
        popInfo = intent.getStringExtra("popInfo") ?: ""
        replies = try { JSONObject(intent.getStringExtra("replies") ?: "{}") } catch (e: Exception) { JSONObject() }
        studyMin = intent.getIntExtra("studyMin", 10)
        restMin = intent.getIntExtra("restMin", 5)

        ensureChannels(this)
        val n = NotificationCompat.Builder(this, CH_WATCH)
            .setSmallIcon(R.drawable.ic_stat_mireum)
            .setContentTitle(if (watchTitle.isEmpty()) "미루먼지가 딴짓을 지켜보는 중" else watchTitle)
            .setContentText(watchText)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openAppIntent(this, 0, false))
            .build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID_WATCH, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        else startForeground(ID_WATCH, n)
        running = true
        handler.removeCallbacks(tick)
        handler.post(tick)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        running = false
        handler.removeCallbacks(tick)
        removeOverlay()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private val tick = object : Runnable {
        override fun run() {
            try { check() } catch (e: Exception) { /* 한 번 실패해도 다음 확인은 계속 */ }
            if (running) handler.postDelayed(this, 2000)
        }
    }

    private fun check() {
        val now = System.currentTimeMillis()
        if (untilMs in 1..now) {
            stopSelf()
            return
        }
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val from = if (lastQuery == 0L) now - 60_000L else lastQuery - 2_000L
        val evs = usm.queryEvents(from, now)
        val e = UsageEvents.Event()
        while (evs.hasNextEvent()) {
            evs.getNextEvent(e)
            when (e.eventType) {
                EV_RESUMED -> if (e.packageName != current) { current = e.packageName; since = e.timeStamp }
                EV_SCREEN_OFF -> { current = null; since = 0L }
            }
        }
        lastQuery = now

        val pkg = current
        if (pkg == null || pkg !in packages) {
            since = 0L; lastFire = 0L
            if (overlay != null && pkg != null && pkg != packageName) removeOverlay()   // 딴짓 앱을 나가면 창도 거둔다
            return
        }
        if (now < quietUntilMs) return
        if (since == 0L) since = now
        if (now - since < delayMs) return
        if (lastFire != 0L && now - lastFire < repeatMs) return
        lastFire = now
        fire(pkg, now, now - since)
    }

    private fun fire(pkg: String, now: Long, usedMs: Long) {
        val label = labels.optString(pkg, "").ifEmpty { labelOf(this, pkg) }
        val shown = try { showOverlay(label, now) } catch (e: Exception) { false }
        val ev = JSONObject()
        ev.put("type", "detect")
        ev.put("pkg", pkg)
        ev.put("app", label)
        ev.put("at", now)
        ev.put("usedSec", usedMs / 1000)
        ev.put("overlay", shown)
        ev.put("late", late)
        saveEvent(this, ev)
        try { DistractionPlugin.instance?.emit(JSObject(ev.toString())) } catch (e: Exception) { /* 앱이 꺼져 있으면 pending()으로 */ }
        if (shown) return   // 미루먼지 창이 떴으면 알림은 따로 안 띄운다

        ensureChannels(this)
        val title = if (alertTitle.isEmpty()) "딴짓 감지! $label" else alertTitle.replace("{app}", label)
        val n = NotificationCompat.Builder(this, CH_ALERT)
            .setSmallIcon(R.drawable.ic_stat_mireum)
            .setContentTitle(title)
            .setContentText(alertText.replace("{app}", label))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent(this, 1, true))
            .build()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(ID_ALERT, n)

        // (예전 방식) 잡도리 화면을 바로 앞으로 — 지금은 기본으로 쓰지 않는다
        if (bringToFront && DistractionPlugin.canOverlay(this)) openApp()
    }

    private fun openApp() {
        try {
            startActivity(Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("distraction", true))
        } catch (e: Exception) { /* 막히면 그대로 */ }
    }

    /* ---------------- 미루먼지 창 (다른 앱 위에 표시) ---------------- */

    private fun dp(v: Float): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

    @Suppress("DEPRECATION")
    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE

    private fun removeOverlay() {
        val v = overlay ?: return
        overlay = null
        try { (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(v) } catch (e: Exception) { /* 이미 없음 */ }
    }

    /** 지금 쓰는 앱 위에 미루먼지 창을 띄운다. 띄웠으면 true */
    private fun showOverlay(label: String, at: Long): Boolean {
        if (!useOverlay || !DistractionPlugin.canOverlay(this)) return false
        removeOverlay()
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val ink = Color.parseColor("#F3ECE0")
        val sub = Color.parseColor("#B9AC9A")

        val card = LinearLayout(this)
        card.orientation = LinearLayout.VERTICAL
        card.setPadding(dp(16f), dp(14f), dp(12f), dp(14f))
        card.background = GradientDrawable().apply { setColor(Color.parseColor("#2B2622")); cornerRadius = dp(22f).toFloat() }
        card.elevation = dp(10f).toFloat()

        val row = LinearLayout(this)
        row.orientation = LinearLayout.HORIZONTAL
        row.gravity = Gravity.CENTER_VERTICAL
        val img = ImageView(this)
        img.setImageResource(if (late) R.drawable.mireum_angry else R.drawable.mireum_watch)
        row.addView(img, LinearLayout.LayoutParams(dp(58f), dp(58f)))

        val texts = LinearLayout(this)
        texts.orientation = LinearLayout.VERTICAL
        texts.setPadding(dp(12f), 0, dp(4f), 0)
        val line = TextView(this)
        line.text = popLine.replace("{app}", label).ifEmpty { "킁킁… 딴짓 냄새!" }
        line.setTextColor(ink)
        line.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        line.typeface = Typeface.DEFAULT_BOLD
        texts.addView(line)
        val info = TextView(this)
        info.text = popInfo.replace("{app}", label)
        info.setTextColor(sub)
        info.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f)
        info.setPadding(0, dp(3f), 0, 0)
        if (popInfo.isNotEmpty()) texts.addView(info)
        row.addView(texts, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        val close = TextView(this)
        close.text = "✕"
        close.setTextColor(sub)
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
        close.setPadding(dp(10f), dp(6f), dp(6f), dp(6f))
        close.contentDescription = "닫기"
        row.addView(close)
        card.addView(row)

        val btns = LinearLayout(this)
        btns.orientation = LinearLayout.HORIZONTAL
        btns.setPadding(0, dp(12f), dp(4f), 0)
        val choices = if (late) listOf("start" to "지금 시작할게", "later" to "조금만 있다가")
            else listOf("study" to "공부 중이야", "rest" to "잠깐 쉴게", "focus" to "다시 집중할게")
        val primaryId = if (late) "start" else "focus"

        fun answer(id: String) {
            val now = System.currentTimeMillis()
            when (id) {
                "study" -> quietUntilMs = maxOf(quietUntilMs, now + studyMin * 60_000L)
                "rest" -> quietUntilMs = maxOf(quietUntilMs, now + restMin * 60_000L)
            }
            val ev = JSONObject()
            ev.put("type", "choice")
            ev.put("at", at)
            ev.put("choice", id)
            ev.put("app", label)
            ev.put("choiceAt", now)
            saveEvent(this, ev)
            try { DistractionPlugin.instance?.emit(JSObject(ev.toString())) } catch (e: Exception) { /* pending()으로 */ }
            if (id == "start") { removeOverlay(); openApp(); return }
            val reply = replies.optString(id, "")
            if (reply.isEmpty() || id == "dismiss") { removeOverlay(); return }
            line.text = reply
            texts.removeView(info)
            card.removeView(btns)
            handler.postDelayed({ removeOverlay() }, 1800)
        }

        for ((id, txt) in choices) {
            val b = TextView(this)
            b.text = txt
            b.gravity = Gravity.CENTER
            b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            b.typeface = Typeface.DEFAULT_BOLD
            val primary = id == primaryId
            b.setTextColor(if (primary) Color.parseColor("#26211C") else ink)
            b.background = GradientDrawable().apply {
                cornerRadius = dp(12f).toFloat()
                if (primary) setColor(ink) else { setColor(Color.TRANSPARENT); setStroke(dp(1.5f), Color.parseColor("#5A5148")) }
            }
            b.setOnClickListener { answer(id) }
            val lp = LinearLayout.LayoutParams(0, dp(44f), 1f)
            lp.setMargins(dp(4f), 0, dp(4f), 0)
            btns.addView(b, lp)
        }
        card.addView(btns)
        close.setOnClickListener { answer("dismiss") }

        val wrap = FrameLayout(this)
        wrap.setPadding(dp(12f), 0, dp(12f), 0)
        wrap.addView(card, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT, overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT)
        lp.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        lp.y = dp(44f)
        wm.addView(wrap, lp)
        overlay = wrap
        return true
    }

    companion object {
        const val CH_WATCH = "jabdori_watch"
        const val CH_ALERT = "jabdori_slack"
        const val ID_WATCH = 7301
        const val ID_ALERT = 7302
        private const val EV_RESUMED = 1        // UsageEvents.Event.ACTIVITY_RESUMED (= 예전 MOVE_TO_FOREGROUND)
        private const val EV_SCREEN_OFF = 16    // UsageEvents.Event.SCREEN_NON_INTERACTIVE
        private const val PREF = "jabdori_distraction"

        @Volatile
        var running = false

        fun ensureChannels(ctx: Context) {
            if (Build.VERSION.SDK_INT < 26) return
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CH_WATCH) == null)
                nm.createNotificationChannel(NotificationChannel(CH_WATCH, "딴짓 지켜보기", NotificationManager.IMPORTANCE_LOW))
            if (nm.getNotificationChannel(CH_ALERT) == null)
                nm.createNotificationChannel(NotificationChannel(CH_ALERT, "딴짓 감지 알림", NotificationManager.IMPORTANCE_HIGH))
        }

        fun openAppIntent(ctx: Context, req: Int, distraction: Boolean): PendingIntent {
            val i = Intent(ctx, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("distraction", distraction)
            return PendingIntent.getActivity(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        @Suppress("DEPRECATION")
        fun labelOf(ctx: Context, pkg: String): String = try {
            val pm = ctx.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        } catch (e: Exception) { pkg }

        fun saveEvent(ctx: Context, ev: JSONObject) {
            val sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val arr = try { JSONArray(sp.getString("events", "[]")) } catch (e: Exception) { JSONArray() }
            arr.put(ev)
            while (arr.length() > 20) arr.remove(0)
            sp.edit().putString("events", arr.toString()).apply()
        }

        fun takeEvents(ctx: Context): JSONArray {
            val sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val arr = try { JSONArray(sp.getString("events", "[]")) } catch (e: Exception) { JSONArray() }
            sp.edit().putString("events", "[]").apply()
            return arr
        }
    }
}
