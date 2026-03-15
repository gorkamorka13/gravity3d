import * as THREE from 'three';
import './style.css';
import { state, SPEED_SCALE, DRAG_COEFF_PRESETS } from './state.js';
import { SimulationRenderer } from './renderer.js';
import {
  calculerCaracteristiques,
  calculerEnveloppe,
  calculerTrajectoireAvecFrottement,
  genererEquationParabole,
  toDeg,
  toRad,
  DT
} from './physics.js';

let renderer;
let sliders, inputs, values, elements;

function getVelocityAtFrame(traj, index) {
  const n = traj.length;
  if (n === 0) return { vx: 0, vy: 0, vz: 0, v: 0 };
  const i = Math.min(Math.max(0, index), n - 1);

  if (!state.isResistanceActive && state.mode === "simulation") {
    const t = i * DT;
    const alphaRad = toRad(state.alpha);
    const betaRad = toRad(state.outOfPlaneAngleDeg || 0);
    const v_horiz = state.v0 * Math.cos(alphaRad);
    const vx = v_horiz * Math.cos(betaRad);
    const vy = v_horiz * Math.sin(betaRad);
    const vz = state.v0 * Math.sin(alphaRad) - state.g * t;
    const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
    return { vx, vy, vz, v };
  }

  let vx = 0, vy = 0, vz = 0;
  if (i > 0) {
    const a = traj[i - 1];
    const b = traj[i];
    vx = (b.x - a.x) / DT;
    vy = (b.y - a.y) / DT;
    vz = ((b.z || 0) - (a.z || 0)) / DT;
  } else if (n > 1) {
    const a = traj[0];
    const b = traj[1];
    vx = (b.x - a.x) / DT;
    vy = (b.y - a.y) / DT;
    vz = ((b.z || 0) - (a.z || 0)) / DT;
  }
  return { vx, vy, vz, v: Math.sqrt(vx*vx + vy*vy + vz*vz) };
}

