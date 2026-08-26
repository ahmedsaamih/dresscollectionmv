/**
 * Product.img / colorImages{} are stored as full CSS `background` shorthand
 * strings — either a gradient placeholder (e.g. "linear-gradient(...)") when
 * no photo's been uploaded, or `url(https://...) center/cover no-repeat` for
 * a real photo. This extracts the real URL when there is one, so callers can
 * render it through next/image instead of a plain CSS background.
 */
export type ImageValue = { type: 'url'; src: string } | { type: 'css'; background: string };

const URL_RE = /^url\((['"]?)(.*?)\1\)/i;

export function parseImageValue(value: string | null | undefined): ImageValue {
  if (!value) return { type: 'css', background: '#f5f1f3' };
  const m = value.match(URL_RE);
  if (m) return { type: 'url', src: m[2] };
  return { type: 'css', background: value };
}
