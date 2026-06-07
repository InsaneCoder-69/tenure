'use client';

import { useState } from 'react';
import type { ReviewSession, ReviewComment, Convention, FeedbackState } from '@/types';
import TrustBadge from './TrustBadge';
import { TIER_CONFIG } from '@/lib/trust-tiers';

// ── feedback buttons ──────────────────────────────────────────────────────────

function FeedbackButtons({
  comment,
  state = 'idle',
  onFeedback,
}: {
  comment: ReviewComment;
  state?: FeedbackState;
  onFeedback?: (comment: ReviewComment, accepted: boolean) => void;
}) {
  if (state === 'pending') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
        <span className="inline-block w-3 h-3 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
        saving…
      </span>
    );
  }

  if (state === 'accepted') {
    return (
      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded border text-emerald-400 bg-emerald-950/40 border-emerald-800/60">
        Accepted ✓
      </span>
    );
  }

  if (state === 'rejected') {
    return (
      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded border text-rose-400 bg-rose-950/40 border-rose-800/60">
        Rejected ✗
      </span>
    );
  }

  const isReplay = !onFeedback;
  const title = isReplay ? 'Accept/Reject available in Live mode' : undefined;

  return (
    <div className="flex items-center gap-1" title={title}>
      <button
        onClick={() => onFeedback?.(comment, true)}
        disabled={isReplay}
        className="text-[11px] font-mono px-2 py-0.5 rounded border
          text-emerald-500 border-emerald-800/50 bg-emerald-950/20
          hover:bg-emerald-950/50 hover:border-emerald-700/60
          disabled:opacity-25 disabled:cursor-not-allowed
          transition-colors leading-none"
      >
        ✓ Accept
      </button>
      <button
        onClick={() => onFeedback?.(comment, false)}
        disabled={isReplay}
        className="text-[11px] font-mono px-2 py-0.5 rounded border
          text-rose-500 border-rose-800/50 bg-rose-950/20
          hover:bg-rose-950/50 hover:border-rose-700/60
          disabled:opacity-25 disabled:cursor-not-allowed
          transition-colors leading-none"
      >
        ✗ Reject
      </button>
    </div>
  );
}

// ── inline comment ────────────────────────────────────────────────────────────

