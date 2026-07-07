import { createGlyphAtlasTexture } from './ascii/glyphAtlas.ts';
import { ShaderProgram } from './gl/shader.ts';
import { AsciiPostProcessPass } from './passes/asciiPostProcessPass.ts';
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
  const asciiPass = new AsciiPostProcessPass(gl, new ShaderProgram(gl, fullscreenVS, asciiFS), glyphTex);
  return {
    name: 'ascii',
    enabled: options.enabled ?? false,
    draw: (inputTex, w, h, outputFbo) => asciiPass.draw(inputTex, w, h, outputFbo),
  };
};
