import json
import collections
import statistics
from pathlib import Path
import sys


def analyze(path: Path) -> None:
    with path.open("r", encoding="utf-8") as f:
        d = json.load(f)
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

    print("====", path.name, "====")
    if anim_intervals:
        mean_i = statistics.mean(anim_intervals)
        print(
            f"frameInterval n={len(anim_intervals)} mean={mean_i:.2f}ms "
            f"(~{1000 / mean_i:.1f} FPS) p50={statistics.median(anim_intervals):.2f} "
            f"p95={sorted(anim_intervals)[int(len(anim_intervals) * 0.95)]:.2f}"
        )
    if raf:
        print(
            f"FireAnimationFrame work n={len(raf)} mean={statistics.mean(raf):.2f}ms "
            f"p50={statistics.median(raf):.2f} p95={sorted(raf)[int(len(raf) * 0.95)]:.2f} "
            f"max={max(raf):.2f}"
        )
    if gpu:
        print(
            f"GPUTask n={len(gpu)} mean={statistics.mean(gpu):.2f}ms "
            f"p95={sorted(gpu)[int(len(gpu) * 0.95)]:.2f} max={max(gpu):.2f} "
            f"sum={sum(gpu):.1f} perFrame~={sum(gpu) / max(1, len(raf)):.2f}"
        )
    if run_task:
        print(
            f"long RunTask >8ms n={len(run_task)} mean={statistics.mean(run_task):.2f} "
            f"max={max(run_task):.2f}"
        )
    if submits:
        print(f"submit-like events n={submits} perFrame~={submits / max(1, len(raf)):.2f}")

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


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/analyze-chrome-trace.py <Trace-....json> [more.json...]")
        sys.exit(1)

    for arg in sys.argv[1:]:
        analyze(Path(arg))
        print()


if __name__ == "__main__":
    main()
