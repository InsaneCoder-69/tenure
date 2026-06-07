'use client';

import type { AppMode } from '@/types';

interface ModeBarProps {
  mode: AppMode;
  onUnlockClick: () => void;
}

export default function ModeBar({ mode, onUnlockClick }: ModeBarProps) {
  const isLive = mode === 'live';

  return (
    <header className="flex items-center justify-between px-5 h-12 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <span className="font-semibold text-zinc-100 tracking-tight">Tenure</span>
        <span className="hidden sm:block text-zinc-600 text-xs font-mono">
          AI code reviewer that earns trust
        </span>
      </div>

      {/* Mode badge + unlock */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md border select-none ${
            isLive
              ? 'text-orange-400 bg-orange-950/50 border-orange-800/60'
              : 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60'
          }`}
        >
          {isLive ? '⚡ LIVE' : '▶ REPLAY'}
        </span>

        {!isLive && (
          <button
            onClick={onUnlockClick}
            title="Switch to Live Mode"
            aria-label="Switch to Live Mode"
            className="text-zinc-700 hover:text-zinc-400 transition-colors p-1 rounded"
          >
            {/* lock icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
        )}

        {isLive && (
          <a
            href="/"
            title="Back to Replay Mode"
            className="text-zinc-700 hover:text-zinc-400 transition-colors p-1 rounded"
          >
            {/* x icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </a>
        )}
      </div>
    </header>
  );
}
