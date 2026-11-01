"""Clean natural voice: raw Kokoro lines (assets/voice/raw/*.wav) -> assets/voice/<id>.mp3 + tools/schedule.json."""
import json, subprocess
START = 0.6
lines = json.load(open("tools/lines.json"))
sched, t = [], START
for l in lines:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"assets/voice/raw/{l['id']}.wav", "-af", "loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100", "-ac", "1", "-b:a", "160k", f"assets/voice/{l['id']}.mp3"], check=True)
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"assets/voice/{l['id']}.mp3"])) - 0.05
    sched.append({"id": l["id"], "show": l["show"], "start": round(t, 2), "dur": round(d, 2)})
    t += d + l["gap"]
json.dump(sched, open("tools/schedule.json", "w"), indent=1)
for s in sched: print(s["id"], s["start"], "->", round(s["start"] + s["dur"], 2))
