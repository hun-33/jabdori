package com.jabdori.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StrikethroughSpan
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.UUID

/**
 * 홈 화면 위젯 그리기 · 누름 처리 · 다시 그릴 때 예약.
 *
 * 위젯 4종 (각각 AppWidgetProvider):
 *  - TodayWidgetProvider  오늘의 일정 (날짜 · 완료 수 · 진행률 · 일정 줄 · 큰 크기면 미루먼지 한마디). 일반 일정은 여기서 바로 체크
 *  - NextWidgetProvider   다음 일정 (이름 · 시작 시각 · 남은 시간 카운트다운 · 진행 중/시작 전 일정)
 *  - MireumWidgetProvider 미루먼지 (표정 · 한마디 · 지금 농도 · 오늘 진행)
 *  - StatsWidgetProvider  잡도리 통계 (오늘 완료율 · 이번 주 성공률 · 연속 성공)
 *
 * 다시 그리는 때: 앱이 새 묶음을 넘길 때(WidgetPlugin.update), 위젯에서 체크할 때, 회차 상태가 바뀌는 시각(알람),
 * 크기를 바꿀 때, 시각·시간대를 바꿀 때. 알람은 화면을 깨우지 않는 종류(RTC)라 화면이 꺼져 있으면 켜질 때 한 번에 그린다.
 */
object WidgetRender {
    const val ACTION_CHECK = "com.jabdori.app.widget.CHECK"
    const val ACTION_TICK = "com.jabdori.app.widget.TICK"
    const val ACTION_OPEN = "com.jabdori.app.widget.OPEN"
    const val EXTRA_KEY = "key"
    const val EXTRA_TARGET = "jabdori_widget"

    val KINDS: List<Pair<String, Class<*>>> = listOf(
        "today" to TodayWidgetProvider::class.java,
        "next" to NextWidgetProvider::class.java,
        "mireum" to MireumWidgetProvider::class.java,
        "stats" to StatsWidgetProvider::class.java,
    )

    fun classOf(kind: String): Class<*>? = KINDS.firstOrNull { it.first == kind }?.second

    /** 모든 위젯을 지금 묶음으로 다시 그리고, 다음에 다시 그릴 시각을 예약한다 */
    fun updateAll(c: Context) {
        val mgr = AppWidgetManager.getInstance(c) ?: return
        val model = WidgetModel.load(c)
        var any = false
        for ((kind, cls) in KINDS) {
            val ids = try { mgr.getAppWidgetIds(ComponentName(c, cls)) } catch (e: Exception) { IntArray(0) }
            for (id in ids) { any = true; updateOne(c, mgr, id, kind, model) }
        }
        scheduleNext(c, if (any) model else null)
    }

