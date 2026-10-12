import numpy as np, mh, json
V, VT, F = mh.load_obj()
B = V.copy()
mh.macro(B, muscle=0.7, weight=0.55, height=0.62, proportions=0.85)
vg = mh.vgroups()
P = B * 0.1
body = sorted({i for f in F['body'] for i in f[0]})
miny = P[body][:, 1].min()
P[:, 1] -= miny
print('height', P[body][:, 1].max())
rig = mh.rig()
for name in ['pelvis', 'spine_01', 'spine_03', 'neck_01', 'head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'middle_01_l', 'thumb_01_l']:
    h = rig[name]['head']
    p = mh.joint_pos(P, vg, h['cube_name'])
    print(name, np.round(p, 3))
# UV ranges of head-ish faces
W = mh.weights()
wv = np.zeros((len(P), ))
headw = np.zeros(len(P))
for bn in ['head', 'neck_01']:
    for i, w in W[bn]:
        headw[i] += w
hf = [f for f in F['body'] if headw[f[0]].mean() > 0.5]
uv = np.array([VT[t] for f in hf for t in f[1]])
print('head faces', len(hf), 'uv bbox', uv.min(0), uv.max(0))
handw = np.zeros(len(P))
for bn, lst in W.items():
    if bn.startswith(('hand_', 'thumb', 'index', 'middle', 'ring', 'pinky')):
        for i, w in lst:
            handw[i] += w
hf2 = [f for f in F['body'] if handw[f[0]].mean() > 0.5]
uv2 = np.array([VT[t] for f in hf2 for t in f[1]])
print('hand faces', len(hf2), 'uv bbox', uv2.min(0), uv2.max(0))
