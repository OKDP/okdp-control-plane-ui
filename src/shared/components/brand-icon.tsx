/** Minimal brand glyph: what BrandIcon needs to render a mark. simple-icons
 *  entries are structurally compatible; hand-vendored logos (brands missing
 *  from simple-icons) provide their own viewBox. */
export interface BrandGlyph {
  /** Single-path monochrome mark (the simple-icons shape). */
  path?: string;
  hex?: string;
  /** Multicolor mark: each path carries its own fill, winning over `hex`.
   *  For brands whose mono simple-icons variant is unreadable at 16px. */
  paths?: { d: string; fill: string }[];
  /** Defaults to the simple-icons 24x24 canvas. */
  viewBox?: string;
}

/** Inline brand logo sized to the sidebar icon slot (it follows the menu's
 *  `--nav-item-scale`; outside the rail the var is unset and the slot stays
 *  16×18px). `mono` follows the text color instead of the brand hex, for
 *  near-black brands that would vanish in dark mode. */
export function BrandIcon({ icon, mono }: { icon: BrandGlyph; mono?: boolean }) {
  return (
    <svg
      viewBox={icon.viewBox ?? '0 0 24 24'}
      aria-hidden="true"
      className="h-[calc(1rem*var(--nav-item-scale,1))] w-[calc(18px*var(--nav-item-scale,1))] shrink-0"
      fill={mono ? 'currentColor' : icon.hex ? `#${icon.hex}` : undefined}
    >
      {icon.paths ? (
        icon.paths.map((p, i) => <path key={i} d={p.d} fill={mono ? undefined : p.fill} />)
      ) : (
        <path d={icon.path} />
      )}
    </svg>
  );
}
