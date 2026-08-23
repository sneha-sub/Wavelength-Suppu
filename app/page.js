"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dial from "../components/Dial.jsx";
import { DECKS, REACTIONS, deckById } from "../lib/decks.js";
import { MESSAGES } from "../lib/http.js";

const LS = "wl-suppu-session";
const say = (c) => MESSAGES[c] || "Something went wrong. Try that again.";

/* Bubble colours, all drawn from the dosa artwork so the waiting room
   sits in the same world as the board. Assigned by seat order, so two
   neighbouring bubbles are never the same colour. */
const AVATARS = [
  { bg: "#FFFFFF", fg: "#4A1236" },
  { bg: "#4A1236", fg: "#FFFFFF" },
  { bg: "#FFD45E", fg: "#4A1236" },
  { bg: "#46AC50", fg: "#FFFFFF" },
  { bg: "#FFBC5C", fg: "#4A1236" },
];
const avatarFor = (i) => AVATARS[i % AVATARS.length];
const initials = (n) =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Bubble({ player, seat, isMe, isHost, isPsychic, onKick }) {
  const a = avatarFor(seat);
  return (
    <div className={"bub" + (isMe ? " me" : "")}>
      <div className="av" style={{ background: a.bg, color: a.fg }}>
        {initials(player.name)}
        {isHost && <span className="tag">Host</span>}
        {isPsychic && <span className="tag psychic">Psychic</span>}
        {onKick && (
          <button className="drop" aria-label={`Remove ${player.name}`} onClick={onKick}>
            &times;
          </button>
        )}
      </div>
      <span className="nm">{player.name}{isMe ? " (you)" : ""}</span>
    </div>
  );
}

