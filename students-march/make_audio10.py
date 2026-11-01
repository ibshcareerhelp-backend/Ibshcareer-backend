import numpy as np, wave
sr=44100;D=10;n=sr*D;t=np.arange(n)/sr;rng=np.random.default_rng(3)
a=np.zeros(n)
# marching thumps + dusty scuff
for k in range(int(D*2.6)):
    s=int(k/2.6*sr); L=int(0.18*sr); tt=np.arange(L)/sr
    thump=np.sin(2*np.pi*(70-80*tt)*tt)*np.exp(-tt*22)
    scuff=rng.normal(0,1,L)*np.exp(-tt*30)*0.25
    a[s:s+L]+=(thump+scuff)[:n-s]*(0.9 if k%2==0 else 0.7)
# wind/dust bed (lowpassed noise) and low drone
w=rng.normal(0,1,n);w=np.convolve(w,np.ones(200)/200,'same');a+=w*3*(0.6+0.4*np.sin(t*1.3))
a+=0.12*np.sin(2*np.pi*55*t)+0.07*np.sin(2*np.pi*82.4*t)
a*=np.minimum(1,np.minimum(t/0.6,(D-t)/0.9))
a=a/np.abs(a).max()*0.8
st=np.stack([a,np.roll(a,40)],1)
with wave.open('march10.wav','wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((st*32767).astype('<i2').tobytes())
