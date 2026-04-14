"use client";

import { type ReactNode, useCallback, useState } from "react";

type CollapsibleSectionProps = {
  className?: string;
  /** false — как блоки «Подробная воронка» / «Помесячная модель» (свернуто по умолчанию) */
  defaultOpen?: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Кнопки справа в шапке (не сворачивают блок при клике) */
  headerAside?: ReactNode;
  children: ReactNode;
};

export function CollapsibleSection({
  className = "",
  defaultOpen = true,
  title,
  description,
  headerAside,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const onToggle = useCallback((e: React.SyntheticEvent<HTMLDetailsElement>) => {
    setOpen(e.currentTarget.open);
  }, []);

  return (
    <details
      className={["section-card", "details-card", className].filter(Boolean).join(" ")}
      open={open}
      onToggle={onToggle}
    >
      <summary>
        <div className="section-header collapsible-section-summary-inner">
          <div className="collapsible-section-leading">
            <div className="collapsible-section-title-inline">
              <h2>{title}</h2>
              <span className="collapsible-section-disclosure-icon" aria-hidden />
            </div>
            {description ? (
              <div className="collapsible-section-description">{description}</div>
            ) : null}
          </div>
          {headerAside ? (
            <div className="collapsible-section-aside" onClick={(e) => e.stopPropagation()}>
              {headerAside}
            </div>
          ) : null}
        </div>
      </summary>
      <div className="collapsible-section-body">{children}</div>
    </details>
  );
}
