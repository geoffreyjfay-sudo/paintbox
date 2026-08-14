// ── Colour science ────────────────────────────────────────────────────────────
//
//  RGB ↔ Lab conversions and palette mix-matching.
//  Lab is perceptually uniform, making it far better than RGB for
//  "which colours look similar" comparisons.

// ── RGB → Lab ─────────────────────────────────────────────────────────────────

function rgbToLab(r, g, b) {
  // Linearise (sRGB gamma)
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;

  // RGB → XYZ (D65)
  let X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  let Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  let Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

  // XYZ → Lab (D65 white point)
  X /= 0.95047; Y /= 1.00000; Z /= 1.08883;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);

  return {
    L: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// CIE76 ΔE — good enough for palette matching
function deltaE(lab1, lab2) {
  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

// Blend two Lab colours with weight w for lab1 (0..1)
function blendLab(lab1, lab2, w) {
  return {
    L: lab1.L * w + lab2.L * (1 - w),
    a: lab1.a * w + lab2.a * (1 - w),
    b: lab1.b * w + lab2.b * (1 - w),
  };
}

// Blend in RGB for display (Lab blend → display)
function blendRgb(c1, c2, w) {
  return {
    r: Math.round(c1.r * w + c2.r * (1 - w)),
    g: Math.round(c1.g * w + c2.g * (1 - w)),
    b: Math.round(c1.b * w + c2.b * (1 - w)),
  };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Express a weight 0..1 as a simple ratio string e.g. "2 : 1"
function weightToRatio(w) {
  const steps = [
    [1, 4], [1, 3], [1, 2], [2, 3], [3, 4],
    [1, 1],
    [3, 2], [2, 1], [3, 1], [4, 1],
  ];
  let best = steps[0], bestDist = Infinity;
  for (const [a, b] of steps) {
    const dist = Math.abs(a / (a + b) - w);
    if (dist < bestDist) { bestDist = dist; best = [a, b]; }
  }
  return best;
}

// ── Main algorithm ────────────────────────────────────────────────────────────
//
//  Given a target RGB and an array of palette colours (non-null entries),
//  return the best suggestion:
//    { parts: [{ colour, ratio }], mixHex, deltaE }
//
//  Tries single-colour and all 2-colour pairs with several ratios.
//  Returns whichever minimises ΔE to the target.

function suggestMix(targetR, targetG, targetB, paletteColours) {
  const colours = paletteColours.filter(Boolean);
  if (colours.length === 0) return null;

  const targetLab = rgbToLab(targetR, targetG, targetB);

  // Pre-compute Lab for every palette colour
  const labs = colours.map((c) => rgbToLab(c.r, c.g, c.b));

  let bestDelta = Infinity;
  let bestResult = null;

  // ── 1-colour matches ───────────────────────────────────────────────────────
  colours.forEach((c, i) => {
    const dE = deltaE(targetLab, labs[i]);
    if (dE < bestDelta) {
      bestDelta = dE;
      bestResult = {
        parts: [{ colour: c, ratio: 1 }],
        mixHex: `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
        deltaE: dE,
      };
    }
  });

  // ── 2-colour mixes ─────────────────────────────────────────────────────────
  // Try ratios at 10% steps; narrow step near 50/50 for better precision
  const weights = [0.1, 0.2, 0.25, 0.33, 0.4, 0.5, 0.6, 0.67, 0.75, 0.8, 0.9];

  for (let i = 0; i < colours.length - 1; i++) {
    for (let j = i + 1; j < colours.length; j++) {
      for (const w of weights) {
        const mixLab = blendLab(labs[i], labs[j], w);
        const dE = deltaE(targetLab, mixLab);
        if (dE < bestDelta) {
          bestDelta = dE;
          const [ra, rb] = weightToRatio(w);
          const mixedRgb = blendRgb(colours[i], colours[j], w);
          bestResult = {
            parts: [
              { colour: colours[i], ratio: ra },
              { colour: colours[j], ratio: rb },
            ],
            mixHex: rgbToHex(mixedRgb),
            deltaE: dE,
          };
        }
      }
    }
  }

  return bestResult;
}
