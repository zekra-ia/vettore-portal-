export function Wordmark({ parts, className = '' }: { parts: string[]; className?: string }) {
  const [a, b] = parts;
  return <span className={`wordmark ${className}`} aria-label={parts.join('')}><b>{a}</b><span>{b}</span></span>;
}

export function PoweredBy({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      Powered by <span className="font-semibold text-[#1E6FD9]">ZEKRA</span> <span className="font-semibold">IA</span>
    </p>
  );
}
