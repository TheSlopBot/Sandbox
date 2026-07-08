export type TextureHandle = WebGLTexture;

export class TextureCache {
  private readonly cache = new Map<string, TextureHandle>();
  private readonly pending = new Map<string, Promise<TextureHandle>>();
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  getOrCreate(uri: string, image: ImageBitmap): TextureHandle {
    const existing = this.cache.get(uri);
    if (existing) return existing;
    const tex = this.gl.createTexture();
    if (!tex) throw new Error('createTexture failed');
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 0);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.cache.set(uri, tex);
    return tex;
  }

  getOrLoad = async (uri: string): Promise<TextureHandle> => {
    const existing = this.cache.get(uri);
    if (existing) return existing;

    const inFlight = this.pending.get(uri);
    if (inFlight) return inFlight;

    const load = (async () => {
      const res = await fetch(uri);
      if (!res.ok) throw new Error(`Failed to fetch texture: ${uri}`);
      const blob = await res.blob();
      const image = await createImageBitmap(blob);
      return this.getOrCreate(uri, image);
    })();

    this.pending.set(uri, load);
    try {
      return await load;
    } finally {
      this.pending.delete(uri);
    }
  };
}

