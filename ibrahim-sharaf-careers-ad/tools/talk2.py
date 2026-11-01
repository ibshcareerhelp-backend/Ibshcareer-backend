"""Talking portrait v2: mouth shapes follow the sounds of each line, and the body moves with the speech.

  python tools/talk2.py out.mp4 T0 T1        animate film time T0..T1 (seconds), using tools/schedule.json + assets/voice/*.mp3
  python tools/talk2.py --test out.png       preview mouth shapes

How it works (all procedural, no neural lip-sync model):
 * each narration line is turned into phonemes (the same espeak G2P Kokoro used), spread over the line's speech
   segments (found from the audio's own silences), and mapped to mouth shapes: jaw opening, lip rounding/spreading,
   closed lips for p/b/m, teeth on lip for f/v, with smoothing between them;
 * the mouth interior (dark cavity, upper and lower teeth, tongue) is drawn onto the portrait;
 * a person cut-out moves slightly over a cleaned background: breathing, a nod on stressed syllables, a gentle sway
   and a slow push-in, all driven by the loudness of the voice.
Needs numpy, opencv, mediapipe, kokoro-onnx (for the phonemiser) and two MediaPipe model files in tools/.
"""
import json, os, subprocess, sys
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
IMG = os.path.join(ROOT, "assets", "img", "presenter.jpg")
LM_TASK = os.environ.get("LM_TASK", os.path.join(HERE, "face_landmarker.task"))
SEG_TASK = os.environ.get("SEG_TASK", os.path.join(HERE, "selfie_segmenter.tflite"))
FPS, OUT = 30, 720

# ---------------------------------------------------------------- phonemes -> mouth shapes
# (jaw opening 0..1, lip width -1 round .. +1 spread, teeth emphasis 0..1, duration weight, kind)
V = {"ɑ": (1.0, 0.0), "æ": (0.9, 0.3), "ʌ": (0.7, 0.1), "a": (0.9, 0.1), "ɒ": (0.8, -0.3), "ɔ": (0.65, -0.55), "o": (0.55, -0.7),
     "ʊ": (0.35, -0.6), "u": (0.30, -0.9), "ɛ": (0.6, 0.4), "e": (0.5, 0.5), "ɜ": (0.5, 0.1), "ə": (0.4, 0.1), "ɚ": (0.38, -0.2),
     "ɪ": (0.4, 0.5), "i": (0.28, 0.9), "ɐ": (0.5, 0.0), "ᵻ": (0.4, 0.4)}
DIPH = {"aɪ": ("a", "ɪ"), "aʊ": ("a", "ʊ"), "eɪ": ("e", "ɪ"), "oʊ": ("o", "ʊ"), "ɔɪ": ("ɔ", "ɪ"), "əʊ": ("ə", "ʊ")}
C = {  # opening, width, teeth, weight, kind
    "p": (0.0, -0.2, 0.0, 0.5, "bil"), "b": (0.0, -0.2, 0.0, 0.5, "bil"), "m": (0.0, -0.2, 0.0, 0.6, "bil"),
    "f": (0.16, 0.2, 1.0, 0.7, "lab"), "v": (0.16, 0.2, 1.0, 0.6, "lab"),
    "w": (0.30, -1.0, 0.0, 0.5, "c"), "ʃ": (0.28, -0.8, 0.6, 0.8, "c"), "ʒ": (0.28, -0.8, 0.6, 0.7, "c"),
    "s": (0.16, 0.6, 1.0, 0.8, "c"), "z": (0.16, 0.6, 1.0, 0.7, "c"), "θ": (0.2, 0.3, 1.0, 0.7, "c"), "ð": (0.2, 0.3, 1.0, 0.5, "c"),
    "t": (0.24, 0.2, 0.6, 0.5, "c"), "d": (0.24, 0.2, 0.6, 0.5, "c"), "n": (0.24, 0.2, 0.5, 0.6, "c"), "l": (0.3, 0.1, 0.5, 0.6, "c"),
    "k": (0.3, 0.0, 0.3, 0.5, "c"), "ɡ": (0.3, 0.0, 0.3, 0.5, "c"), "g": (0.3, 0.0, 0.3, 0.5, "c"), "ŋ": (0.28, 0.0, 0.3, 0.6, "c"),
    "h": (0.35, 0.0, 0.2, 0.4, "c"), "ɹ": (0.3, -0.5, 0.2, 0.6, "c"), "r": (0.3, -0.5, 0.2, 0.6, "c"), "j": (0.25, 0.8, 0.5, 0.5, "c"),
    "ʔ": (0.2, 0.0, 0.0, 0.2, "c"),
}
AFFR = {"tʃ": ("t", "ʃ"), "dʒ": ("d", "ʒ")}
PAUSE = ",.?!;:"


