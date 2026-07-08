export type TextureHandle = WebGLTexture;

export type TextureCache = {
  getOrCreate: (uri: string, image: ImageBitmap) => TextureHandle;
  getOrLoad: (uri: string) => Promise<TextureHandle>;
  destroy: () => void;
};

export const createTextureCache = (gl: WebGL2RenderingContext): TextureCache => {
  const cache = new Map<string, TextureHandle>();
  const pending = new Map<string, Promise<TextureHandle>>();

  const getOrCreate = (uri: string, image: ImageBitmap): TextureHandle => {
    const existing = cache.get(uri);
    if (existing) return existing;
    const tex = gl.createTexture();
    if (!tex) throw new Error('createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    cache.set(uri, tex);
    return tex;
  };

  const getOrLoad = async (uri: string): Promise<TextureHandle> => {
    const existing = cache.get(uri);
    if (existing) return existing;

    const inFlight = pending.get(uri);
    if (inFlight) return inFlight;

    const load = (async () => {
      const res = await fetch(uri);
      if (!res.ok) throw new Error(`Failed to fetch texture: ${uri}`);
      const blob = await res.blob();
      const image = await createImageBitmap(blob);
      return getOrCreate(uri, image);
    })();

    pending.set(uri, load);
    try {
      return await load;
    } finally {
      pending.delete(uri);
    }
  };

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;

    for (const tex of cache.values()) gl.deleteTexture(tex);
    cache.clear();
    pending.clear();
  };

  return { getOrCreate, getOrLoad, destroy };
};

