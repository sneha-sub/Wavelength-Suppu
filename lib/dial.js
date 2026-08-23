/* ══════════════════════════════════════════════════════════════
   Dial geometry, in dosa.png's own pixel grid (402 x 481).
   Measured directly off the supplied assets:
     pivot .......... (201.5, 235.5) — the exact centre of the
                      circle, which is also the banana-leaf horizon
     circle radius .. 178.5
     wedge .......... inner r 48 (edge of the photo), outer r 168
     band widths .... from scale.png — bullseye +/-4.3 deg,
                      gold out to +/-13.75, brick out to +/-24.6
     arrows/labels .. traced off the supplied round-screen frame
   ══════════════════════════════════════════════════════════════ */
export const CX = 201.5, CY = 235.5;
export const R_IN = 48, R_OUT = 168, R_NUM = 152, R_NEEDLE = 166;
export const B4 = 4.3, B3 = 13.75, B2 = 24.6;
export const SPAN = B2;

export const ARROW_Y = 256.5, ARROW_IN = 65, ARROW_OUT = 167,
             ARROW_H = 6, ARROW_LEN = 11;
export const LABEL_Y = 278, LABEL_CX = 116, LABEL_MAX = 124, LABEL_SIZE = 13;

const rad = (d) => (d * Math.PI) / 180;
const f = (n) => Math.round(n * 100) / 100;

/** point at radius r, d degrees clockwise from vertical */
export const pt = (r, d) => [CX + r * Math.sin(rad(d)), CY - r * Math.cos(rad(d))];

/** annular sector between two angles measured clockwise from vertical */
export function sector(d1, d2, ri, ro) {
  const [x1, y1] = pt(ri, d1), [x2, y2] = pt(ro, d1);
  const [x3, y3] = pt(ro, d2), [x4, y4] = pt(ri, d2);
  return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}` +
         `A${ro} ${ro} 0 0 1 ${f(x3)} ${f(y3)}` +
         `L${f(x4)} ${f(y4)}` +
         `A${ri} ${ri} 0 0 0 ${f(x1)} ${f(y1)}Z`;
}

export const BANDS = [
  { d1: -B2, d2: -B3, fill: "var(--brick)", n: 2 },
  { d1: -B3, d2: -B4, fill: "var(--gold)",  n: 3 },
  { d1: -B4, d2:  B4, fill: "var(--pink)",  n: 4 },
  { d1:  B4, d2:  B3, fill: "var(--gold)",  n: 3 },
  { d1:  B3, d2:  B2, fill: "var(--brick)", n: 2 },
];

/** dial value 0..1 (left..right) -> degrees clockwise from vertical */
export const valToDeg = (v) => (v - 0.5) * 180;

/** the target centre is inset so the whole wedge always fits on the dial */
export const TARGET_MIN = SPAN / 180;
export const TARGET_MAX = 1 - SPAN / 180;

/** real Wavelength scoring: 4 / 3 / 2 / miss */
export function scoreFor(guess, target) {
  const diff = Math.abs(guess - target) * 180;
  if (diff <= B4) return 4;
  if (diff <= B3) return 3;
  if (diff <= B2) return 2;
  return 0;
}
