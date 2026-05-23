/**
 * Logo PEAK Suplementos — 3 picos sobrepostos baseados no brand kit oficial.
 * Pico 1 (atrás, mais alto): Navy profundo #102030
 * Pico 2 (frente esquerda, médio): Teal Peak #1090B0
 * Pico 3 (frente direita, menor): Ciano #20C0D0
 */
export function PeakLogo({
  size = 32,
  variant = 'auto',
  withText = false,
}: {
  size?: number;
  variant?: 'auto' | 'white' | 'mark';
  withText?: boolean;
}) {
  const useWhiteOverride = variant === 'white';
  const navy = useWhiteOverride ? '#FFFFFF' : '#102030';
  const teal = useWhiteOverride ? 'rgba(255,255,255,0.85)' : '#1090B0';
  const ciano = useWhiteOverride ? 'rgba(255,255,255,0.6)' : '#20C0D0';

  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Peak Suplementos"
    >
      {/* Pico 1 — navy, atrás, mais alto */}
      <path d="M 6 48 L 26 8 L 42 48 Z" fill={navy} />
      {/* Pico 2 — teal, frente esquerda */}
      <path d="M 0 48 L 17 20 L 32 48 Z" fill={teal} />
      {/* Pico 3 — ciano, frente direita */}
      <path d="M 30 48 L 41 26 L 56 48 Z" fill={ciano} />
      {/* Linha de base sutil */}
      <line x1="0" y1="48" x2="60" y2="48" stroke={navy} strokeWidth="0.5" opacity="0.3" />
    </svg>
  );

  if (!withText) return svg;

  return (
    <div className="flex items-center gap-2">
      {svg}
      <div className="flex flex-col leading-none">
        <span className="text-base font-black tracking-tight text-white">PEAK</span>
        <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-primary mt-0.5">Suplementos</span>
      </div>
    </div>
  );
}
