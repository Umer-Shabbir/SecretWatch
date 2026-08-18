"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export default function AdminSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("admin-credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/admin");
  }

  return (
    <AuthCard>
      <p className="text-xl font-semibold text-fg-default">SecretWatch</p>
      <p className="text-center text-base font-semibold text-fg-default">Admin sign in</p>

      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!!error}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={!!error}
        />
        <Button type="submit" loading={loading}>
          Sign in
        </Button>
      </form>

      <Link href="/" className="text-xs font-medium text-accent-fg hover:underline">
        Back to home
      </Link>
    </AuthCard>
  );
}
