"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  PROJECT_STATUS_LABEL,
  type ProjectStatus,
} from "@/shared/project-status";

export type NextAction = {
  key: string;
  label: string;
  method: "POST" | "PUT" | "PATCH";
  path: string;
  body?: unknown;
};

type Prerequisite = { label: string; done: boolean };

type Props = {
  status: ProjectStatus;
  prerequisites: Prerequisite[];
  actions: NextAction[];
  onAddWorkItem?: () => void;
};

/**
 * docs/05 §6: panel "Langkah berikutnya" berisi aksi utama beserta prasyarat yang belum
 * terpenuhi. Aksi nonaktif menampilkan alasannya sebagai daftar prasyarat.
 */
export function NextSteps({
  status,
  prerequisites,
  actions,
  onAddWorkItem,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const blocked = prerequisites.filter((item) => !item.done);

  async function run(action: NextAction) {
    if (action.key === "add-work-item") {
      if (onAddWorkItem) {
        onAddWorkItem();
        return;
      }
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(action.path, {
        method: action.method,
        headers: { "content-type": "application/json" },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        toast.error(body.error?.message ?? "Aksi gagal dijalankan.");
        return;
      }
      toast.success(action.label);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="next-step"
      className="mb-6 rounded-lg border bg-panel p-4"
    >
      <h2 id="next-step" className="text-base font-semibold">
        Langkah berikutnya
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Status proyek: {PROJECT_STATUS_LABEL[status]}
      </p>

      {blocked.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          {blocked.map((item) => (
            <li key={item.label}>{item.label}</li>
          ))}
        </ul>
      ) : null}

      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.key}
              disabled={busy || blocked.length > 0}
              onClick={() => run(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
