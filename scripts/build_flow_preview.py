#!/usr/bin/env python3
"""Generate a self-contained page showing every screen in the game.

Pulls the real app/globals.css and the real dial geometry from lib/dial.js,
and inlines public/dosa.png, so the preview cannot drift from the app.
"""
import base64, json, math, os, re, subprocess, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS  = open(os.path.join(ROOT, "app/globals.css"), encoding="utf-8").read()
PNG  = base64.b64encode(open(os.path.join(ROOT, "public/dosa.png"), "rb").read()).decode()
DOSA = "data:image/png;base64," + PNG
IMG  = '<div class="dosa-img"></div>'   # painted from a single CSS copy of the PNG

# ── geometry, read straight out of lib/dial.js so it stays in step ──
DIAL_JS = open(os.path.join(ROOT, "lib/dial.js"), encoding="utf-8").read()
def num(name):
    m = re.search(rf"\b{name}\s*=\s*(-?[\d.]+)", DIAL_JS)
    return float(m.group(1))
CX, CY = num("CX"), num("CY")
R_IN, R_OUT, R_NUM, R_NEEDLE = num("R_IN"), num("R_OUT"), num("R_NUM"), num("R_NEEDLE")
B4, B3, B2 = num("B4"), num("B3"), num("B2")
ARROW_Y, ARROW_IN, ARROW_OUT = num("ARROW_Y"), num("ARROW_IN"), num("ARROW_OUT")
ARROW_H, ARROW_LEN = num("ARROW_H"), num("ARROW_LEN")
LABEL_Y, LABEL_CX, LABEL_SIZE = num("LABEL_Y"), num("LABEL_CX"), num("LABEL_SIZE")

BANDS = [(-B2, -B3, "var(--brick)", 2), (-B3, -B4, "var(--gold)", 3),
         (-B4,  B4, "var(--pink)",  4), ( B4,  B3, "var(--gold)", 3),
         ( B3,  B2, "var(--brick)", 2)]

f = lambda n: round(n, 2)
def pt(r, d):
    a = math.radians(d)
    return CX + r * math.sin(a), CY - r * math.cos(a)

def sector(d1, d2, ri, ro):
    x1, y1 = pt(ri, d1); x2, y2 = pt(ro, d1)
    x3, y3 = pt(ro, d2); x4, y4 = pt(ri, d2)
    return (f"M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}"
            f"A{ro} {ro} 0 0 1 {f(x3)} {f(y3)}"
            f"L{f(x4)} {f(y4)}"
            f"A{ri} {ri} 0 0 0 {f(x1)} {f(y1)}Z")

val2deg = lambda v: (v - 0.5) * 180

def arrow(sign):
    x1 = CX + sign * ARROW_IN
    x2 = CX + sign * (ARROW_OUT - ARROW_LEN * 0.6)
    tip = CX + sign * ARROW_OUT
    base = CX + sign * (ARROW_OUT - ARROW_LEN)
    return (f'<path d="M{f(tip)} {ARROW_Y}L{f(base)} {f(ARROW_Y-ARROW_H)}'
            f'L{f(base)} {f(ARROW_Y+ARROW_H)}Z"/>'
            f'<line x1="{f(x1)}" y1="{ARROW_Y}" x2="{f(x2)}" y2="{ARROW_Y}" stroke-width="2.5"/>')

