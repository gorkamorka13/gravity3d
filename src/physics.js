export const DT = 0.016;

export const toRad = (deg) => (deg * Math.PI) / 180;
export const toDeg = (rad) => (rad * 180) / Math.PI;

export function calculerVitesseMinimale(g, x_target, y_target, h_depart) {
  const y_minus_h = y_target - h_depart;
  const sous_racine = Math.sqrt(Math.pow(y_minus_h, 2) + Math.pow(x_target, 2));
  const v0_carre = g * (y_minus_h + sous_racine);
  if (v0_carre < 0) return null;
  return Math.sqrt(v0_carre);
}

export function calculerTrajectoireAvecFrottement(
  v0,
  alphaRad,
  h,
  g,
  m,
  hArrivee,
  radius,
  dragCoeff,
  airDensity,
  dragModel,
  betaRad = 0
) {
  let trajectoire = [{ x: 0, y: 0, z: h }];
  let x = 0, y = 0, z = h;
  
  const v_horiz = v0 * Math.cos(alphaRad);
  let vx = v_horiz * Math.cos(betaRad);
  let vy = v_horiz * Math.sin(betaRad);
  let vz = v0 * Math.sin(alphaRad);
  let t = 0;
  let zMax = h, xSommet = 0, tSommet = 0;
  let isFalling = false;
  const area = Math.PI * radius ** 2;

  let dragConstant;
  if (dragModel === "quadratic") {
    dragConstant = 0.5 * airDensity * area * dragCoeff;
  } else {
    dragConstant = dragCoeff * radius * airDensity * 0.1;
  }

  const maxSteps = 50000;
  let step = 0;

  while ((z >= hArrivee || vz > 0) && step < maxSteps) {
    const v = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);
    if (v === 0) break;

    let F_drag_mag = dragModel === "quadratic" ? dragConstant * v ** 2 : dragConstant * v;
    const F_drag_x = -F_drag_mag * (vx / v);
    const F_drag_y = -F_drag_mag * (vy / v);
    const F_drag_z = -F_drag_mag * (vz / v);
    const F_gravity_z = -m * g;

    const ax = F_drag_x / m;
    const ay = F_drag_y / m;
    const az = (F_drag_z + F_gravity_z) / m;

    vx += ax * DT;
    vy += ay * DT;
    vz += az * DT;
    x += vx * DT;
    y += vy * DT;
    z += vz * DT;
    t += DT;
    step++;

    trajectoire.push({ x, y, z });

    if (vz < 0 && !isFalling) {
      isFalling = true;
      zMax = z;
      xSommet = x;
      tSommet = t;
    }
  }

  const vImpact = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);
  const eInitiale = m * g * h + 0.5 * m * v0 ** 2;
  const eImpact = 0.5 * m * vImpact ** 2;

  return { yMax: zMax, porteeX: x, dureeVol: t, tSommet, xSommet, vImpact, eInitiale, eImpact, trajectoire };
}

export function calculerCaracteristiques(v0, alphaRad, h, g, m, hArrivee, betaRad = 0) {
  if (g <= 0 || v0 <= 0)
    return {
      yMax: h, porteeX: 0, dureeVol: 0, tSommet: 0, xSommet: 0,
      vImpact: v0, eInitiale: m * g * h, eImpact: 0, trajectoire: []
    };

  const vz0 = v0 * Math.sin(alphaRad);
  const v_horiz = v0 * Math.cos(alphaRad);
  const vx0 = v_horiz * Math.cos(betaRad);
  const vy0 = v_horiz * Math.sin(betaRad);

  const eInitiale = m * g * h + 0.5 * m * v0 ** 2;
  let tSommet = vz0 / g;
  let zVertex = -0.5 * g * tSommet ** 2 + vz0 * tSommet + h;
  let xVertex = vx0 * tSommet;
  let zMax = zVertex, xSommet = xVertex, tSommetEff = tSommet;

  if (tSommet <= 0) {
    tSommetEff = 0;
    zMax = h;
    xSommet = 0;
  } else if (zMax < h) {
    zMax = h;
  }

  const A = -0.5 * g;
  const B = vz0;
  const C = h - hArrivee;
  const discriminant = B ** 2 - 4 * A * C;
  let dureeVol = 0;
  if (!(zMax < hArrivee && B >= 0) && discriminant >= 0) {
    const t1 = (-B + Math.sqrt(discriminant)) / (2 * A);
    const t2 = (-B - Math.sqrt(discriminant)) / (2 * A);
    dureeVol = Math.max(t1, t2, 0);
  }

  const porteeX = vx0 * dureeVol;
  const porteeY = vy0 * dureeVol;
  const vImpact = Math.sqrt(vx0 ** 2 + vy0 ** 2 + (vz0 - g * dureeVol) ** 2);
  const eImpact = 0.5 * m * vImpact ** 2;

  let trajectoire = [];
  if (dureeVol > 0) {
    for (let t = 0; t <= dureeVol; t += DT) {
      const x = vx0 * t;
      const y = vy0 * t;
      const z = -0.5 * g * t ** 2 + vz0 * t + h;
      trajectoire.push({ x, y, z });
    }
    trajectoire.push({ x: porteeX, y: porteeY, z: hArrivee });
  } else {
    trajectoire.push({ x: 0, y: 0, z: h });
  }

  return { yMax: zMax, porteeX, porteeY, dureeVol, tSommet: tSommetEff, xSommet, vImpact, eInitiale, eImpact, trajectoire };
}

export function calculerEnveloppe(v0, h, g) {
  if (v0 <= 0 || g <= 0) return { x: [], y: [] };
  const xMaxEnv = (v0 / g) * Math.sqrt(v0 ** 2 + 2 * g * h);
  const xPoints = [], yPoints = [];
  for (let i = 0; i <= 1; i += 0.01) {
    const x = i * xMaxEnv;
    const y = h + v0 ** 2 / (2 * g) - (g / (2 * v0 ** 2)) * x ** 2;
    if (y >= 0) {
      xPoints.push(x);
      yPoints.push(y);
    }
  }
  return { x: xPoints, y: yPoints };
}

export function genererEquationParabole(state, angleDeg) {
  const { v0, g, h } = state;
  if (v0 <= 0 || g <= 0) return "Paramètres invalides pour l'équation.";
  const alphaRad = toRad(angleDeg);
  const cosAlpha = Math.cos(alphaRad);
  if (cosAlpha === 0) return `Tir vertical (non une parabole en y(x))`;
  const a = -g / (2 * v0 * v0 * cosAlpha * cosAlpha);
  const b = Math.tan(alphaRad);
  const c = h;
  let equation = `<i>y(x)</i> = ${a.toFixed(3)} ∙ <i>x</i>²`;
  equation += (b >= 0 ? " + " : " - ") + `${Math.abs(b).toFixed(3)} ∙ <i>x</i>`;
  equation += (c >= 0 ? " + " : " - ") + `${Math.abs(c).toFixed(2)}`;
  return equation;
}
