import { ImageError } from './image-error';
import { runImage, type ImageRunRequest } from './image-run';

const limits = {
  quality: 80,
  width: 64,
  height: 32,
  background: '#ffffff',
  maxWidth: 4096,
  maxHeight: 4096,
} satisfies Omit<ImageRunRequest, 'input' | 'sourceFormat' | 'targetFormat'>;

describe('image worker pipeline', () => {
  it('rejects a broken SVG document', async () => {
    await expect(
      runImage({
        ...limits,
        input: Buffer.from('<svg><text>hi</text>', 'utf8'),
        sourceFormat: 'svg',
        targetFormat: 'png',
      }),
    ).rejects.toBeInstanceOf(ImageError);
  });

  it('rejects an unsafe SVG document', async () => {
    await expect(
      runImage({
        ...limits,
        input: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          'utf8',
        ),
        sourceFormat: 'svg',
        targetFormat: 'png',
      }),
    ).rejects.toMatchObject({ code: 'UNSAFE_SVG' });
  });

  it('rasterizes SVG text with the bundled font', async () => {
    const output = await runImage({
      ...limits,
      input: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><text x="4" y="20" font-family="DejaVu Sans">Hi</text></svg>',
        'utf8',
      ),
      sourceFormat: 'svg',
      targetFormat: 'png',
    });
    expect(output.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('rejects a truncated PNG', async () => {
    await expect(
      runImage({
        ...limits,
        input: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        sourceFormat: 'png',
        targetFormat: 'jpeg',
      }),
    ).rejects.toBeInstanceOf(ImageError);
  });
});
