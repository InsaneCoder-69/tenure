'use client';

import { useState, useRef, useEffect } from 'react';

interface UnlockModalProps {
  onClose: () => void;
}

export default function UnlockModal({ onClose }: UnlockModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    const url = new URL(window.location.href);
    url.searchParams.set('passphrase', passphrase.trim());
    window.location.href = url.toString();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-orange-400 text-base">⚡</span>
          <h2 className="text-zinc-100 font-semibold text-base">Switch to Live Mode</h2>
        </div>
        <p className="text-zinc-500 text-sm mb-5">
          Live mode enables real Qwen3 + Hindsight calls and is rate-limited.
          Enter the team passphrase to proceed.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Team passphrase"
            autoComplete="off"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder:text-zinc-600 text-sm font-mono focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!passphrase.trim()}
              className="px-4 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-100 rounded-lg transition-colors font-medium"
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