function updateVectors(traj, frameIndex) {
  if (!state.showVelocityVectors || !traj || traj.length === 0 || state.isDualTrajectoryMode) {
    renderer.velocityVector.visible = false;
    renderer.vxVector.visible = false;
    renderer.vyVector.visible = false;
    renderer.vzVector.visible = false;
    return;
  }

  const idx = Math.min(frameIndex, traj.length - 1);
  const pos = traj[idx];
  const vel = getVelocityAtFrame(traj, idx);
  
  const origin = new THREE.Vector3(pos.x, pos.z, pos.y);
  const dir = new THREE.Vector3(vel.vx, vel.vz, vel.vy);
  const vMag = dir.length();
  
  if (vMag > 1e-6) dir.normalize();
  
  const length = vel.v * state.velocityVectorScale;
  renderer.velocityVector.setDirection(vMag > 1e-6 ? dir : new THREE.Vector3(1,0,0));
  renderer.velocityVector.position.copy(origin);
  renderer.velocityVector.setLength(length, 0.4, 0.2); // Flèche un peu plus grosse
  renderer.velocityVector.visible = vel.v > 0.05;

  const vTip = origin.clone().add(dir.clone().multiplyScalar(length));
  renderer.updateLabel("vLabel", `v=${vel.v.toFixed(2)} m/s`, vTip.clone().add(new THREE.Vector3(0, 0.8, 0)), "#4facfe");

  if (state.showVelocityComponents) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const colorX = isDark ? "#ff4444" : "#dc2626";
    const colorZ = isDark ? "#44ff44" : "#059669";
    const colorY = isDark ? "#4444ff" : "#2563eb";

    if (state.coordSystem === "local") {
      const v_horiz = Math.sqrt(vel.vx**2 + vel.vy**2);
      const betaRadVal = toRad(state.outOfPlaneAngleDeg || 0);
      const dirX = new THREE.Vector3(Math.cos(-betaRadVal), 0, Math.sin(-betaRadVal));
      
      renderer.vxVector.setDirection(dirX);
      renderer.vxVector.setColor(new THREE.Color(isDark ? 0xff4444 : 0xdc2626));
      renderer.vxVector.position.copy(origin);
      renderer.vxVector.setLength(v_horiz * state.velocityVectorScale, 0.2, 0.1);
      renderer.vxVector.visible = v_horiz > 0.1;
      
      const vxTip = origin.clone().add(dirX.clone().multiplyScalar(v_horiz * state.velocityVectorScale));
      renderer.updateLabel("vxLabel", `vx'=${v_horiz.toFixed(2)} m/s`, vxTip.clone().add(new THREE.Vector3(0, 1.2, 0)), colorX);

      renderer.vzVector.setDirection(new THREE.Vector3(0,1,0)); // Vertical reste vertical
      renderer.vzVector.setColor(new THREE.Color(isDark ? 0x44ff44 : 0x059669));
      renderer.vzVector.position.copy(vxTip);
      renderer.vzVector.setLength(Math.abs(vel.vz)*state.velocityVectorScale, 0.2, 0.1);
      renderer.vzVector.visible = Math.abs(vel.vz) > 0.1;
      const vzTip = vxTip.clone().add(new THREE.Vector3(0, vel.vz * state.velocityVectorScale, 0));
      renderer.updateLabel("vzLabel", `vz=${vel.vz.toFixed(2)} m/s`, vzTip.clone().add(new THREE.Vector3(0, 0, 1.5)), colorZ);
      
      renderer.vyVector.visible = false;
      if (renderer.velocityLabels["vyLabel"]) renderer.velocityLabels["vyLabel"].visible = false;
    } else {
      // Repère Global
      renderer.vxVector.setDirection(new THREE.Vector3(1,0,0));
      renderer.vxVector.setColor(new THREE.Color(isDark ? 0xff4444 : 0xdc2626));
      renderer.vxVector.position.copy(origin);
      renderer.vxVector.setLength(Math.abs(vel.vx)*state.velocityVectorScale, 0.2, 0.1);
      renderer.vxVector.visible = Math.abs(vel.vx) > 0.1;
      const vxTip = origin.clone().add(new THREE.Vector3(vel.vx * state.velocityVectorScale, 0, 0));
      renderer.updateLabel("vxLabel", `vx=${vel.vx.toFixed(2)} m/s`, vxTip.clone().add(new THREE.Vector3(0, 1.2, 0)), colorX);

      renderer.vyVector.setDirection(new THREE.Vector3(0,0,1)); // Axe Y latéral (Three Z)
      renderer.vyVector.setColor(new THREE.Color(isDark ? 0x4444ff : 0x2563eb));
      renderer.vyVector.position.copy(vxTip);
      renderer.vyVector.setLength(Math.abs(vel.vy)*state.velocityVectorScale, 0.2, 0.1);
      renderer.vyVector.visible = Math.abs(vel.vy) > 0.1;
      const vyTip = vxTip.clone().add(new THREE.Vector3(0, 0, vel.vy * state.velocityVectorScale));
      renderer.updateLabel("vyLabel", `vy=${vel.vy.toFixed(2)} m/s`, vyTip.clone().add(new THREE.Vector3(2, 0, 0)), colorY);
      
      renderer.vzVector.setDirection(new THREE.Vector3(0,1,0)); // Axe Z vertical (Three Y)
      renderer.vzVector.setColor(new THREE.Color(isDark ? 0x44ff44 : 0x059669));
      renderer.vzVector.position.copy(vyTip);
      renderer.vzVector.setLength(Math.abs(vel.vz)*state.velocityVectorScale, 0.2, 0.1);
      renderer.vzVector.visible = Math.abs(vel.vz) > 0.1;
      const vzTip = vyTip.clone().add(new THREE.Vector3(0, vel.vz * state.velocityVectorScale, 0));
      renderer.updateLabel("vzLabel", `vz=${vel.vz.toFixed(2)} m/s`, vzTip.clone().add(new THREE.Vector3(0, 0, 1.5)), colorZ);
    }
  } else {
    renderer.vxVector.visible = renderer.vyVector.visible = renderer.vzVector.visible = false;
    ["vLabel", "vxLabel", "vyLabel", "vzLabel"].forEach((k) => renderer.velocityLabels[k] && (renderer.velocityLabels[k].visible = false));
  }
}

