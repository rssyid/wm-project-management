import type { ReactNode } from "react";

type EmptyStateProps = {
  message: string;
  action?: ReactNode;
};

// Rule 05 #17: one sentence plus the relevant action, no illustration.
export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-8 md:items-center">
      <p className="text-ink-muted">{message}</p>
      {action}
    </div>
  );
}
