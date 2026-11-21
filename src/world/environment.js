/* Ciel, lumière et météo dynamique. La même palette pilote fog, soleil, ciel et pluie :
   la cohérence visuelle vient de là. */

import * as THREE from 'three';

export const WEATHER_PRESETS = {
  clear: {
    sunColor: new THREE.Color(0xffe8c0), sunIntensity: 2.6,
    skyTop: new THREE.Color(0x9db8d2), skyHorizon: new THREE.Color(0xd8d2b8),
    fogColor: new THREE.Color(0xc4c8b2), fogDensity: 0.0055,
    ambient: 0.75, rain: 0, wind: 0.25, label: 'Dégagé'
  },
  overcast: {
    sunColor: new THREE.Color(0xcfd6da), sunIntensity: 1.1,
    skyTop: new THREE.Color(0x707c7e), skyHorizon: new THREE.Color(0xaab0a4),
    fogColor: new THREE.Color(0x9aa093), fogDensity: 0.011,
    ambient: 0.85, rain: 0, wind: 0.5, label: 'Couvert'
  },
  rain: {
    sunColor: new THREE.Color(0xb8c2c8), sunIntensity: 0.7,
    skyTop: new THREE.Color(0x4e5a60), skyHorizon: new THREE.Color(0x83897d),
    fogColor: new THREE.Color(0x707a73), fogDensity: 0.017,
    ambient: 0.8, rain: 0.7, wind: 0.7, label: 'Pluie'
  },
  storm: {
    sunColor: new THREE.Color(0x9aa4ac), sunIntensity: 0.45,
    skyTop: new THREE.Color(0x36414a), skyHorizon: new THREE.Color(0x5c635b),
    fogColor: new THREE.Color(0x525c56), fogDensity: 0.022,
    ambient: 0.7, rain: 1, wind: 1, label: 'Orage'
  }
};

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform float uSunY;
varying vec3 vDir;
void main() {
  float h = clamp(normalize(vDir).y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.7));
  col *= mix(0.35, 1.0, clamp(uSunY, 0.0, 1.0) * 0.8 + 0.2);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.current = clonePreset('clear');
    this.target = 'clear';
    this.from = clonePreset('clear');
    this.blend = 1;
    this.timer = 40;
    this.thunderTimer = 12;

    this.sun = new THREE.DirectionalLight(0xffe8c0, 2.6);
    this.sun.position.set(60, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 220;
    const S = 90;
    this.sun.shadow.camera.left = -S;
    this.sun.shadow.camera.right = S;
    this.sun.shadow.camera.top = S;
    this.sun.shadow.camera.bottom = -S;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbbccd6, 0x3a4430, 0.8);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xc4c8b2, 0.0055);

    this._buildSky();
    this._buildRain();
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(400, 24, 16);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uTop: { value: new THREE.Color(0x9db8d2) },
        uHorizon: { value: new THREE.Color(0xd8d2b8) },
        uSunY: { value: 1 }
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.skyMat = mat;
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  _buildRain() {
    const COUNT = 900;
    const positions = new Float32Array(COUNT * 6);
    this.rainSpeed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 120;
      const y = Math.random() * 40;
      const z = (Math.random() - 0.5) * 120;
      positions[i * 6] = x; positions[i * 6 + 1] = y; positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x; positions[i * 6 + 4] = y - 0.7; positions[i * 6 + 5] = z;
      this.rainSpeed[i] = 18 + Math.random() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xaebbc2, transparent: true, opacity: 0.0 });
    this.rainMesh = new THREE.LineSegments(geo, mat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);
  }

  setWeather(name, fast = false) {
    if (!WEATHER_PRESETS[name] || name === this.target) return;
    this.from = clonePreset(this.target);
    this.target = name;
    this.blend = fast ? 0.35 : 0.02;
    this.timer = 90 + Math.random() * 120;
  }

  /* déclenché par le scénario : la météo accompagne le récit */
  nudge(name) {
    this.setWeather(name, true);
  }

  update(dt, playerPos, audio) {
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 24);
      const b = smooth01(this.blend);
      const P = WEATHER_PRESETS[this.target];
      this.current = {
        sunColor: this.from.sunColor.clone().lerp(P.sunColor, b),
        sunIntensity: lerpN(this.from.sunIntensity, P.sunIntensity, b),
        skyTop: this.from.skyTop.clone().lerp(P.skyTop, b),
        skyHorizon: this.from.skyHorizon.clone().lerp(P.skyHorizon, b),
        fogColor: this.from.fogColor.clone().lerp(P.fogColor, b),
        fogDensity: lerpN(this.from.fogDensity, P.fogDensity, b),
        ambient: lerpN(this.from.ambient, P.ambient, b),
        rain: lerpN(this.from.rain, P.rain, b),
        wind: lerpN(this.from.wind, P.wind, b),
        label: P.label
      };
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        // évolutions naturelles, jamais de coupure brutale pendant l'action
        const order = { clear: 'overcast', overcast: 'rain', rain: 'clear', storm: 'overcast' };
        this.setWeather(order[this.target] || 'clear');
      }
    }

    const cur = this.current;
    this.sun.color.copy(cur.sunColor);
    this.sun.intensity = cur.sunIntensity;
    this.hemi.intensity = cur.ambient;
    if (playerPos) {
      this.sun.position.set(playerPos.x + 55, playerPos.y + 70, playerPos.z + 28);
      this.sun.target.position.copy(playerPos);
      this.sky.position.set(playerPos.x, 0, playerPos.z);
    }
    this.scene.fog.color.copy(cur.fogColor);
    this.scene.fog.density = cur.fogDensity;
    this.skyMat.uniforms.uTop.value.copy(cur.skyTop);
    this.skyMat.uniforms.uHorizon.value.copy(cur.skyHorizon);
    this.skyMat.uniforms.uSunY.value = cur.sunIntensity / 2.6;

    // pluie : rideau de segments tombant autour du joueur
    this.rainMesh.visible = cur.rain > 0.02;
    this.rainMesh.material.opacity = cur.rain * 0.25;
    if (this.rainMesh.visible && playerPos) {
      this.rainMesh.position.set(playerPos.x, playerPos.y, playerPos.z);
      const pos = this.rainMesh.geometry.attributes.position;
      const slant = 1 + cur.wind * 5;
      for (let i = 0; i < this.rainSpeed.length; i++) {
        let y = pos.getY(i * 2) - this.rainSpeed[i] * dt;
        let x = pos.getX(i * 2) + slant * dt;
        if (y < -20) { y += 40; x -= slant * (40 / this.rainSpeed[i]); }
        if (x > 60) x -= 120;
        pos.setX(i * 2, x); pos.setX(i * 2 + 1, x + slant * 0.03);
        pos.setY(i * 2, y); pos.setY(i * 2 + 1, y - 0.7);
      }
      pos.needsUpdate = true;
    }

    if (audio) audio.setWeather(cur.wind, cur.rain);

    if (cur.rain > 0.8) {
      this.thunderTimer -= dt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 8 + Math.random() * 22;
        if (audio) audio.thunder(Math.random());
      }
    }
    return cur;
  }
}

function clonePreset(name) {
  const P = WEATHER_PRESETS[name];
  return {
    sunColor: P.sunColor.clone(), sunIntensity: P.sunIntensity,
    skyTop: P.skyTop.clone(), skyHorizon: P.skyHorizon.clone(),
    fogColor: P.fogColor.clone(), fogDensity: P.fogDensity,
    ambient: P.ambient, rain: P.rain, wind: P.wind, label: P.label
  };
}

function lerpN(a, b, t) { return a + (b - a) * t; }
function smooth01(t) { return t * t * (3 - 2 * t); }
