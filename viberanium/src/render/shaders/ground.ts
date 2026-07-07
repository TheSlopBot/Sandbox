import { shadowSamplingGLSL } from './shadow.ts';

export const groundVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
uniform mat4 u_viewProj;
uniform mat4 u_model;
out vec3 v_worldPos;
void main() {
  vec4 wp = u_model * vec4(a_position, 1.0);
  v_worldPos = wp.xyz;
  gl_Position = u_viewProj * wp;
}
`;

export const groundFS = `#version 300 es
precision highp float;
in vec3 v_worldPos;
uniform vec3 u_lightDir;
${shadowSamplingGLSL}
out vec4 outColor;

void main() {
  vec2 p = v_worldPos.xz;

  float baseSquare = mod(floor(p.x) + floor(p.y), 2.0);
  vec3 paperA = vec3(0.78, 0.76, 0.73);
  vec3 paperB = vec3(0.74, 0.72, 0.69);
  vec3 col = mix(paperA, paperB, baseSquare);

  vec2 minorCell = abs(fract(p) - 0.5);
  vec2 minorD = 0.5 - minorCell;
  vec2 majorP = p / 5.0;
  vec2 majorCell = abs(fract(majorP) - 0.5);
  vec2 majorD = 0.5 - majorCell;

  float aaMinor = max(fwidth(p.x), fwidth(p.y));
  float aaMajor = max(fwidth(majorP.x), fwidth(majorP.y));

  float minorLine = 1.0 - smoothstep(0.0, aaMinor * 1.25, min(minorD.x, minorD.y));
  float majorLine = 1.0 - smoothstep(0.0, aaMajor * 1.75, min(majorD.x, majorD.y));

  col = mix(col, vec3(0.64, 0.62, 0.59), minorLine * 0.55);
  col = mix(col, vec3(0.54, 0.52, 0.49), majorLine * 0.85);

  vec3 n = vec3(0.0, 1.0, 0.0);
  float shadow = sampleShadow(v_worldPos, n, u_lightDir);
  col *= mix(vec3(0.55), vec3(1.0), shadow);

  outColor = vec4(col, 1.0);
}
`;
