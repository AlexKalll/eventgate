"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { signIn, getSession, signOut } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-gray-50">
          <div className="container mx-auto px-4 py-10 lg:px-8">
            <div className="mx-auto h-96 w-full max-w-md animate-pulse border border-gray-200 bg-white" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const verified = searchParams.get("verified");

  // Show verification success/failure message
  useEffect(() => {
    if (verified === "1") {
      setSuccessMessage("Email verified successfully! You can now sign in.");
    } else if (verified === "0") {
      setError("Verification failed or link expired. Please try again.");
    }
  }, [verified]);

  const getRolesWithRetry = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rolesRes = await fetch("/api/roles", { cache: "no-store" });
        if (!rolesRes.ok) throw new Error("roles fetch failed");
        const roles = await rolesRes.json();
        const systemRoles: string[] = Array.isArray(roles?.systemRoles)
          ? roles.systemRoles
          : [];
        const clubRoles: string[] = Array.isArray(roles?.clubRoles)
          ? roles.clubRoles
          : [];
        return { systemRoles, clubRoles };
      } catch {
        // Small backoff in case session cookie/roles query lags behind.
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    return { systemRoles: [] as string[], clubRoles: [] as string[] };
  };

  const extractSessionUser = (sessionData: unknown) => {
    if (!sessionData || typeof sessionData !== "object") return null;
    const root = sessionData as Record<string, unknown>;
    if (root.user && typeof root.user === "object") {
      return root.user as Record<string, unknown>;
    }
    if (root.session && typeof root.session === "object") {
      const nestedUser = (root.session as Record<string, unknown>).user;
      if (nestedUser && typeof nestedUser === "object") {
        return nestedUser as Record<string, unknown>;
      }
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    let succeeded = false;
    try {
      const result = await signIn.email({ email, password });

      // Check for errors in the result
      if (result.error) {
        // Check if user exists but is unverified
        try {
          const checkRes = await fetch("/api/auth/check-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const checkData = await checkRes.json();

          if (checkData.exists && !checkData.verified) {
            // User exists but not verified - redirect to verify page
            await signOut().catch(() => {});
            router.push("/verify?email=" + encodeURIComponent(email));
            return;
          }
        } catch {}

        setError("Invalid email or password.");
        return;
      }

      // Check session to decide where to go
      const res = await getSession();
      const data = "data" in res ? res.data : null;
      const user = extractSessionUser(data);
      const emailVerified = Boolean(user?.emailVerified);

      if (emailVerified) {
        const { systemRoles, clubRoles } = await getRolesWithRetry();

        if (systemRoles.includes("ADMIN")) {
          router.push("/admin");
          succeeded = true;
          return;
        }

        if (systemRoles.includes("STUDENT_UNION")) {
          router.push("/student-union");
          succeeded = true;
          return;
        }

        if (systemRoles.includes("DIRECTOR")) {
          router.push("/director");
          succeeded = true;
          return;
        }

        if (clubRoles.includes("VP")) {
          router.push("/vp");
          succeeded = true;
          return;
        }

        if (clubRoles.includes("SECRETARY")) {
          router.push("/secretary");
          succeeded = true;
          return;
        }

        if (clubRoles.includes("PRESIDENT")) {
          router.push("/president");
          succeeded = true;
          return;
        }

        if (redirectParam) {
          router.push(redirectParam);
          succeeded = true;
          return;
        }

        router.push("/president");
        succeeded = true;
      } else if (user) {
        await signOut();
        router.push("/verify?email=" + encodeURIComponent(email));
      } else {
        setError("Invalid email or password.");
      }
    } catch {
      // Check if user exists but is unverified
      try {
        const checkRes = await fetch("/api/auth/check-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const checkData = await checkRes.json();

        if (checkData.exists && !checkData.verified) {
          // User exists but not verified - redirect to verify page
          await signOut().catch(() => {});
          router.push("/verify?email=" + encodeURIComponent(email));
          return;
        }
      } catch {}

      // Use a generic error to avoid revealing whether the user exists
      setError("Invalid email or password.");
    } finally {
      if (!succeeded) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-svh bg-gray-50">
      <div className="container mx-auto px-4 py-10 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-5 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Sign In</h1>
            <p className="mt-1 text-sm text-gray-500">
              Access your EventGate dashboard.
            </p>
          </div>
          <Card className="shadow-none border border-gray-200 rounded-none">
            <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="
                focus-visible:ring-0 rounded-none shadow-none
                "
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  className=" outline-none focus-visible:ring-0 rounded-none shadow-none"
                  id="password"
                  type="password"
                  required
                  value={password}
                  placeholder="*******"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {successMessage && (
                <p className="text-sm text-emerald-600">{successMessage}</p>
              )}
              <Button
                type="submit"
                className="w-full cursor-pointer rounded-none bg-[var(--aau-blue)] hover:bg-[var(--aau-blue)]/90"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
              <div className="text-center text-sm text-gray-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/sign-up"
                  className="underline underline-offset-4 text-[var(--aau-blue)] hover:text-[var(--aau-blue)]/80"
                >
                  Sign up
                </Link>
              </div>
            </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
