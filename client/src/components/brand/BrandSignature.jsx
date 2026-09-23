import { motion, useReducedMotion } from 'framer-motion';
import logo1600 from '../../assets/brand/logo-1600.webp';
import logo800 from '../../assets/brand/logo-800.webp';

const MASK = 'radial-gradient(ellipse 54% 58% at 50% 50%, #000 64%, transparent 100%)';

// Closing "signature" of the landing page: the full logo, dissolved into the page background by a
// soft radial mask, revealed on scroll with a warm light behind it.
export default function BrandSignature() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative mx-auto mt-16 max-w-[900px] md:mt-24">
      <span
        className="pointer-events-none absolute left-[12%] top-1/2 h-[55%] w-[45%] -translate-y-1/2 rounded-full bg-[#2b7fff]/20 blur-[100px]"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute right-[8%] top-1/2 h-[55%] w-[45%] -translate-y-1/2 rounded-full bg-[#ff8a1f]/20 blur-[100px]"
        aria-hidden="true"
      />
      <motion.div
        className="relative"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-120px' }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="lx-float">
        <img
          src={logo1600}
          srcSet={`${logo800} 800w, ${logo1600} 1600w`}
          sizes="(min-width: 960px) 900px, 94vw"
          alt="CardBrix"
          width="1600"
          height="873"
          loading="lazy"
          decoding="async"
          draggable="false"
          className="relative block h-auto w-full select-none"
          style={{ maskImage: MASK, WebkitMaskImage: MASK }}
        />
        </div>
      </motion.div>
    </div>
  );
}
