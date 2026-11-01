"""Mixes narration + transitions + music (ducked under the voice) -> renders/audio.mp3.   python tools/mix.py"""
import json, subprocess
TOTAL = 180
sched = json.load(open("tools/schedule.json")); scenes = json.load(open("tools/scenes.json"))
sfx = [("assets/sfx/whoosh-cinematic.mp3", max(0, s["start"] - 0.4), 0.2) for s in scenes[1:-1]]
sfx += [("assets/sfx/impact-bass-1.mp3", scenes[-1]["start"], 0.28), ("assets/sfx/whoosh-cinematic.mp3", scenes[-1]["start"] - 0.5, 0.2)]
args = ["ffmpeg", "-v", "error", "-y"]; ch = []; k = 0
for l in sched:
    args += ["-i", f"assets/voice/{l['id']}.mp3"]; ch.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(l['start']*1000)}:all=1[v{k}]"); k += 1
nv = k
for f, t, v in sfx:
    args += ["-i", f]; ch.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,volume={v},adelay={int(t*1000)}:all=1[x{k}]"); k += 1
args += ["-i", "assets/music/corporate-bed.wav"]
vo = "".join(f"[v{i}]" for i in range(nv)) + f"amix=inputs={nv}:normalize=0:dropout_transition=0,apad=whole_dur={TOTAL},atrim=0:{TOTAL}[vo]"
fx = "".join(f"[x{i}]" for i in range(nv, k)) + f"amix=inputs={k-nv}:normalize=0:dropout_transition=0,apad=whole_dur={TOTAL},atrim=0:{TOTAL}[fx]"
bed = f"[{k}:a]aresample=48000,volume=0.17[bed]"
duck = "[vo]asplit=2[vo1][key];[bed][key]sidechaincompress=threshold=0.012:ratio=8:attack=25:release=500:makeup=1[duck]"
final = f"[vo1][fx][duck]amix=inputs=3:normalize=0:duration=first,atrim=0:{TOTAL},loudnorm=I=-14:TP=-1.5:LRA=11[out]"
subprocess.run(args + ["-filter_complex", ";".join(ch + [vo, fx, bed, duck, final]), "-map", "[out]", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "256k", "renders/audio.mp3"], check=True)
print("ok")
