import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SimulationRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    this.camera = new THREE.PerspectiveCamera(75, rect.width / rect.height, 0.1, 1000);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(rect.width, rect.height);
    
    this.camera.position.set(50, 50, 50);
    this.camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    this.scene.add(directionalLight);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI / 2;

    this.velocityLabels = {};
    this.alphaArc = null;
    this.betaArc = null;
    this.betaProjection = null;
    
    this.initMeshes();

    window.addEventListener('resize', this.onWindowResize.bind(this), false);
  }

  initMeshes() {
    // Projectile Principal
    const projectileGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    this.projectileMesh = new THREE.Mesh(projectileGeometry, new THREE.MeshPhongMaterial());
    this.scene.add(this.projectileMesh);

    // Lines (Allocated with 50000 points max for performance)
    const maxPoints = 50000;
    
    const createLine = (color) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(maxPoints * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setDrawRange(0, 0);
      const material = new THREE.LineBasicMaterial({ color });
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      return line;
    };

    this.mainTrajectoryLine = createLine(0x0000ff);
    this.idealTrajectoryLine = createLine(0xcccccc);
    this.trajectory1Line = createLine(0xff0000);
    this.trajectory2Line = createLine(0x800080);

    // Markers
    const markerGeom = new THREE.SphereGeometry(0.6, 20, 20);
    this.trajectory1Marker = new THREE.Mesh(markerGeom, new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x330000 }));
    this.trajectory1Marker.renderOrder = 2;
    this.trajectory1Marker.visible = false;
    this.scene.add(this.trajectory1Marker);

    const markerGeom2 = new THREE.SphereGeometry(0.6, 20, 20);
    this.trajectory2Marker = new THREE.Mesh(markerGeom2, new THREE.MeshPhongMaterial({ color: 0x800080, emissive: 0x220022 }));
    this.trajectory2Marker.renderOrder = 2;
    this.trajectory2Marker.visible = false;
    this.scene.add(this.trajectory2Marker);

    // Target Marker (Cible en forme de cube)
    const targetGeom = new THREE.BoxGeometry(2, 2, 2);
    this.targetMesh = new THREE.Mesh(targetGeom, new THREE.MeshStandardMaterial({ 
      color: 0xffff00, 
      transparent: true, 
      opacity: 0.5,
      emissive: 0x666600,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.2
    }));
    
    // Bordures du cube cible pour plus de visibilité
    const targetEdges = new THREE.EdgesGeometry(targetGeom);
    const targetLine = new THREE.LineSegments(targetEdges, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    this.targetMesh.add(targetLine);
    
    this.scene.add(this.targetMesh);
    this.targetMesh.visible = false;

    // Repères volumétriques affinés (Dépassent la grille d'un carreau)
    const axisRadius = 0.08;
    const axisLength = 52.5; // Grille de 50m + 1 carreau de 2.5m
    const arrowSize = 1.2;
    const arrowRadius = 0.25;
    
    // Axe X (Rouge)
    this.axisX = new THREE.Group();
    const cylX = new THREE.Mesh(new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    cylX.rotation.z = -Math.PI / 2;
    cylX.position.x = axisLength / 2;
    const coneX = new THREE.Mesh(new THREE.ConeGeometry(arrowRadius, arrowSize, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    coneX.rotation.z = -Math.PI / 2;
    coneX.position.x = axisLength;
    this.axisX.add(cylX, coneX);
    this.scene.add(this.axisX);

    // Axe Z (Vert - Vertical)
    this.axisZ = new THREE.Group();
    const cylZ = new THREE.Mesh(new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8), new THREE.MeshBasicMaterial({ color: 0x44ff44 }));
    cylZ.position.y = axisLength / 2;
    const coneZ = new THREE.Mesh(new THREE.ConeGeometry(arrowRadius, arrowSize, 8), new THREE.MeshBasicMaterial({ color: 0x44ff44 }));
    coneZ.position.y = axisLength;
    this.axisZ.add(cylZ, coneZ);
    this.scene.add(this.axisZ);

    // Axe Y (Bleu - Latéral)
    this.axisY = new THREE.Group();
    const cylY = new THREE.Mesh(new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8), new THREE.MeshBasicMaterial({ color: 0x4444ff }));
    cylY.rotation.x = Math.PI / 2;
    cylY.position.z = axisLength / 2;
    const coneY = new THREE.Mesh(new THREE.ConeGeometry(arrowRadius, arrowSize, 8), new THREE.MeshBasicMaterial({ color: 0x4444ff }));
    coneY.rotation.x = Math.PI / 2;
    coneY.position.z = axisLength;
    this.axisY.add(cylY, coneY);
    this.scene.add(this.axisY);

    // Repère local aligné sur la trajectoire (Pointillés avec Flèches)
    this.localFrame = new THREE.Group();
    this.scene.add(this.localFrame);
    
    // Axe X' Local (Rouge pointillé)
    this.localX = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(45,0,0)]),
      new THREE.LineDashedMaterial({ color: 0xff4444, dashSize: 2, gapSize: 1 })
    );
    this.localX.computeLineDistances();
    this.coneLocalX = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    this.coneLocalX.rotation.z = -Math.PI / 2;
    this.coneLocalX.position.x = 45;
    this.localFrame.add(this.localX, this.coneLocalX);

    // Axe Z Local (Vert pointillé - Vertical)
    this.localZ = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,45,0)]),
      new THREE.LineDashedMaterial({ color: 0x44ff44, dashSize: 2, gapSize: 1 })
    );
    this.localZ.computeLineDistances();
    this.coneLocalZ = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1, 8), new THREE.MeshBasicMaterial({ color: 0x44ff44 }));
    this.coneLocalZ.position.y = 45;
    this.localFrame.add(this.localZ, this.coneLocalZ);

    // Axe Y' Local (Bleu pointillé - Latéral au plan)
    this.localY = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,45)]),
      new THREE.LineDashedMaterial({ color: 0x4444ff, dashSize: 2, gapSize: 1 })
    );
    this.localY.computeLineDistances();
    this.coneLocalY = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1, 8), new THREE.MeshBasicMaterial({ color: 0x4444ff }));
    this.coneLocalY.rotation.x = Math.PI / 2;
    this.coneLocalY.position.z = 45;
    this.localFrame.add(this.localY, this.coneLocalY);
    
    // Labels pour le repère local
    this.labelXPrime = this.makeLabelSprite("x'", "#ff4444");
    this.labelXPrime.scale.set(3, 1.5, 1);
    this.labelXPrime.position.set(47, 0, 0);
    this.localFrame.add(this.labelXPrime);

    this.labelYPrime = this.makeLabelSprite("y'", "#4444ff");
    this.labelYPrime.scale.set(3, 1.5, 1);
    this.labelYPrime.position.set(0, 0, 47);
    this.localFrame.add(this.labelYPrime);

    this.labelZPrime = this.makeLabelSprite("z", "#44ff44");
    this.labelZPrime.scale.set(3, 1.5, 1);
    this.labelZPrime.position.set(0, 47, 0);
    this.localFrame.add(this.labelZPrime);

    // Étiquettes d'axes globaux
    this.labelX = this.makeLabelSprite("X", "#ff4444");
    this.labelX.position.set(55, 0, 0);
    this.labelX.scale.set(4, 2, 1); 
    this.scene.add(this.labelX);

    this.labelZ = this.makeLabelSprite("Z", "#44ff44"); // Vertical
    this.labelZ.position.set(0, 55, 0);
    this.labelZ.scale.set(4, 2, 1); 
    this.scene.add(this.labelZ);

    this.labelY = this.makeLabelSprite("Y", "#4444ff"); // Profondeur
    this.labelY.position.set(0, 0, 55);
    this.labelY.scale.set(4, 2, 1); 
    this.scene.add(this.labelY);

    this.gridHelper = new THREE.GridHelper(100, 40, 0xbbbbbb, 0xdddddd);
    this.gridHelper.material.opacity = 0.4;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);



    // Impact
    const impactGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    this.impactPointMesh = new THREE.Mesh(impactGeometry, new THREE.MeshPhongMaterial({ color: 0x4facfe }));
    this.impactPointMesh.visible = false;
    this.scene.add(this.impactPointMesh);

    // Vectors
    const shaft = 0.2, head = 0.1;
    this.velocityVector = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0x4facfe, shaft, head);
    this.vxVector = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0xcccccc, shaft, head);
    this.vyVector = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0xcccccc, shaft, head);
    this.vzVector = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0xcccccc, shaft, head);
    this.v0Vector = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0x4facfe, 0.5, 0.2);

    this.scene.add(this.velocityVector);
    this.scene.add(this.vxVector);
    this.scene.add(this.vyVector);
    this.scene.add(this.vzVector);
    this.scene.add(this.v0Vector);
  }

  onWindowResize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    
    // Éviter les redimensionnements inutiles ou saccadés durant les transitions CSS
    if (this.renderer.domElement.width === width && this.renderer.domElement.height === height) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  updateLine(line, trajectory) {
    if (!trajectory || trajectory.length === 0) {
      line.visible = false;
      return;
    }
    const positions = line.geometry.attributes.position.array;
    let index = 0;
    for (let i = 0; i < trajectory.length; i++) {
      const p = trajectory[i];
      if (!p) continue;
      positions[index++] = p.x || 0;
      positions[index++] = p.z || 0; // Vertical (User Z -> Three Y)
      positions[index++] = p.y || 0; // Lateral
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.setDrawRange(0, trajectory.length);
    line.visible = trajectory.length > 1;
  }

  updateTheme(isDark) {
    this.scene.background = isDark ? new THREE.Color(0x121212) : new THREE.Color(0xffffff); // Blanc pur plus net
    this.projectileMesh.material.color.set(isDark ? 0x4facfe : 0x2563eb); // Bleu plus intense en clair
    this.mainTrajectoryLine.material.color.set(isDark ? 0x4facfe : 0x2563eb);
    this.idealTrajectoryLine.material.color.set(isDark ? 0xcccccc : 0x64748b); // Gris ardoise plus visible
    
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      if (this.gridHelper.geometry) this.gridHelper.geometry.dispose();
      if (this.gridHelper.material) this.gridHelper.material.dispose();
    }
    
    const gridColorCenter = isDark ? 0x666666 : 0x64748b; // Ardoise
    const gridColorGrid = isDark ? 0x333333 : 0xcbd5e1;   // Gris clair plus marqué
    this.gridHelper = new THREE.GridHelper(100, 40, gridColorCenter, gridColorGrid);
    this.gridHelper.material.opacity = isDark ? 0.6 : 0.8; // Plus opaque en clair
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);

    // Mise à jour des couleurs des labels d'axes pour le contraste
    const labels = [
      { key: 'labelX', text: 'X', pos: [55, 0, 0], color: isDark ? "#ff4444" : "#dc2626" },
      { key: 'labelZ', text: 'Z', pos: [0, 55, 0], color: isDark ? "#44ff44" : "#059669" },
      { key: 'labelY', text: 'Y', pos: [0, 0, 55], color: isDark ? "#4444ff" : "#2563eb" }
    ];

    labels.forEach(l => {
      if (this[l.key]) {
        this.scene.remove(this[l.key]);
        if (this[l.key].material.map) this[l.key].material.map.dispose();
        this[l.key].material.dispose();
      }
      this[l.key] = this.makeLabelSprite(l.text, l.color);
      this[l.key].position.set(...l.pos);
      this[l.key].scale.set(4, 2, 1);
      this.scene.add(this[l.key]);
    });

    // Mise à jour de la couleur des axes volumétriques (Cylindres + Cônes)
    const updateAxisColor = (group, color) => {
      if (group) {
        group.children.forEach(child => {
          if (child.material) child.material.color.set(color);
        });
      }
    };

    updateAxisColor(this.axisX, isDark ? 0xff4444 : 0xdc2626);
    updateAxisColor(this.axisZ, isDark ? 0x44ff44 : 0x059669);
    updateAxisColor(this.axisY, isDark ? 0x4444ff : 0x2563eb);

    // Mise à jour de la couleur des axes locaux (Lignes + Cônes)
    const colorLocalX = isDark ? 0xff4444 : 0xdc2626;
    const colorLocalY = isDark ? 0x4444ff : 0x2563eb;
    const colorLocalZ = isDark ? 0x44ff44 : 0x059669;

    if (this.localX) {
        this.localX.material.color.set(colorLocalX);
        if (this.coneLocalX) this.coneLocalX.material.color.set(colorLocalX);
    }
    if (this.localY) {
        this.localY.material.color.set(colorLocalY);
        if (this.coneLocalY) this.coneLocalY.material.color.set(colorLocalY);
    }
    if (this.localZ) {
        this.localZ.material.color.set(colorLocalZ);
        if (this.coneLocalZ) this.coneLocalZ.material.color.set(colorLocalZ);
    }

    // Mise à jour des labels locaux
    const localLabels = [
      { key: 'labelXPrime', text: "x'", pos: [47, 0, 0], color: isDark ? "#ff4444" : "#dc2626" },
      { key: 'labelYPrime', text: "y'", pos: [0, 0, 47], color: isDark ? "#4444ff" : "#2563eb" },
      { key: 'labelZPrime', text: "z", pos: [0, 47, 0], color: isDark ? "#44ff44" : "#059669" }
    ];

    localLabels.forEach(l => {
      if (this[l.key]) {
        this.localFrame.remove(this[l.key]);
        if (this[l.key].material.map) this[l.key].material.map.dispose();
        this[l.key].material.dispose();
      }
      this[l.key] = this.makeLabelSprite(l.text, l.color);
      this[l.key].position.set(...l.pos);
      this[l.key].scale.set(3, 1.5, 1);
      this.localFrame.add(this[l.key]);
    });
  }

  makeLabelSprite(text, color = "#ffffff") {
    const canvas = document.createElement("canvas");
    const width = 1024;
    const height = 512;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.font = "bold 500px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    // Aspect ratio: 1024/512 = 2. Scale accordingly.
    sprite.scale.set(16, 8, 1);
    sprite.renderOrder = 3;
    return sprite;
  }

  updateLabel(name, text, position, color = "#ffffff") {
    if (!this.velocityLabels[name]) {
      const sprite = this.makeLabelSprite(text, color);
      this.velocityLabels[name] = sprite;
      this.scene.add(sprite);
    } else {
      const sprite = this.velocityLabels[name];
      const canvas = sprite.material.map.image;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      ctx.font = "bold 80px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      sprite.material.map.needsUpdate = true;
    }
    this.velocityLabels[name].position.copy(position);
    this.velocityLabels[name].visible = true;
  }

  hideLabels() {
    Object.values(this.velocityLabels).forEach((s) => (s.visible = false));
  }

  createArc(startAngle, endAngle, radius, color, plane = 'xy') {
    const points = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);
      let x, y, z;
      if (plane === 'xy') {
        x = radius * Math.cos(angle);
        y = radius * Math.sin(angle);
        z = 0;
      } else if (plane === 'xz') {
        x = radius * Math.cos(angle);
        y = 0;
        z = radius * Math.sin(angle);
      }
      points.push(new THREE.Vector3(x, y, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    return new THREE.Line(geometry, material);
  }

  drawV0Vector(state, angleDeg, color) {
    if (state.v0 <= 0) {
      this.v0Vector.visible = false;
      if (this.velocityLabels["v0Label"]) this.velocityLabels["v0Label"].visible = false;
      if (this.velocityLabels["alphaLabel"]) this.velocityLabels["alphaLabel"].visible = false;
      if (this.velocityLabels["betaLabel"]) this.velocityLabels["betaLabel"].visible = false;
      if (this.alphaArc) this.alphaArc.visible = false;
      if (this.betaArc) this.betaArc.visible = false;
      if (this.betaProjection) this.betaProjection.visible = false;
      return;
    }

    const alphaRad = (angleDeg * Math.PI) / 180;
    const betaRad = ((state.outOfPlaneAngleDeg || 0) * Math.PI) / 180;
    const visualScale = 0.3;
    const startPoint = new THREE.Vector3(state.x0 || 0, state.h, state.y0 || 0);

    // Alpha = élévation (plan vertical), Beta = azimut (plan horizontal)
    const v_horiz = state.v0 * Math.cos(alphaRad);
    const direction = new THREE.Vector3(
      v_horiz * Math.cos(betaRad),
      state.v0 * Math.sin(alphaRad),
      v_horiz * Math.sin(betaRad)
    ).normalize();

    const length = state.v0 * visualScale;

    this.v0Vector.setDirection(direction);
    this.v0Vector.position.copy(startPoint);
    this.v0Vector.setLength(length, 1.0, 0.4);
    this.v0Vector.line.material.color.set(color);
    this.v0Vector.cone.material.color.set(color);
    this.v0Vector.visible = true;

    const labelColor = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;

    const v0MidPoint = startPoint.clone().add(direction.clone().multiplyScalar(length * 0.5));
    const perpDir = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
    this.updateLabel("v0Label", `v₀=${state.v0.toFixed(2)} m/s`, v0MidPoint.clone().add(perpDir.clone().multiplyScalar(0.8)), labelColor);

    const arcRadius = length * 0.4;
    if (this.alphaArc) this.scene.remove(this.alphaArc);
    this.alphaArc = this.createArc(0, alphaRad, arcRadius, color, 'xy');
    this.alphaArc.position.copy(startPoint);
    this.scene.add(this.alphaArc);
    this.alphaArc.visible = true;

    if (this.betaArc) this.scene.remove(this.betaArc);
    this.betaArc = this.createArc(0, betaRad, arcRadius, color, 'xz');
    this.betaArc.position.copy(startPoint);
    this.scene.add(this.betaArc);
    this.betaArc.visible = true;

    const projectionDir = new THREE.Vector3(Math.cos(alphaRad) * Math.cos(betaRad), 0, Math.sin(betaRad)).normalize();
    const projPoints = [startPoint, projectionDir.clone().multiplyScalar(length).add(startPoint)];
    
    if (this.betaProjection) this.scene.remove(this.betaProjection);
    const projGeometry = new THREE.BufferGeometry().setFromPoints(projPoints);
    const projMaterial = new THREE.LineDashedMaterial({ color: color, dashSize: 0.2, gapSize: 0.1 });
    this.betaProjection = new THREE.Line(projGeometry, projMaterial);
    this.betaProjection.computeLineDistances();
    this.scene.add(this.betaProjection);
    this.betaProjection.visible = true;

    const alphaLabelPos = startPoint.clone().add(new THREE.Vector3(arcRadius * 0.7, arcRadius * 0.7, 0));
    this.updateLabel("alphaLabel", `α=${angleDeg.toFixed(1)}°`, alphaLabelPos, labelColor);

    const betaLabelPos = startPoint.clone().add(new THREE.Vector3(arcRadius * 0.7, 0, arcRadius * 0.7));
    this.updateLabel("betaLabel", `β=${(state.outOfPlaneAngleDeg||0).toFixed(1)}°`, betaLabelPos, labelColor);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setCameraView(view) {
    const dist = 75;
    this.camera.up.set(0, 1, 0); // Default up

    switch(view) {
      case 'top':
        this.camera.position.set(25, dist, 0);
        this.camera.up.set(1, 0, 0); // Aligner X' vers le haut
        break;
      case 'left':
        this.camera.position.set(25, 10, -dist);
        break;
      case 'right':
        this.camera.position.set(25, 10, dist);
        break;
      case 'iso':
        this.resetCamera();
        return;
    }
    this.controls.target.set(25, 5, 0); 
    this.controls.update();
  }

  resetCamera() {
    this.camera.position.set(50, 40, 50);
    this.camera.up.set(0, 1, 0);
    this.controls.target.set(20, 0, 0);
    this.controls.update();
  }
}
