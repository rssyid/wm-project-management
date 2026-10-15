import { connection } from "next/server";

/**
 * Route handler tanpa segment dinamis akan diprerender saat build, sedangkan GET di sini selalu
 * membaca session. `connection()` adalah cara opting out di Next 16, tetapi ia melempar galat
 * ketika handler dipanggil langsung oleh integration test tanpa request scope. Hanya galat itu
 * yang diabaikan; galat lain tetap dilempar.
 */
export async function requireRuntime(): Promise<void> {
  try {
    await connection();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("outside a request scope")) throw error;
  }
}
