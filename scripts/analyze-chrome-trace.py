import json
import collections
import statistics
from pathlib import Path
import sys


def _pct(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    return sorted_vals[min(len(sorted_vals) - 1, int(len(sorted_vals) * p))]


def _summarize(label: str, vals: list[float], raf_n: int = 0) -> None:
    if not vals:
        return
    ordered = sorted(vals)
    extra = f" perFrame~={sum(vals) / max(1, raf_n):.2f}" if raf_n else ""
    print(
        f"{label} n={len(vals)} mean={statistics.mean(vals):.2f}ms "
        f"p50={statistics.median(vals):.2f} p95={_pct(ordered, 0.95):.2f} "
        f"max={max(vals):.2f}{extra}"
    )


def analyze_chrome(path: Path, d: dict) -> None:
    events = d.get("traceEvents") or []

    raf = []
    func_ms: collections.Counter[str] = collections.Counter()
    func_count: collections.Counter[str] = collections.Counter()
    gpu = []
    anim_intervals = []
    last_raf_ts = None
    run_task = []
    submits = 0

    for e in events:
        name = e.get("name", "")
        ph = e.get("ph")
        dur = e.get("dur")
        args = e.get("args") or {}
        ts = e.get("ts")

        if name == "FireAnimationFrame" and ph == "X" and dur is not None:
            raf.append(dur / 1000)
            if last_raf_ts is not None and ts is not None:
                anim_intervals.append((ts - last_raf_ts) / 1000)
            last_raf_ts = ts

        if name == "FunctionCall" and ph == "X" and dur is not None:
            data = args.get("data") or {}
            fn = data.get("functionName") or data.get("url") or "anon"
            func_ms[fn[:140]] += dur / 1000
            func_count[fn[:140]] += 1

        if name == "GPUTask" and ph == "X" and dur is not None:
            gpu.append(dur / 1000)

        if name == "RunTask" and ph == "X" and dur is not None and dur > 8000:
            run_task.append(dur / 1000)

        if ("GPUQueue" in name or name.endswith("::Submit") or name == "DeviceQueue::Submit"):
            submits += 1

    print("====", path.name, "(chrome) ====")
    if anim_intervals:
        mean_i = statistics.mean(anim_intervals)
        print(
            f"frameInterval n={len(anim_intervals)} mean={mean_i:.2f}ms "
            f"(~{1000 / mean_i:.1f} FPS) p50={statistics.median(anim_intervals):.2f} "
            f"p95={_pct(sorted(anim_intervals), 0.95):.2f}"
        )
    _summarize("FireAnimationFrame work", raf)
    if gpu:
        print(
            f"GPUTask n={len(gpu)} mean={statistics.mean(gpu):.2f}ms "
            f"p95={_pct(sorted(gpu), 0.95):.2f} max={max(gpu):.2f} "
            f"sum={sum(gpu):.1f} perFrame~={sum(gpu) / max(1, len(raf)):.2f}"
        )
    if run_task:
        print(
            f"long RunTask >8ms n={len(run_task)} mean={statistics.mean(run_task):.2f} "
            f"max={max(run_task):.2f}"
        )
    if submits:
        print(f"submit-like events n={submits} perFrame~={submits / max(1, len(raf)):.2f}")

    if raf and anim_intervals:
        gap = statistics.mean(anim_intervals) - statistics.mean(raf)
        print(f"RAF vs interval gap mean≈{gap:.2f}ms (outside animation callback)")

    print("top FunctionCall total ms:")
    for k, v in func_ms.most_common(20):
        print(f"  {v:8.1f}ms x{func_count[k]:4d}  {k}")

    nodes: dict = {}
    samples = []
    time_deltas = []
    for e in events:
        if e.get("name") == "Profile":
            for n in ((e.get("args") or {}).get("data") or {}).get("cpuProfile", {}).get("nodes", []) or []:
                nodes[n["id"]] = n
        if e.get("name") == "ProfileChunk":
            data = ((e.get("args") or {}).get("data") or {}).get("cpuProfile") or {}
            for n in data.get("nodes") or []:
                nodes[n["id"]] = n
            samples.extend(data.get("samples") or [])
            time_deltas.extend(((e.get("args") or {}).get("data") or {}).get("timeDeltas") or [])

    if samples and time_deltas:
        self_us: collections.Counter[str] = collections.Counter()
        for i, sid in enumerate(samples):
            dt = time_deltas[i] if i < len(time_deltas) else 0
            node = nodes.get(sid)
            if not node:
                continue
            call = node.get("callFrame") or {}
            name = call.get("functionName") or "(anonymous)"
            url = call.get("url") or ""
            file = url.split("/")[-1] if url else ""
            line = call.get("lineNumber", "")
            self_us[f"{name} @ {file}:{line}"] += dt
        print("CPU profile self time top:")
        for k, v in self_us.most_common(40):
            print(f"  {v / 1000:8.1f}ms  {k}")


def analyze_safari(path: Path, d: dict) -> None:
    rec = d.get("recording") or {}
    records = rec.get("records") or []

    def dur_ms(r: dict) -> float:
        return (r["endTime"] - r["startTime"]) * 1000

    frames = [r for r in records if r.get("type") == "timeline-record-type-rendering-frame"]
    scripts = [r for r in records if r.get("type") == "timeline-record-type-script"]
    layouts = [r for r in records if r.get("type") == "timeline-record-type-layout"]
    cpus = [r for r in records if r.get("type") == "timeline-record-type-cpu"]

    rafs = [r for r in scripts if r.get("eventType") == "animation-frame-fired"]
    raf_durs = [dur_ms(r) for r in rafs]
    comps = [r for r in layouts if r.get("eventType") == "composite"]
    comp_durs = [dur_ms(r) for r in comps]

    frame_starts = sorted(r["startTime"] for r in frames)
    frame_intervals = [(b - a) * 1000 for a, b in zip(frame_starts, frame_starts[1:])]
    raf_starts = sorted(r["startTime"] for r in rafs)
    raf_intervals = [(b - a) * 1000 for a, b in zip(raf_starts, raf_starts[1:])]

    print("====", path.name, "(safari timeline) ====")
    if frame_intervals:
        mean_i = statistics.mean(frame_intervals)
        print(
            f"frameInterval n={len(frame_intervals)} mean={mean_i:.2f}ms "
            f"(~{1000 / mean_i:.1f} FPS) p50={statistics.median(frame_intervals):.2f} "
            f"p95={_pct(sorted(frame_intervals), 0.95):.2f}"
        )
    elif raf_intervals:
        mean_i = statistics.mean(raf_intervals)
        print(
            f"rafInterval n={len(raf_intervals)} mean={mean_i:.2f}ms "
            f"(~{1000 / mean_i:.1f} FPS) p50={statistics.median(raf_intervals):.2f} "
            f"p95={_pct(sorted(raf_intervals), 0.95):.2f}"
        )

    _summarize("FireAnimationFrame work", raf_durs)

    intervals = frame_intervals or raf_intervals
    if raf_durs and intervals:
        gap = statistics.mean(intervals) - statistics.mean(raf_durs)
        print(f"RAF vs interval gap mean≈{gap:.2f}ms (outside animation callback)")
        idle_gaps = 0
        for a, b in zip(sorted(rafs, key=lambda r: r["startTime"]), sorted(rafs, key=lambda r: r["startTime"])[1:]):
            gap_ms = (b["startTime"] - a["endTime"]) * 1000
            between = sum(
                dur_ms(s)
                for s in scripts
                if s["startTime"] >= a["endTime"] and s["startTime"] < b["startTime"]
            )
            if gap_ms > 30 and between < 1:
                idle_gaps += 1
        n_pairs = max(1, len(rafs) - 1)
        print(
            f"idle gaps >30ms with <1ms script: {idle_gaps}/{n_pairs} "
            f"({100 * idle_gaps / n_pairs:.0f}%)"
        )

    _summarize("composite", comp_durs, raf_n=len(raf_durs))

    by_script: dict[str, list[float]] = collections.defaultdict(list)
    for r in scripts:
        by_script[str(r.get("eventType") or "?")].append(dur_ms(r))
    print("script eventTypes:")
    for et, ds in sorted(by_script.items(), key=lambda kv: -sum(kv[1])):
        print(
            f"  {et}: n={len(ds)} sum={sum(ds):.1f}ms mean={statistics.mean(ds):.2f} "
            f"p95={_pct(sorted(ds), 0.95):.2f} max={max(ds):.2f}"
        )

    by_layout: dict[str, list[float]] = collections.defaultdict(list)
    for r in layouts:
        by_layout[str(r.get("eventType") or "?")].append(dur_ms(r))
    if by_layout:
        print("layout eventTypes:")
        for et, ds in sorted(by_layout.items(), key=lambda kv: -sum(kv[1])):
            print(
                f"  {et}: n={len(ds)} sum={sum(ds):.1f}ms mean={statistics.mean(ds):.2f} "
                f"p95={_pct(sorted(ds), 0.95):.2f} max={max(ds):.2f}"
            )

    if cpus:
        usages = [float(r.get("usage") or 0) for r in cpus]
        mains = []
        for r in cpus:
            for t in r.get("threads") or []:
                if t.get("type") == "main":
                    mains.append(float(t.get("usage") or 0))
        print(
            f"CPU samples n={len(cpus)} mean_usage%={statistics.mean(usages):.1f} "
            f"max={max(usages):.1f}"
        )
        if mains:
            print(f"main thread usage% mean={statistics.mean(mains):.1f} max={max(mains):.1f}")

    sample_blobs = rec.get("samples") or []
    leaf_count: collections.Counter[str] = collections.Counter()
    path_count: collections.Counter[str] = collections.Counter()
    for blob in sample_blobs:
        if not isinstance(blob, dict):
            continue
        for st in blob.get("stackTraces") or []:
            frames_s = st.get("stackFrames") or []
            if not frames_s:
                leaf_count["(empty)"] += 1
                continue
            names = [f.get("name") or "(anon)" for f in frames_s]
            leaf_count[names[0]] += 1
            path_count[" <- ".join(names[:6])] += 1

    if leaf_count:
        print("CPU sample leaf frames (counts):")
        for k, v in leaf_count.most_common(25):
            print(f"  {v:6d}  {k}")
        print("CPU sample paths (counts):")
        for k, v in path_count.most_common(15):
            print(f"  {v:6d}  {k}")

    markers = rec.get("markers") or []
    if markers:
        details = collections.Counter(str(m.get("details") or m.get("type") or "?") for m in markers)
        print("markers:")
        for k, v in details.most_common(15):
            print(f"  {v:6d}  {k}")


def analyze(path: Path) -> None:
    with path.open("r", encoding="utf-8") as f:
        d = json.load(f)

    if isinstance(d, dict) and "traceEvents" in d:
        analyze_chrome(path, d)
        return

    if isinstance(d, dict) and isinstance(d.get("recording"), dict):
        analyze_safari(path, d)
        return

    print(f"==== {path.name} ====")
    print("Unrecognized recording format (need Chrome traceEvents or Safari recording).")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/analyze-chrome-trace.py <Trace-....json> [more.json...]")
        sys.exit(1)

    for arg in sys.argv[1:]:
        analyze(Path(arg))
        print()


if __name__ == "__main__":
    main()
