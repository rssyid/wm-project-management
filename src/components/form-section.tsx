import type { ReactNode } from "react";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

// Rule 35 §5: one-column forms, max 720 px, grouped by section with a 16 px title and divider.
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="max-w-[720px] border-b pb-6 not-first:pt-6 last:border-b-0">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-dense text-ink-muted">{description}</p> : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}
