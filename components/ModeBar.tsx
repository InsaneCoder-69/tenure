export default function ModeBar() {
  return (
    <header className="flex items-center px-5 h-12 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm shrink-0">
      <span className="font-semibold text-zinc-100 tracking-tight">Tenure</span>
      <span className="hidden sm:block ml-3 text-zinc-600 text-xs font-mono">
        AI code reviewer that earns trust
      </span>
    </header>
  );
}
