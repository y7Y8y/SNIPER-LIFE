import { Color3, Mesh, Scene, ShaderMaterial, Vector2, Vector3 } from '@babylonjs/core';
import type { Engine } from '@babylonjs/core';
import type { WindSample } from '../core/wind.ts';

const MAX_WIND_SPEED = 9;

const GRASS_VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;
attribute vec3 bladeOrigin;

uniform mat4 view;
uniform mat4 projection;
uniform mat4 world;
uniform float time;
uniform vec2 windDir;
uniform float windStrength;
uniform vec3 cameraPos;
uniform float bendFactor;

varying vec3 vColor;
varying float vDist;

void main(void) {
    float height01 = uv.y;
    float phase = bladeOrigin.x * 0.13 + bladeOrigin.z * 0.17 + bladeOrigin.y * 1.7;

    float windWave = sin(time * (2.2 + windStrength * 2.6) + phase)
        + 0.42 * sin(time * 5.7 + phase * 2.3)
        + 0.21 * sin(time * 9.1 + phase * 4.1);

    float bend = (windStrength * 0.25 + windStrength * windWave * 0.25) * bendFactor;
    bend = max(bend, -0.9 * windStrength * bendFactor);
    float bendAmount = bend * height01 * height01;

    vec3 p = position;
    p.x += windDir.x * bendAmount;
    p.z += windDir.y * bendAmount;

    vec4 worldPos = world * vec4(p, 1.0);
    worldPos.x += windDir.x * (0.06 * height01 * height01 * windStrength);
    worldPos.z += windDir.y * (0.06 * height01 * height01 * windStrength);

    gl_Position = projection * view * worldPos;
    vDist = distance(worldPos.xyz, cameraPos);
    vColor = mix(vec3(0.16, 0.19, 0.09), vec3(0.36, 0.34, 0.14), height01);
}
`;

const GRASS_FRAGMENT = `
precision highp float;

varying vec3 vColor;
varying float vDist;

uniform vec3 fogColor;
uniform float fogDensity;
uniform float fadeStart;
uniform float fadeEnd;
uniform float checkerSize;

void main(void) {
    if (vDist > fadeEnd) {
        discard;
    }
    if (vDist > fadeStart) {
        float fade = smoothstep(fadeEnd, fadeStart, vDist);
        vec2 cell = floor(gl_FragCoord.xy / checkerSize);
        float pattern = fract(cell.x + cell.y) * 0.5 + 0.25;
        if (pattern > fade) {
            discard;
        }
    }
    vec3 color = vColor;
    float fogAmount = 1.0 - exp(-pow(vDist * fogDensity, 2.0));
    color = mix(color, fogColor, clamp(fogAmount, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
}
`;

export interface GrassField {
  mesh: Mesh;
  material: ShaderMaterial;
  setWind: (sample: WindSample, timeSec: number) => void;
  setCamera: (cameraPos: Vector3) => void;
  setFog: (fogColor: Color3, fogDensity: number) => void;
}

const BLADE_BASE_DENSITY = 22000;
const HIDE_DISTANCE = 220;

export function createGrassField(
  _engine: Engine,
  scene: Scene,
  hillHeightFn: (x: number, z: number) => number,
  densityFactor: number,
): GrassField {
  const bladeCount = Math.max(2000, Math.round(BLADE_BASE_DENSITY * densityFactor));

  const positions: number[] = [];
  const uvs: number[] = [];
  const origins: number[] = [];
  const indices: number[] = [];

  let seed = 2009;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  let v = 0;
  for (let b = 0; b < bladeCount; b++) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * HIDE_DISTANCE;
    const ox = Math.cos(angle) * radius;
    const oz = Math.sin(angle) * radius;
    const oy = hillHeightFn(ox, oz);
    const rot = rand() * Math.PI * 2;
    const height = 0.28 + rand() * 0.25;
    const halfW = 0.02 + rand() * 0.022;
    const leanX = (rand() - 0.5) * 0.25;
    const leanZ = (rand() - 0.5) * 0.25;

    const dirX = Math.cos(rot);
    const dirZ = Math.sin(rot);

    const push = (
      pointHeight: number,
      widthScale: number,
      uvX: number,
      uvY: number,
    ): void => {
      const px = ox + dirX * halfW * widthScale + leanX * pointHeight;
      const pz = oz + dirZ * halfW * widthScale + leanZ * pointHeight;
      const py = oy + pointHeight * height;
      positions.push(px, py, pz);
      uvs.push(uvX, uvY);
      origins.push(ox, oy, oz);
    };

    push(0, 1, 0, 0);
    push(0, -1, 1, 0);
    push(0.5, 0.6, 0, 0.5);
    push(0.5, -0.6, 1, 0.5);
    push(1, 0, 0.5, 1);
    push(1, 0, 0.5, 1);

    for (const i of [0, 1, 2, 1, 3, 2, 2, 3, 4, 2, 3, 5]) {
      indices.push(v + i);
    }
    v += 6;
  }

  const mesh = new Mesh('grass-field', scene);
  mesh.setVerticesData('position', new Float32Array(positions), false, 3);
  mesh.setVerticesData('uv', new Float32Array(uvs), false, 2);
  mesh.setVerticesData('bladeOrigin', new Float32Array(origins), false, 3);
  mesh.setIndices(new Uint32Array(indices), bladeCount * 6);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;

  const material = new ShaderMaterial(
    'grass-mat',
    scene,
    { vertexSource: GRASS_VERTEX, fragmentSource: GRASS_FRAGMENT },
    {
      attributes: ['position', 'uv', 'bladeOrigin'],
      uniforms: [
        'world',
        'view',
        'projection',
        'time',
        'windDir',
        'windStrength',
        'cameraPos',
        'bendFactor',
        'fogColor',
        'fogDensity',
        'fadeStart',
        'fadeEnd',
        'checkerSize',
      ],
    },
  );
  material.disableColorWrite = false;
  material.backFaceCulling = false;
  material.setFloat('time', 0);
  material.setFloat('windStrength', 0);
  material.setVector2('windDir', new Vector3(1, 0, 0));
  material.setVector3('cameraPos', new Vector3(0, 2, 0));
  material.setFloat('bendFactor', 1);
  material.setFloat('fadeStart', 120);
  material.setFloat('fadeEnd', HIDE_DISTANCE);
  material.setFloat('checkerSize', 3);
  material.setColor3('fogColor', new Color3(0.62, 0.66, 0.71));
  material.setFloat('fogDensity', 0.0022);
  mesh.material = material;

  return {
    mesh,
    material,
    setWind(sample: WindSample, timeSec: number): void {
      material.setFloat('time', timeSec);
      material.setFloat('windStrength', Math.min(1, sample.speed / MAX_WIND_SPEED));
      material.setVector2('windDir', new Vector2(-Math.sin(sample.direction), -Math.cos(sample.direction)));
    },
    setCamera(cameraPos: Vector3): void {
      material.setVector3('cameraPos', cameraPos);
    },
    setFog(fogColor: Color3, fogDensity: number): void {
      material.setColor3('fogColor', fogColor);
      material.setFloat('fogDensity', fogDensity);
    },
  };
}

export { GRASS_VERTEX, GRASS_FRAGMENT };