function calculateTargetSolutions() {
  state.showFinalTrajectory = false;
  state.isDualTrajectoryMode = false;
  state.currentFrameIndex = 0;
  
  const v0 = parseFloat(sliders.v0Target.value);
  const g = parseFloat(sliders.g.value);
  const h = parseFloat(sliders.h.value);
  state.v0 = v0;
  state.h = h;
  state.target.x = parseFloat(inputs.targetX.value);
  state.target.y = parseFloat(inputs.targetY.value);
  state.target.z = parseFloat(inputs.targetZ.value);
  
  state.outOfPlaneAngleDeg = sliders.outOfPlane ? parseFloat(sliders.outOfPlane.value || 0) : 0;
  state.vz0 = (state.v0 || 0) * Math.sin(toRad(state.outOfPlaneAngleDeg));
  
  const { target } = state;
  if (target.x <= 0) return;

  const A = (g * target.x ** 2) / (2 * v0 ** 2);
  const B = -target.x;
  const C = target.y - h + A;
  const delta = B ** 2 - 4 * A * C;

  if (delta < 0) {
    state.solutions = [];
    state.trajectoire = state.trajectoire1 = state.trajectoire2 = [];
  } else {
    const T1 = (-B + Math.sqrt(delta)) / (2 * A);
    const T2 = (-B - Math.sqrt(delta)) / (2 * A);
    state.solutions = [];
    [T1, T2].forEach((T) => {
      const alpha = toDeg(Math.atan(T));
      if (alpha >= -90 && alpha <= 90) state.solutions.push(alpha);
    });
    state.solutions.sort((a, b) => b - a);

    if (target.z !== 0 && state.solutions.length > 0) {
      const alphaRad = toRad(state.solutions[0]);
      const cosAlpha = Math.cos(alphaRad);
      if (cosAlpha > 1e-9) {
        const flightTime = target.x / (v0 * cosAlpha);
        state.vz0 = target.z / flightTime;
        state.outOfPlaneAngleDeg = toDeg(Math.asin(Math.max(-1, Math.min(1, state.vz0 / v0))));
      }
    }

    if (state.solutions.length > 0) {
      const c1 = calculerCaracteristiques(v0, toRad(state.solutions[0]), h, g, state.m, target.y, state.vz0);
      let traj1 = c1.trajectoire;
      const targetIndex1 = traj1.findIndex((p) => p.x >= target.x);
      if (targetIndex1 !== -1) {
        traj1 = traj1.slice(0, targetIndex1 + 1);
        traj1[traj1.length - 1] = { x: target.x, y: target.y, z: state.vz0 * (targetIndex1 * DT) };
      }
      state.trajectoire1 = traj1.map((p, idx) => ({ ...p, x: p.x - (traj1[0].x||0), z: (state.target.z||0)*(traj1.length>1?idx/(traj1.length-1):0) }));
      
      if (state.solutions.length === 2) {
        state.isDualTrajectoryMode = true;
        const c2 = calculerCaracteristiques(v0, toRad(state.solutions[1]), h, g, state.m, target.y, state.vz0);
        let traj2 = c2.trajectoire;
        const targetIndex2 = traj2.findIndex((p) => p.x >= target.x);
        if (targetIndex2 !== -1) {
          traj2 = traj2.slice(0, targetIndex2 + 1);
          traj2[traj2.length - 1] = { x: target.x, y: target.y, z: state.target.z || 0 };
        }
        state.trajectoire2 = traj2.map((p, idx) => ({ ...p, x: p.x - (traj2[0].x||0), z: (state.target.z||0)*(traj2.length>1?idx/(traj2.length-1):0) }));
      }
    }
  }
  updateResults();
}

