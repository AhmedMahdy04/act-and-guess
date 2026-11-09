'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';

export default function PageTransitions({ children }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

