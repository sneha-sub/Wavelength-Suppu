"use client";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  CX, CY, R_IN, R_OUT, R_NUM, R_NEEDLE, BANDS, pt, sector, valToDeg,
  ARROW_Y, ARROW_IN, ARROW_OUT, ARROW_H, ARROW_LEN,
  LABEL_Y, LABEL_CX, LABEL_MAX, LABEL_SIZE,
} from "../lib/dial.js";

const f = (n) => Math.round(n * 100) / 100;

/* Arrows and labels are traced off the supplied round-screen frame. */
const arrowBar = (sign) => ({
  x1: f(CX + sign * ARROW_IN), y1: ARROW_Y,
  x2: f(CX + sign * (ARROW_OUT - ARROW_LEN * 0.6)), y2: ARROW_Y,
});
const arrowHead = (sign) => {
  const tip = CX + sign * ARROW_OUT, base = CX + sign * (ARROW_OUT - ARROW_LEN);
  return `M${f(tip)} ${ARROW_Y}L${f(base)} ${ARROW_Y - ARROW_H}L${f(base)} ${ARROW_Y + ARROW_H}Z`;
};

/** Shrink a spectrum label rather than let it collide with the photo
    or run off the edge of the leaf. */
function useFitted(text) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = LABEL_SIZE;
    el.setAttribute("font-size", size);
    for (let i = 0; i < 10 && el.getComputedTextLength() > LABEL_MAX; i++) {
      size -= 0.5;
      if (size < 9.5) break;
      el.setAttribute("font-size", size);
    }
  }, [text]);
  return ref;
}

export default function Dial({
  card,
  value = 0.5,
  target = null,
  showWedge = false,
  showNeedle = false,
  draggable = false,
  hint = false,
  live = false,
  onChange,
}) {
  const wrapRef = useRef(null);
  const draggingRef = useRef(false);

  const leftRef = useFitted(card?.l || "");
  const rightRef = useFitted(card?.r || "");

  const valueFromEvent = useCallback((e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 402;
    const y = ((e.clientY - r.top) / r.height) * 481;
    let d = (Math.atan2(x - CX, CY - y) * 180) / Math.PI;
    d = Math.max(-86, Math.min(86, d));
    return d / 180 + 0.5;
  }, []);

  const down = (e) => {
    if (!draggable) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange?.(valueFromEvent(e), false);
  };
  const move = (e) => {
    if (!draggingRef.current) return;
    onChange?.(valueFromEvent(e), false);
  };
  const up = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    onChange?.(valueFromEvent(e), true);   // commit
  };

  /* Keyboard is a real input here, not an afterthought: some guests
     will be on a laptop. */
  useEffect(() => {
    if (!draggable) return;
    const onKey = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const step = e.shiftKey ? 0.02 : 0.005;
      const next = e.key === "ArrowLeft"
        ? Math.max(0.022, value - step)
        : Math.min(0.978, value + step);
      onChange?.(next, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draggable, value, onChange]);

  const rot = target == null ? 0 : valToDeg(target);
  const [nx1, ny1] = pt(R_IN - 6, valToDeg(value));
  const [nx2, ny2] = pt(R_NEEDLE, valToDeg(value));

  return (
    <div
      ref={wrapRef}
      className={"dial-wrap" + (draggable ? " grab" : "")}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {/* dosa.png is used exactly as supplied — never redrawn */}
      <img src="/dosa.png" alt="" />
      <svg viewBox="0 0 402 481" aria-hidden="true">
        <g className={"wedge" + (showWedge && target != null ? " show" : "")}>
          <g transform={`rotate(${f(rot)} ${CX} ${CY})`}>
            {BANDS.map((b, i) => (
              <path key={i} d={sector(b.d1, b.d2, R_IN, R_OUT)} fill={b.fill} />
            ))}
          </g>
          {BANDS.map((b, i) => {
            const [x, y] = pt(R_NUM, (b.d1 + b.d2) / 2 + rot);
            return (
              <text key={i} className="wedge-num" x={f(x)} y={f(y)}>{b.n}</text>
            );
          })}
        </g>

        <g className={"needle" + (showNeedle ? " show" : "") + (hint ? " hint" : "") + (live ? " live" : "")}>
          <line className="shaft-out" x1={f(nx1)} y1={f(ny1)} x2={f(nx2)} y2={f(ny2)} />
          <line className="shaft"     x1={f(nx1)} y1={f(ny1)} x2={f(nx2)} y2={f(ny2)} />
          <circle className="knob-pulse" cx={f(nx2)} cy={f(ny2)} r="11" />
          <circle className="knob-out"   cx={f(nx2)} cy={f(ny2)} r="12" />
          <circle className="knob"       cx={f(nx2)} cy={f(ny2)} r="9.5" />
          <circle className="knob-dot"   cx={f(nx2)} cy={f(ny2)} r="3.4" />
        </g>

        <g className="spectrum">
          <path d={arrowHead(-1)} />
          <line {...arrowBar(-1)} strokeWidth="2.5" />
          <path d={arrowHead(1)} />
          <line {...arrowBar(1)} strokeWidth="2.5" />
          <text ref={leftRef}  x={f(CX - LABEL_CX)} y={LABEL_Y}>{card?.l || ""}</text>
          <text ref={rightRef} x={f(CX + LABEL_CX)} y={LABEL_Y}>{card?.r || ""}</text>
        </g>
      </svg>
    </div>
  );
}