function updateSimulation() {
  if (state.isUpdating) return;
  state.isUpdating = true;
  
  if (state.mode === "simulation" && state.isPaused) state.simulationStarted = false;
  state.showFinalTrajectory = state.mode === "target" || state.simulationStarted;
  
  ["h", "hArrivee", "g", "m", "radius", "dragCoeff"].forEach((key) => {
    if (sliders[key]) state[key] = parseFloat(sliders[key].value);
  });
  
  state.speedFactor = parseFloat(sliders.speed.value) * SPEED_SCALE;
  if(values.speed) values.speed.textContent = parseFloat(sliders.speed.value).toFixed(1) + "x";
  state.velocityVectorScale = parseFloat(sliders.vectorScale.value);
  if(values.vectorScale) values.vectorScale.textContent = state.velocityVectorScale.toFixed(1);
  state.isResistanceActive = elements.resistanceCheckbox.checked;

  if (state.mode === "simulation") {
    state.v0 = parseFloat(sliders.v0.value);
    state.alpha = parseFloat(sliders.alpha.value);
    state.outOfPlaneAngleDeg = sliders.outOfPlane ? parseFloat(sliders.outOfPlane.value || 0) : 0;
    
    const alphaRad = toRad(state.alpha);
    const betaRad = toRad(state.outOfPlaneAngleDeg);
    
    // Vy0 (Latéral) = Horizontal_total * sin(beta)
    // Vz0 (Vertical) = v0 * sin(alpha)
    const v_horiz = state.v0 * Math.cos(alphaRad);
    state.vx0 = v_horiz * Math.cos(betaRad);
    state.vy0 = v_horiz * Math.sin(betaRad);
    state.vz0 = state.v0 * Math.sin(alphaRad);
    
    state.isDualTrajectoryMode = false;
    let chars;
    if (state.isResistanceActive) {
      chars = calculerTrajectoireAvecFrottement(state.v0, alphaRad, state.h, state.g, state.m, state.hArrivee, state.radius, state.dragCoeff, state.airDensity, state.dragModel, betaRad);
      state.idealTrajectoire = calculerCaracteristiques(state.v0, alphaRad, state.h, state.g, state.m, state.hArrivee, betaRad).trajectoire;
    } else {
      chars = calculerCaracteristiques(state.v0, alphaRad, state.h, state.g, state.m, state.hArrivee, betaRad);
      state.idealTrajectoire = [];
    }
    Object.assign(state, chars);
    updateResults();

    // Réinitialiser la position au départ si on ne simule pas activement
    if (!state.simulationStarted || state.isPaused) {
      state.currentFrameIndex = 0;
      renderer.projectileMesh.position.set(0, state.h, 0); // PhysX, PhysZ(H), PhysY(L)
    }

    // Orienter le repère local
    if (renderer.localFrame) {
      renderer.localFrame.rotation.y = -betaRad; 
    }
  }

  if (state.mode === "target") {
     renderer.targetMesh.position.set(state.target.x, state.target.y + 1, state.target.z);
     renderer.targetMesh.visible = true;
  } else {
     renderer.targetMesh.visible = false;
  }

  // Draw Lines
  if (state.mode === "simulation") {
    renderer.updateLine(renderer.mainTrajectoryLine, state.trajectoire);
    renderer.updateLine(renderer.idealTrajectoryLine, state.idealTrajectoire);
    renderer.mainTrajectoryLine.visible = state.showFinalTrajectory;
    renderer.idealTrajectoryLine.visible = state.isResistanceActive && state.showIdealTrajectory;
    renderer.trajectory1Line.visible = false;
    renderer.trajectory2Line.visible = false;
  } else {
    renderer.updateLine(renderer.trajectory1Line, state.trajectoire1);
    renderer.updateLine(renderer.trajectory2Line, state.trajectoire2);
    renderer.trajectory1Line.visible = state.showFinalTrajectory && state.trajectoire1.length > 1;
    renderer.trajectory2Line.visible = state.showFinalTrajectory && state.isDualTrajectoryMode && state.trajectoire2.length > 1;
    renderer.mainTrajectoryLine.visible = false;
    renderer.idealTrajectoryLine.visible = false;
  }
  
  // Mettre à jour le vecteur de tir en mode simulation
  if (state.mode === "simulation") {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    renderer.drawV0Vector(state, state.alpha, isDark ? 0x4facfe : 0x0000ff);
  }
  
  state.isUpdating = false;
}

