"""Audio-driven mouth animation for a still portrait (a procedural stand-in for true AI lip-sync).

  python tools/talk.py voice.wav 0 10.6 assets/video/talk-s1.mp4          # animate seconds 0..10.6 of voice.wav
  python tools/talk.py --test out.png                                      # preview a few mouth openings

voice.wav is the narration only (mono, 16 kHz), aligned to the film's timeline. The mouth opens with the loudness
of the speech (fast attack, slower release) and stays closed in silence. Needs numpy, opencv, mediapipe and the
face_landmarker.task model (TASK env var or ./face_landmarker.task).
"""
import os, subprocess, sys
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "..", "assets", "img", "presenter.jpg")
TASK = os.environ.get("TASK", os.path.join(HERE, "face_landmarker.task"))
FPS, OUT = 30, 720


def landmarks(img):
    import mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision
    lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=TASK), num_faces=1))
    r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    h, w = img.shape[:2]
    return np.array([[p.x * w, p.y * h] for p in r.face_landmarks[0]], dtype=np.float32)


UP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]      # inner upper lip, left to right
LO = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]      # inner lower lip, left to right


class Mouth:
    def __init__(self, img):
        self.img = img
        self.h, self.w = img.shape[:2]
        p = landmarks(img)
        self.p = p
        self.xl, self.xr = p[78][0], p[308][0]
        self.xc, self.hw = (self.xl + self.xr) / 2, (self.xr - self.xl) / 2
        self.ym = (p[13][1] + p[14][1]) / 2                  # line between the lips
        self.ychin = p[152][1]
        self.dmax = 0.21 * 2 * self.hw
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        self.xx, self.yy = xx, yy
        # displacement weight: 0 above the lip line, 1 from the lower lip down to the chin, fading below the chin
        ramp = np.clip((yy - self.ym) / (0.035 * self.hw), 0, 1)
        ramp = ramp * ramp * (3 - 2 * ramp)
        below = np.clip(1 - (yy - self.ychin) / (0.55 * self.hw), 0, 1)
        t = np.clip((yy - self.ym) / max(self.ychin - self.ym, 1), 0, 1)
        sx = (0.62 + 0.95 * t) * self.hw                     # narrow at the lips, wide at the jaw
        gx = np.exp(-(((xx - self.xc) / sx) ** 2))
        self.field = (ramp * below * gx).astype(np.float32)
        # soft mask around the mouth for compositing the interior
        self.up = p[UP].copy()
        self.lo0 = p[LO].copy()

    def frame(self, o):
        """o in 0..1 -> BGR frame with the mouth opened by o."""
        d = float(o) * self.dmax
        if d < 0.6:
            return self.img.copy()
        mapy = self.yy - d * self.field
        warped = cv2.remap(self.img, self.xx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        # the lower inner lip moves with the same field
        lo = self.lo0.copy()
        for i, (x, y) in enumerate(lo):
            lo[i, 1] = y + d * float(np.exp(-(((x - self.xc) / (0.62 * self.hw)) ** 2)))
        poly = np.vstack([self.up, lo[::-1]]).astype(np.float32)
        mask = np.zeros((self.h, self.w), np.uint8)
        cv2.fillPoly(mask, [np.round(poly).astype(np.int32)], 255)
        mask = cv2.erode(mask, np.ones((3, 3), np.uint8))
        x0, x1 = int(self.xl) - 6, int(self.xr) + 6
        y0, y1 = int(self.up[:, 1].min()) - 4, int(lo[:, 1].max()) + 6
        inner = np.zeros_like(warped)
        # mouth cavity: dark red-brown, a little lighter toward the bottom
        grad = np.linspace(0, 1, y1 - y0, dtype=np.float32)[:, None]
        cav = np.zeros((y1 - y0, x1 - x0, 3), np.float32)
        cav[..., 0] = 22 + 14 * grad; cav[..., 1] = 24 + 18 * grad; cav[..., 2] = 62 + 30 * grad   # BGR
        inner[y0:y1, x0:x1] = cav
        # upper teeth: a soft off-white band under the upper lip, only when open enough to show them
        tooth_h = min(0.40 * d, 0.14 * self.hw)
        if tooth_h > 1.2:
            band = np.zeros((self.h, self.w), np.uint8)
            upper = self.up.copy()
            lower = self.up.copy(); lower[:, 1] += tooth_h * np.sin(np.linspace(0.2, np.pi - 0.2, len(self.up))) ** 0.7
            cv2.fillPoly(band, [np.round(np.vstack([upper, lower[::-1]])).astype(np.int32)], 255)
            band = cv2.GaussianBlur(band, (0, 0), 2.2)
            ty = np.clip((self.yy - self.up[5, 1]) / max(tooth_h, 1), 0, 1)[..., None]
            teeth = (np.array([236, 242, 248], np.float32) * (1 - 0.10 * ty)).astype(np.float32)   # BGR, darker toward the gap
            a = (band.astype(np.float32) / 255)[..., None] * 0.9
            inner = (inner * (1 - a) + teeth * a).astype(np.uint8)
        # tongue hint when wide open
        if d > 0.45 * self.dmax:
            tg = np.zeros((self.h, self.w), np.uint8)
            cy = int(lo[5][1] - 0.35 * d)
            cv2.ellipse(tg, (int(self.xc), cy), (int(0.42 * self.hw), int(0.22 * d)), 0, 0, 360, 255, -1)
            tg = cv2.GaussianBlur(tg, (0, 0), 3.0)
            tongue = np.empty_like(warped); tongue[:] = (84, 62, 150)
            a = (tg.astype(np.float32) / 255)[..., None] * 0.8
            inner = (inner * (1 - a) + tongue * a).astype(np.uint8)
        m = cv2.GaussianBlur(mask, (0, 0), 1.3).astype(np.float32)[..., None] / 255
        return (warped * (1 - m) + inner * m).astype(np.uint8)


def envelope(wav16k, t0, t1):
    """mouth openness per video frame from the loudness of the narration"""
    x = wav16k
    n = int((t1 - t0) * FPS)
    sr = 16000
    win = int(sr / FPS)
    env = np.zeros(n, np.float32)
    for i in range(n):
        s = int((t0 + i / FPS) * sr)
        seg = x[max(0, s - win // 2): s + win]
        env[i] = np.sqrt(np.mean(seg ** 2)) if len(seg) else 0
    db = 20 * np.log10(env + 1e-5)
    speech = np.clip((db + 46) / 26, 0, 1)                 # -46 dB: closed, -20 dB: wide open
    o = np.zeros(n, np.float32)
    cur = 0.0
    for i in range(n):                                       # fast attack, slower release
        tgt = speech[i] ** 0.85
        cur = cur + (tgt - cur) * (0.65 if tgt > cur else 0.28)
        o[i] = cur
    o[o < 0.07] = 0
    return o


def read_wav(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"])
    return np.frombuffer(raw, dtype=np.float32)


if __name__ == "__main__":
    img = cv2.imread(IMG)
    mouth = Mouth(img)
    if sys.argv[1] == "--test":
        cs = [mouth.frame(o)[420:800, 380:830] for o in (0.0, 0.3, 0.6, 1.0)]
        cv2.imwrite(sys.argv[2], np.hstack(cs))
        sys.exit()
    wav, t0, t1, out = read_wav(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
    o = envelope(wav, t0, t1)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OUT}x{OUT}", "-r", str(FPS), "-i", "-",
                           "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", "-g", "15", out], stdin=subprocess.PIPE)
    for v in o:
        f = cv2.resize(mouth.frame(v), (OUT, OUT), interpolation=cv2.INTER_AREA)
        ff.stdin.write(f.tobytes())
    ff.stdin.close(); ff.wait()
    print(out, len(o), "frames")
