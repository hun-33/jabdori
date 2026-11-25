package com.jabdori.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale

/**
 * 홈 화면 위젯이 쓰는 데이터.
 *
 * - 앱(웹 화면, 05d-widget.js)이 만든 '위젯 묶음'(JSON)을 SharedPreferences에 보관한다 (WidgetStore).
 * - 위젯을 그릴 때마다 그 묶음을 '지금 시각' 기준으로 다시 계산한다 (WidgetModel):
 *   오늘 목록, 회차 상태(예정 → 시작 전 → 마감 지남 …), 다음 일정, 진행률, 미루먼지 표정·대사, 이번 주 성공률.
 * - 위젯에서 일반 일정을 체크하면 묶음을 바로 고치고 '할 일'(action)을 쌓아 둔다. 앱이 받아 반영한 뒤 지운다.
 */
object WidgetStore {
    private const val PREF = "jabdori_widget"
    private const val K_SNAP = "snap"
    private const val K_ACTIONS = "actions"
    private const val K_LAUNCH = "launch"

    private fun prefs(c: Context) = c.getSharedPreferences(PREF, Context.MODE_PRIVATE)

    fun snapshot(c: Context): JSONObject? = try {
        prefs(c).getString(K_SNAP, null)?.let { JSONObject(it) }
    } catch (e: Exception) { null }

    fun saveSnapshot(c: Context, s: JSONObject) {
        prefs(c).edit().putString(K_SNAP, s.toString()).commit()
    }

    fun actions(c: Context): JSONArray = try {
        JSONArray(prefs(c).getString(K_ACTIONS, "[]") ?: "[]")
    } catch (e: Exception) { JSONArray() }

    /** 같은 일정에 쌓인 앞선 할 일은 지우고 마지막 것만 남긴다 (연속 탭: 최종 상태만 의미 있음) */
    fun addAction(c: Context, a: JSONObject) {
        val old = actions(c)
        val out = JSONArray()
        for (i in 0 until old.length()) {
            val o = old.optJSONObject(i) ?: continue
            if (o.optString("key") == a.optString("key") && o.optString("type") == a.optString("type")) continue
            out.put(o)
        }
        out.put(a)
        // 아주 오래 앱을 안 열어도 끝없이 쌓이지 않게
        val trimmed = JSONArray()
        val from = maxOf(0, out.length() - 100)
        for (i in from until out.length()) trimmed.put(out.get(i))
        prefs(c).edit().putString(K_ACTIONS, trimmed.toString()).commit()
    }

    fun removeActions(c: Context, ids: Set<String>) {
        if (ids.isEmpty()) return
        val old = actions(c)
        val out = JSONArray()
        for (i in 0 until old.length()) {
            val o = old.optJSONObject(i) ?: continue
            if (o.optString("id") in ids) continue
            out.put(o)
        }
        prefs(c).edit().putString(K_ACTIONS, out.toString()).commit()
    }

    /** 달력 위젯마다 지금 보고 있는 달 (이번 달 = 0, 다음 달 = 1 …) */
    fun monthOffset(c: Context, id: Int): Int = prefs(c).getString("mo_$id", "0")?.toIntOrNull() ?: 0
    fun setMonthOffset(c: Context, id: Int, v: Int) { prefs(c).edit().putString("mo_$id", v.toString()).commit() }
    fun clearMonth(c: Context, id: Int) { prefs(c).edit().remove("mo_$id").commit() }

    fun setLaunch(c: Context, target: String?) {
        prefs(c).edit().apply { if (target == null) remove(K_LAUNCH) else putString(K_LAUNCH, target) }.commit()
    }

    fun takeLaunch(c: Context): String? {
        val v = prefs(c).getString(K_LAUNCH, null)
        if (v != null) setLaunch(c, null)
        return v
    }
}

/** 한 회차 (앱의 occurrencesCovering 결과를 줄인 것) */
class WItem(
    val key: String,
    val title: String,
    val jab: Boolean,          // 잡도리 일정 (잡도리를 끈 일정은 false = 일반 일정처럼 체크)
    val allDay: Boolean,
    val start: Long,
    val end: Long,
    val deadline: Long,        // 0 = 마감 없음
    var status: String,        // todo | done | failed | running
    val breakUntil: Long,      // 진행 중 휴식이 끝나는 시각 (0 = 휴식 아님)
    val color: Int,
    val date: String,          // 회차 시작 날짜
    val dayNo: Int,
    val days: Int,
    val timeText: String,      // 앱이 만든 시간 글자 (18:00–20:00, 종일, 2/3일째 …)
)

