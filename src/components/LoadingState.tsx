/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function LoadingState({ message = 'Carregando dados...' }: { message?: string }) {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Skeleton cards */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-16 bg-surface-container rounded-xl border border-outline-variant/20"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
      <p className="text-center text-[10px] uppercase tracking-[0.3em] text-on-surface-variant/30 font-bold pt-4">
        {message}
      </p>
    </div>
  );
}
