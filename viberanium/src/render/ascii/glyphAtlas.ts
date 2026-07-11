import { type TextureHandle } from '../gl/texture.ts';

export const ASCII_DENSITY = ' .,:\'~-!iIl|/\\()[]{}?><+=*czsxtneraohgpmdwqkuvybCQMZW@#&$%';

const GLYPH_WIDTH = 8;
const GLYPH_HEIGHT = 12;
const FONT = '10px Consolas, "Courier New", monospace';

const buildGlyphAtlasCanvas = (): HTMLCanvasElement => {
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

  return atlas;
};

export const createGlyphAtlasHandle = (device: { gpu: GPUDevice }): TextureHandle => {
  const atlas = buildGlyphAtlasCanvas();
  const texture = device.gpu.createTexture({
    size: { width: atlas.width, height: atlas.height },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.gpu.queue.copyExternalImageToTexture(
    { source: atlas },
    { texture },
    { width: atlas.width, height: atlas.height },
  );

  const sampler = device.gpu.createSampler({
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  return {
    texture,
    view: texture.createView(),
    sampler,
  };
};