/** 달력 위젯 막대 하나 (앱 weekLanes 결과): 요일 칸 · 칸 수 · 줄 · 제목 · 색 · 표시(1 여러 날 · 2 왼쪽 이어짐 · 4 오른쪽 이어짐 · 8 완료 · 16 실패) */
class WSeg(val col: Int, val span: Int, val lane: Int, val title: String, val color: Int, val flags: Int) {
    val multi get() = flags and 1 != 0
    val contL get() = flags and 2 != 0
    val contR get() = flags and 4 != 0
    val done get() = flags and 8 != 0
    val failed get() = flags and 16 != 0
}
/** 달력 한 주: 일요일 날짜 · 요일 칸마다 일정 수 · 막대들 */
class WWeek(val ws: String, val n: IntArray, val segs: List<WSeg>)

/** 그 시각의 미루먼지 (앱이 미리 계산한 표정·대사·농도) */
class WMood(
    val at: Long, val img: String, val line: String, val heat: Int, val stage: Int,
    val stageName: String, val kind: String, val key: String, val title: String, val ctx: String,
)

class WidgetModel(val snap: JSONObject?, val now: Long) {
    val login: Boolean = snap?.optBoolean("login", false) == true
    val name: String = snap?.optString("name", "미루먼지")?.ifEmpty { "미루먼지" } ?: "미루먼지"
    val today: String = ymd(now)
    val hasTasks: Boolean = snap?.optBoolean("hasTasks", false) == true
    private val days: JSONObject? = snap?.optJSONObject("days")

    /** 오늘 목록. 묶음에 오늘이 없으면(앱을 7일 넘게 안 열었음) null */
    val todayItems: List<WItem>? = itemsOn(today)