export default function Page() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState(null);
  const [screen, setScreen] = useState("home");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [booted, setBooted] = useState(false);

  const [nameIn, setNameIn] = useState("");
  const [codeIn, setCodeIn] = useState("");
  const [clueIn, setClueIn] = useState("");

  const vRef = useRef(0);
  const seenReactRef = useRef(null);
  const screenRef = useRef(null);
  const [floats, setFloats] = useState([]);

  const [localDial, setLocalDial] = useState(null);
  const localUntilRef = useRef(0);
  const lastSentRef = useRef(0);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS) || "null");
      if (s?.code && s?.playerId) setSession(s);
    } catch {}
    setBooted(true);
  }, []);

  const applyView = useCallback((v) => {
    if (!v) return;
    vRef.current = v.v;
    setView(v);
  }, []);

  const saveSession = (s) => {
    localStorage.setItem(LS, JSON.stringify(s));
    setSession(s);
  };
  const leave = useCallback(() => {
    localStorage.removeItem(LS);
    setSession(null); setView(null); setScreen("home");
    vRef.current = 0; seenReactRef.current = null;
  }, []);

  const act = useCallback(
    async (type, payload = {}, { quiet = false } = {}) => {
      if (!session) return;
      try {
        const r = await fetch("/api/action", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...session, type, payload }),
        });
        const j = await r.json();
        if (j.error) {
          if (j.error === "not_in_room" || j.error === "no_room") return leave();
          if (!quiet) setError(say(j.error));
          return;
        }
        setError(""); applyView(j.view);
      } catch { setOffline(true); }
    },
    [session, applyView, leave]
  );

  /* ── polling ── */
  useEffect(() => {
    if (!session) return;
    let stop = false, timer;
    const interval = () => {
      if (typeof document !== "undefined" && document.hidden) return 3000;
      return view?.phase === "guess" ? 600 : 1400;
    };
    const tick = async () => {
      if (stop) return;
      try {
        const r = await fetch(
          `/api/state?code=${session.code}&pid=${session.playerId}&v=${vRef.current}`,
          { cache: "no-store" }
        );
        if (r.status === 404) return leave();
        const j = await r.json();
        setOffline(false);
        if (j.view) applyView(j.view);
      } catch { setOffline(true); }
      if (!stop) timer = setTimeout(tick, interval());
    };
    tick();
    const wake = () => { clearTimeout(timer); tick(); };
    document.addEventListener("visibilitychange", wake);
    return () => {
      stop = true; clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [session, view?.phase, applyView, leave]);

  /* ── floating reactions ── */
  useEffect(() => {
    const rs = view?.reactions || [];
    if (!rs.length) return;
    const max = rs[rs.length - 1].n;
    if (seenReactRef.current === null) { seenReactRef.current = max; return; }
    const fresh = rs.filter((r) => r.n > seenReactRef.current);
    if (!fresh.length) return;
    seenReactRef.current = max;
    const made = fresh.flatMap((r) =>
      Array.from({ length: 3 }, (_, i) => ({
        key: `${r.n}-${i}`, id: r.id,
        left: 12 + Math.random() * 76,
        dx: Math.random() * 70 - 35,
        delay: i * 90,
      }))
    );
    setFloats((f) => [...f, ...made]);
    setTimeout(() => {
      const keys = new Set(made.map((m) => m.key));
      setFloats((f) => f.filter((x) => !keys.has(x.key)));
    }, 2400);
  }, [view?.reactions]);

  /* a new phase is a new screen — never inherit the last one's scroll */
  useEffect(() => {
    if (screenRef.current) screenRef.current.scrollTop = 0;
  }, [view?.phase, view?.round]);

  /* ── derived ── */
  const me = view?.me;
  const phase = view?.phase;
  const deck = view?.deckId ? deckById(view.deckId) : null;
  const psychic = view?.players.find((p) => p.id === view.psychicId);
  const isPsychic = !!view?.isPsychic;
  const canDial = phase === "guess" && !isPsychic;

  const dialValue = useMemo(() => {
    if (localDial !== null && Date.now() < localUntilRef.current) return localDial;
    return view?.dial ?? 0.5;
  }, [localDial, view?.dial]);

  const onDial = useCallback(
    (v, commit) => {
      setLocalDial(v);
      localUntilRef.current = Date.now() + 900;
      const now = Date.now();
      if (commit || now - lastSentRef.current > 180) {
        lastSentRef.current = now;
        act("dial", { dial: v }, { quiet: true });
      }
    },
    [act]
  );

  const create = async () => {
    const name = nameIn.trim();
    if (!name) return setError("Type your name first.");
    setBusy(true);
    try {
      const j = await (await fetch("/api/room", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      })).json();
      if (j.error) return setError(say(j.error));
      saveSession({ code: j.code, playerId: j.playerId, name });
      applyView(j.view); setError("");
    } catch { setError("Couldn't reach the game server."); }
    finally { setBusy(false); }
  };

  const join = async () => {
    const name = nameIn.trim();
    const code = codeIn.trim().toUpperCase();
    if (code.length < 4) return setError("Enter the four-letter code.");
    if (!name) return setError("Type your name first.");
    setBusy(true);
    try {
      const j = await (await fetch("/api/join", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name }),
      })).json();
      if (j.error) return setError(say(j.error));
      saveSession({ code: j.code, playerId: j.playerId, name });
      applyView(j.view); setError("");
    } catch { setError("Couldn't reach the game server."); }
    finally { setBusy(false); }
  };

  /* ══════════════════════ RENDER ══════════════════════ */
  if (!booted) return <div className="app" />;

  if (!session || !view) {
    if (screen === "home") {
      return (
        <div className="app">
          <div className="screen">
            <div className="splash-top">
              <h1 className="wordmark">WAVELENGTH</h1>
              <div className="dial-wrap">
                <img src="/dosa.png" alt="A dosa on a banana leaf with a photo of Suppu at its centre" />
              </div>
            </div>
            <div className="splash-foot">
              <p className="small">Suppu&rsquo;s birthday edition</p>
              <button className="btn" onClick={() => { setScreen("join"); setError(""); }}>
                Join a game
              </button>
              <button className="btn-text" onClick={() => { setScreen("create"); setError(""); }}>
                Start a new game
              </button>
            </div>
          </div>
        </div>
      );
    }

    const creating = screen === "create";
    return (
      <div className="app">
        <div className="screen pad">
          <div className="centre" style={{ paddingTop: 56, paddingBottom: 28 }}>
            <div>
              <h2 className="h1">{creating ? "Start a new game" : "Join the game"}</h2>
              <p className="small" style={{ marginTop: 8 }}>
                {creating
                  ? "You'll host. Everyone else joins with the code you get next."
                  : "Ask the host for the four-letter code."}
              </p>
            </div>
            <div className="stack">
              {!creating && (
                <input className="field code" value={codeIn}
                  onChange={(e) => setCodeIn(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="Code" maxLength={4}
                  autoCapitalize="characters" autoComplete="off" aria-label="Game code" />
              )}
              <input className="field" value={nameIn}
                onChange={(e) => setNameIn(e.target.value.slice(0, 14))}
                onKeyDown={(e) => e.key === "Enter" && (creating ? create() : join())}
                placeholder="Your name" maxLength={14} autoComplete="off" aria-label="Your name" />
              {error && <p className="err">{error}</p>}
              <button className="btn" disabled={busy} onClick={creating ? create : join}>
                {busy ? "One sec…" : creating ? "Create the room" : "Join"}
              </button>
              <button className="btn-text"
                onClick={() => { setScreen(creating ? "join" : "create"); setError(""); }}>
                {creating ? "I have a code instead" : "Start a new game instead"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── shared pieces ── */
  const TopBar = () => (
    <div className="topbar">
      <span className="chip">
        {phase === "lobby" ? "Waiting room" : `Round ${view.round} of ${view.totalRounds}`}
      </span>
      {phase !== "lobby" && (
        <span className="scorebox">
          <span className="lbl">Score</span>
          <span className="n">{view.score}</span>
        </span>
      )}
    </div>
  );

  const ReactBar = () => (
    <div className="reactbar">
      {REACTIONS.map((r) => (
        <button key={r.id} className="react" title={r.label} aria-label={r.label}
          onClick={() => act("react", { reaction: r.id }, { quiet: true })}>
          {r.img ? <img src={r.img} alt="" /> : r.emoji}
        </button>
      ))}
    </div>
  );

  const FloatLayer = () => (
    <div className="float-layer">
      {floats.map((fl) => {
        const r = REACTIONS.find((x) => x.id === fl.id);
        return (
          <span key={fl.key} className="floaty"
            style={{ left: `${fl.left}%`, "--dx": `${fl.dx}px`, animationDelay: `${fl.delay}ms` }}>
            {r?.img ? <img src={r.img} alt="" /> : r?.emoji || "✨"}
          </span>
        );
      })}
    </div>
  );

  const Waiting = ({ children }) => (
    <div className="waiting">
      <div className="dots"><i /><i /><i /></div>
      <p className="small">{children}</p>
    </div>
  );

  /* ── WAITING ROOM ── */
  if (phase === "lobby") {
    const n = view.players.length;
    const cards = DECKS.filter((d) => view.decks.includes(d.id))
      .reduce((a, d) => a + d.cards.length, 0);
    const slots = Math.max(8, Math.ceil((n + 1) / 4) * 4);

    return (
      <div className="app">
        {offline && <div className="offline">Reconnecting</div>}
        <div className="screen" ref={screenRef}>
          <TopBar />
          <div className="lobby-body">
            <div className="codebox">
              <p className="small">Your room code is</p>
              <p className="val">{view.code}</p>
              <p className="tiny">Everyone opens this page and taps &ldquo;Join a game&rdquo;</p>
            </div>

            <div className="block">
              <p className="label">{n} in the room</p>
              <div className="bubbles">
                {view.players.map((p, i) => (
                  <Bubble key={p.id} player={p} seat={i}
                    isMe={p.id === me?.id}
                    isHost={p.id === view.hostId}
                    onKick={view.isHost && p.id !== view.hostId
                      ? () => act("kick", { playerId: p.id }) : null} />
                ))}
                {Array.from({ length: Math.max(0, slots - n) }, (_, i) => (
                  <div key={`e${i}`} className="bub empty">
                    <div className="av" /><span className="nm">&nbsp;</span>
                  </div>
                ))}
              </div>
              <p className="tiny centre-text">
                You all play on the same side. Everyone takes a turn as the psychic.
              </p>
            </div>

            {view.isHost && (
              <>
                <div className="block">
                  <p className="label">Decks</p>
                  {DECKS.map((d) => {
                    const on = view.decks.includes(d.id);
                    return (
                      <button key={d.id} className={"deckrow" + (on ? " on" : "")} aria-pressed={on}
                        onClick={() => act("setDecks", {
                          decks: on ? view.decks.filter((x) => x !== d.id) : [...view.decks, d.id],
                        })}>
                        <span className="em">{d.emoji}</span>
                        <span>{d.name}</span>
                        <span className="ct">{d.cards.length}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="block">
                  <p className="label">Rounds</p>
                  <div className="seg">
                    {[4, 6, 8, 10, 12].map((r) => (
                      <button key={r} className={view.totalRounds === r ? "on" : ""}
                        onClick={() => act("setRounds", { rounds: r })}>{r}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && <p className="err">{error}</p>}

            {view.isHost ? (
              <div className="block">
                <button className="btn" disabled={n < 2} onClick={() => act("start")}>
                  Start the game
                </button>
                <p className="tiny centre-text">
                  {n < 2
                    ? "Waiting for one more player."
                    : `${view.totalRounds} rounds, ${cards} scales in play. Best possible score ${view.totalRounds * 4}.`}
                </p>
              </div>
            ) : (
              <Waiting>Waiting for the host to start</Waiting>
            )}

            <button className="btn-text" onClick={leave}>Leave this game</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── FINAL ── */
  if (phase === "done") {
    return (
      <div className="app">
        {offline && <div className="offline">Reconnecting</div>}
        <div className="screen" ref={screenRef}>
          <div className="centre pad" style={{ paddingTop: 48, paddingBottom: 18 }}>
            <p className="small">That&rsquo;s a wrap</p>
            <div className="finalscore">
              <p className="n">{view.score}</p>
              <p className="of">out of {view.maxScore}</p>
            </div>
            <h2 className="h1">{view.rating}</h2>
            <p className="small">
              {view.players.map((p) => p.name).join(", ")} &mdash; {view.totalRounds} rounds together
            </p>
            <p className="tiny">Happy birthday Suppu</p>
            {view.isHost ? (
              <div className="stack">
                <button className="btn" onClick={() => act("start")}>Play again</button>
                <button className="btn ghost sm" onClick={() => act("backToLobby")}>
                  Back to the waiting room
                </button>
              </div>
            ) : (
              <Waiting>Waiting for the host</Waiting>
            )}
          </div>
          <ReactBar />
        </div>
        <FloatLayer />
      </div>
    );
  }

  /* ── PLAY ── */
  let headline = "", subline = "", foot = null, showWedge = false, showNeedle = false;

  if (phase === "clue") {
    if (isPsychic) {
      showWedge = true;
      headline = "Give a clue that lands here";
      subline = "You're the psychic";
      foot = (
        <>
          <p className="small centre-text">Say it out loud, then type it so everyone can see</p>
          <input className="field" value={clueIn}
            onChange={(e) => setClueIn(e.target.value.slice(0, 60))}
            onKeyDown={(e) => { if (e.key === "Enter" && clueIn.trim()) { act("clue", { clue: clueIn }); setClueIn(""); } }}
            placeholder="Your clue" maxLength={60} aria-label="Your clue" autoComplete="off" />
          <div className="btn-row">
            <button className="btn ghost sm" onClick={() => act("newCard")}>New scale</button>
            <button className="btn sm" disabled={!clueIn.trim()}
              onClick={() => { act("clue", { clue: clueIn }); setClueIn(""); }}>Lock the clue</button>
          </div>
        </>
      );
    } else {
      headline = `${psychic?.name || "The psychic"} is thinking of a clue`;
      subline = "This round's scale is on the dosa";
      foot = <Waiting>Have a look at the two ends while you wait</Waiting>;
    }
  }

  if (phase === "guess") {
    showNeedle = true;
    headline = view.clue;
    subline = `${psychic?.name || "The psychic"}'s clue`;
    foot = canDial ? (
      <>
        <p className="small centre-text">Everyone argue, then drag the dial. Anyone can lock it in.</p>
        <button className="btn" onClick={() => act("lock")}>Lock it in</button>
      </>
    ) : (
      <Waiting>Stay quiet — no nods, no faces. Let them work it out.</Waiting>
    );
  }

  if (phase === "reveal") {
    showWedge = true; showNeedle = true;
    headline = view.clue;
    subline = `${psychic?.name || "The psychic"}'s clue`;
    const pts = view.lastScore?.pts ?? 0;
    foot = (
      <>
        <div className="result">
          <p className={`result-score p${pts}`}>
            {pts === 0 ? "Miss" : `+${pts}`}
          </p>
          <p className="small">
            {pts === 4 ? "Bullseye." : pts === 3 ? "So close." : pts === 2 ? "On the board."
              : "Nowhere near. Blame the psychic."}
            {" "}Total {view.score}.
          </p>
        </div>
        <button className="btn" onClick={() => act("next")}>
          {view.round >= view.totalRounds ? "See how you did" : "Next round"}
        </button>
      </>
    );
  }

  return (
    <div className="app">
      {offline && <div className="offline">Reconnecting</div>}
      <div className="screen" ref={screenRef}>
        <TopBar />
        <div className="head">
          {deck && <p className="label">{deck.emoji} {deck.name}</p>}
          <p className="h2">{headline}</p>
          {subline && <p className="tiny">{subline}</p>}
        </div>
        <Dial
          card={view.card} value={dialValue} target={view.target}
          showWedge={showWedge} showNeedle={showNeedle}
          draggable={canDial} hint={canDial && view.dialBy === null} live={canDial}
          onChange={onDial}
        />
        <div className="foot">
          {error && <p className="err">{error}</p>}
          {foot}
        </div>
        {phase !== "clue" && <ReactBar />}
      </div>
      <FloatLayer />
    </div>
  );
}
