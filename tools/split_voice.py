"""한 번에 생성한 긴 음성(배치)을 대사별 파일로 자른다.
사용: python3 tools/split_voice.py voice/raw/batch1.mp3 voice/batch1.json src/voice/mireum

원리
- ffmpeg silencedetect로 조용한 구간을 모두 찾는다.
- 배치 안 대사 수가 N개면, 가장 긴 조용한 구간 N-1개를 대사 사이 경계로 본다
  (문장 안 쉼표보다 대사 사이 빈 줄 쉼이 더 길다는 점을 이용).
- 경계 가운데에서 자르고, 앞뒤 무음을 0.08초만 남기고 깎고, 음량을 맞춘 뒤 64kbps 모노 mp3로 저장한다.
- 대사 글자 수와 길이를 비교해 이상하게 짧거나 긴 조각을 경고한다 (저는 소리를 들을 수 없어서 숫자로만 점검).
"""
import json, re, subprocess, sys
from pathlib import Path

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def duration(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(path)])
    return float(r.stdout.strip())

def silences(path, db=-38, d=0.22):
    r = run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'])
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    return list(zip(starts, ends))

def main(src, listfile, outdir, texts=None):
    names = json.load(open(listfile, encoding='utf-8'))
    n = len(names)
    total = duration(src)
    sil = [(s, e) for s, e in silences(src) if s > 0.05 and e < total - 0.05]  # 맨 앞·맨 뒤 무음 제외
    if len(sil) < n - 1:
        sys.exit(f'경계가 모자라요: 대사 {n}개인데 조용한 구간 {len(sil)}개 → 생성할 때 대사 사이를 더 띄워 주세요')
    cut = sorted(sorted(sil, key=lambda x: x[1] - x[0], reverse=True)[:n - 1])
    bounds = [0.0] + [(s + e) / 2 for s, e in cut] + [total]
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    report = []
    for i, name in enumerate(names):
        a, b = bounds[i], bounds[i + 1]
        dst = out / f'{name}.mp3'
        af = ('silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.08,'
              'areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.12,areverse,'
              'loudnorm=I=-16:TP=-1.5:LRA=11')
        r = run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', str(src),
                 '-af', af, '-ac', '1', '-ar', '44100', '-b:a', '64k', str(dst)])
        if r.returncode: sys.exit(r.stderr)
        report.append((name, round(duration(dst), 2), round(cut[i - 1][1] - cut[i - 1][0], 2) if i else None))
    gaps = [round(e - s, 2) for s, e in cut]
    others = sorted([round(e - s, 2) for s, e in sil if (s, e) not in cut], reverse=True)
    print(f'{src}: 대사 {n}개 · 전체 {total:.1f}초 · 경계 쉼 최소 {min(gaps) if gaps else "-"}초 · 경계 아닌 쉼 최대 {others[0] if others else "-"}초')
    if gaps and others and min(gaps) <= others[0] + 0.05:
        print('  경고: 경계 쉼과 문장 안 쉼의 길이가 비슷해요. 잘못 잘렸을 수 있어요.')
    if texts:
        for (name, dur, _), t in zip(report, texts):
            cps = len(re.sub(r'\[[^\]]*\]|\s', '', t)) / max(dur, 0.1)
            flag = '  ← 확인 필요' if cps < 2.5 or cps > 11 else ''
            print(f'  {name} {dur:5.2f}초 {cps:4.1f}자/초 {t[:28]}{flag}')
    return report

if __name__ == '__main__':
    src, listfile, outdir = sys.argv[1:4]
    texts = None
    txt = Path(listfile).with_suffix('.txt')
    if txt.exists():
        texts = [l for l in txt.read_text(encoding='utf-8').split('\n') if l.strip()]
    main(src, listfile, outdir, texts)