function updateResults(dynamicHTML = "") {
  let html = "";
  if (state.mode === "simulation") {
    html = `<b>Caractéristiques :</b><ul><li>Hauteur max: <b>${state.yMax.toFixed(2)}m</b></li><li>Portée: <b>${state.porteeX.toFixed(2)}m</b></li><li>Vol: <b>${state.dureeVol.toFixed(2)}s</b></li></ul>`;
    if (dynamicHTML) html += `<div style="margin-top:10px">${dynamicHTML}</div>`;
  } else if (state.mode === "target") {
    html = `<b>Cible:</b> (${state.target.x}m, ${state.target.y}m, ${state.target.z}m)<br>`;
    if (state.solutions.length > 0) {
      html += `Solutions trouvées: ${state.solutions.map(s=>`<b>${s.toFixed(1)}°</b>`).join(' et ')}`;
    } else {
      html += `Aucune solution pour ces paramètres.`;
    }
  }
  elements.resultsDisplay.innerHTML = html;
  
  if (state.mode === "simulation" && !state.isResistanceActive) {
    elements.equationDisplay.innerHTML = genererEquationParabole(state, state.alpha);
  } else {
    elements.equationDisplay.innerHTML = state.isResistanceActive ? "Équations non disponibles (frottement actif)." : "";
  }
}

function toggleAnimation(atEnd = false) {
  state.isPaused = !state.isPaused;
  if (!state.isPaused) {
    state.simulationStarted = true;
    state.showFinalTrajectory = true;
    elements.pauseButton.textContent = "Pause";
    elements.pauseButton.classList.replace("btn-go", "btn-pause");
    document.getElementById("panel").classList.remove("open");
  } else {
    elements.pauseButton.textContent = "Go";
    elements.pauseButton.classList.replace("btn-pause", "btn-go");
  }
}

