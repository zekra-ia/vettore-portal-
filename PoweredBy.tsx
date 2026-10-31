'use client';
import { useState } from 'react';

/** "Powered by ZEKRA IA" — ZEKRA simgesiyle birlikte; simge dosyası yoksa yalnızca yazı görünür. */
export function PoweredBy({ className = '' }: { className?: string }) {
  const [logo, setLogo] = useState(true);
  return (
    <p className={`text-xs text-muted inline-flex items-center gap-1.5 ${className}`}>
      Powered by
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/zekra-logo.png" alt="" width={18} height={18} className="h-[18px] w-auto rounded-[3px]" onError={() => setLogo(false)} />
      )}
      <span><span className="font-semibold text-[#1E6FD9]">ZEKRA</span> <span className="font-semibold text-ink">IA</span></span>
    </p>
  );
}
