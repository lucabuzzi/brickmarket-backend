// Fixed, decorative background layer: slow-drifting brand-color blobs plus a
// sprinkle of rising sparkle particles. Rendered once in Layout so it's behind
// every route. Pure CSS animation (see .aurora-*/.sparkle rules in index.css) -
// no JS animation loop, so it's effectively free performance-wise.
const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i * 1.7) % 10}s`,
  duration: `${8 + (i % 5) * 1.6}s`,
}));

export default function SiteAurora() {
  return (
    <div className="site-aurora" aria-hidden="true">
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
      <span className="aurora-blob aurora-blob-4" />
      <div className="sparkle-field">
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="sparkle"
            style={{ left: s.left, animationDelay: s.delay, animationDuration: s.duration }}
          />
        ))}
      </div>
    </div>
  );
}
