"""Processes the raw Kokoro lines (assets/voice/raw/*.wav): natural pitch, light speed-up,
then writes assets/voice/<id>.mp3 and tools/schedule.json (start/duration of every line)."""
import json, subprocess
TEMPO = 1.14
START = 0.5
GAPS = [0.45, 0.2, 0.2, 0.35, 0.2, 0.9]  # after l1..l6
lines = json.load(open("tools/lines.json"))
sched, t = [], START
for i, l in enumerate(lines):
    src = f"assets/voice/raw/{l['id']}.wav"
    # clean, natural voice: no pitch shift, no EQ colouring; only a gentle speed-up (pitch preserved) and level matching
    flt = f"rubberband=tempo={TEMPO}:pitchq=quality,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", flt, "-ac", "1", "-b:a", "160k", f"assets/voice/{l['id']}.mp3"], check=True)
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"assets/voice/{l['id']}.mp3"]))
    d = round(d - 0.05, 2)  # mp3 encoder padding
    sched.append({"id": l["id"], "show": l["show"], "start": round(t, 2), "dur": d})
    t += d + (GAPS[i] if i < len(GAPS) else 0)
json.dump(sched, open("tools/schedule.json", "w"), indent=1)
for s in sched: print(s["id"], s["start"], "->", round(s["start"] + s["dur"], 2))
