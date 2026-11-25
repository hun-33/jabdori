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
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject

/**
 * 잡도리 중에만 켜지는 '딴짓 지켜보기' 서비스.
 * 2초마다 '사용 정보'에서 맨 앞에 열린 앱이 무엇인지 확인하고,
 * 지켜보는 앱(유튜브 등)을 정해 둔 시간(바로·1분·3분·5분) 넘게 쓰면
 *   1) 딴짓 기록을 저장하고 (앱을 다시 열면 pending()으로 넘어감)
 *   2) 소리 나는 알림을 띄우고
 *   3) '다른 앱 위에 표시'가 허용돼 있으면 잡도리 화면을 바로 앞으로 불러온다.
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
    private var bringToFront = true

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
        bringToFront = intent.getBooleanExtra("bringToFront", true)

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
        if (pkg == null || pkg !in packages) { since = 0L; lastFire = 0L; return }
        if (now < quietUntilMs) return
        if (since == 0L) since = now
        if (now - since < delayMs) return
        if (lastFire != 0L && now - lastFire < repeatMs) return
        lastFire = now
        fire(pkg, now, now - since)
    }

    private fun fire(pkg: String, now: Long, usedMs: Long) {
        val label = labels.optString(pkg, "").ifEmpty { labelOf(this, pkg) }
        val ev = JSONObject()
        ev.put("pkg", pkg)
        ev.put("app", label)
        ev.put("at", now)
        ev.put("usedSec", usedMs / 1000)
        saveEvent(this, ev)

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

        try { DistractionPlugin.instance?.emit(JSObject(ev.toString())) } catch (e: Exception) { /* 앱이 꺼져 있으면 pending()으로 */ }

        // '다른 앱 위에 표시'가 허용돼 있으면 잡도리 화면을 바로 앞으로
        if (bringToFront && DistractionPlugin.canOverlay(this)) {
            try {
                startActivity(Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra("distraction", true))
            } catch (e: Exception) { /* 막히면 알림만 */ }
        }
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
