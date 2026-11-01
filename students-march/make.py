import numpy as np, subprocess, math
from PIL import Image, ImageFilter
W,H,FPS,SEC=1280,720,24,10
src=Image.open('/root/.claude/uploads/ef18b16f-981a-5c8f-9d09-7f759852c040/298d9910-image.jpg').convert('RGB')
# work at 1.15x canvas so zoom/warp never shows edges
S=1.18
base=np.asarray(src.resize((int(W*S),int(H*S)),Image.LANCZOS)).astype(np.float32)
BH,BW=base.shape[:2]
rng=np.random.default_rng(7)
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)

def sprite(n=128):
    a=rng.random((16,16)).astype(np.float32)
    im=Image.fromarray((a*255).astype(np.uint8)).resize((n,n),Image.BICUBIC).filter(ImageFilter.GaussianBlur(5))
    a=np.asarray(im).astype(np.float32)/255
    a=(a-a.min())/(a.max()-a.min()+1e-6)
    r=np.hypot(*(np.mgrid[0:n,0:n]-n/2)/(n/2)); fall=np.clip(1-r,0,1)**1.3
    return a*fall
SPR=[sprite() for _ in range(6)]
# dust particles: born near feet (bottom band), billow up/back, fade
P=[]
for i in range(320):
    P.append(dict(x=rng.uniform(-0.05,1.05),y0=rng.uniform(0.6,1.05),t0=rng.uniform(-3,SEC),
        life=rng.uniform(2.5,4.5),size=rng.uniform(140,380),sp=rng.integers(0,6),
        vx=rng.uniform(-110,-30),vy=rng.uniform(-45,-8),a=rng.uniform(0.4,0.75)))

def sample(img,mx,my):
    mx=np.clip(mx,0,BW-1.001);my=np.clip(my,0,BH-1.001)
    x0=mx.astype(np.int32);y0=my.astype(np.int32);fx=(mx-x0)[...,None];fy=(my-y0)[...,None]
    a=img[y0,x0];b=img[y0,x0+1];c=img[y0+1,x0];d=img[y0+1,x0+1]
    return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy

cmd=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
     '-c:v','libx264','-pix_fmt','yuv420p','-crf','17','-preset','medium','/home/user/Ibshcareer-backend/students-march/march_intense.mp4']
ff=subprocess.Popen(cmd,stdin=subprocess.PIPE)
step=2*math.pi*2.6  # ~1.9 steps/sec
for f in range(FPS*SEC):
    t=f/FPS
    zoom=1.0+0.12*(t/SEC)            # slow push-in
    ny=yy/H                           # 0 top..1 bottom
    depth=np.clip((ny-0.28)/0.72,0,1)**1.2   # bodies (low in frame) move most
    ph=step*t+xx/W*5.0+ny*1.5         # slightly desynced marching phase
    bob=-(np.abs(np.sin(ph/2)))*26*depth      # up/down footfall
    sway=np.sin(ph/2)*17*depth*(0.4+ny)         # side-to-side body sway
    shake_x=7*math.sin(t*11.3)+4*math.sin(t*5.1); shake_y=9*abs(math.sin(step*t/2))
    cx,cy=BW/2,BH/2
    mx=cx+(xx-W/2)/zoom+sway+shake_x
    my=cy+(yy-H/2)/zoom+bob+shake_y
    fr=sample(base,mx,my)
    # haze rolling behind
    haze=0.18+0.07*np.sin(t*0.8)
    fr=fr*(1-haze)+np.array([225,180,115],np.float32)*haze*(0.4+0.6*(1-ny)[...,None])
    # dust
    dust=np.zeros((H,W,1),np.float32)
    for p in P:
        age=t-p['t0']
        if age<0 or age>p['life']: continue
        u=age/p['life']
        cxp=p['x']*W+p['vx']*age*(0.6+u); cyp=p['y0']*H+p['vy']*age
        sz=int(p['size']*(0.6+1.4*u)); 
        if sz<8: continue
        a=p['a']*math.sin(math.pi*u)**1.2
        sp=np.asarray(Image.fromarray((SPR[p['sp']]*255).astype(np.uint8)).resize((sz,sz),Image.BILINEAR)).astype(np.float32)/255*a
        x0=int(cxp-sz/2);y0=int(cyp-sz/2)
        xa,ya=max(x0,0),max(y0,0);xb,yb=min(x0+sz,W),min(y0+sz,H)
        if xa>=xb or ya>=yb: continue
        sub=sp[ya-y0:yb-y0,xa-x0:xb-x0,None]
        dust[ya:yb,xa:xb]=1-(1-dust[ya:yb,xa:xb])*(1-sub)
    col=np.array([214,170,112],np.float32)
    fr=fr*(1-dust)+col*dust
    # vignette + grade + fade
    vg=1-0.35*(((xx/W-.5)**2+(yy/H-.5)**2)*2.2)
    fr=fr*vg[...,None]*np.array([1.04,1.0,0.93],np.float32)
    fade=min(1,t/0.6,(SEC-t)/0.8)
    fr=fr*fade
    ff.stdin.write(np.clip(fr,0,255).astype(np.uint8).tobytes())
ff.stdin.close();ff.wait()
