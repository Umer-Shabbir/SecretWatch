import bcrypt from "bcryptjs";

export interface AdminCandidate {
  id: string;
  role: string;
  passwordHash: string | null;
}

/**
 * Pure authorization check for admin credential sign-in, isolated from
 * Prisma/next-auth for unit testing. Never logs the password or hash.
 */
export async function verifyAdminCredentials(
  user: AdminCandidate | null,
  password: string
): Promise<boolean> {
  if (!user || user.role !== "ADMIN" || !user.passwordHash) {
    return false;
  }
  return bcrypt.compare(password, user.passwordHash);
}