function animationLoop() {
  requestAnimationFrame(animationLoop);
  renderer.render();

  let idx = Math.floor(state.currentFrameIndex);

  if (!state.isPaused) {
    let traj = state.mode === "simulation" ? state.trajectoire : state.trajectoire1;
    let maxFrames = state.isDualTrajectoryMode ? Math.max(state.trajectoire1.length, state.trajectoire2.length) : traj.length;

    if (state.currentFrameIndex >= maxFrames - 1 && maxFrames > 0) {
      state.currentFrameIndex = maxFrames - 1;
      idx = Math.floor(state.currentFrameIndex);
      toggleAnimation(true);
    } else {
      state.currentFrameIndex += state.speedFactor;
      idx = Math.floor(state.currentFrameIndex);
    }
    
    if (traj.length > 0 && traj[idx]) {
      let frame = traj[idx];
      renderer.projectileMesh.position.set(frame.x, frame.z, frame.y);
      if (state.coordSystem === "local") {
        const xPrime = Math.sqrt(frame.x**2 + frame.y**2);
        updateResults(`<b>t = ${(idx * DT).toFixed(2)}s</b>, x' = ${xPrime.toFixed(1)}m, z = ${frame.z.toFixed(1)}m`);
      } else {
        updateResults(`<b>t = ${(idx * DT).toFixed(2)}s</b>, x = ${frame.x.toFixed(1)}m, y = ${frame.y.toFixed(1)}m, z = ${frame.z.toFixed(1)}m`);
      }
    }
  }

  // Animation progressive des trajectoires
  if (state.simulationStarted || state.mode === "target") {
    if (state.mode === "simulation") {
      if (renderer.mainTrajectoryLine) {
        renderer.mainTrajectoryLine.geometry.setDrawRange(0, Math.min(idx + 1, state.trajectoire.length));
        renderer.mainTrajectoryLine.visible = true;
      }
    } else {
      if (renderer.trajectory1Line) {
        renderer.trajectory1Line.geometry.setDrawRange(0, Math.min(idx + 1, state.trajectoire1.length));
        renderer.trajectory1Line.visible = true;
      }
      if (state.isDualTrajectoryMode && renderer.trajectory2Line) {
        renderer.trajectory2Line.geometry.setDrawRange(0, Math.min(idx + 1, state.trajectoire2.length));
        renderer.trajectory2Line.visible = true;
      }
    }
  }

  // Afficher les vecteurs et points d'impact même en pause
  let trajToDraw = state.mode === "simulation" ? state.trajectoire : state.trajectoire1;
  let currentAlpha = state.mode === "simulation" ? state.alpha : (state.solutions.length > 0 ? state.solutions[0] : 0);
  
  updateVectors(trajToDraw, Math.floor(state.currentFrameIndex));
  
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const shootColor = (state.mode === "simulation" || state.solutions.length === 0) ? (isDark ? 0x4facfe : 0x0000ff) : 0xff0000;
  renderer.drawV0Vector(state, currentAlpha, shootColor);
}

