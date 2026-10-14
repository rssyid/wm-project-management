import { hashPassword, verifyPassword } from "better-auth/crypto";

/**
 * docs/02 §7: Super Admin membuat user dan mengatur password sementara, jadi aplikasi
 * perlu membuat dan mengganti hash di luar alur Better Auth.
 */
export { hashPassword, verifyPassword };