def parse_ipa(s):
    """IPA string -> list of tokens. token = dict(open,width,teeth,w,kind,stress) or {'pause':True}."""
    toks, i, stress = [], 0, 1.0
    while i < len(s):
        ch = s[i]
        if ch in "ˈ":
            stress = 1.18; i += 1; continue
        if ch in "ˌ":
            stress = 1.08; i += 1; continue
        if ch in PAUSE:
            toks.append({"pause": True}); i += 1; continue
        if ch in " ‿-ˑ'\"“”()":
            i += 1; continue
        two = s[i:i + 2]
        if two in DIPH:
            a, b = DIPH[two]
            for k, v in enumerate((a, b)):
                o, w = V[v]
                toks.append({"open": o * stress * (1 if k == 0 else 0.8), "width": w, "teeth": 0.2, "w": 0.9 * stress, "kind": "v"})
            stress = 1.0; i += 2; continue
        if two in AFFR:
            for v in AFFR[two]:
                o, w, t, wt, k = C[v]
                toks.append({"open": o, "width": w, "teeth": t, "w": wt * 0.8, "kind": k})
            i += 2; continue
        if ch in V:
            o, w = V[ch]
            longv = i + 1 < len(s) and s[i + 1] == "ː"
            toks.append({"open": min(1.0, o * stress), "width": w, "teeth": 0.2, "w": (1.5 if longv else 1.0) * stress, "kind": "v"})
            stress = 1.0; i += 2 if longv else 1; continue
        if ch in C:
            o, w, t, wt, k = C[ch]
            toks.append({"open": o, "width": w, "teeth": t, "w": wt, "kind": k}); i += 1; continue
        i += 1  # unknown symbol (length mark etc.)
    return toks


def phonemize(text):
    from kokoro_onnx.tokenizer import Tokenizer
    return Tokenizer().phonemize(text, "en-us")


# ---------------------------------------------------------------- audio helpers
def read_audio(path, sr=16000):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"])
    return np.frombuffer(raw, dtype=np.float32)


def db_track(x, sr=16000, hop=0.01):
    n = int(len(x) / (sr * hop))
    h, w = int(sr * hop), int(sr * hop * 2)
    e = np.array([np.sqrt(np.mean(x[i * h:i * h + w] ** 2) + 1e-12) for i in range(n)], np.float32)
    return 20 * np.log10(e + 1e-6)


def speech_segments(db, hop=0.01, drop=36, gap=0.11, minlen=0.08):
    on = db > (db.max() - drop)
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None: start = i
        if not v and start is not None: segs.append([start * hop, i * hop]); start = None
    if start is not None: segs.append([start * hop, len(on) * hop])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < gap: merged[-1][1] = s[1]
        else: merged.append(s)
    return [s for s in merged if s[1] - s[0] >= minlen]


def line_keys(text, audio_path, line_start):
    """keyframes (time, open, width, teeth, closure) in film time for one narration line"""
    x = read_audio(audio_path)
    db = db_track(x)
    segs = speech_segments(db)
    ipa = phonemize(text)
    phrases, cur = [], []
    for t in parse_ipa(ipa):
        if t.get("pause"):
            if cur: phrases.append(cur); cur = []
        else: cur.append(t)
    if cur: phrases.append(cur)
    if len(phrases) != len(segs):                      # fall back: one stretch over all the speech
        flat = [t for p in phrases for t in p]
        phrases, segs = [flat], [[segs[0][0], segs[-1][1]]]
    keys = []
    for toks, (a, b) in zip(phrases, segs):
        tot = sum(t["w"] for t in toks)
        acc = 0.0
        keys.append((line_start + a - 0.07, 0, 0, 0, 0))
        for t in toks:
            t0 = a + (b - a) * acc / tot
            acc += t["w"]
            t1 = a + (b - a) * acc / tot
            tc = line_start + (t0 + t1) / 2
            if t["kind"] == "bil":
                keys += [(line_start + t0 + 0.2 * (t1 - t0), t["open"], t["width"], 0, 1), (line_start + t1 - 0.2 * (t1 - t0), t["open"], t["width"], 0, 1)]
            else:
                keys.append((tc, t["open"], t["width"], t["teeth"], 0))
        keys.append((line_start + b + 0.07, 0, 0, 0, 0))
    return keys, [(line_start + a, line_start + b) for a, b in segs]


