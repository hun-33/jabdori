"""한 번에 생성한 긴 음성(배치)을 대사별 파일로 자른다.
사용: python3 tools/split_voice.py voice/raw/batch1.mp3 voice/batch1.json src/voice/mireum

원리 (v2: 글자 수 맞춤)
- 소리를 10ms 단위로 재서 조용한 구간(0.15초 이상)을 모두 찾는다 → 자를 수 있는 후보.
- '폴폴…' 같은 말줄임 쉼도 대사 사이 쉼만큼 길어서, 쉼 길이만으로는 경계를 못 고른다.
  그래서 대사마다 예상 길이(글자 수 + 말줄임 수에 비례)를 두고, 후보 가운데 N-1개를
  '조각 길이가 예상과 가깝고 + 쉼이 길수록 좋다'는 점수로 동적 계획법(DP)으로 고른다.
- 경계 가운데에서 자르고, 앞뒤 무음을 깎고, 음량을 맞춘 뒤 64kbps 모노 mp3로 저장한다.
- 조각 길이 / 예상 길이 비율이 너무 작거나 크면 경고한다 (저는 소리를 들을 수 없어서 숫자로만 점검).
"""
import json, re, subprocess, sys
from pathlib import Path

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=60)

def duration(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(path)])
    return float(r.stdout.strip())

def silences(path, db=-38, d=0.22):
    r = run(['ffmpeg', '-nostdin', '-hide_banner', '-i', str(path), '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'])
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    return list(zip(starts, ends))

def frames_db(path, hop=0.01):
    """ffmpeg로 16kHz 모노 PCM을 받아 10ms마다 음량(dB)을 잰다."""
    import array
    r = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True)
    a = array.array('h'); a.frombytes(r.stdout)
    n = int(16000 * hop); out = []
    for i in range(0, len(a) - n + 1, n):
        seg = a[i:i + n]; ms = sum(x * x for x in seg) / n / (32768.0 ** 2)
        out.append(10 * __import__('math').log10(ms + 1e-12))
    return out

def weight(t):
    """대사 하나의 예상 길이 비중: 글자 수 + 말줄임(…) 쉼 + 대사 앞뒤 여유."""
    core = re.sub(r'[\s!?.,~]', '', t).replace('…', '')
    return len(core) + 1.5 * t.count('…') + 0.6

def align(db, total, texts, thr=-38, min_sil=0.15, gap_w=1.2):
    sil, st = [], -1
    for i, v in enumerate(db):
        if v < thr:
            if st < 0: st = i
        else:
            if st >= 0 and (i - st) >= min_sil * 100: sil.append((st / 100, i / 100))
            st = -1
    C = [(a, b) for a, b in sil if a > 0.05 and b < total - 0.05]
    n, m = len(texts), len(C)
    if m < n - 1: sys.exit(f'경계 후보가 모자라요: 대사 {n}개인데 조용한 구간 {m}개')
    w = [weight(t) for t in texts]; W = sum(w); e = [total * x / W for x in w]
    mid = [(a + b) / 2 for a, b in C]; gl = [min(b - a, 1.2) for a, b in C]
    cost = lambda s, i: ((s - e[i]) / e[i]) ** 2
    INF = float('inf')
    dp = [[INF] * m for _ in range(n)]; bk = [[-1] * m for _ in range(n)]
    for j in range(m): dp[1][j] = cost(mid[j], 0) - gap_w * gl[j]
    for i in range(2, n):
        for j in range(m):
            best, bj = INF, -1
            for k in range(j):
                if dp[i - 1][k] == INF: continue
                v = dp[i - 1][k] + cost(mid[j] - mid[k], i - 1)
                if v < best: best, bj = v, k
            if bj >= 0: dp[i][j], bk[i][j] = best - gap_w * gl[j], bj
    best, bj = INF, -1
    for j in range(m):
        if dp[n - 1][j] == INF: continue
        v = dp[n - 1][j] + cost(total - mid[j], n - 1)
        if v < best: best, bj = v, j
    cuts = []
    i, j = n - 1, bj
    while i >= 1: cuts.insert(0, j); j = bk[i][j]; i -= 1
    return [C[j] for j in cuts], e, C

