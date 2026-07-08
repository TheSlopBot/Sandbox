import { createGlyphAtlasTexture } from './ascii/glyphAtlas.ts';
import { createShaderProgram } from './gl/shader.ts';
import { createAsciiPostProcessPass } from './passes/asciiPostProcessPass.ts';
import { type PostProcessStage } from './pipeline.ts';
import { fullscreenVS } from './shaders/post.ts';
import { asciiFS } from './shaders/ascii.ts';

export type AsciiStageOptions = {
  enabled?: boolean;
};

export const createAsciiPostProcessStage = (
  gl: WebGL2RenderingContext,
  options: AsciiStageOptions = {},
): PostProcessStage => {
  const glyphTex = createGlyphAtlasTexture(gl);
  const asciiPass = createAsciiPostProcessPass(gl, createShaderProgram(gl, fullscreenVS, asciiFS), glyphTex);
  return {
    name: 'ascii',
    enabled: options.enabled ?? false,
    draw: (inputTex, w, h, outputFbo) => asciiPass.draw(inputTex, w, h, outputFbo),
    destroy: () => {
      asciiPass.destroy();
      gl.deleteTexture(glyphTex);
    },
  };
};