    fun updateOne(c: Context, mgr: AppWidgetManager, id: Int, kind: String, model: WidgetModel = WidgetModel.load(c)) {
        val opts = try { mgr.getAppWidgetOptions(id) } catch (e: Exception) { Bundle() }
        // 세로 화면 기준: 너비 = 최소 너비, 높이 = 최대 높이 (안드로이드 문서 권장)
        val w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0).takeIf { it > 0 } ?: defaultW(kind)
        val h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0).takeIf { it > 0 } ?: defaultH(kind)
        val views = try {
            when (kind) {
                "today" -> today(c, model, w, h)
                "next" -> next(c, model, w, h)
                "mireum" -> mireum(c, model, w, h)
                else -> stats(c, model, w, h)
            }
        } catch (e: Exception) {
            // 그리다 문제가 나도 빈 위젯 대신 앱을 열어 달라는 안내
            message(c, R.layout.widget_today, "앱을 열면 다시 불러올게요.")
        }
        try { mgr.updateAppWidget(id, views) } catch (e: Exception) { /* 홈 화면 앱이 거절하면 다음에 */ }
    }

    private fun defaultW(kind: String) = if (kind == "today") 250 else 110
    private fun defaultH(kind: String) = 110

    // ---------------------------------------------------------------- 오늘의 일정
    private fun today(c: Context, m: WidgetModel, w: Int, h: Int): RemoteViews {
        val v = RemoteViews(c.packageName, R.layout.widget_today)
        v.setOnClickPendingIntent(R.id.w_head, open(c, "today"))
        v.setOnClickPendingIntent(R.id.w_add, open(c, "add"))
        v.removeAllViews(R.id.w_rows)
        v.setViewVisibility(R.id.w_mascot, View.GONE)
        v.setViewVisibility(R.id.w_line, View.GONE)
        v.setViewVisibility(R.id.w_more, View.GONE)
        v.setViewVisibility(R.id.w_msg, View.GONE)
        v.setTextViewText(R.id.w_date, WidgetModel.dateLong(m.today))
        if (!m.login) return notReady(c, v, "카카오로 로그인하면 오늘 일정이 여기에 보여요.", "today")
        val list = m.todayItems ?: return notReady(c, v, "앱을 한동안 열지 않아서 일정을 불러오지 못했어요. 앱을 한 번 열어 주세요.", "today")
        val (done, total) = m.progress()
        v.setTextViewText(R.id.w_count, if (total == 0) "오늘 일정 없음" else "$done/$total 완료 · ${pct(done, total)}%")
        v.setProgressBar(R.id.w_progress, 100, pct(done, total), false)
        v.setViewVisibility(R.id.w_progress, if (total == 0) View.GONE else View.VISIBLE)

        val large = h >= 250 && w >= 250
        if (large) {
            m.mood()?.let { md ->
                bitmap(c, md.img, 160)?.let { b -> v.setImageViewBitmap(R.id.w_mascot, b); v.setViewVisibility(R.id.w_mascot, View.VISIBLE) }
                if (md.line.isNotEmpty()) { v.setTextViewText(R.id.w_line, "${m.name} · ${md.line}"); v.setViewVisibility(R.id.w_line, View.VISIBLE) }
            }
        }
        if (list.isEmpty()) {
            v.setTextViewText(R.id.w_msg, "오늘은 비어 있어요. + 를 눌러 일정을 올려 보세요.")
            v.setViewVisibility(R.id.w_msg, View.VISIBLE)
            v.setOnClickPendingIntent(R.id.w_msg, open(c, "add"))
            return v
        }
        // 크기에 맞춰 줄 수: 머리 영역(약 62dp, 큰 크기면 + 한마디 약 40dp)을 빼고 한 줄 약 46dp
        val head = 62 + (if (large) 44 else 0)
        var rows = ((h - head) / 46).coerceIn(0, 8)
        if (rows < list.size && rows > 0) rows = ((h - head - 30) / 46).coerceIn(0, 8) // '+N개 더' 자리
        val shown = list.take(rows)
        for (it in shown) v.addView(R.id.w_rows, row(c, m, it))
        val rest = list.size - shown.size
        if (rest > 0) {
            v.setTextViewText(R.id.w_more, if (shown.isEmpty()) "일정 ${list.size}개 · 눌러서 앱에서 보기" else "+${rest}개 더 · 앱에서 보기")
            v.setViewVisibility(R.id.w_more, View.VISIBLE)
            v.setOnClickPendingIntent(R.id.w_more, open(c, "today"))
        }
        return v
    }

    private fun row(c: Context, m: WidgetModel, it: WItem): RemoteViews {
        val r = RemoteViews(c.packageName, R.layout.widget_row)
        val k = m.kindOf(it)
        val icon = when (k) {
            "done" -> R.drawable.ic_w_done
            "failed" -> R.drawable.ic_w_fail
            "running", "break", "overdue" -> R.drawable.ic_w_live
            "late", "missedStart" -> R.drawable.ic_w_late
            "upcoming", "past" -> R.drawable.ic_w_heat
            else -> R.drawable.ic_w_ring   // 일반 일정 체크 칸
        }
        r.setImageViewResource(R.id.r_mark, icon)
        r.setInt(R.id.r_bar, "setColorFilter", it.color)
        val title = if (!it.jab && k == "done") SpannableString(it.title).apply { setSpan(StrikethroughSpan(), 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) } else it.title
        r.setTextViewText(R.id.r_title, title)
        r.setTextColor(R.id.r_title, c.getColor(if (!it.jab && k == "done") R.color.w_ink2 else R.color.w_ink))
        r.setTextViewText(R.id.r_meta, if (it.jab) "잡도리 · ${it.timeText}" else it.timeText)
        val side = m.sideText(it)
        r.setTextViewText(R.id.r_side, side)
        r.setTextColor(R.id.r_side, c.getColor(when (k) {
            "done" -> R.color.w_ok
            "failed" -> R.color.w_bad
            "late", "missedStart", "overdue" -> R.color.w_heat
            "running", "break" -> R.color.w_ink
            else -> R.color.w_ink2
        }))
        r.setViewVisibility(R.id.r_side, if (side.isEmpty()) View.GONE else View.VISIBLE)
        // 일반 일정: 동그라미를 누르면 바로 체크/해제. 잡도리 일정: 어디를 눌러도 앱이 그 일정을 연다
        val openIt = open(c, "open:" + it.key)
        r.setOnClickPendingIntent(R.id.r_root, openIt)
        r.setOnClickPendingIntent(R.id.r_mark, if (!it.jab) check(c, it.key) else openIt)
        r.setContentDescription(R.id.r_mark, if (!it.jab) (if (k == "done") "${it.title} 완료 취소" else "${it.title} 완료 표시") else "${it.title} 앱에서 열기")
        return r
    }

    // ---------------------------------------------------------------- 다음 일정
    private fun next(c: Context, m: WidgetModel, w: Int, h: Int): RemoteViews {
        val v = RemoteViews(c.packageName, R.layout.widget_next)
        v.setOnClickPendingIntent(android.R.id.background, open(c, "today"))
        v.setViewVisibility(R.id.n_cur, View.GONE)
        v.setViewVisibility(R.id.n_left_box, View.GONE)
        v.setViewVisibility(R.id.n_when, View.VISIBLE)
        v.setTextViewText(R.id.n_label, "다음 일정")
        if (!m.login) { v.setTextViewText(R.id.n_title, "로그인이 필요해요"); v.setTextViewText(R.id.n_when, "눌러서 잡도리 열기"); return v }
        if (m.todayItems == null) { v.setTextViewText(R.id.n_title, "앱을 한 번 열어 주세요"); v.setTextViewText(R.id.n_when, "일정을 불러오지 못했어요"); return v }
        val compact = h < 100
        val n = m.nextItem()
        if (n == null) {
            v.setTextViewText(R.id.n_title, if (m.hasTasks) "남은 일정이 없어요" else "아직 올린 일정이 없어요")
            v.setTextViewText(R.id.n_when, if (m.hasTasks) "앞으로 7일 안에 시작할 일정이 없어요" else "눌러서 일정 올리기")
            if (!m.hasTasks) v.setOnClickPendingIntent(android.R.id.background, open(c, "add"))
        } else {
            v.setOnClickPendingIntent(android.R.id.background, open(c, "open:" + n.key))
            v.setTextViewText(R.id.n_label, if (n.jab) "다음 잡도리" else "다음 일정")
            v.setTextViewText(R.id.n_title, n.title)
            val dayWord = when (n.date) { m.today -> "오늘"; WidgetModel.addDays(m.today, 1) -> "내일"; else -> WidgetModel.dateShort(n.date) }
            v.setTextViewText(R.id.n_when, "$dayWord ${WidgetModel.hm(n.start)} 시작")
            v.setViewVisibility(R.id.n_left_box, View.VISIBLE)
            val left = n.start - m.now
            if (left < 24 * 3600_000L) {
                // 남은 시간: 위젯 카운트다운이 스스로 흐른다 (앱·알람 없이 1초마다)
                v.setTextViewText(R.id.n_left_label, "시작까지")
                v.setViewVisibility(R.id.n_left, View.VISIBLE)
                v.setViewVisibility(R.id.n_left_text, View.GONE)
                v.setChronometer(R.id.n_left, SystemClock.elapsedRealtime() + left, null, true)
                v.setChronometerCountDown(R.id.n_left, true)
            } else {
                v.setTextViewText(R.id.n_left_label, "")
                v.setViewVisibility(R.id.n_left, View.GONE)
                v.setChronometer(R.id.n_left, SystemClock.elapsedRealtime(), null, false)
                val days = (WidgetModel.parseYmd(n.date).timeInMillis - WidgetModel.parseYmd(m.today).timeInMillis + 3600_000L) / 86_400_000L
                v.setTextViewText(R.id.n_left_text, "${days}일 뒤")
                v.setViewVisibility(R.id.n_left_text, View.VISIBLE)
            }
        }
        // 지금 붙잡힌 일 (다음 일정과 섞이지 않게 따로)
        val cur = m.current()
        if (cur != null && !compact) {
            val (label, ci) = cur
            val text = when (label) {
                "시작 전" -> "${ci.title} · ${WidgetModel.hm(ci.start)}"
                "지금" -> "${ci.title} · ~${WidgetModel.hm(ci.end)}"
                else -> "${ci.title}${if (ci.deadline > 0) " · 마감 ${WidgetModel.hm(ci.deadline)}" else ""}"
            }
            v.setTextViewText(R.id.n_cur_label, label)
            v.setTextViewText(R.id.n_cur_text, text)
            v.setViewVisibility(R.id.n_cur, View.VISIBLE)
            v.setOnClickPendingIntent(R.id.n_cur, open(c, "open:" + ci.key))
        }
        if (compact) v.setViewVisibility(R.id.n_when, if (n == null) View.VISIBLE else View.GONE)
        return v
    }

    // ---------------------------------------------------------------- 미루먼지
    private fun mireum(c: Context, m: WidgetModel, w: Int, h: Int): RemoteViews {
        val wide = w >= 220
        val v = RemoteViews(c.packageName, if (wide) R.layout.widget_mireum_wide else R.layout.widget_mireum)
        v.setOnClickPendingIntent(android.R.id.background, open(c, "today"))
        val md = if (m.login) m.mood() else null
        bitmap(c, md?.img ?: "mireum_sleepy", if (wide) 240 else 200)?.let { v.setImageViewBitmap(R.id.m_img, it) }
        if (wide) v.setTextViewText(R.id.m_name, m.name)
        when {
            !m.login -> { v.setTextViewText(R.id.m_line, "로그인하면 ${m.name}가 옆에 있을게요"); v.setTextViewText(R.id.m_heat, "") }
            md == null -> { v.setTextViewText(R.id.m_line, "앱을 한 번 열어 주세요"); v.setTextViewText(R.id.m_heat, "오래 열지 않아서 지금 상태를 몰라요") }
            else -> {
                v.setTextViewText(R.id.m_line, md.line)
                val heat = "${m.scaleTitle} ${md.heat}${m.scaleUnit} · ${md.stageName}"
                v.setTextViewText(R.id.m_heat, if (md.title.isNotEmpty() && wide) "$heat · ${md.ctx}" else heat)
                if (md.key.isNotEmpty()) v.setOnClickPendingIntent(android.R.id.background, open(c, "open:" + md.key))
            }
        }
        if (wide) {
            val (done, total) = m.progress()
            v.setTextViewText(R.id.m_today, when {
                !m.login || m.todayItems == null -> ""
                total == 0 -> "오늘 일정 없음"
                md != null && md.title.isNotEmpty() -> "${md.title} · 오늘 $done/$total 완료"
                else -> "오늘 $done/$total 완료"
            })
        }
        return v
    }

    // ---------------------------------------------------------------- 잡도리 통계
    private fun stats(c: Context, m: WidgetModel, w: Int, h: Int): RemoteViews {
        val v = RemoteViews(c.packageName, R.layout.widget_stats)
        v.setOnClickPendingIntent(android.R.id.background, open(c, "records"))
        v.setViewVisibility(R.id.s_progress, View.GONE)
        if (!m.login || m.todayItems == null) {
            v.setTextViewText(R.id.s_today_label, "잡도리 통계")
            v.setTextViewText(R.id.s_today, "–")
            v.setTextViewText(R.id.s_week, if (!m.login) "로그인하면 기록이 보여요" else "앱을 한 번 열어 주세요")
            v.setTextViewText(R.id.s_streak, "")
            return v
        }
        val (done, total) = m.progress()
        v.setTextViewText(R.id.s_today_label, if (total == 0) "오늘" else "오늘 $done/$total 완료")
        v.setTextViewText(R.id.s_today, if (total == 0) "일정 없음" else "${pct(done, total)}%")
        if (total > 0) { v.setViewVisibility(R.id.s_progress, View.VISIBLE); v.setProgressBar(R.id.s_progress, 100, pct(done, total), false) }
        val (ok, bad) = m.week()
        v.setTextViewText(R.id.s_week, if (ok + bad == 0) "이번 주 잡도리 기록 없음" else "이번 주 잡도리 ${pct(ok, ok + bad)}%\n${ok}번 성공 · ${bad}번 실패")
        v.setTextViewText(R.id.s_streak, when {
            m.recTotal == 0 -> "기록이 쌓이면 연속 성공을 세어 줄게요"
            m.streak > 0 -> "연속 성공 ${m.streak}번"
            else -> "연속 성공 0번 · 다음 잡도리로 다시 시작"
        })
        return v
    }

    // ---------------------------------------------------------------- 공통
    private fun notReady(c: Context, v: RemoteViews, msg: String, target: String): RemoteViews {
        v.setTextViewText(R.id.w_count, "")
        v.setViewVisibility(R.id.w_progress, View.GONE)
        v.setTextViewText(R.id.w_msg, msg)
        v.setViewVisibility(R.id.w_msg, View.VISIBLE)
        v.setOnClickPendingIntent(R.id.w_msg, open(c, target))
        return v
    }

    private fun message(c: Context, layout: Int, msg: String): RemoteViews {
        val v = RemoteViews(c.packageName, layout)
        v.setTextViewText(R.id.w_msg, msg)
        v.setViewVisibility(R.id.w_msg, View.VISIBLE)
        v.setOnClickPendingIntent(android.R.id.background, open(c, "today"))
        return v
    }

    fun pct(a: Int, b: Int): Int = if (b <= 0) 0 else Math.round(a * 100f / b)

    /** 앱 안 그림(assets/public/assets/mireum/png/…)을 위젯 크기로 줄여 읽는다 */
    private val bmpCache = HashMap<String, Bitmap>()
    fun bitmap(c: Context, name: String, px: Int): Bitmap? {
        val safe = name.replace(Regex("[^a-z_]"), "").ifEmpty { "mireum_default" }
        val key = "$safe@$px"
        bmpCache[key]?.let { return it }
        return try {
            val raw = c.assets.open("public/assets/mireum/png/$safe.png").use { BitmapFactory.decodeStream(it) }
                ?: return if (safe != "mireum_default") bitmap(c, "mireum_default", px) else null
            val b = if (raw.width > px) Bitmap.createScaledBitmap(raw, px, (raw.height * px / raw.width.toFloat()).toInt(), true) else raw
            if (bmpCache.size > 12) bmpCache.clear()
            bmpCache[key] = b
            b
        } catch (e: Exception) {
            if (safe != "mireum_default") bitmap(c, "mireum_default", px) else null
        }
    }

    /** 앱 열기: target = today | add | records | open:<회차 key> */
    fun open(c: Context, target: String): PendingIntent {
        val i = Intent(c, MainActivity::class.java).apply {
            action = ACTION_OPEN
            data = Uri.parse("jabdori-widget://open/" + Uri.encode(target))
            putExtra(EXTRA_TARGET, target)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        return PendingIntent.getActivity(c, ("o:$target").hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun check(c: Context, key: String): PendingIntent {
        val i = Intent(c, TodayWidgetProvider::class.java).apply {
            action = ACTION_CHECK
            data = Uri.parse("jabdori-widget://check/" + Uri.encode(key))
            putExtra(EXTRA_KEY, key)
        }
        return PendingIntent.getBroadcast(c, ("c:$key").hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun tickIntent(c: Context): PendingIntent {
        val i = Intent(c, WidgetTickReceiver::class.java).setAction(ACTION_TICK)
        return PendingIntent.getBroadcast(c, 7301, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /** 다음에 다시 그릴 시각 예약. 정확한 알람은 쓰지 않는다(권한·배터리): 화면을 깨우지 않는 RTC + 시간 창.
     *  안드로이드 12+는 시간 창을 최소 10분으로 넓히므로 상태 글자가 몇 분 늦게 바뀔 수 있다 */
    fun scheduleNext(c: Context, model: WidgetModel?) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val pi = tickIntent(c)
        if (model == null) { am.cancel(pi); return }
        val t = model.nextRefresh()
        try { am.setWindow(AlarmManager.RTC, t, 60_000L, pi) }
        catch (e: Exception) { try { am.set(AlarmManager.RTC, t, pi) } catch (e2: Exception) { /* 예약 실패: 다음 앱 실행 때 */ } }
    }
}

/** 위젯에서 일반 일정 체크: 묶음을 바로 고치고 할 일을 쌓아 둔다 (앱이 다음에 받아 기록에 반영) */
object WidgetActions {
    private var lastKey: String? = null
    private var lastAt = 0L

    fun toggle(c: Context, key: String) {
        val now = System.currentTimeMillis()
        synchronized(this) {
            // 연속 탭(0.7초 안 같은 줄)은 한 번으로 본다 — 실수로 두 번 눌러 원래대로 돌아가지 않게
            if (key == lastKey && now - lastAt < 700) return
            lastKey = key; lastAt = now
            val snap = WidgetStore.snapshot(c) ?: return
            if (!snap.optBoolean("login", false)) return
            val days = snap.optJSONObject("days") ?: return
            val hits = ArrayList<JSONObject>()
            val names = days.keys()
            while (names.hasNext()) {
                val arr = days.optJSONArray(names.next()) ?: continue
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    if (o.optString("k") == key) hits.add(o)
                }
            }
            if (hits.isEmpty()) return
            if (hits.any { it.optBoolean("j", false) }) return   // 잡도리 일정은 위젯에서 바꾸지 않는다
            val done = hits[0].optString("st") != "done"
            for (o in hits) o.put("st", if (done) "done" else "todo")
            WidgetStore.saveSnapshot(c, snap)
            WidgetStore.addAction(c, JSONObject()
                .put("id", UUID.randomUUID().toString())
                .put("type", "normalDone").put("key", key).put("done", done).put("at", now))
        }
        WidgetRender.updateAll(c)
        WidgetPlugin.instance?.emitAction()   // 앱이 켜져 있으면 바로 반영
    }
}

/** 위젯 4종 공통: 그리기·크기 변경·체크 누름 */
abstract class JabdoriWidgetProvider(private val kind: String) : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val model = WidgetModel.load(context)
        for (id in appWidgetIds) WidgetRender.updateOne(context, appWidgetManager, id, kind, model)
        WidgetRender.scheduleNext(context, model)
    }

    override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle) {
        WidgetRender.updateOne(context, appWidgetManager, appWidgetId, kind)
    }

    override fun onDisabled(context: Context) {
        // 마지막 위젯을 지웠으면 다른 종류가 남았는지 보고 알람 정리
        WidgetRender.updateAll(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == WidgetRender.ACTION_CHECK) {
            val key = intent.getStringExtra(WidgetRender.EXTRA_KEY) ?: return
            WidgetActions.toggle(context, key)
            return
        }
        super.onReceive(context, intent)
    }
}

class TodayWidgetProvider : JabdoriWidgetProvider("today")
class NextWidgetProvider : JabdoriWidgetProvider("next")
class MireumWidgetProvider : JabdoriWidgetProvider("mireum")
class StatsWidgetProvider : JabdoriWidgetProvider("stats")

/** 예약한 시각이 됐을 때, 기기 시각·시간대를 바꿨을 때 다시 그리기 */
class WidgetTickReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        WidgetRender.updateAll(context)
    }
}
