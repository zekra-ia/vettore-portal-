export function Wordmark({ parts, className = '' }: { parts: string[]; className?: string }) {
  const [a, b] = parts;
  return <span className={`wordmark ${className}`} aria-label={parts.join('')}><b>{a}</b><span>{b}</span></span>;
}

export { PoweredBy } from './PoweredBy';