def sample_tracks(keys, t0, t1):
    keys = sorted(keys)
    kt = np.array([k[0] for k in keys]); K = np.array([k[1:] for k in keys], np.float32)
    fine = np.arange(t0 - 0.2, t1 + 0.2, 1 / 240)
    tr = np.stack([np.interp(fine, kt, K[:, j]) for j in range(4)], 1)
    sig = int(0.024 * 240)
    g = np.exp(-0.5 * (np.arange(-3 * sig, 3 * sig + 1) / sig) ** 2); g /= g.sum()
    sm = np.stack([np.convolve(tr[:, j], g, mode="same") for j in range(4)], 1)
    sm[:, 3] = np.minimum(tr[:, 3], sm[:, 3] * 0 + tr[:, 3])         # closure stays sharp
    t = np.arange(t0, t1, 1 / FPS)
    out = np.stack([np.interp(t, fine, sm[:, j]) for j in range(4)], 1)
    clos = np.interp(t, fine, tr[:, 3])
    out[:, 0] *= (1 - np.clip(clos, 0, 1))                              # lips press shut on p b m
    return t, out


# ---------------------------------------------------------------- the face
UP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
LO = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]


def landmarks(img):
    import mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision
    lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=LM_TASK), num_faces=1))
    r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    h, w = img.shape[:2]
    return np.array([[p.x * w, p.y * h] for p in r.face_landmarks[0]], dtype=np.float32)


def person_mask(img):
    import mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision
    seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=mpp.BaseOptions(model_asset_path=SEG_TASK), output_confidence_masks=True, output_category_mask=False))
    r = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    m = r.confidence_masks[0].numpy_view().astype(np.float32)
    if m.mean() < 0.3 and len(r.confidence_masks) > 1:                  # some models put the person in the other channel
        m = r.confidence_masks[1].numpy_view().astype(np.float32)
    return m