function initDOM() {
  sliders = {
    v0: document.getElementById("v0Slider"),
    alpha: document.getElementById("alphaSlider"),
    h: document.getElementById("hSlider"),
    hArrivee: document.getElementById("hArriveeSlider"),
    g: document.getElementById("gSlider"),
    m: document.getElementById("mSlider"),
    speed: document.getElementById("speedSlider"),
    vectorScale: document.getElementById("vectorScaleSlider"),
    v0Target: document.getElementById("v0TargetSlider"),
    targetX: document.getElementById("targetXSlider"),
    targetY: document.getElementById("targetYSlider"),
    targetZ: document.getElementById("targetZSlider"),
    outOfPlane: document.getElementById("outOfPlaneSlider"),
    radius: document.getElementById("radiusSlider"),
    dragCoeff: document.getElementById("dragCoeffSlider"),
  };

  inputs = {
    v0: document.getElementById("v0Input"),
    alpha: document.getElementById("alphaInput"),
    h: document.getElementById("hInput"),
    hArrivee: document.getElementById("hArriveeInput"),
    g: document.getElementById("gInput"),
    m: document.getElementById("mInput"),
    v0Target: document.getElementById("v0TargetInput"),
    targetX: document.getElementById("targetXInput"),
    targetY: document.getElementById("targetYInput"),
    targetZ: document.getElementById("targetZInput"),
    outOfPlane: document.getElementById("outOfPlaneInput"),
    radius: document.getElementById("radiusInput"),
    dragCoeff: document.getElementById("dragCoeffInput"),
  };

  elements = {
    resultsDisplay: document.getElementById("results-display"),
    equationDisplay: document.getElementById("equation-display"),
    resistanceCheckbox: document.getElementById("resistanceCheckbox"),
    pauseButton: document.getElementById("pauseButton")
  };

  values = {
    speed: document.getElementById("speedValue"),
    vectorScale: document.getElementById("vectorScaleValue")
  };

  const link = (s, i, cb) => {
    if(!s || !i) return;
    s.addEventListener("input", () => { i.value = s.value; cb(); });
    i.addEventListener("change", () => { s.value = i.value; cb(); });
    
    // Empêcher la capture du clavier après interaction
    s.addEventListener("mouseup", () => s.blur());
    s.addEventListener("touchend", () => s.blur());
    i.addEventListener("blur", () => i.value = s.value); 
  };

  ["v0", "alpha", "h", "hArrivee", "g", "m", "outOfPlane", "radius", "dragCoeff", "speed", "vectorScale"].forEach(k => {
    const s = sliders[k];
    const i = inputs[k];
    if (s && i) i.value = s.value; // Synchronisation initiale
    
    const cb = () => { if(state.mode==="simulation") updateSimulation(); else calculateTargetSolutions(); };
    
    if (s && i) {
      link(s, i, cb);
    } else if (s) {
      s.addEventListener("input", cb);
    }
  });

  ["v0Target", "targetX", "targetY", "targetZ"].forEach(k => {
    if (sliders[k] && inputs[k]) inputs[k].value = sliders[k].value; // Synchronisation initiale
    link(sliders[k], inputs[k], calculateTargetSolutions);
  });

  document.querySelectorAll('input[name="mode"]').forEach(rad => {
    rad.addEventListener("change", e => {
      state.mode = e.target.value;
      document.getElementById("simulation-controls").classList.toggle("hidden", state.mode === "target");
      document.getElementById("target-controls").classList.toggle("hidden", state.mode === "simulation");
      if (state.mode === "simulation") updateSimulation(); else calculateTargetSolutions();
    });
  });

  elements.pauseButton.addEventListener("click", toggleAnimation);
  document.getElementById("resetButton").addEventListener("click", () => location.reload()); // Quick reset
  document.getElementById("openBtn").addEventListener("click", () => document.getElementById("panel").classList.add("open"));
  document.getElementById("closePanelHeaderBtn").addEventListener("click", () => document.getElementById("panel").classList.remove("open"));

  document.getElementById("themeToggleBtn").addEventListener("click", () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    const isDark = newTheme === "dark";

    html.setAttribute("data-theme", newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById("themeToggleBtn").textContent = isDark ? "🌙" : "☀️";
    
    if (renderer) {
      renderer.updateTheme(isDark);
    }
  });

  // Sections repliables
  document.querySelectorAll(".section-header").forEach(header => {
    header.addEventListener("click", () => {
      header.parentElement.classList.toggle("collapsed");
    });
  });

  // Visibilité résistance de l'air
  elements.resistanceCheckbox.addEventListener("change", () => {
    document.getElementById("resistance-params").classList.toggle("hidden", !elements.resistanceCheckbox.checked);
    updateSimulation();
  });

  document.querySelectorAll('input[name="coordSystem"]').forEach(rad => {
    rad.addEventListener("change", e => {
      state.coordSystem = e.target.value;
      if (renderer.localFrame) renderer.localFrame.visible = (state.coordSystem === "local");
      updateSimulation();
    });
  });

  // Raccourcis clavier
  window.addEventListener("keydown", (e) => {
    // Éviter de déclencher si on tape dans un champ de texte
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.code === "Space") {
      e.preventDefault();
      toggleAnimation();
    } else if (e.code === "Escape") {
      state.isPaused = true;
      state.simulationStarted = false;
      state.currentFrameIndex = 0;
      elements.pauseButton.textContent = "Go";
      elements.pauseButton.classList.replace("btn-pause", "btn-go");
      document.getElementById("panel").classList.remove("open");
      updateSimulation(); // Repositionne au départ
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  
  renderer = new SimulationRenderer(document.getElementById("simCanvas"));
  renderer.updateTheme(isDark);
  
  initDOM();
  document.getElementById("themeToggleBtn").textContent = isDark ? "🌙" : "☀️";
  
  updateSimulation();
  animationLoop();
  
  // Forcer le redimensionnement pour un affichage "droit" dès le départ
  renderer.onWindowResize();
  if (renderer.localFrame) renderer.localFrame.visible = (state.coordSystem === "local");
  
  setTimeout(() => {
    document.body.classList.add('initialized');
  }, 100);
});
