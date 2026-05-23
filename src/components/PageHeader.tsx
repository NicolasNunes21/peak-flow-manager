import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconGradient?: boolean;
  actions?: ReactNode;
};

/**
 * Cabeçalho padrão de página — usado em todas as telas
 * pra dar consistência visual estilo Apple.
 */
export function PageHeader({ title, subtitle, icon, iconGradient, actions }: Props) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap mb-2">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className={
              iconGradient
                ? "w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_4px_12px_-2px_hsl(192_83%_38%/0.4)] text-white shrink-0"
                : "w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-foreground shrink-0"
            }
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
