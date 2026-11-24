# Convierte la composición de marca (PNG con transparencia) en:
#   - composicion.svg          : estática, un solo color
#   - composicion-motion.svg   : animada (se dibuja sola siguiendo las líneas y luego queda con movimiento suave)
#   - motivo-*.svg             : elementos sueltos para usar como adornos
# Uso: python3 -I genera.py <composicion.png> <carpeta de salida>
import sys, math, heapq, json
import numpy as np, cv2
from PIL import Image
from skimage.morphology import skeletonize
from scipy.spatial import cKDTree
import potrace

SRC, OUT = sys.argv[1], sys.argv[2]
S, U = 3000, 1000
K = U / S                      # px del original -> unidades del viewBox
COLOR = "#AB391B"              # terracota de la marca
VEL = 1650.0                   # px (del original) por segundo que avanza el trazo
MAXJ = 105                     # salto máximo entre piezas para que "prenda" la siguiente

def f(v):                      # número compacto con 1 decimal en unidades del viewBox
    s = "%.1f" % (v * K)
    return s[:-2] if s.endswith(".0") else s

a = np.array(Image.open(SRC).convert("RGBA"))
ink = (a[..., 3] > 110).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(ink, connectivity=8)
comps = [(i, *st[i][:5], cen[i][0], cen[i][1]) for i in range(1, n) if st[i][4] >= 40]
comps.sort(key=lambda c: (round(c[7] / 150), c[6]))     # mismo orden que el mapa de revisión
NC = len(comps)
k_of_lab = {c[0]: k for k, c in enumerate(comps)}

# ---------- 1. Formas exactas (contornos suavizados) ----------
def traza(k, recorte=None):
    i, x, y, w, h, area, cx, cy = comps[k]
    p = 4
    x0, y0 = max(0, x - p), max(0, y - p)
    m = (lab[y0:y + h + p, x0:x + w + p] == i)
    if recorte is not None:
        Y, X = np.mgrid[y0:y0 + m.shape[0], x0:x0 + m.shape[1]]
        m = m & recorte(X, Y)
    pl = potrace.Bitmap(~m).trace(turdsize=6, alphamax=1.0, opticurve=True, opttolerance=0.45)
    out = []
    for c in pl:
        s = c.start_point
        out.append("M%s %s" % (f(s.x + x0), f(s.y + y0)))
        for g in c.segments:
            if g.is_corner:
                out.append("L%s %s %s %s" % (f(g.c.x + x0), f(g.c.y + y0), f(g.end_point.x + x0), f(g.end_point.y + y0)))
            else:
                out.append("C%s %s %s %s %s %s" % (f(g.c1.x + x0), f(g.c1.y + y0), f(g.c2.x + x0), f(g.c2.y + y0), f(g.end_point.x + x0), f(g.end_point.y + y0)))
        out.append("Z")
    return "".join(out)

