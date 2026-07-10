import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

export function Starfield({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`min-h-full gradient-cosmos starfield relative ${className}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CosmicCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-cosmic rounded-3xl p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Mascot({ animal = 'fox', size = 'lg', message }: { animal?: keyof typeof import('../lib/cosmicTheme').ANIMALS; size?: 'sm' | 'lg'; message?: string }) {
  const emojis: Record<string, string> = { fox: '🦊', cat: '🐱', bunny: '🐰', owl: '🦉', panda: '🐼' };
  const sizeClass = size === 'lg' ? 'text-6xl' : 'text-3xl';
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.span
        className={`${sizeClass} animate-float inline-block`}
        role="img"
        aria-label="mascot"
      >
        {emojis[animal]}
      </motion.span>
      {message && (
        <p className="text-sm text-white/70 text-center max-w-xs italic">&ldquo;{message}&rdquo;</p>
      )}
    </div>
  );
}

export function PlanetProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[...Array(total)].map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-all duration-500 ${
            i < current ? 'bg-cosmos-mint shadow-[0_0_10px_rgba(0,245,196,0.5)]' : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}