def dial(left, right, value=0.5, target=None, wedge=False, needle=False, live=False, hint=False):
    rot = 0 if target is None else val2deg(target)
    bands = "".join(f'<path d="{sector(a,b,R_IN,R_OUT)}" fill="{c}"/>' for a,b,c,_ in BANDS)
    nums = ""
    for a, b, _, n in BANDS:
        x, y = pt(R_NUM, (a + b) / 2 + rot)
        nums += f'<text class="wedge-num" x="{f(x)}" y="{f(y)}">{n}</text>'
    nx1, ny1 = pt(R_IN - 6, val2deg(value))
    nx2, ny2 = pt(R_NEEDLE, val2deg(value))
    wc = "wedge show" if (wedge and target is not None) else "wedge"
    nc = "needle" + (" show" if needle else "") + (" live" if live else "") + (" hint" if hint else "")
    return f'''<div class="dial-wrap">
{IMG}
<svg viewBox="0 0 402 481" aria-hidden="true">
<g class="{wc}"><g transform="rotate({f(rot)} {CX} {CY})">{bands}</g>{nums}</g>
<g class="{nc}">
<line class="shaft-out" x1="{f(nx1)}" y1="{f(ny1)}" x2="{f(nx2)}" y2="{f(ny2)}"/>
<line class="shaft" x1="{f(nx1)}" y1="{f(ny1)}" x2="{f(nx2)}" y2="{f(ny2)}"/>
<circle class="knob-pulse" cx="{f(nx2)}" cy="{f(ny2)}" r="11"/>
<circle class="knob-out" cx="{f(nx2)}" cy="{f(ny2)}" r="12"/>
<circle class="knob" cx="{f(nx2)}" cy="{f(ny2)}" r="9.5"/>
<circle class="knob-dot" cx="{f(nx2)}" cy="{f(ny2)}" r="3.4"/>
</g>
<g class="spectrum">{arrow(-1)}{arrow(1)}
<text x="{f(CX-LABEL_CX)}" y="{LABEL_Y}" font-size="{LABEL_SIZE}">{html.escape(left)}</text>
<text x="{f(CX+LABEL_CX)}" y="{LABEL_Y}" font-size="{LABEL_SIZE}">{html.escape(right)}</text>
</g></svg></div>'''

# ── waiting-room bubbles ──
AV = [("#FFFFFF","#4A1236"),("#4A1236","#FFFFFF"),("#FFD45E","#4A1236"),
      ("#46AC50","#FFFFFF"),("#FFBC5C","#4A1236")]
PLAYERS = ["Suppu","Sneha","Naveen","Maya","Arjun","Divya","Rohan"]

def bubbles(me="Suppu", host="Suppu", kick=False, empties=1):
    out = []
    for i, n in enumerate(PLAYERS):
        bg, fg = AV[i % len(AV)]
        ini = n[0].upper()
        tag = '<span class="tag">Host</span>' if n == host else ""
        drop = '<button class="drop">&times;</button>' if (kick and n != host) else ""
        label = n + (" (you)" if n == me else "")
        out.append(f'<div class="bub{" me" if n==me else ""}">'
                   f'<div class="av" style="background:{bg};color:{fg}">{ini}{tag}{drop}</div>'
                   f'<span class="nm">{label}</span></div>')
    for _ in range(empties):
        out.append('<div class="bub empty"><div class="av"></div><span class="nm">&nbsp;</span></div>')
    return '<div class="bubbles">' + "".join(out) + "</div>"

# read the decks from lib/decks.js, so counts here can never drift from the game
_js = subprocess.run(
    ["node", "--input-type=module", "-e",
     "const {DECKS}=await import(process.argv[1]);"
     "console.log(JSON.stringify(DECKS.map(d=>[d.emoji,d.name,d.cards.length])))",
     os.path.join(ROOT, "lib/decks.js")],
    capture_output=True, text=True, check=True)
DECKS = json.loads(_js.stdout.strip().splitlines()[-1])
TOTAL_CARDS = sum(c for _, _, c in DECKS)
def deckrows():
    return "".join(f'<button class="deckrow on"><span class="em">{e}</span>'
                   f'<span>{html.escape(n)}</span><span class="ct">{c}</span></button>'
                   for e, n, c in DECKS)

