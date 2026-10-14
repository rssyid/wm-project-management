import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

// useSearchParams butuh Suspense agar halaman tetap bisa di-prerender.
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm rounded-lg border bg-panel p-6">
        <h1 className="mb-1 text-xl font-semibold text-ink">
          WM Project Management
        </h1>
        <p className="mb-6 text-dense text-ink-muted">
          Masuk dengan akun yang diberikan Super Admin.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
