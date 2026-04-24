'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Card from '../../../components/ui/Card';

export default function JoinDirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const gameId = params.gameId;
    if (gameId) {
      router.replace(`/join?id=${encodeURIComponent(gameId)}`);
    }
  }, [params.gameId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <Card className="p-8 sm:p-12 text-center">
        <motion.div
          initial={{ rotate: -10, opacity: 0.7 }}
          animate={{ rotate: 360, opacity: 1 }}
          transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
          className="text-6xl mb-6"
        >
          🔄
        </motion.div>
        <h1 className="text-4xl font-black mb-3">Joining Game...</h1>
        <p className="opacity-80">Redirecting to join screen</p>
      </Card>
    </main>
  );
}
