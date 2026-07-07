import { shadowSamplingGLSL } from './shadow.ts';

export const litTexturedVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_uv;

uniform mat4 u_viewProj;
uniform mat4 u_model;

out vec3 v_nrm;
out vec2 v_uv;
out vec3 v_worldPos;

void main() {
  vec4 wp = u_model * vec4(a_position, 1.0);
  v_worldPos = wp.xyz;
  v_nrm = mat3(u_model) * a_normal;
  v_uv = a_uv;
  gl_Position = u_viewProj * wp;
}
`;

export const litSkinnedVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_uv;
layout(location=3) in uvec4 a_joints;
layout(location=4) in vec4 a_weights;

uniform mat4 u_viewProj;
uniform mat4 u_model;
uniform mat4 u_joints[64];

out vec3 v_nrm;
out vec2 v_uv;
out vec3 v_worldPos;

mat4 skinMat() {
  mat4 m = mat4(0.0);
  m += u_joints[int(a_joints.x)] * a_weights.x;
  m += u_joints[int(a_joints.y)] * a_weights.y;
  m += u_joints[int(a_joints.z)] * a_weights.z;
  m += u_joints[int(a_joints.w)] * a_weights.w;
  return m;
}

void main() {
  mat4 sm = skinMat();
  vec4 lp = sm * vec4(a_position, 1.0);
  vec3 ln = mat3(sm) * a_normal;

  vec4 wp = u_model * lp;
  v_worldPos = wp.xyz;
  v_nrm = mat3(u_model) * ln;
  v_uv = a_uv;
  gl_Position = u_viewProj * wp;
}
`;

export const litTexturedFS = `#version 300 es
precision highp float;

in vec3 v_nrm;
in vec2 v_uv;
in vec3 v_worldPos;

uniform sampler2D u_baseColorTex;
uniform vec4 u_baseColorFactor;
uniform vec3 u_lightDir;
uniform vec3 u_ambient;
uniform vec3 u_lightColor;
${shadowSamplingGLSL}

out vec4 outColor;

void main() {
  vec3 n = normalize(v_nrm);
  float ndl = max(dot(n, -u_lightDir), 0.0);
  vec4 tex = texture(u_baseColorTex, v_uv);
  vec4 base = tex * u_baseColorFactor;
  float shadow = sampleShadow(v_worldPos, n, u_lightDir);
  vec3 lit = base.rgb * (u_ambient + ndl * u_lightColor * shadow);
  outColor = vec4(lit, base.a);
}
`;
