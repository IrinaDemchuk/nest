import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const fontsDir = join(process.cwd(), 'assets/fonts');
const cacheDir = join(process.cwd(), 'storage/fontconfig');
const confPath = join(cacheDir, 'fonts.conf');

mkdirSync(cacheDir, { recursive: true });

const fontPath = join(fontsDir, 'DejaVuSans.ttf');
if (!existsSync(fontPath)) {
  throw new Error(`Bundled SVG font is missing: ${fontPath}`);
}
writeFileSync(
  confPath,
  `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${escapeXml(fontsDir)}</dir>
  <cachedir>${escapeXml(cacheDir)}</cachedir>
  <alias>
    <family>sans-serif</family>
    <prefer><family>DejaVu Sans</family></prefer>
  </alias>
  <alias>
    <family>serif</family>
    <prefer><family>DejaVu Sans</family></prefer>
  </alias>
  <alias>
    <family>monospace</family>
    <prefer><family>DejaVu Sans</family></prefer>
  </alias>
  <alias>
    <family>sans</family>
    <prefer><family>DejaVu Sans</family></prefer>
  </alias>
</fontconfig>
`,
);

process.env.FONTCONFIG_FILE = confPath;
process.env.FONTCONFIG_PATH = cacheDir;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export const BUNDLED_FONT_PATH = fontPath;
