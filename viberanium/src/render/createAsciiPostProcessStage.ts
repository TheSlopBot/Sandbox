import { type GpuDevice } from './gl/device.ts';
import { type PostProcessStage } from './pipeline.ts';
import { ASCII_DENSITY, createGlyphAtlasHandle } from './ascii/glyphAtlas.ts';
import { createAsciiPostPass } from './passes/postProcessPass.ts';

export type AsciiStageOptions = {
  enabled?: boolean;
};

export const createAsciiPostProcessStage = (
  device: GpuDevice,
  options: AsciiStageOptions = {},
): PostProcessStage => {
  const glyphAtlas = createGlyphAtlasHandle(device);
  const pass = createAsciiPostPass(device, glyphAtlas, ASCII_DENSITY.length);

  return {
    name: 'ascii',
    enabled: options.enabled ?? false,
    encode: (encoder, inputView, w, h, outputView) => {
      pass.encode(encoder, inputView, w, h, outputView);
    },
    destroy: () => {
      pass.destroy();
      glyphAtlas.texture.destroy();
    },
  };
};