shapes = [traza(k) for k in range(NC)]
print("formas trazadas:", NC, "| tamaño", sum(len(s) for s in shapes) // 1024, "KB")

# ---------- 2. Líneas centrales y propagación del trazo ----------
sk = skeletonize(ink.astype(bool))
dt = cv2.distanceTransform(ink, cv2.DIST_L2, 5)
ys, xs = np.nonzero(sk)
N = len(xs)
pts = np.stack([xs, ys], 1).astype(float)
idx = -np.ones(sk.shape, int); idx[ys, xs] = np.arange(N)
comp = np.array([k_of_lab.get(l, -1) for l in lab[ys, xs]])
rad = dt[ys, xs]
nb = [[] for _ in range(N)]
for i in range(N):
    x, y = xs[i], ys[i]
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == 0 and dy == 0: continue
            xx, yy = x + dx, y + dy
            if 0 <= xx < S and 0 <= yy < S:
                j = idx[yy, xx]
                if j >= 0: nb[i].append((j, math.hypot(dx, dy)))
# saltos entre piezas cercanas (el trazo "brinca" el hueco)
ids = [np.nonzero(comp == k)[0] for k in range(NC)]
trees = [cKDTree(pts[ix]) for ix in ids]
gaps = {}
for A in range(NC):
    for B in range(A + 1, NC):
        d, j = trees[B].query(pts[ids[A]])
        m = int(np.argmin(d))
        gaps[(A, B)] = (float(d[m]), int(ids[A][m]), int(ids[B][j[m]]))
SALTO = 1.5                    # cruzar un hueco "cuesta" más que dibujar (pequeña pausa entre piezas)
def enlaza(A, B):
    d, i, j = gaps[(min(A, B), max(A, B))]
    nb[i].append((j, d * SALTO)); nb[j].append((i, d * SALTO))
# árbol mínimo por distancia entre piezas: garantiza que todo se conecte por el vecino más cercano
padre = list(range(NC))
def raiz(x):
    while padre[x] != x:
        padre[x] = padre[padre[x]]; x = padre[x]
    return x
arbol = set()
for (A, B), (d, i, j) in sorted(gaps.items(), key=lambda kv: kv[1][0]):
    ra, rb = raiz(A), raiz(B)
    if ra != rb:
        padre[ra] = rb; arbol.add((A, B))
for (A, B), (d, i, j) in gaps.items():
    if (A, B) in arbol or d <= MAXJ: enlaza(A, B)

def cerca(k, x, y):            # píxel de la línea central de la pieza k más cercano a (x, y)
    ix = ids[k]; d = np.hypot(pts[ix, 0] - x, pts[ix, 1] - y)
    return int(ix[int(np.argmin(d))])

# semillas: los dos puntos del símbolo (dos personas) y la base del tallo de la flor
ROSA = max(range(NC), key=lambda k: comps[k][4] * comps[k][3] if comps[k][6] < 1300 and comps[k][7] < 1300 else 0)
tallo = cerca(ROSA, 538, 1815)
def pieza_en(x, y, rmax=60):
    best = min(range(NC), key=lambda k: math.hypot(comps[k][6] - x, comps[k][7] - y))
    assert math.hypot(comps[best][6] - x, comps[best][7] - y) < rmax, (x, y)
    return best
P1, P2 = pieza_en(1314, 1316), pieza_en(1567, 1316)
semillas = [tallo, cerca(P1, 1314, 1316), cerca(P2, 1567, 1316)]

arr = np.full(N, 1e18); pred = -np.ones(N, int)
pq = []
for s in semillas:
    arr[s] = 0.0; heapq.heappush(pq, (0.0, s))
while pq:
    d, i = heapq.heappop(pq)
    if d > arr[i]: continue
    for j, w in nb[i]:
        nd = d + w
        if nd < arr[j]:
            arr[j] = nd; pred[j] = i; heapq.heappush(pq, (nd, j))
sin = [k for k in range(NC) if arr[ids[k]].min() > 1e17]
assert not sin, ("piezas sin alcanzar", sin)
T_DIBUJO = float(arr.max() / VEL)
print("duración del trazo: %.2f s" % T_DIBUJO)

# puntos sueltos: aparecen con un "pop" en vez de dibujarse
def es_punto(k):
    i, x, y, w, h, area, cx, cy = comps[k]
    return max(w, h) < 80 and area < 3200
PUNTOS = [k for k in range(NC) if es_punto(k)]

def rdp(P, eps):
    if len(P) < 3: return P
    a, b = P[0], P[-1]
    ab = b - a; L = np.hypot(*ab)
    if L == 0: d = np.hypot(*(P - a).T)
    else: d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / L
    m = int(np.argmax(d))
    if d[m] > eps:
        l = rdp(P[:m + 1], eps); r = rdp(P[m:], eps)
        return np.vstack([l[:-1], r])
    return np.vstack([a, b])

# descomposición en trazos: de cada punta hacia atrás hasta topar con algo ya dibujado
hijos = np.zeros(N, int)
for i in range(N):
    p = pred[i]
    if p >= 0 and comp[p] == comp[i]: hijos[p] += 1
hojas = sorted([i for i in range(N) if hijos[i] == 0], key=lambda i: -arr[i])
visto = np.zeros(N, bool)
trazos = [[] for _ in range(NC)]     # por pieza: (t0, dur, ancho, d)
manchas = [[] for _ in range(NC)]    # por pieza: (t, cx, cy, r)
for hoja in hojas:
    if visto[hoja]: continue
    k = comp[hoja]
    if k in PUNTOS: continue
    cad = [hoja]; visto[hoja] = True; i = hoja
    while True:
        p = pred[i]
        if p < 0 or comp[p] != k: break
        cad.append(p)
        if visto[p]: break
        visto[p] = True; i = p
    cad.reverse()
    P = pts[cad]
    largo = float(np.hypot(*np.diff(P, axis=0).T).sum()) if len(cad) > 1 else 0.0
    if largo < 9 and trazos[k]: continue                 # pelitos del esqueleto
    r = rad[cad]
    ancho = float(min(52, max(34, 2 * np.percentile(r, 90) + 12)))
    t0 = float(arr[cad[0]] / VEL); t1 = float(arr[cad[-1]] / VEL)
    Q = rdp(P, 1.3) if len(cad) > 2 else P
    if len(Q) == 1: Q = np.vstack([Q[0], Q[0] + [0.5, 0]])
    d = "M" + "L".join("%s %s" % (f(x), f(y)) for x, y in Q)
    trazos[k].append((t0, max(t1 - t0, 0.04), ancho, d))
    # zonas más gruesas que el trazo (uniones, destellos): se revelan con un círculo al pasar
    gord = [c for c, rr in zip(cad, r) if 2 * rr + 4 > ancho]
    gord.sort(key=lambda c: -rad[c])
    puestos = []
    for c in gord:
        if all(math.hypot(*(pts[c] - pts[q])) > rad[q] * 0.7 for q in puestos):
            puestos.append(c)
            manchas[k].append((float(arr[c] / VEL), pts[c][0], pts[c][1], float(rad[c] + 4)))
print("trazos:", sum(len(t) for t in trazos), "| círculos de apoyo:", sum(len(m) for m in manchas), "| puntos:", len(PUNTOS))

fin = [float(arr[ids[k]].max() / VEL) + 0.05 for k in range(NC)]
ini = [float(arr[ids[k]].min() / VEL) for k in range(NC)]
for k in sorted(range(NC), key=lambda k: ini[k]):
    print("  pieza %2d c=(%4d,%4d) %s  inicia %.2fs  termina %.2fs  entra por pieza %s" % (k, comps[k][6], comps[k][7], "punto" if k in PUNTOS else "trazo", ini[k], fin[k], (lambda r: comp[pred[r]] if pred[r] >= 0 else "semilla")(int(ids[k][int(np.argmin(arr[ids[k]]))]))))

# ---------- 3. Grupos para el movimiento continuo ----------
def P_(x, y): return pieza_en(x, y, 90)
def G_(x, y, w=0):            # pieza grande cuyo recuadro contiene el punto
    c = [k for k in range(NC) if comps[k][1] <= x <= comps[k][1] + comps[k][3] and comps[k][2] <= y <= comps[k][2] + comps[k][4] and k not in PUNTOS]
    return min(c, key=lambda k: comps[k][3] * comps[k][4])
nombres = {
    "rosa":   [ROSA, P_(796, 858)],
    "fuente": [G_(417, 1544), G_(659, 1544), G_(415, 1707), G_(661, 1707)],
    "gotas":  [P_(470, 1475), P_(606, 1475)],
    "raya1":  [G_(1613, 614), P_(1430, 614)],
    "raya2":  [G_(1523, 701), P_(1704, 701)],
    "escal":  [G_(1711, 800), P_(1911, 956)],
    "destello": [G_(1568, 1010), G_(1568, 1110)],
    "cabezas": [P1, P2],
    "anillos": [G_(2288, 811), P_(2304, 477)],
    "rayoA":  [G_(2100, 1334)], "rayoB": [G_(2507, 1334)], "rayoC": [G_(2026, 1434)], "rayoD": [G_(2567, 1435)],
    "solcito": [P_(2305, 1417)],
    "pendulo": [G_(2303, 1702)],
    "casa":   [G_(1351, 1767), P_(1440, 1894), P_(1618, 1977)],
    "greca":  [G_(1717, 2081)],
    "esquina": [G_(1856, 2242)],
    "flecha": [G_(2178, 2174)],
    "mano":   [G_(877, 2227)],
    "corazon": [G_(343, 2328), P_(538, 2369)],
    "nota":   [G_(2251, 2532), P_(2188, 2629)],
}
usadas = [k for v in nombres.values() for k in v]
assert sorted(usadas) == list(range(NC)), ("faltan o sobran", sorted(set(range(NC)) - set(usadas)), [k for k in usadas if usadas.count(k) > 1])

MANO = nombres["mano"][0]
en_corazon = lambda X, Y: (X < 868) & (Y > 2110)
extra = {   # formas finales adicionales: (id, grupo, d)
    "mc": ("corazon", traza(MANO, en_corazon)),
    "mm": ("mano", traza(MANO, lambda X, Y: ~((X < 862) & (Y > 2110)))),
}
def bbox(ks, pad=0):
    x0 = min(comps[k][1] for k in ks) - pad; y0 = min(comps[k][2] for k in ks) - pad
    x1 = max(comps[k][1] + comps[k][3] for k in ks) + pad; y1 = max(comps[k][2] + comps[k][4] for k in ks) + pad
    return x0, y0, x1, y1

CSS = """
.ylm{color:__COLOR__;overflow:visible}
.ylm .d{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1.06 3;stroke-dashoffset:1.06;opacity:0;animation:ylm-d var(--d) linear var(--t) forwards}
.ylm .b{fill:currentColor;opacity:0;animation:ylm-o .01s linear var(--t) forwards}
.ylm .c{fill:url(#ylm-foil) currentColor;opacity:0;animation:ylm-o .18s linear var(--e) forwards}
.ylm .rv{animation:ylm-h .01s linear calc(var(--e) + .25s) forwards}
.ylm .ylm-b{stop-color:var(--ylm-brillo,#F2A28B)}
.ylm .p{fill:url(#ylm-foil) currentColor;transform-box:fill-box;transform-origin:center;animation:ylm-p .6s cubic-bezier(.3,1.7,.5,1) var(--t) both}
@keyframes ylm-d{from{opacity:1;stroke-dashoffset:1.06}to{opacity:1;stroke-dashoffset:0}}
@keyframes ylm-o{to{opacity:1}}
@keyframes ylm-h{to{visibility:hidden}}
@keyframes ylm-p{from{transform:scale(0)}to{transform:scale(1)}}
.ylm .k{transform-box:fill-box;transform-origin:center;animation-delay:var(--T);animation-timing-function:ease-in-out;animation-iteration-count:infinite}
.ylm .k-rosa{transform-box:view-box;transform-origin:179.3px 605px;animation-name:ylm-sway;animation-duration:9s}
.ylm .k-fuente{transform-box:view-box;transform-origin:179.3px 612px;animation-name:ylm-brota;animation-duration:2.4s;animation-direction:alternate}
.ylm .k-gotas{animation-name:ylm-sube;animation-duration:2.4s;animation-direction:alternate}
.ylm .k-raya1{animation-name:ylm-des1;animation-duration:6.4s}
.ylm .k-raya2{animation-name:ylm-des2;animation-duration:6.4s}
.ylm .k-destello{animation-name:ylm-brilla;animation-duration:1.5s;animation-direction:alternate}
.ylm .k-cabezas{animation-name:ylm-sube;animation-duration:2.9s;animation-direction:alternate}
.ylm .k-rayoA{animation-name:ylm-rA;animation-duration:1.9s;animation-direction:alternate}
.ylm .k-rayoB{animation-name:ylm-rB;animation-duration:1.9s;animation-direction:alternate;animation-delay:calc(var(--T) + .25s)}
.ylm .k-rayoC{animation-name:ylm-rC;animation-duration:1.9s;animation-direction:alternate;animation-delay:calc(var(--T) + .5s)}
.ylm .k-rayoD{animation-name:ylm-rD;animation-duration:1.9s;animation-direction:alternate;animation-delay:calc(var(--T) + .75s)}
.ylm .k-solcito{animation-name:ylm-late;animation-duration:1.9s;animation-direction:alternate}
.ylm .k-pendulo{transform-box:view-box;transform-origin:767.7px 490px;animation-name:ylm-pend;animation-duration:4.2s}
.ylm .k-greca{animation:ylm-gira 7s cubic-bezier(.7,0,.3,1) var(--T) infinite}
.ylm .k-corazon{transform-box:view-box;transform-origin:179.3px 795px;animation:ylm-lat 1.7s ease-in-out var(--T) infinite}
.ylm .k-nota{animation-name:ylm-nota;animation-duration:5.2s}
.ylm .k-anillos .p,.ylm .k-casa .p,.ylm .k-escal .p,.ylm .k-nota .p,.ylm .k-rosa .p{animation:ylm-p .6s cubic-bezier(.3,1.7,.5,1) var(--t) both,ylm-tit 2.6s ease-in-out calc(var(--T) + var(--t)) infinite alternate}
@keyframes ylm-sway{0%,100%{transform:rotate(0deg);animation-timing-function:ease-out}25%{transform:rotate(.8deg);animation-timing-function:ease-in-out}75%{transform:rotate(-.8deg);animation-timing-function:ease-in}}
@keyframes ylm-brota{from{transform:scale(1)}to{transform:scale(1.05)}}
@keyframes ylm-sube{from{transform:translateY(0)}to{transform:translateY(-5px)}}
@keyframes ylm-des1{0%,100%{transform:translateX(0);animation-timing-function:ease-out}25%{transform:translateX(5px);animation-timing-function:ease-in-out}75%{transform:translateX(-5px);animation-timing-function:ease-in}}
@keyframes ylm-des2{0%,100%{transform:translateX(0);animation-timing-function:ease-out}25%{transform:translateX(-5px);animation-timing-function:ease-in-out}75%{transform:translateX(5px);animation-timing-function:ease-in}}
@keyframes ylm-brilla{from{transform:scale(1);opacity:1}to{transform:scale(.78);opacity:.55}}
@keyframes ylm-rA{from{transform:translate(0,0)}to{transform:translate(-6.2px,-3.1px)}}
@keyframes ylm-rB{from{transform:translate(0,0)}to{transform:translate(6.2px,-3.1px)}}
@keyframes ylm-rC{from{transform:translate(0,0)}to{transform:translate(-7px,0)}}
@keyframes ylm-rD{from{transform:translate(0,0)}to{transform:translate(7px,0)}}
@keyframes ylm-late{from{transform:scale(1)}to{transform:scale(1.35)}}
@keyframes ylm-pend{0%,100%{transform:rotate(0deg);animation-timing-function:ease-out}25%{transform:rotate(6.5deg);animation-timing-function:ease-in-out}75%{transform:rotate(-6.5deg);animation-timing-function:ease-in}}
@keyframes ylm-gira{0%,62%{transform:rotate(0deg)}82%,100%{transform:rotate(90deg)}}
@keyframes ylm-lat{0%,46%,100%{transform:scale(1)}11%{transform:scale(1.06)}22%{transform:scale(1.005)}32%{transform:scale(1.04)}}
@keyframes ylm-nota{0%,100%{transform:translateY(0) rotate(0deg);animation-timing-function:ease-out}25%{transform:translateY(-4px) rotate(1.6deg);animation-timing-function:ease-in-out}75%{transform:translateY(3px) rotate(-1.6deg);animation-timing-function:ease-in}}
@keyframes ylm-tit{from{transform:scale(1)}to{transform:scale(.72)}}
@media (prefers-reduced-motion:reduce){.ylm *{animation:none!important}.ylm .rv{display:none}.ylm .c,.ylm .p{opacity:1}}
""".replace("__COLOR__", COLOR)

T = T_DIBUJO + 0.3
defs, cuerpo = [], []
for k in range(NC):
    defs.append('<path id="ylm-s%d" fill-rule="evenodd" clip-rule="evenodd" d="%s"/>' % (k, shapes[k]))
for eid, (grp, d) in extra.items():
    defs.append('<path id="ylm-s%s" fill-rule="evenodd" d="%s"/>' % (eid, d))
for k in range(NC):
    if k not in PUNTOS:
        defs.append('<clipPath id="ylm-c%d"><use href="#ylm-s%d"/></clipPath>' % (k, k))
# destello tipo foil: una banda clara que cruza todo el dibujo cada cierto tiempo (degradado animado del relleno)
defs.append('<linearGradient id="ylm-foil" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="230" y2="80" gradientTransform="translate(-360 0)">'
            '<stop offset="0" stop-color="currentColor"/><stop class="ylm-b" offset=".5" stop-color="#F2A28B"/><stop offset="1" stop-color="currentColor"/>'
            '<animateTransform attributeName="gradientTransform" type="translate" values="-360 0;1240 0;1240 0" keyTimes="0;.3;1" begin="%.2fs" dur="6.5s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .2 1;0 0 1 1"/>'
            '</linearGradient>' % (T + .5))
for nom, ks in nombres.items():
    g = ['<g class="k k-%s">' % nom]
    for k in ks:
        if k in PUNTOS:
            g.append('<use class="p" href="#ylm-s%d" style="--t:%.2fs"/>' % (k, ini[k]))
            continue
        g.append('<g class="rv" clip-path="url(#ylm-c%d)" style="--e:%.2fs">' % (k, fin[k]))
        for t0, du, an, d in sorted(trazos[k]):
            g.append('<path class="d" pathLength="1" stroke-width="%s" style="--t:%.2fs;--d:%.2fs" d="%s"/>' % (f(an), t0, du, d))
        for t, cx, cy, r in sorted(manchas[k]):
            g.append('<circle class="b" cx="%s" cy="%s" r="%s" style="--t:%.2fs"/>' % (f(cx), f(cy), f(r), t))
        g.append('</g>')
        if k != MANO:
            g.append('<use class="c" href="#ylm-s%d" style="--e:%.2fs"/>' % (k, fin[k]))
    for eid, (grp, d) in extra.items():
        if grp == nom:
            g.append('<use class="c" href="#ylm-s%s" style="--e:%.2fs"/>' % (eid, fin[MANO]))
    g.append('</g>')
    cuerpo.append("".join(g))
motion = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" class="ylm" role="img" aria-label="Composición gráfica de YUC\'ATÅLOVE" style="--T:%.2fs" data-dur="%.2f">'
          '<style>%s</style><defs>%s</defs>%s</svg>') % (U, U, T, T, CSS.strip().replace("\n", ""), "".join(defs), "".join(cuerpo))
