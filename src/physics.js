export const DT = 0.01;

export function toRad(deg) { return (deg * Math.PI) / 180; }
export function toDeg(rad) { return (rad * 180) / Math.PI; }

export function calculerTrajectoireAvecFrottement(v0, alphaRad, h, g, m, hArrivee, radius, dragCoeff, airDensity, dragModel, betaRad = 0, x0 = 0, y0 = 0) {
  let x = x0, y = y0, z = h;
  const vz0 = v0 * Math.sin(alphaRad);
  const v_horiz0 = v0 * Math.cos(alphaRad);
  let vx = v_horiz0 * Math.cos(betaRad);
  let vy = v_horiz0 * Math.sin(betaRad);
  let vz = vz0;

  let t = 0;
  let trajectoire = [{ x, y, z, vx, vy, vz, v: v0, v_horiz: v_horiz0 }];
  let zMax = h;
  let xSommet = 0;
  let tSommet = 0;
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
    const vCurrent = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);
    if (vCurrent < 1e-6) break;

    let F_drag_mag = dragModel === "quadratic" ? dragConstant * vCurrent ** 2 : dragConstant * vCurrent;
    const F_drag_x = -F_drag_mag * (vx / vCurrent);
    const F_drag_y = -F_drag_mag * (vy / vCurrent);
    const F_drag_z = -F_drag_mag * (vz / vCurrent);
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

    const vNew = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);
    const vhNew = Math.sqrt(vx ** 2 + vy ** 2);
    trajectoire.push({ x, y, z, vx, vy, vz, v: vNew, v_horiz: vhNew });

    if (vz < 0 && !isFalling) {
      isFalling = true;
      zMax = z;
      xSommet = Math.sqrt(x*x + y*y);
      tSommet = t;
    }
  }

  const vImpact = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);
  const eInitiale = m * g * h + 0.5 * m * v0 ** 2;
  const eImpact = 0.5 * m * vImpact ** 2;

  // yMax : Variable utilisée par l'UI pour la hauteur max, mappée sur zMax
  return { 
    yMax: zMax, 
    porteeX: Math.sqrt((x - x0) ** 2 + (y - y0) ** 2), 
    dureeVol: t, tSommet, xSommet: xSommet - Math.sqrt(x0*x0 + y0*y0), vImpact, eInitiale, eImpact, trajectoire 
  };
}

export function calculerCaracteristiques(v0, alphaRad, h, g, m, hArrivee, betaRad = 0, x0 = 0, y0 = 0) {
  if (g <= 0 || v0 <= 0)
    return {
      yMax: h, porteeX: 0, dureeVol: 0, tSommet: 0, xSommet: 0,
      vImpact: v0, eInitiale: m * g * h, eImpact: 0, trajectoire: []
    };

  const vz0 = v0 * Math.sin(alphaRad);
  const v_horiz0 = v0 * Math.cos(alphaRad);
  const vx0 = v_horiz0 * Math.cos(betaRad);
  const vy0 = v_horiz0 * Math.sin(betaRad);

  const eInitiale = m * g * h + 0.5 * m * v0 ** 2;
  let tSommet = vz0 / g;
  let zVertex = -0.5 * g * tSommet ** 2 + vz0 * tSommet + h;
  let xVertex = vx0 * tSommet;
  let yVertex = vy0 * tSommet;
  
  let zMax = zVertex, xSommet = Math.sqrt((xVertex-x0)*(xVertex-x0) + (yVertex-y0)*(yVertex-y0)), tSommetEff = tSommet;

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
      const x = vx0 * t + x0;
      const y = vy0 * t + y0;
      const z = -0.5 * g * t ** 2 + vz0 * t + h;
      const vt = Math.sqrt(vx0**2 + vy0**2 + (vz0 - g * t)**2);
      const vh = Math.sqrt(vx0**2 + vy0**2);
      trajectoire.push({ x, y, z, vx: vx0, vy: vy0, vz: vz0 - g * t, v: vt, v_horiz: vh });
    }
    const finalVz = vz0 - g * dureeVol;
    trajectoire.push({ 
      x: vx0 * dureeVol + x0, y: vy0 * dureeVol + y0, z: hArrivee, 
      vx: vx0, vy: vy0, vz: finalVz, 
      v: vImpact, v_horiz: Math.sqrt(vx0**2 + vy0**2) 
    });
  } else {
    trajectoire.push({ x: x0, y: y0, z: h, vx: vx0, vy: vy0, vz: vz0, v: v0, v_horiz: v_horiz0 });
  }

  return { 
    yMax: zMax, 
    porteeX: Math.sqrt(porteeX**2 + porteeY**2), 
    porteeY, dureeVol, tSommet: tSommetEff, xSommet, vImpact, eInitiale, eImpact, trajectoire 
  };
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
  let equation = `<i>z(x')</i> = ${a.toFixed(3)} ∙ <i>x'</i>²`;
  equation += (b >= 0 ? " + " : " - ") + `${Math.abs(b).toFixed(3)} ∙ <i>x'</i>`;
  equation += (c >= 0 ? " + " : " - ") + `${Math.abs(c).toFixed(2)}`;
  return equation;
}