function InlineComment({
  comment,
  convention,
  feedbackState,
  onFeedback,
}: {
  comment: ReviewComment;
  convention?: Convention;
  feedbackState?: FeedbackState;
  onFeedback?: (comment: ReviewComment, accepted: boolean) => void;
}) {
  const cfg = TIER_CONFIG[comment.tier];
  const borderColor =
    comment.tier === 'block' ? 'border-rose-500/70' :
    comment.tier === 'warn'  ? 'border-amber-500/70' :
                               'border-sky-500/70';

  const conventionText = convention?.text ?? null;

  return (
    <div className={`my-1 border-l-2 ${borderColor} ${cfg.bg} px-4 py-3`}>
      {/* Header: badge + convention id + feedback buttons */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <TrustBadge tier={comment.tier} size="sm" />
          {comment.conventionId && (
            <span className="text-[11px] font-mono text-zinc-500 truncate" title={comment.conventionId}>
              {comment.conventionId}
            </span>
          )}
        </div>
        <FeedbackButtons comment={comment} state={feedbackState} onFeedback={onFeedback} />
      </div>

      {/* Comment text */}
      <p className="text-sm text-zinc-200 leading-relaxed">{comment.text}</p>

      {/* Based on: convention text */}
      {conventionText && (
        <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
          <span className="text-zinc-700 font-mono">based on:</span>{' '}
          <span className="text-zinc-500 italic">
            {conventionText.length > 110
              ? conventionText.slice(0, 107) + '…'
              : conventionText}
          </span>
        </p>
      )}

      {/* Rationale */}
      {comment.rationale && (
        <p className="text-[11px] text-zinc-700 mt-1 font-mono leading-relaxed">
          {comment.rationale}
        </p>
      )}
    </div>
  );
}

// ── diff input pane (LIVE mode only) ─────────────────────────────────────────

function DiffInputPane({
  onSubmit,
  isReviewing,
  onClose,
}: {
  onSubmit: (diff: string, filePath: string) => Promise<void>;
  isReviewing: boolean;
  onClose: () => void;
}) {
  const [rawDiff, setRawDiff]   = useState('');
  const [filePath, setFilePath] = useState('');

  const handleSubmit = async () => {
    const trimmed = rawDiff.trim();
    if (!trimmed || isReviewing) return;
    await onSubmit(trimmed, filePath.trim() || 'unknown');
    onClose();
  };

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">File path</span>
        <input
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="src/components/Example.tsx"
          spellCheck={false}
          className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded px-2 py-1
            text-xs font-mono text-zinc-300 placeholder-zinc-600
            focus:outline-none focus:border-zinc-500/80
            transition-colors"
        />
      </div>

      <textarea
        value={rawDiff}
        onChange={(e) => setRawDiff(e.target.value)}
        placeholder={"Paste code or a unified diff — plain code is wrapped automatically.\n\nExample (unified diff):\n@@ -1,4 +1,5 @@\n-old line\n+new line\n context\n\nOr just paste the file contents directly."}
        spellCheck={false}
        rows={9}
        className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded px-3 py-2
          text-xs font-mono text-zinc-300 placeholder-zinc-700 leading-relaxed resize-none
          focus:outline-none focus:border-zinc-500/80
          transition-colors"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-700 font-mono">
          Plain code or unified diff — auto-detected
        </span>
        <button
          onClick={() => void handleSubmit()}
          disabled={!rawDiff.trim() || isReviewing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded
            bg-orange-600/80 hover:bg-orange-500/80
            disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed
            text-xs font-mono font-semibold text-white
            transition-colors leading-none"
        >
          {isReviewing ? (
            <>
              <span className="w-3 h-3 border border-white/40 border-t-white/90 rounded-full animate-spin" />
              Reviewing…
            </>
          ) : (
            'Review →'
          )}
        </button>
      </div>
    </div>
  );
}

// ── diff panel ────────────────────────────────────────────────────────────────

interface DiffPanelProps {
  session: ReviewSession;
  conventionMap?: Map<string, Convention>;
  feedbackStates?: Record<string, FeedbackState>;
  onFeedback?: (comment: ReviewComment, accepted: boolean) => void;
  onSubmitDiff?: (diff: string, filePath: string) => Promise<void>;
  isReviewing?: boolean;
}

export default function DiffPanel({
  session,
  conventionMap,
  feedbackStates,
  onFeedback,
  onSubmitDiff,
  isReviewing = false,
}: DiffPanelProps) {
  const [showInput, setShowInput] = useState(false);
  const commentsByLine = new Map<number, ReviewComment[]>();
  for (const c of session.comments) {
    const existing = commentsByLine.get(c.lineNo) ?? [];
    commentsByLine.set(c.lineNo, [...existing, c]);
  }

  const blockCount   = session.comments.filter((c) => c.tier === 'block').length;
  const warnCount    = session.comments.filter((c) => c.tier === 'warn').length;
  const suggestCount = session.comments.filter((c) => c.tier === 'suggest').length;
  const totalComments = session.comments.length;

  return (
    <div className="flex flex-col h-full">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-zinc-300 text-sm font-mono truncate">{session.filePath}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          {totalComments === 0 ? (
            <span className="text-xs text-zinc-600">no comments</span>
          ) : (
            <span className="text-xs text-zinc-500">
              {totalComments} comment{totalComments !== 1 ? 's' : ''}
            </span>
          )}
          {blockCount > 0 && (
            <span className="text-[11px] font-mono font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/60 px-1.5 py-px rounded">
              {blockCount} block
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-[11px] font-mono font-semibold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-1.5 py-px rounded">
              {warnCount} warn
            </span>
          )}
          {suggestCount > 0 && (
            <span className="text-[11px] font-mono font-semibold text-sky-400 bg-sky-950/40 border border-sky-800/60 px-1.5 py-px rounded">
              {suggestCount} suggest
            </span>
          )}
          {onSubmitDiff && (
            <button
              onClick={() => setShowInput((v) => !v)}
              className="text-[11px] font-mono px-2 py-0.5 rounded border
                text-zinc-400 border-zinc-700/60 bg-zinc-800/40
                hover:text-zinc-200 hover:border-zinc-600/80 hover:bg-zinc-800/80
                transition-colors leading-none"
            >
              {showInput ? '✕ close' : '↑ paste diff'}
            </button>
          )}
        </div>
      </div>

      {/* Diff input pane (LIVE mode, when toggled open) */}
      {showInput && onSubmitDiff && (
        <DiffInputPane
          onSubmit={onSubmitDiff}
          isReviewing={isReviewing}
          onClose={() => setShowInput(false)}
        />
      )}

      {/* Diff body */}
      <div className="flex-1 overflow-auto relative">
        {isReviewing && (
          <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-700/80 rounded-lg px-4 py-2.5 shadow-xl">
              <span className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-orange-400 rounded-full animate-spin" />
              <span className="text-xs text-zinc-400 font-mono">Reviewing your diff…</span>
            </div>
          </div>
        )}
        <div className="min-w-0">
          {session.diff.map((line, i) => {
            if (line.type === 'header') {
              return (
                <div key={i} className="flex items-center px-4 py-1 bg-zinc-800/40 text-zinc-500 text-xs font-mono select-none">
                  {line.content}
                </div>
              );
            }

            const bgClass =
              line.type === 'added'
                ? 'bg-emerald-950/30 hover:bg-emerald-950/50'
                : line.type === 'removed'
                ? 'bg-rose-950/30 hover:bg-rose-950/50'
                : 'hover:bg-zinc-800/20';

            const signColor =
              line.type === 'added'   ? 'text-emerald-500' :
              line.type === 'removed' ? 'text-rose-500'    :
                                        'text-zinc-700';

            const sign =
              line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

            const comments = line.lineNo ? (commentsByLine.get(line.lineNo) ?? []) : [];

            return (
              <div key={i}>
                <div className={`flex items-start text-sm font-mono group transition-colors ${bgClass}`}>
                  <span className="w-10 text-right pr-2 py-0.5 select-none text-zinc-700 text-xs shrink-0 leading-5 tabular-nums">
                    {line.oldLineNo ?? ''}
                  </span>
                  <span className="w-10 text-right pr-2 py-0.5 select-none text-zinc-700 text-xs shrink-0 leading-5 tabular-nums">
                    {line.lineNo ?? ''}
                  </span>
                  <span className={`w-5 text-center py-0.5 select-none shrink-0 leading-5 ${signColor}`}>
                    {sign}
                  </span>
                  <span className="py-0.5 pr-6 flex-1 whitespace-pre overflow-x-auto leading-5 text-zinc-200">
                    {line.content || ' '}
                  </span>
                </div>
                {comments.map((c) => (
                  <InlineComment
                    key={c.id}
                    comment={c}
                    convention={conventionMap?.get(c.conventionId)}
                    feedbackState={feedbackStates?.[c.id] ?? 'idle'}
                    onFeedback={onFeedback}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
