export const ASCII_DENSITY = ' .,:\'~-!iIl|/\\()[]{}?><+=*czsxtneraohgpmdwqkuvybCQMZW@#&$%';

const GLYPH_WIDTH = 8;
const GLYPH_HEIGHT = 12;
const FONT = '10px Consolas, "Courier New", monospace';

export function createGlyphAtlasTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const atlas = document.createElement('canvas');
  atlas.width = ASCII_DENSITY.length * GLYPH_WIDTH;
  atlas.height = GLYPH_HEIGHT;

  const ctx = atlas.getContext('2d');
  if (!ctx) throw new Error('Failed to create glyph atlas canvas');

  ctx.clearRect(0, 0, atlas.width, atlas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let i = 0; i < ASCII_DENSITY.length; i++) {
    ctx.fillText(ASCII_DENSITY[i] ?? '.', i * GLYPH_WIDTH + GLYPH_WIDTH / 2, GLYPH_HEIGHT / 2);
  }

  const tex = gl.createTexture();
  if (!tex) throw new Error('createTexture failed');

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return tex;
}