open(OUT + "/composicion-motion.svg", "w").write(motion)

def estatico(ks, nombre, pad=40):
    if ks is None: vb = (0, 0, S, S); ks = range(NC)
    else: vb = bbox(ks, pad)
    x0, y0, x1, y1 = vb
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s"><path fill="%s" fill-rule="evenodd" d="%s"/></svg>' % (f(x0), f(y0), f(x1 - x0), f(y1 - y0), COLOR, "".join(shapes[k] for k in ks))
    open("%s/%s.svg" % (OUT, nombre), "w").write(svg)
    return len(svg)

tam = {"composicion": estatico(None, "composicion")}
motivos = {
    "motivo-flor": nombres["rosa"] + nombres["fuente"] + nombres["gotas"],
    "motivo-simbolo": nombres["cabezas"] + nombres["casa"] + nombres["greca"] + nombres["esquina"],
    "motivo-corazon": nombres["mano"] + nombres["corazon"],
    "motivo-sol": nombres["anillos"] + nombres["rayoA"] + nombres["rayoB"] + nombres["rayoC"] + nombres["rayoD"] + nombres["solcito"] + nombres["pendulo"],
    "motivo-nota": nombres["nota"],
    "motivo-destello": nombres["destello"],
}
for nom, ks in motivos.items(): tam[nom] = estatico(ks, nom)
tam["composicion-motion"] = len(motion)
print({k: "%d KB" % (v // 1024) for k, v in tam.items()})
json.dump({"T": T, "nombres": nombres, "ini": ini, "fin": fin}, open(OUT + "/info.json", "w"))
