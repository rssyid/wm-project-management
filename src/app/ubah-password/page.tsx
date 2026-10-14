import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getSessionUser } from "@/infra/session";

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm rounded-lg border bg-panel p-6">
        <h1 className="mb-1 text-xl font-semibold text-ink">Ganti password</h1>
        <p className="mb-6 text-dense text-ink-muted">
          Password ini dipakai sementara. Buat password baru sebelum masuk
          aplikasi.
        </p>
        <Suspense fallback={null}>
          <PasswordGate />
        </Suspense>
      </div>
    </main>
  );
}

// docs/05 §3: setelah login harus ganti password dulu bila akun baru atau di-reset.
async function PasswordGate() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/dashboard");

  return <ChangePasswordForm />;
}
