const LIGHT_SURFACE = '#fff9f4';
const DARK_SURFACE = '#181716';

export interface AccessibleThemeColors {
  onPrimary: string;
  readableOnLight: string;
  readableOnDark: string;
}

export function accessibleThemeColors(primaryColor: string): AccessibleThemeColors {
  const primary = normalizeHex(primaryColor);
  const onPrimary =
    contrastRatio(primary, LIGHT_SURFACE) >= contrastRatio(primary, DARK_SURFACE)
      ? LIGHT_SURFACE
      : DARK_SURFACE;

  return {
    onPrimary,
    readableOnLight: shadeUntilReadable(primary, LIGHT_SURFACE, DARK_SURFACE),
    readableOnDark: shadeUntilReadable(primary, DARK_SURFACE, LIGHT_SURFACE),
  };
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const brightest = Math.max(firstLuminance, secondLuminance);
  const darkest = Math.min(firstLuminance, secondLuminance);
  return (brightest + 0.05) / (darkest + 0.05);
}

function shadeUntilReadable(primary: string, background: string, target: string): string {
  if (contrastRatio(primary, background) >= 4.5) return primary;

  for (let step = 1; step <= 100; step += 1) {
    const candidate = mix(primary, target, step / 100);
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }

  return target;
}

function mix(first: string, second: string, amount: number): string {
  const from = channels(first);
  const to = channels(second);
  return `#${from
    .map((channel, index) => Math.round(channel + (to[index]! - channel) * amount))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function luminance(value: string): number {
  const [red, green, blue] = channels(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function channels(value: string): number[] {
  const hex = normalizeHex(value).slice(1);
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function normalizeHex(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#166534';
}