class Face:
    def __init__(self, img):
        self.img = img
        self.h, self.w = img.shape[:2]
        p = landmarks(img)
        self.xl, self.xr = p[78][0], p[308][0]
        self.xc, self.hw = (self.xl + self.xr) / 2, (self.xr - self.xl) / 2
        self.ym = (p[13][1] + p[14][1]) / 2
        self.ychin = p[152][1]
        self.dmax = 0.25 * 2 * self.hw
        self.up0, self.lo0 = p[UP].copy(), p[LO].copy()
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        self.xx, self.yy = xx, yy
        ramp = np.clip((yy - self.ym) / (0.035 * self.hw), 0, 1)
        below = np.clip(1 - (yy - self.ychin) / (0.55 * self.hw), 0, 1)
        t = np.clip((yy - self.ym) / max(self.ychin - self.ym, 1), 0, 1)
        sx = (0.80 + 0.95 * t) * self.hw
        self.field = (ramp * below * np.exp(-(np.abs((xx - self.xc) / sx) ** 3))).astype(np.float32)
        self.G = np.exp(-(((xx - self.xc) / (1.5 * self.hw)) ** 2) - (((yy - self.ym) / (0.9 * self.hw)) ** 2)).astype(np.float32)

    def frame(self, o, wd, teeth):
        d = float(o) * self.dmax
        k = (0.13 * float(wd)) if wd > 0 else (0.24 * float(wd))   # lip spread (+) / pucker (-)
        if d < 0.5 and abs(k) < 0.01:
            return self.img.copy()
        mapx = self.xc + (self.xx - self.xc) / (1 + k * self.G)
        mapy = self.yy - d * self.field
        warped = cv2.remap(self.img, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        if d < 1.2:
            return warped
        gx = lambda x: np.exp(-(abs((x - self.xc) / (0.80 * self.hw)) ** 3))
        sc = lambda x, y: (self.xc + (x - self.xc) * (1 + k * float(np.exp(-(((x - self.xc) / (1.5 * self.hw)) ** 2) - (((y - self.ym) / (0.9 * self.hw)) ** 2)))))
        up = np.array([[sc(x, y), y] for x, y in self.up0], np.float32)
        lo = np.array([[sc(x, y), y + d * float(gx(x))] for x, y in self.lo0], np.float32)
        poly = np.round(np.vstack([up, lo[::-1]])).astype(np.int32)
        mask = np.zeros((self.h, self.w), np.uint8); cv2.fillPoly(mask, [poly], 255)
        mask = cv2.erode(mask, np.ones((3, 3), np.uint8))
        yy, xx = self.yy, self.xx
        top = float(up[:, 1].min()); bot = float(lo[:, 1].max())
        # mouth cavity: dark red-brown, shadowed under the upper lip
        v = np.clip((yy - top) / max(bot - top, 1), 0, 1)[..., None]
        cav = np.array([20, 22, 58], np.float32) * (1 - v) + np.array([34, 38, 96], np.float32) * v
        inner = np.broadcast_to(cav, (self.h, self.w, 3)).copy()
        xmid = (up[0, 0] + up[-1, 0]) / 2; half = (up[-1, 0] - up[0, 0]) / 2
        # upper teeth
        th = min(0.55 * d, 0.19 * self.hw) * (0.75 + 0.5 * float(teeth))
        if th > 1.2:
            u2 = up.copy(); u2[:, 1] += th * (np.sin(np.linspace(0.12, np.pi - 0.12, len(up))) ** 0.55)
            band = np.zeros((self.h, self.w), np.uint8); cv2.fillPoly(band, [np.round(np.vstack([up, u2[::-1]])).astype(np.int32)], 255)
            band = cv2.GaussianBlur(band, (0, 0), 1.0).astype(np.float32)[..., None] / 255
            ty = np.clip((yy - self.up0[5, 1]) / max(th, 1), 0, 1)[..., None]
            tx = np.clip(np.abs(xx - xmid) / max(half, 1), 0, 1)[..., None]
            col = np.array([238, 244, 250], np.float32)                             # warm white (BGR)
            col = col * (1 - 0.16 * tx ** 2) * (1 - 0.08 * (1 - ty) ** 2) * (1 - 0.04 * ty)
            lines = np.zeros((self.h, self.w), np.float32)
            for j in range(-5, 6):                                               # faint gaps between teeth
                x0 = xmid + j * 0.105 * half * 0.82 + 0.5
                cv2.line(lines, (int(round(x0)), int(top)), (int(round(x0 + 0.01 * j * half)), int(top + th * 0.95)), 1.0, 1, cv2.LINE_AA)
            lines = cv2.GaussianBlur(lines, (0, 0), 0.7)[..., None]
            col = col * (1 - 0.22 * lines)
            inner = inner * (1 - band * 0.96) + col * band * 0.96
        # lower teeth when wide open
        if o > 0.5:
            h2 = 0.40 * th
            l2 = lo.copy(); l2[:, 1] -= h2 * (np.sin(np.linspace(0.2, np.pi - 0.2, len(lo))) ** 0.7)
            band = np.zeros((self.h, self.w), np.uint8); cv2.fillPoly(band, [np.round(np.vstack([lo, l2[::-1]])).astype(np.int32)], 255)
            band = cv2.GaussianBlur(band, (0, 0), 1.2).astype(np.float32)[..., None] / 255 * 0.7
            inner = inner * (1 - band) + np.array([214, 222, 232], np.float32) * band
        # tongue
        if o > 0.38:
            tg = np.zeros((self.h, self.w), np.uint8)
            cy = int(lo[5, 1] - 0.28 * d)
            cv2.ellipse(tg, (int(xmid), cy), (int(0.40 * half), max(2, int(0.20 * d))), 0, 0, 360, 255, -1)
            tg = cv2.GaussianBlur(tg, (0, 0), 2.6).astype(np.float32)[..., None] / 255 * 0.85
            inner = inner * (1 - tg) + np.array([92, 70, 160], np.float32) * tg
        m = cv2.GaussianBlur(mask, (0, 0), 1.1).astype(np.float32)[..., None] / 255
        return np.clip(warped * (1 - m) + inner * m, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- the body
class Body:
    def __init__(self, img, mask):
        h, w = img.shape[:2]
        m = cv2.GaussianBlur((mask > 0.5).astype(np.float32), (0, 0), 2.2)
        self.m = m
        small = cv2.resize(img, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
        hole = cv2.dilate((cv2.resize(m, (w // 4, h // 4)) > 0.3).astype(np.uint8) * 255, np.ones((7, 7), np.uint8))
        bg = cv2.inpaint(small, hole, 6, cv2.INPAINT_TELEA)
        bg = cv2.resize(bg, (w, h), interpolation=cv2.INTER_CUBIC)
        a = cv2.GaussianBlur(cv2.dilate((m > 0.3).astype(np.uint8) * 255, np.ones((9, 9), np.uint8)), (0, 0), 3).astype(np.float32)[..., None] / 255
        self.bg = (img * (1 - a) + bg * a).astype(np.uint8)
        self.w, self.h = w, h

    def compose(self, person, dx, dy, rot, scale, bg_scale):
        c = (self.w / 2, self.h * 0.92)                                    # pivot low in the frame: the head moves more than the torso
        M = cv2.getRotationMatrix2D(c, rot, scale); M[0, 2] += dx; M[1, 2] += dy
        p = cv2.warpAffine(person, M, (self.w, self.h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        mm = cv2.warpAffine(self.m, M, (self.w, self.h), flags=cv2.INTER_LINEAR)[..., None]
        Mb = cv2.getRotationMatrix2D((self.w / 2, self.h / 2), 0, bg_scale)
        b = cv2.warpAffine(self.bg, Mb, (self.w, self.h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        return (b * (1 - mm) + p * mm).astype(np.uint8)


def body_motion(t, env, act):
    """per-frame (dx, dy, rot, scale) from the voice: breathing, nods on stressed syllables, sway, push-in"""
    lp = np.convolve(env, np.ones(5) / 5, mode="same")
    d = np.gradient(lp)
    nod = np.clip(lp, 0, 1) * 5.0                                         # px, head dips on louder syllables
    emph = np.clip(d, 0, None) * 38.0                                     # onset accents
    dy = nod * 0.9 + emph * 2.0 + 2.2 * np.sin(2 * np.pi * 0.24 * t) - 2.0
    dx = 5.5 * np.sin(2 * np.pi * 0.13 * t + 0.6) * (0.4 + 0.6 * act) + 1.6 * np.sin(2 * np.pi * 0.41 * t) * act
    rot = (0.55 * np.sin(2 * np.pi * 0.17 * t + 1.1) + 0.9 * (lp - lp.mean()) - 0.35 * np.clip(d, 0, None) * 20) * (0.5 + 0.5 * act)
    scale = 1.0 + 0.004 * np.sin(2 * np.pi * 0.24 * t) + 0.012 * act
    return dx, dy, rot, scale


def main_render(out, t0, t1):
    img = cv2.imread(IMG)
    face, body = Face(img), Body(img, person_mask(img))
    sched = json.load(open(os.path.join(HERE, "schedule.json")))
    say = {l["id"]: l["say"] for l in json.load(open(os.path.join(HERE, "lines.json")))}
    keys = []
    for l in sched:
        k, _ = line_keys(say[l["id"]], os.path.join(ROOT, "assets", "voice", l["id"] + ".mp3"), l["start"])
        keys += k
    t, P = sample_tracks(keys, t0, t1)
    vo = read_audio(os.path.join(HERE, "voice-only.wav"))
    db = db_track(vo)
    envf = np.interp(t, np.arange(len(db)) * 0.01, np.clip((db - (db.max() - 34)) / 34, 0, 1))
    act = np.convolve((envf > 0.1).astype(np.float32), np.ones(15) / 15, mode="same")
    P[:, 0] = np.clip((P[:, 0] - 0.12) / 0.62, 0, 1)                      # vowels open wide, consonants stay nearly closed
    P[:, 0] *= (0.7 + 0.5 * envf) * act.clip(0, 1) ** 0.3               # quieter -> smaller movements; silence -> closed
    dx, dy, rot, sc = body_motion(t, envf, act)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OUT}x{OUT}", "-r", str(FPS), "-i", "-",
                           "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", "-g", "15", out], stdin=subprocess.PIPE)
    ramp = np.minimum(1, (t - t0) / 0.8)                                  # ease the motion in at the start of the clip
    push = 1 + 0.035 * (t - t0) / max(t1 - t0, 1)
    for i in range(len(t)):
        pe = face.frame(min(1.0, P[i, 0]), P[i, 1], P[i, 2])
        fr = body.compose(pe, dx[i] * ramp[i], dy[i] * ramp[i], rot[i] * ramp[i], sc[i] * push[i], 1 + 0.4 * (sc[i] * push[i] - 1))
        ff.stdin.write(cv2.resize(fr, (OUT, OUT), interpolation=cv2.INTER_AREA).tobytes())
    ff.stdin.close(); ff.wait()
    print(out, len(t), "frames")


if __name__ == "__main__":
    if sys.argv[1] == "--test":
        img = cv2.imread(IMG); f = Face(img)
        shapes = [("rest", 0, 0, 0), ("ah", 1.0, 0.0, 0.2), ("oo", 0.3, -0.9, 0.0), ("ee", 0.28, 0.9, 0.6), ("eh", 0.6, 0.4, 0.3), ("ff", 0.16, 0.2, 1.0)]
        cs = [f.frame(o, w, t)[460:660, 470:740] for _, o, w, t in shapes]
        cs = [cv2.resize(c, None, fx=2.2, fy=2.2, interpolation=cv2.INTER_CUBIC) for c in cs]
        for c, (n, *_r) in zip(cs, shapes): cv2.putText(c, n, (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.imwrite(sys.argv[2], np.vstack([np.hstack(cs[:3]), np.hstack(cs[3:])]))
    else:
        main_render(sys.argv[1], float(sys.argv[2]), float(sys.argv[3]))