    fun itemsOn(date: String): List<WItem>? {
        val arr = days?.optJSONArray(date) ?: return null
        val out = ArrayList<WItem>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            try {
                out.add(WItem(
                    key = o.getString("k"), title = o.optString("t", ""), jab = o.optBoolean("j", false),
                    allDay = o.optBoolean("ad", false), start = o.optLong("s", 0), end = o.optLong("e", 0),
                    deadline = o.optLong("dl", 0), status = o.optString("st", "todo"), breakUntil = o.optLong("bu", 0),
                    color = parseColor(o.optString("c", "#6FA3D6")), date = o.optString("d", date),
                    dayNo = o.optInt("dn", 1), days = o.optInt("dd", 1), timeText = o.optString("tm", ""),
                ))
            } catch (e: Exception) { /* 깨진 줄은 건너뜀 */ }
        }
        return out
    }

    /** 회차의 지금 상태 (앱 occState와 같은 규칙, 시간만 흐른 경우) */
    fun kindOf(it: WItem): String {
        if (!it.jab) return if (it.status == "done") "done" else "todo"
        return when (it.status) {
            "done" -> "done"
            "failed" -> "failed"
            "running" -> when {
                it.deadline > 0 && now >= it.deadline -> "overdue"
                it.breakUntil > now -> "break"
                else -> "running"
            }
            else -> when {
                it.date > today -> "upcoming"
                it.date < today -> "past"
                now < it.start -> "upcoming"
                it.deadline > 0 && now >= it.deadline -> "missedStart"
                else -> "late"
            }
        }
    }

    /** 오른쪽 짧은 글자 (앱 KIND_LABEL과 같은 말).
     *  위젯은 분 단위로 다시 그릴 수 없어서(안드로이드 12+ 알람 제한) "N분 늦음"처럼 분이 흐르는 글자는 쓰지 않는다 */
    fun sideText(it: WItem): String = when (kindOf(it)) {
        "upcoming" -> if (it.date == today) "예정" else ""
        "late" -> "시작 전"
        "running" -> "진행 중"
        "break" -> "휴식 중"
        "overdue" -> "마감 도달"
        "missedStart" -> "마감 지남"
        "done" -> "완료"
        "failed" -> "실패"
        "past" -> "지난 회차"
        else -> if (!it.allDay && now >= it.start && now < it.end) "지금" else ""
    }

    /** 오늘 완료 수 / 전체 */
    fun progress(): Pair<Int, Int> {
        val list = todayItems ?: return 0 to 0
        return list.count { kindOf(it) == "done" } to list.size
    }

    /** 다음 일정: 아직 시작 전이고 시작 시각이 지금보다 뒤인 것 중 가장 이른 것 (완료·실패·진행 중·종일 제외) */
    fun nextItem(): WItem? {
        var best: WItem? = null
        for (i in 0 until 7) {
            val list = itemsOn(addDays(today, i)) ?: continue
            for (it in list) {
                if (it.allDay || it.dayNo > 1 || it.start <= now) continue   // 종일·여러 날 일정의 둘째 날부터·이미 시작한 것 제외
                val k = kindOf(it)
                if (k != "upcoming" && k != "todo") continue                 // 완료·실패·진행 중 제외
                if (best == null || it.start < best.start) best = it
            }
            if (best != null) break   // 가까운 날에서 찾았으면 그 뒤 날짜는 볼 필요 없음
        }
        return best
    }

    /** 지금 붙잡힌 일: 진행 중 잡도리 > 시작 전(지각) 잡도리 > 지금 시간인 일반 일정 */
    fun current(): Pair<String, WItem>? {
        val list = todayItems ?: return null
        list.firstOrNull { it.jab && it.status == "running" }?.let { return kindLabel(kindOf(it)) to it }
        list.firstOrNull { it.jab && kindOf(it) == "late" }?.let { return "시작 전" to it }
        list.firstOrNull { !it.jab && !it.allDay && kindOf(it) == "todo" && now >= it.start && now < it.end }?.let { return "지금" to it }
        return null
    }

    fun kindLabel(k: String) = when (k) {
        "running" -> "진행 중"; "break" -> "휴식 중"; "overdue" -> "마감 도달"; "late" -> "시작 전"
        "missedStart" -> "마감 지남"; "upcoming" -> "예정"; "done" -> "완료"; "failed" -> "실패"; else -> ""
    }

    /** 지금 시각의 미루먼지. 미리 계산한 시간이 끝났으면 null (앱을 한 번 열어야 함) */
    fun mood(): WMood? {
        val m = snap?.optJSONObject("mood") ?: return null
        val arr = m.optJSONArray("list") ?: return null
        var pick: JSONObject? = null
        var lastAt = 0L
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val at = o.optLong("at", 0)
            lastAt = maxOf(lastAt, at)
            if (at <= now) pick = o
        }
        if (pick == null || now - lastAt > 2 * 3600_000L) return null
        return WMood(
            pick.optLong("at"), pick.optString("img", "mireum_default"), pick.optString("line", ""),
            pick.optInt("heat", 0), pick.optInt("stage", 1), pick.optString("sname", ""),
            pick.optString("kind", "idle"), pick.optString("key", ""), pick.optString("title", ""), pick.optString("ctx", ""),
        )
    }
    val scaleTitle: String get() = snap?.optJSONObject("mood")?.optString("title", "미루먼지 농도") ?: "미루먼지 농도"
    val scaleUnit: String get() = snap?.optJSONObject("mood")?.optString("unit", "") ?: ""

    /** 이번 주(일요일 시작, 앱 기록 탭과 같은 기준) 잡도리 성공·실패 수 */
    fun week(): Pair<Int, Int> {
        val rec = snap?.optJSONObject("rec") ?: return 0 to 0
        val ws = weekStart(today)
        var ok = 0; var bad = 0
        for (i in 0 until 7) {
            val a = rec.optJSONArray(addDays(ws, i)) ?: continue
            ok += a.optInt(0, 0); bad += a.optInt(1, 0)
        }
        return ok to bad
    }
    /** 달력 위젯: 그 달(YYYY-MM)의 주 목록. 묶음에 없는 달이면 null (앱이 지난달 ~ 3달 뒤만 넘김) */
    fun monthWeeks(month: String): List<WWeek>? {
        val arr = snap?.optJSONObject("cal")?.optJSONArray(month) ?: return null
        val out = ArrayList<WWeek>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val nArr = o.optJSONArray("n")
            val n = IntArray(7) { nArr?.optInt(it, 0) ?: 0 }
            val segs = ArrayList<WSeg>()
            val sa = o.optJSONArray("s")
            if (sa != null) for (j in 0 until sa.length()) {
                val g = sa.optJSONArray(j) ?: continue
                val col = g.optInt(0, -1); val span = g.optInt(1, 0)
                if (col !in 0..6 || span < 1 || col + span > 7) continue   // 깨진 값은 건너뜀
                segs.add(WSeg(col, span, g.optInt(2, 0), g.optString(3, ""), parseColor(g.optString(4, "#6FA3D6")), g.optInt(5, 0)))
            }
            out.add(WWeek(o.optString("ws", ""), n, segs))
        }
        return out
    }

    val streak: Int get() = snap?.optInt("streak", 0) ?: 0
    val recTotal: Int get() = snap?.optInt("recTotal", 0) ?: 0

    /** 다음에 위젯을 다시 그려야 하는 시각: 회차 상태가 바뀌는 순간(시작·종료·마감·휴식 끝), 자정, 미루먼지 다음 표정.
     *  남은 시간 글자는 위젯의 카운트다운(Chronometer)이 스스로 흐르므로 여기서 분마다 깨우지 않는다 */
    fun nextRefresh(): Long {
        var t = midnightAfter(now)
        val list = todayItems
        if (list != null) {
            for (it in list) for (x in longArrayOf(it.start, it.end, it.deadline, it.breakUntil)) if (x > now && x < t) t = x
        }
        nextItem()?.let { n -> if (n.start > now && n.start < t) t = n.start }
        val arr = snap?.optJSONObject("mood")?.optJSONArray("list")
        if (arr != null) for (i in 0 until arr.length()) {
            val at = arr.optJSONObject(i)?.optLong("at", 0L) ?: 0L
            if (at > now) { if (at < t) t = at; break }
        }
        return maxOf(t, now + 30_000)
    }

    companion object {
        fun load(c: Context, now: Long = System.currentTimeMillis()) = WidgetModel(WidgetStore.snapshot(c), now)

        fun ymd(t: Long): String {
            val c = Calendar.getInstance(); c.timeInMillis = t
            return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
        }
        fun parseYmd(s: String): Calendar {
            val c = Calendar.getInstance()
            val p = s.split("-")
            c.set(p[0].toInt(), p[1].toInt() - 1, p[2].toInt(), 0, 0, 0)
            c.set(Calendar.MILLISECOND, 0)
            return c
        }
        fun addDays(s: String, n: Int): String {
            return try { val c = parseYmd(s); c.add(Calendar.DAY_OF_MONTH, n); ymd(c.timeInMillis) } catch (e: Exception) { s }
        }
        fun weekStart(s: String): String {
            val c = parseYmd(s)
            val dow = c.get(Calendar.DAY_OF_WEEK) // 일=1 … 토=7
            c.add(Calendar.DAY_OF_MONTH, -(dow - 1))
            return ymd(c.timeInMillis)
        }
        fun daysBetween(a: String, b: String): Int =
            Math.round((parseYmd(b).timeInMillis - parseYmd(a).timeInMillis) / 86_400_000.0).toInt()
        fun midnightAfter(t: Long): Long {
            val c = Calendar.getInstance(); c.timeInMillis = t
            c.add(Calendar.DAY_OF_MONTH, 1)
            c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0)
            return c.timeInMillis
        }
        fun hm(t: Long): String {
            val c = Calendar.getInstance(); c.timeInMillis = t
            return String.format(Locale.US, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE))
        }
        /** 앱 fmtDur와 같은 모양: 1시간 20분 · 2시간 · 45분 */
        fun fmtDur(min: Long): String {
            val m = maxOf(0, min)
            val h = m / 60; val r = m % 60
            return when { h > 0 && r > 0 -> "${h}시간 ${r}분"; h > 0 -> "${h}시간"; else -> "${r}분" }
        }
        fun ceilMin(ms: Long): Long = if (ms <= 0) 0 else (ms + 59_999) / 60_000
        private val WD = arrayOf("", "일", "월", "화", "수", "목", "금", "토")
        /** 11월 25일 수요일 */
        fun dateLong(s: String): String {
            val c = parseYmd(s)
            return "${c.get(Calendar.MONTH) + 1}월 ${c.get(Calendar.DAY_OF_MONTH)}일 ${WD[c.get(Calendar.DAY_OF_WEEK)]}요일"
        }
        /** 11월 25일 (수) */
        fun dateShort(s: String): String {
            val c = parseYmd(s)
            return "${c.get(Calendar.MONTH) + 1}월 ${c.get(Calendar.DAY_OF_MONTH)}일 (${WD[c.get(Calendar.DAY_OF_WEEK)]})"
        }
        fun parseColor(s: String): Int = try { android.graphics.Color.parseColor(s) } catch (e: Exception) { 0xFF6FA3D6.toInt() }
    }
}
