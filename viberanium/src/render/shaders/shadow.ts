export const shadowDepthVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 a_position;

uniform mat4 u_lightViewProj;
uniform mat4 u_model;

void main() {
  gl_Position = u_lightViewProj * u_model * vec4(a_position, 1.0);
}
`;

export const shadowDepthSkinnedVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 a_position;
layout(location=3) in uvec4 a_joints;
layout(location=4) in vec4 a_weights;

uniform mat4 u_lightViewProj;
uniform mat4 u_model;
uniform mat4 u_joints[64];

mat4 skinMat() {
  mat4 m = mat4(0.0);
  m += u_joints[int(a_joints.x)] * a_weights.x;
  m += u_joints[int(a_joints.y)] * a_weights.y;
  m += u_joints[int(a_joints.z)] * a_weights.z;
  m += u_joints[int(a_joints.w)] * a_weights.w;
  return m;
}

void main() {
  vec4 wp = u_model * skinMat() * vec4(a_position, 1.0);
  gl_Position = u_lightViewProj * wp;
}
`;

export const shadowDepthFS = `#version 300 es
precision highp float;
void main() {}
`;

export const shadowSamplingGLSL = `
uniform mat4 u_lightViewProj;
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowMapSize;

float sampleShadow(vec3 worldPos, vec3 nrm, vec3 lightDir) {
  vec4 lp = u_lightViewProj * vec4(worldPos, 1.0);
  vec3 proj = lp.xyz / lp.w;
  vec2 uv = proj.xy * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;

  float ndl = max(dot(nrm, -lightDir), 0.0);
  float bias = max(0.0012 * (1.0 - ndl), 0.00035);
  float depth = proj.z * 0.5 + 0.5 - bias;

  float texel = 1.0 / u_shadowMapSize;
  float shadow = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 off = vec2(float(x), float(y)) * texel;
      shadow += texture(u_shadowMap, vec3(uv + off, depth));
    }
  }
  return shadow / 25.0;
}
`;