def cuts_from_alignment(db, lines, total, thr=-55):
    """ElevenLabs가 준 글자별 시작 시각으로 대사마다 [시작, 끝]을 잡는다.
    - 끝: 그 줄의 줄바꿈 글자 시작(nl) 근처에서 시작되는 첫 쉼의 시작 (대사가 끝난 곳)
    - 다음 시작: 다음 줄 첫 글자 시작 직전 마지막 쉼의 끝
    - 그 사이에 대본에 없는 숨소리·웅얼거림이 끼어 있으면 어느 대사에도 넣지 않고 버린다.
    두 대사가 쉼 없이 붙어 나온 경우(사이 0.2초 미만)는 그 사이 가장 조용한 10ms에서 자른다."""
    runs, st = [], -1
    for i, v in enumerate(db + [0]):
        if v < thr:
            if st < 0: st = i
        else:
            if st >= 0 and i - st >= 3: runs.append((st / 100, i / 100))
            st = -1
    segs, cur = [], 0.0
    for i in range(len(lines)):
        if i == len(lines) - 1:
            segs.append((cur, total)); break
        nl = lines[i]['nl'] if lines[i]['nl'] is not None else lines[i]['last'] + 0.3
        nxt = lines[i + 1]['start']
        a, b = min(nl, nxt) - 0.25, nxt + 0.05
        inside = [r for r in runs if r[1] > a and r[0] < b]
        if inside:
            last_ch = lines[i]['last']  # 마지막 글자(보통 ! ?) 시작 = 마지막 음절이 끝나 가는 때. 그보다 앞의 쉼은 문장 안 쉼
            longish = [r for r in inside if r[1] - r[0] >= 0.1]  # '털'과 '털' 사이 0.04초 같은 음절 틈은 줄 사이 쉼이 아니다
            first = (next((r for r in longish if r[1] >= nl - 0.06 and r[0] >= last_ch - 0.15), None)
                     or next((r for r in inside if r[1] >= nl - 0.06 and r[0] >= last_ch - 0.15), None)
                     or next((r for r in inside if r[0] >= last_ch - 0.15), inside[-1]))
            before_next = [r for r in inside if r[0] <= nxt + 0.05] or [first]
            last = ([r for r in before_next if r[1] - r[0] >= 0.1] or [max(before_next, key=lambda r: r[1] - r[0])])[-1]
            end = min(first[0] + 0.05, first[1]); nstart = max(last[1] - 0.05, last[0])  # 무음 기준이 -55dB라 작은 '쉿'도 소리로 남는다
            if nstart < end: end = nstart = (first[0] + last[1]) / 2
        else:
            lo, hi = int((nl - 0.06) * 100), max(int((nl - 0.06) * 100) + 1, int((nxt + 0.03) * 100))
            f = min(range(lo, min(hi, len(db) - 1) + 1), key=lambda k: db[k]); end = nstart = f / 100
        segs.append((cur, end)); cur = nstart
    return segs

def silence_runs(db, thr, min_len):
    runs, st = [], -1
    for i, v in enumerate(db + [0]):
        if v < thr:
            if st < 0: st = i
        else:
            if st >= 0 and (i - st) / 100 >= min_len: runs.append((st / 100, i / 100))
            st = -1
    return runs

def cuts_snap(db, lines, total):
    """짧은 소리 묶음(퐁!, 킁킁 같은 한 단어)용. 정렬 시각은 0.3~0.5초씩 어긋나서 대략적인 위치로만 쓰고,
    실제 경계는 '정렬이 말하는 위치에 가깝고 + 길수록 좋은' 무음 구간을 순서대로 골라(DP) 잡는다.
    소리 크기 -45dB 아래를 쉼 후보로 보고, 그 안에 -55dB 아래 진짜 무음이 있으면 그 가장자리에서 자른다
    (작게 끄는 '히잉…' 꼬리를 살리려고)."""
    n = len(lines)
    pred = [((lines[i]['nl'] if lines[i]['nl'] is not None else lines[i]['last']) + lines[i + 1]['start']) / 2 for i in range(n - 1)]
    C = [r for r in silence_runs(db, -45, 0.05) if r[0] > 0.05 and r[1] < total - 0.05]
    deep = silence_runs(db, -55, 0.05)
    m = len(C)
    if m < n - 1: sys.exit(f'경계 후보가 모자라요: {m}개')
    cost = lambda i, j: ((((C[j][0] + C[j][1]) / 2) - pred[i]) / 0.5) ** 2 - 4 * min(C[j][1] - C[j][0], 0.5)
    INF = float('inf'); dp = [[INF] * m for _ in range(n - 1)]; bk = [[-1] * m for _ in range(n - 1)]
    for j in range(m): dp[0][j] = cost(0, j)
    for i in range(1, n - 1):
        for j in range(i, m):
            k = min(range(j), key=lambda k: dp[i - 1][k])
            if dp[i - 1][k] < INF: dp[i][j], bk[i][j] = dp[i - 1][k] + cost(i, j), k
    j = min(range(m), key=lambda j: dp[n - 2][j]); pick = []
    for i in range(n - 2, -1, -1): pick.insert(0, j); j = bk[i][j]
    segs, cur = [], 0.0
    for j in pick:
        a, b = C[j]
        inner = [d for d in deep if d[0] >= a - 0.01 and d[1] <= b + 0.01]
        if inner: a, b = inner[0][0], inner[-1][1]
        segs.append((cur, min(a + 0.05, b))); cur = max(b - 0.05, a)
    segs.append((cur, total))
    return segs

