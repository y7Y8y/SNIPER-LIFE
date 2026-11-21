import { Color3, Mesh, MeshBuilder, Scene, ShaderMaterial, StandardMaterial, Vector2, Vector3 } from '@babylonjs/core';
import type { WindSample } from '../core/wind.ts';

const CLOTH_VERTEX = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;
attribute vec3 clothOrigin;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform float time;
uniform vec2 windDir;
uniform float windStrength;

varying float vSag;

void main(void) {
    float t = uv.x;
    float phase = clothOrigin.x * 0.4 + clothOrigin.z * 0.4;
    float flap =
        sin(time * (5.0 + windStrength * 6.0) + phase + t * 6.0) * 0.25
        + sin(time * 9.0 + phase * 2.0 + t * 11.0) * 0.25 + 0.5;

    float magnitude = t * t * (0.4 + windStrength * 1.4);
    vec3 p = position;
    p.x += windDir.x * magnitude * (0.6 + flap);
    p.z += windDir.y * magnitude * (0.6 + flap);
    p.y -= magnitude * 0.35 * flap;

    vSag = flap;
    gl_Position = projection * view * world * vec4(p, 1.0);
}
`;

const CLOTH_FRAGMENT = `
precision highp float;
varying float vSag;
uniform vec3 color;
void main(void) {
    vec3 shaded = color * (0.55 + 0.45 * vSag);
    gl_FragColor = vec4(shaded, 1.0);
}
`;

export interface FlagIndicator {
  meshes: Mesh[];
  setWind: (sample: WindSample, timeSec: number) => void;
}

const MAX_WIND_SPEED = 9;

export function createWindFlags(scene: Scene, originPoints: Vector3[]): FlagIndicator {
  const material = new ShaderMaterial(
    'cloth-mat',
    scene,
    { vertexSource: CLOTH_VERTEX, fragmentSource: CLOTH_FRAGMENT },
    {
      attributes: ['position', 'uv', 'clothOrigin'],
      uniforms: ['world', 'view', 'projection', 'time', 'windDir', 'windStrength', 'color'],
    },
  );
  material.backFaceCulling = false;
  material.setColor3('color', new Color3(0.75, 0.6, 0.2));
  material.setVector2('windDir', new Vector2(1, 0));
  material.setFloat('windStrength', 0.4);

  const meshes: Mesh[] = [];
  for (const origin of originPoints) {
    const pole = MeshBuilder.CreateCylinder(
      `flagpole-${origin.x}`,
      { height: 3, diameter: 0.07, tessellation: 8 },
      scene,
    );
    pole.position = new Vector3(origin.x, origin.y + 1.5, origin.z);
    const poleMat = new StandardMaterial(`flagpole-mat-${origin.x}`, scene);
    poleMat.diffuseColor = new Color3(0.25, 0.24, 0.22);
    poleMat.specularColor = new Color3(0.1, 0.1, 0.1);
    pole.material = poleMat;

    const cloth = MeshBuilder.CreatePlane(
      `flag-${origin.x}`,
      { width: 1.1, height: 0.6, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    cloth.parent = pole;
    cloth.position = new Vector3(0.05, 1.1, 0);
    const positions = cloth.getVerticesData('position')!;
    const uvArr = cloth.getVerticesData('uv')!;
    const origins: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      origins.push(origin.x, origin.y, origin.z);
    }
    void uvArr;
    cloth.setVerticesData('clothOrigin', new Float32Array(origins), false, 3);
    cloth.material = material;
    cloth.alwaysSelectAsActiveMesh = true;
    meshes.push(cloth);
  }

  return {
    meshes,
    setWind(sample: WindSample, timeSec: number): void {
      material.setFloat('time', timeSec);
      material.setFloat('windStrength', Math.min(1, sample.speed / MAX_WIND_SPEED));
      material.setVector2('windDir', new Vector2(-Math.sin(sample.direction), -Math.cos(sample.direction)));
    },
  };
}
