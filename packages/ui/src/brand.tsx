/** Generated identity geometry. Keep both halves equal; edit tools/brand/identity.json. */
export function BrandMark({ className, label }: { readonly className?: string; readonly label?: string }) {
  return <svg viewBox="0 0 128 128" width="128" height="128" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} fill="currentColor">
    <path d="M28 100V28H40L56 50V70L40 48V100Z" /><circle cx="34" cy="100" r="8" />
    <g transform="translate(128 0) scale(-1 1)"><path d="M28 100V28H40L56 50V70L40 48V100Z" /><circle cx="34" cy="100" r="8" /></g>
  </svg>;
}
export function BrandLockup({ label = "TraceMigo" }: { readonly label?: string }) {
  return <picture className="brand-lockup"><source media="(prefers-color-scheme: dark)" srcSet="/brand/lockup-reverse.svg" /><img src="/brand/lockup-primary.svg" alt={label} width="495" height="128" /></picture>;
}
