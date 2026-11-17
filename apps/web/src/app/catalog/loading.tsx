export default function CatalogLoading() {
  return (
    <div className="warmup-main library-main" role="status" aria-busy="true">
      <div className="warmup-heading">
        <p className="eyebrow">The warmup library</p>
        <h1>Loading exercises…</h1>
      </div>
      <div className="skeleton-grid" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-card" />
        ))}
      </div>
    </div>
  );
}