REACTS = ["\U0001F602","\U0001F525","\U0001F644","\U0001F436","☕","\U0001F44F"]
REACTBAR = '<div class="reactbar">' + "".join(f'<button class="react">{r}</button>' for r in REACTS) + '</div>'
WAIT = lambda t: f'<div class="waiting"><div class="dots"><i></i><i></i><i></i></div><p class="small">{t}</p></div>'
TOP = lambda l, r: f'<div class="topbar"><span class="chip">{l}</span>{r}</div>'
SCORE = lambda n: f'<span class="scorebox"><span class="lbl">Score</span><span class="n">{n}</span></span>'

CLUE = "Texting your ex at 2am"
L, R = "Forbidden", "Encouraged"
TARGET, GUESS = 0.62, 0.66   # 7.2 degrees apart -> 3 points

SCREENS = [
("Splash", "What everyone sees first", f'''
<div class="screen">
  <div class="splash-top"><h1 class="wordmark">WAVELENGTH</h1>
  <div class="dial-wrap">{IMG}</div></div>
  <div class="splash-foot">
    <p class="small">Suppu&rsquo;s birthday edition</p>
    <button class="btn">Join a game</button>
    <button class="btn-text">Start a new game</button>
  </div>
</div>'''),

("Join a game", "Guests: the four-letter code", '''
<div class="screen pad"><div class="centre" style="padding-top:56px;padding-bottom:28px">
  <div><h2 class="h1">Join the game</h2>
  <p class="small" style="margin-top:8px">Ask the host for the four-letter code.</p></div>
  <div class="stack">
    <input class="field code" value="34NQ" readonly>
    <input class="field" placeholder="Your name" readonly>
    <button class="btn">Join</button>
    <button class="btn-text">Start a new game instead</button>
  </div>
</div></div>'''),

("Start a new game", "Whoever hosts", '''
<div class="screen pad"><div class="centre" style="padding-top:56px;padding-bottom:28px">
  <div><h2 class="h1">Start a new game</h2>
  <p class="small" style="margin-top:8px">You&rsquo;ll host. Everyone else joins with the code you get next.</p></div>
  <div class="stack">
    <input class="field" placeholder="Your name" readonly>
    <button class="btn">Create the room</button>
    <button class="btn-text">I have a code instead</button>
  </div>
</div></div>'''),

("Waiting room, host", "Sets the decks and rounds", f'''
<div class="screen">{TOP("Waiting room","")}
  <div class="lobby-body">
    <div class="codebox"><p class="small">Your room code is</p><p class="val">34NQ</p>
      <p class="tiny">Everyone opens this page and taps &ldquo;Join a game&rdquo;</p></div>
    <div class="block"><p class="label">7 in the room</p>{bubbles(kick=True)}
      <p class="tiny centre-text">You all play on the same side. Everyone takes a turn as the psychic.</p></div>
    <div class="block"><p class="label">Decks</p>{deckrows()}</div>
    <div class="block"><p class="label">Rounds</p><div class="seg">
      <button>4</button><button>6</button><button class="on">8</button><button>10</button><button>12</button>
    </div></div>
    <div class="block"><button class="btn">Start the game</button>
      <p class="tiny centre-text">8 rounds, {TOTAL_CARDS} scales in play. Best possible score 32.</p></div>
    <button class="btn-text">Leave this game</button>
  </div>
</div>'''),

("Waiting room, everyone else", "No controls, just the room", f'''
<div class="screen">{TOP("Waiting room","")}
  <div class="lobby-body">
    <div class="codebox"><p class="small">Your room code is</p><p class="val">34NQ</p>
      <p class="tiny">Everyone opens this page and taps &ldquo;Join a game&rdquo;</p></div>
    <div class="block"><p class="label">7 in the room</p>{bubbles(me="Maya")}
      <p class="tiny centre-text">You all play on the same side. Everyone takes a turn as the psychic.</p></div>
    {WAIT("Waiting for the host to start")}
    <button class="btn-text">Leave this game</button>
  </div>
</div>'''),

("Clue, the psychic", "Only this phone sees the target", f'''
<div class="screen">{TOP("Round 1 of 8", SCORE(0))}
  <div class="head"><p class="label">\U0001F30D Classic Wavelength</p>
    <p class="h2">Give a clue that lands here</p><p class="tiny">You&rsquo;re the psychic</p></div>
  {dial(L, R, target=TARGET, wedge=True)}
  <div class="foot">
    <p class="small centre-text">Say it out loud, then type it so everyone can see</p>
    <input class="field" placeholder="Your clue" readonly>
    <div class="btn-row"><button class="btn ghost sm">New scale</button>
      <button class="btn sm">Lock the clue</button></div>
  </div>
</div>'''),

("Clue, everyone else", "Scale visible, target hidden", f'''
<div class="screen">{TOP("Round 1 of 8", SCORE(0))}
  <div class="head"><p class="label">\U0001F30D Classic Wavelength</p>
    <p class="h2">Suppu is thinking of a clue</p><p class="tiny">This round&rsquo;s scale is on the dosa</p></div>
  {dial(L, R)}
  <div class="foot">{WAIT("Have a look at the two ends while you wait")}</div>
  {REACTBAR}
</div>'''),

("Guessing, everyone but the psychic", "One shared dial, live on all phones", f'''
<div class="screen">{TOP("Round 1 of 8", SCORE(0))}
  <div class="head"><p class="label">\U0001F30D Classic Wavelength</p>
    <p class="h2">{CLUE}</p><p class="tiny">Suppu&rsquo;s clue</p></div>
  {dial(L, R, value=GUESS, needle=True, live=True)}
  <div class="foot">
    <p class="small centre-text">Everyone argue, then drag the dial. Anyone can lock it in.</p>
    <button class="btn">Lock it in</button>
  </div>
  {REACTBAR}
</div>'''),

("Guessing, the psychic", "Locked out, target hidden again", f'''
<div class="screen">{TOP("Round 1 of 8", SCORE(0))}
  <div class="head"><p class="label">\U0001F30D Classic Wavelength</p>
    <p class="h2">{CLUE}</p><p class="tiny">Suppu&rsquo;s clue</p></div>
  {dial(L, R, value=GUESS, needle=True)}
  <div class="foot">{WAIT("Stay quiet &mdash; no nods, no faces. Let them work it out.")}</div>
  {REACTBAR}
</div>'''),

("Reveal", "Target and dial together", f'''
<div class="screen">{TOP("Round 1 of 8", SCORE(3))}
  <div class="head"><p class="label">\U0001F30D Classic Wavelength</p>
    <p class="h2">{CLUE}</p><p class="tiny">Suppu&rsquo;s clue</p></div>
  {dial(L, R, value=GUESS, target=TARGET, wedge=True, needle=True)}
  <div class="foot">
    <div class="result"><p class="result-score p3">+3</p>
      <p class="small">So close. Total 3.</p></div>
    <button class="btn">Next round</button>
  </div>
  {REACTBAR}
</div>'''),

("Final score, host", "One shared total and a rating", f'''
<div class="screen">
  <div class="centre pad" style="padding-top:48px;padding-bottom:18px">
    <p class="small">That&rsquo;s a wrap</p>
    <div class="finalscore"><p class="n">24</p><p class="of">out of 32</p></div>
    <h2 class="h1">Seriously in sync</h2>
    <p class="small">Suppu, Sneha, Naveen, Maya, Arjun, Divya, Rohan &mdash; 8 rounds together</p>
    <p class="tiny">Happy birthday Suppu</p>
    <div class="stack"><button class="btn">Play again</button>
      <button class="btn ghost sm">Back to the waiting room</button></div>
  </div>
  {REACTBAR}
</div>'''),

("Final score, everyone else", "Same result, host drives", f'''
<div class="screen">
  <div class="centre pad" style="padding-top:48px;padding-bottom:18px">
    <p class="small">That&rsquo;s a wrap</p>
    <div class="finalscore"><p class="n">24</p><p class="of">out of 32</p></div>
    <h2 class="h1">Seriously in sync</h2>
    <p class="small">Suppu, Sneha, Naveen, Maya, Arjun, Divya, Rohan &mdash; 8 rounds together</p>
    <p class="tiny">Happy birthday Suppu</p>
    {WAIT("Waiting for the host")}
  </div>
  {REACTBAR}
</div>'''),
]

