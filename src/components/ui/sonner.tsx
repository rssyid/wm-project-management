"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toast sonner tanpa theme provider: aplikasi hanya mode terang (rule 35 §1), jadi tidak
 * perlu next-themes. Warna mengikuti token yang sudah ada di globals.css.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      // Default sonner adalah 4000 ms; notifikasi internal ini dibiarkan agak lebih lama
      // agar sempat dibaca sebelum hilang.
      duration={6000}
      toastOptions={{
        closeButtonAriaLabel: "Tutup notifikasi",
        classNames: {
          toast: "border border-line bg-panel text-ink",
          description: "text-ink-muted",
          actionButton: "bg-canal text-white",
          cancelButton: "bg-surface text-ink-muted",
        },
      }}
    />
  );
}
