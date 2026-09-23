import cmark from '../../assets/brand/cmark-256.webp';

// The brick "C" from the CardBrix logo. `id` lets the first-visit intro find the header
// instance and fly the mark into it (see BrandIntro).
export default function BrandMark({ size = 36, id, className = '' }) {
  return (
    <span
      className={`brand-mark-wrap ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        id={id}
        src={cmark}
        alt=""
        width={size}
        height={size}
        decoding="async"
        draggable="false"
        className="block h-full w-full"
      />
    </span>
  );
}
