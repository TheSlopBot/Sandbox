export const asciiFS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_scene;
uniform sampler2D u_glyphAtlas;
uniform vec2 u_resolution;
uniform float u_glyphCount;

const vec2 CELL_SIZE = vec2(8.0, 12.0);

vec3 saturateColor(vec3 c, float amount) {
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luma), c, amount);
}

vec3 contrastColor(vec3 c, float amount) {
  return clamp((c - 0.5) * amount + 0.5, 0.0, 1.0);
}

vec3 sampleCellColor(vec2 cell) {
  vec2 cellCenter = (cell + 0.5) * CELL_SIZE;
  vec2 uv = cellCenter / u_resolution;
  vec2 texel = 1.0 / u_resolution;
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float w = 1.0 / (1.0 + float(abs(x) + abs(y)));
      col += texture(u_scene, uv + texel * vec2(float(x), float(y))).rgb * w;
      wsum += w;
    }
  }
  return col / wsum;
}

float colorVibrancy(vec3 c) {
  float maxC = max(max(c.r, c.g), c.b);
  float minC = min(min(c.r, c.g), c.b);
  return smoothstep(0.06, 0.38, (maxC - minC) / max(maxC, 1e-4));
}

void main() {
  vec2 fragCoord = v_uv * u_resolution;
  vec2 cell = floor(fragCoord / CELL_SIZE);
  vec2 cellUV = fract(fragCoord / CELL_SIZE);

  vec3 sceneCol = sampleCellColor(cell);
  float luma = dot(sceneCol, vec3(0.2126, 0.7152, 0.0722));
  float vibrancy = colorVibrancy(sceneCol);

  float variety = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  float maxIdx = mix((u_glyphCount - 1.0) * 0.18, u_glyphCount - 1.0, vibrancy);
  float idx = floor(clamp(luma * maxIdx + variety * mix(0.6, 2.0, vibrancy), 0.0, u_glyphCount - 1.0));

  float glyphScale = mix(0.38, 1.0, vibrancy);
  vec2 glyphUV = (cellUV - 0.5) / glyphScale + 0.5;
  float glyphAlpha = 0.0;
  if (all(greaterThanEqual(glyphUV, vec2(0.0))) && all(lessThanEqual(glyphUV, vec2(1.0)))) {
    glyphAlpha = texture(u_glyphAtlas, vec2((idx + glyphUV.x) / u_glyphCount, glyphUV.y)).a;
  }

  vec3 glyphColor = contrastColor(saturateColor(sceneCol, 1.536), 1.12) * 1.2;
  glyphColor = clamp(glyphColor, 0.0, 1.0);
  vec3 bg = glyphColor * 0.5;
  float alpha = mix(mix(0.18, 0.55, luma), mix(0.22, 0.95, luma), vibrancy);

  outColor = vec4(mix(bg, glyphColor, glyphAlpha * alpha), 1.0);
}
`;