def main(src, listfile, outdir, texts=None):
    names = json.load(open(listfile, encoding='utf-8'))
    n = len(names)
    total = duration(src)
    if not texts or len(texts) != n: sys.exit('대사 텍스트(.txt)가 목록(.json)과 개수가 달라요')
    db = frames_db(src)
    al = Path(listfile).with_suffix('.align.json')
    if al.exists():
        alj = json.load(open(al, encoding='utf-8')); lines = alj['lines']
        if len(lines) != n: sys.exit('정렬 파일 줄 수가 대사 수와 달라요')
        if alj.get('mode') == 'snap':
            segs = cuts_snap(db, lines, total); method = 'ElevenLabs 글자 시각 → 가까운 무음에 맞춤(짧은 소리)'
        else:
            segs = cuts_from_alignment(db, lines, total); method = 'ElevenLabs 글자 시각'
    else:
        cut, _, _ = align(db, total, texts)
        method = '글자 수 추정(정렬 파일 없음)'
        b = [0.0] + [(x + y) / 2 for x, y in cut] + [total]
        segs = list(zip(b, b[1:]))
    cut = [(segs[i][1], segs[i + 1][0]) for i in range(len(segs) - 1)]
    w = [weight(t) for t in texts]; W = sum(w); speech = sum(b - a for a, b in segs); expect = [speech * x / W for x in w]
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    report = []
    for i, name in enumerate(names):
        a, b = segs[i]
        dst = out / f'{name}.mp3'
        # 두 단계로 나눈다: (1) 자르고 앞뒤 무음 깎기 → wav, (2) 음량 맞추고 mp3.
        # 한 줄 필터(areverse + silenceremove + loudnorm)는 ffmpeg 6.1에서 가끔 멈춰서 나눴다.
        trim = ('silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.08,'
                'areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.12,areverse')
        tmp = out / f'.{name}.wav'
        r = run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', str(src),
                 '-af', trim, '-ac', '1', str(tmp)])
        if r.returncode: sys.exit(r.stderr)
        r = run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(tmp),
                 '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '44100', '-b:a', '64k', str(dst)])
        tmp.unlink(missing_ok=True)
        if r.returncode: sys.exit(r.stderr)
        report.append((name, round(duration(dst), 2), None))
    gaps = [round(y - x, 2) for x, y in cut]
    print(f'{src}: 대사 {n}개 · 전체 {total:.1f}초 · 경계: {method} · 버린 틈 합계 {sum(gaps):.1f}초')
    bad = 0
    for i, ((name, dur, _), t) in enumerate(zip(report, texts)):
        seg = segs[i][1] - segs[i][0]; ratio = seg / expect[i]
        flag = '  ← 확인 필요' if ratio < 0.55 or ratio > 1.8 else ''
        bad += bool(flag)
        print(f'  {name} 조각 {seg:5.2f}초 (예상의 {ratio:4.2f}배) → 다듬은 뒤 {dur:5.2f}초  {t[:26]}{flag}')
    print(f'  확인 필요 {bad}개')
    return report

if __name__ == '__main__':
    src, listfile, outdir = sys.argv[1:4]
    texts = None
    txt = Path(listfile).with_suffix('.txt')
    if txt.exists():
        texts = [l for l in txt.read_text(encoding='utf-8').split('\n') if l.strip()]
    main(src, listfile, outdir, texts)
