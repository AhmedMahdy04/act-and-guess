'use client';

import { useSyncExternalStore } from 'react';
import { testSeat } from '../lib/testSeat';
import { usePathname } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';

const subscribe = () => () => {};

export default function PageTransitions({ children }) {
  const pathname = usePathname();
  const embedded = useSyncExternalStore(subscribe, testSeat, () => null);
  if (embedded) return children;

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

