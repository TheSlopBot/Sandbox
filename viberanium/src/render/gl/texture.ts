import { type GpuDevice } from './device.ts';

export type TextureHandle = {
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
  readonly sampler: GPUSampler;
};

export type TextureCache = {
  getOrCreate: (uri: string, image: ImageBitmap) => TextureHandle;
  getOrLoad: (uri: string) => Promise<TextureHandle>;
  destroy: () => void;
};

export const createTextureCache = (device: GpuDevice): TextureCache => {
  const cache = new Map<string, TextureHandle>();
  const pending = new Map<string, Promise<TextureHandle>>();
  const sampler = device.gpu.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
  });

  const getOrCreate = (uri: string, image: ImageBitmap): TextureHandle => {
    const existing = cache.get(uri);
    if (existing) return existing;

    const texture = device.gpu.createTexture({
      size: { width: image.width, height: image.height },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount: Math.floor(Math.log2(Math.max(image.width, image.height))) + 1,
    });

    device.gpu.queue.copyExternalImageToTexture(
      { source: image },
      { texture },
      { width: image.width, height: image.height },
    );

    if (texture.mipLevelCount > 1) {
      generateMipmaps(device, texture);
    }

    const handle: TextureHandle = {
      texture,
      view: texture.createView(),
      sampler,
    };
    cache.set(uri, handle);
    return handle;
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

    for (const handle of cache.values()) handle.texture.destroy();
    cache.clear();
    pending.clear();
  };

  return { getOrCreate, getOrLoad, destroy };
};

export const createSolidTexture = (
  device: GpuDevice,
  rgba: readonly [number, number, number, number] = [255, 255, 255, 255],
): TextureHandle => {
  const texture = device.gpu.createTexture({
    size: { width: 1, height: 1 },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.gpu.queue.writeTexture(
    { texture },
    new Uint8Array(rgba),
    { bytesPerRow: 4 },
    { width: 1, height: 1 },
  );
  const sampler = device.gpu.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });
  return {
    texture,
    view: texture.createView(),
    sampler,
  };
};

const generateMipmaps = (device: GpuDevice, texture: GPUTexture) => {
  const mipCount = texture.mipLevelCount;
  if (mipCount <= 1) return;

  const shaderModule = device.gpu.createShaderModule({
    code: `
struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  var out: VsOut;
  let x = f32((vi << 1u) & 2u);
  let y = f32(vi & 2u);
  out.uv = vec2f(x, y);
  out.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  return out;
}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSamp: sampler;

@fragment
fn fs(input: VsOut) -> @location(0) vec4f {
  return textureSample(srcTex, srcSamp, input.uv);
}
`,
  });

  const pipeline = device.gpu.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule, entryPoint: 'vs' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [{ format: texture.format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const sampler = device.gpu.createSampler({ minFilter: 'linear' });
  const encoder = device.gpu.createCommandEncoder();

  for (let level = 1; level < mipCount; level++) {
    const bindGroup = device.gpu.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }) },
        { binding: 1, resource: sampler },
      ],
    });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }),
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
  }

  device.gpu.queue.submit([encoder.finish()]);
};