frames = ""
for i, (title, note, body) in enumerate(SCREENS, 1):
    frames += f'''<figure class="frame">
<figcaption><span class="num">{i}</span><span class="t">{html.escape(title)}</span>
<span class="note">{html.escape(note)}</span></figcaption>
<div class="phone-scale"><div class="app">{body}</div></div>
</figure>'''

PAGE = f'''<title>Suppu Edition Screens</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap">
<style>
{CSS}

/* the dosa, inlined exactly once and painted wherever it is needed */
.dosa-img{{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;
  background:url({DOSA}) center/100% 100% no-repeat}}

/* ── preview chrome (not part of the game) ── */
html,body{{height:auto}}
body{{display:block;background:#2A0A1E;padding:0 0 64px}}
.wrap{{max-width:1240px;margin:0 auto;padding:0 20px}}
.masthead{{padding:52px 0 30px;max-width:640px}}
.masthead h1{{font-size:34px;font-weight:800;letter-spacing:-.015em;line-height:1.1}}
.masthead p{{font-size:15px;font-weight:500;line-height:1.6;color:rgba(255,255,255,.72);margin-top:12px}}
.masthead .rule{{height:1.5px;background:rgba(255,255,255,.18);margin:26px 0 0}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:38px 24px;padding-top:34px;align-items:start;justify-items:center}}
.frame{{display:flex;flex-direction:column;gap:12px}}
figcaption{{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}}
figcaption .num{{width:23px;height:23px;border-radius:999px;background:var(--pink);color:#2A0A1E;
  font-size:12px;font-weight:800;display:grid;place-items:center;flex:0 0 auto}}
figcaption .t{{font-size:15px;font-weight:700}}
figcaption .note{{font-size:12.5px;font-weight:500;color:rgba(255,255,255,.6);flex:1 1 100%;padding-left:31px}}
.phone-scale{{width:290px;overflow:hidden;border-radius:22px;
  box-shadow:0 0 0 1px rgba(255,255,255,.14),0 18px 44px rgba(0,0,0,.4)}}
/* zoom, not transform: zoom affects layout, so a frame grows to fit a
   screen that would scroll on a real phone (the waiting room does) */
.phone-scale .app{{zoom:.7214;width:402px;height:auto;min-height:874px;
  border-radius:0;box-shadow:none;margin:0;overflow:visible}}
.phone-scale .screen{{position:relative;height:auto;min-height:874px;overflow:visible}}
.phone-scale input{{pointer-events:none}}
@media (max-width:700px){{
  .grid{{grid-template-columns:1fr;justify-items:center;gap:34px}}
  .masthead{{padding:38px 0 22px}}
  .masthead h1{{font-size:27px}}
}}
</style>
<div class="wrap">
  <header class="masthead">
    <h1>Wavelength, Suppu Edition</h1>
    <p>Every screen in the game, in order. Numbers 1&ndash;12 &mdash; tell me the number and what you want changed.
       These are rendered from the app&rsquo;s own stylesheet and your dosa file, so what you see is what the phones show.</p>
    <div class="rule"></div>
  </header>
  <div class="grid">{frames}</div>
</div>
'''

def to_ascii(t):
    return "".join(c if ord(c) < 128 else "&#x%X;" % ord(c) for c in t)

PAGE = to_ascii(PAGE)          # no <script> here, so entities are safe throughout
PAGE.encode("ascii")           # hard assert

out = os.path.join(ROOT, "build", "flow-preview.html")
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "w", encoding="ascii").write(PAGE)
print("wrote %s  (%d KB, %d screens)" % (os.path.abspath(out), len(PAGE) // 1024, len(SCREENS)))
