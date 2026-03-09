"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import { signUp, getSession, signOut } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"club_lead" | "reviewer">("club_lead");
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedRole, setSelectedRole] = useState<
    "PRESIDENT" | "VP" | "SECRETARY" | ""
  >("");
  const router = useRouter();
  const rawSignupContact = process.env.NEXT_PUBLIC_SIGNUP_CONTACT;
  const signupContact = rawSignupContact
    ? rawSignupContact
        .replace(/\r?\n/g, " ")
        .replace(/^\s*['"]|['"]\s*$/g, "")
        .trim()
    : "";
  const passwordsMatch = password.length > 0 && password === repeatPassword;
  const passwordTooShort = password.length > 0 && password.length < 8;
  const showMismatch = repeatPassword.length > 0 && !passwordsMatch;
  const signUpEmail = signUp.email as (payload: {
    email: string;
    password: string;
    name: string;
    clubId?: string;
    clubRole?: "PRESIDENT" | "VP" | "SECRETARY";
    phoneNumber?: string;
  }) => Promise<{ error?: { message?: string } }>;
  const getErrorMessage = (err: unknown) => {
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      const direct = typeof e.message === "string" ? e.message : null;
      const nestedData =
        e.data && typeof e.data === "object"
          ? (e.data as Record<string, unknown>)
          : null;
      const nested =
        nestedData && typeof nestedData.message === "string"
          ? nestedData.message
          : null;
      return nested || direct || "Something went wrong";
    }
    return "Something went wrong";
  };

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/public/clubs", {
          method: "GET",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        const list = Array.isArray(data?.clubs) ? data.clubs : [];
        setClubs(list);
        setSelectedClubId((prev) => prev || list[0]?.id || "");
        setSelectedRole((prev) => prev || "PRESIDENT");
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setClubs([]);
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordTooShort) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      // If a session exists, sign out before creating a new account (avoids 422)
      const existing = await getSession();
      const existingData = "data" in existing ? existing.data : null;
      if (existingData?.user) {
        await signOut();
      }

      if (mode === "club_lead") {
        if (!selectedClubId) {
          setError("Please select your club.");
          return;
        }
        if (!selectedRole) {
          setError("Please select your role.");
          return;
        }
      }

      const result = await signUpEmail({
        email,
        password,
        name: fullName,
        ...(mode === "club_lead"
          ? {
              clubId: selectedClubId,
              clubRole: selectedRole,
              phoneNumber: phoneNumber || undefined,
            }
          : {}),
      });

      // Check if signup failed or returned an error
      if (result.error) {
        const errorMessage = result.error.message || "Something went wrong";
        if (
          /restricted|not registered|not allowed|club leads must select|does not match|select their club/i.test(
            errorMessage,
          )
        ) {
          setError(
            signupContact ? `${errorMessage} ${signupContact}` : errorMessage,
          );
          return;
        }
        if (/already|exists|registered|duplicate/i.test(errorMessage)) {
          // Check if user is verified or not via API
          try {
            const checkRes = await fetch("/api/auth/check-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const checkData = await checkRes.json();

            if (checkData.exists && !checkData.verified) {
              // User exists but not verified - redirect to verify page
              router.push("/verify?email=" + encodeURIComponent(email));
              return;
            }
          } catch {}

          // User exists and is verified
          setError(
            "An account with this email already exists. Please login instead.",
          );
          return;
        }
        setError(errorMessage);
        return;
      }

      // Immediately clear any session created by sign-up; verification required first
      try {
        await signOut();
      } catch {}

      // Trigger verification email
      try {
        await fetch("/api/verify/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch {}

      // Redirect to verification page
      router.push("/verify?email=" + encodeURIComponent(email));
    } catch (err: unknown) {
      // Surface better-auth error response when available
      const message = getErrorMessage(err);
      if (
        /restricted|not registered|not allowed|club leads must select|does not match|select their club/i.test(
          message,
        )
      ) {
        setError(signupContact ? `${message} ${signupContact}` : message);
        return;
      }
      if (/already|exists|registered|duplicate/i.test(message)) {
        // Check if user is verified or not
        try {
          const checkRes = await fetch("/api/auth/check-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const checkData = await checkRes.json();

          if (checkData.exists && !checkData.verified) {
            // User exists but not verified - redirect to verify page
            router.push("/verify?email=" + encodeURIComponent(email));
            return;
          }
        } catch {}

        setError(
          "An account with this email already exists. Please login instead.",
        );
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* ---- shared form fields ---- */
  const sharedFields = (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`fullName-${mode}`}>Full Name</Label>
        <Input
          id={`fullName-${mode}`}
          type="text"
          placeholder="Name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="focus-visible:ring-0 rounded-none shadow-none"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`email-${mode}`}>Email</Label>
        <Input
          id={`email-${mode}`}
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="focus-visible:ring-0 rounded-none shadow-none"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`password-${mode}`}>Password</Label>
        <Input
          id={`password-${mode}`}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="focus-visible:ring-0 rounded-none shadow-none"
        />
        {passwordTooShort && (
          <p className="text-xs text-destructive">
            Password must be at least 8 characters.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`repeat-password-${mode}`}>Confirm Password</Label>
        <Input
          id={`repeat-password-${mode}`}
          type="password"
          required
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
          className="focus-visible:ring-0 rounded-none shadow-none"
        />
        {showMismatch && (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        )}
        {passwordsMatch && repeatPassword.length > 0 && (
          <p className="text-xs text-emerald-600"></p>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-svh bg-gray-50">
      <div className="container mx-auto px-4 py-10 lg:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-5 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">
              Create Account
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Register to submit or review university event proposals.
            </p>
          </div>
        {/* Mode selector tabs at the top */}
        <div className="grid grid-cols-2 mb-6 border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setMode("club_lead")}
            className={
              mode === "club_lead"
                ? "h-10 text-sm font-medium text-[var(--aau-blue)] border-b-2 border-[var(--aau-blue)] bg-blue-50/40"
                : "h-10 text-sm text-gray-500 border-b border-gray-200 bg-white"
            }
          >
            Club Lead
          </button>
          <button
            type="button"
            onClick={() => setMode("reviewer")}
            className={
              mode === "reviewer"
                ? "h-10 text-sm font-medium text-[var(--aau-blue)] border-b-2 border-[var(--aau-blue)] bg-blue-50/40"
                : "h-10 text-sm text-gray-500 border-b border-gray-200 bg-white"
            }
          >
            Reviewer
          </button>
        </div>

        {/* Club Lead Card */}
        {mode === "club_lead" && (
          <Card className="rounded-none shadow-none border border-gray-200">
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid gap-1">
                  <CardTitle className="text-lg">Club Lead Sign Up</CardTitle>
                  <CardDescription className="text-xs">
                    Register as a club president, vice president, or secretary.
                  </CardDescription>
                </div>

                {sharedFields}

                {/* Phone Number — club leads only */}
                <div className="grid gap-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+251 9XX XXX XXX"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="focus-visible:ring-0 rounded-none shadow-none"
                  />
                </div>

                {/* Club selection */}
                <div className="grid gap-2">
                  <Label htmlFor="clubId">Club</Label>
                  <select
                    id="clubId"
                    required
                    value={selectedClubId}
                    onChange={(e) => setSelectedClubId(e.target.value)}
                    className="h-9 w-full border border-border bg-background px-3 text-sm rounded-none focus-visible:outline-none focus-visible:ring-0"
                  >
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role selection */}
                <div className="grid gap-2">
                  <Label htmlFor="clubRole">Role</Label>
                  <select
                    id="clubRole"
                    required
                    value={selectedRole}
                    onChange={(e) =>
                      setSelectedRole(e.target.value as typeof selectedRole)
                    }
                    className="h-9 w-full border border-border bg-background px-3 text-sm rounded-none focus-visible:outline-none focus-visible:ring-0"
                  >
                    <option value="PRESIDENT">President</option>
                    <option value="VP">Vice President</option>
                    <option value="SECRETARY">Secretary</option>
                  </select>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="w-full cursor-pointer rounded-none bg-[var(--aau-blue)] hover:bg-[var(--aau-blue)]/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
                <div className="text-center text-sm text-gray-500">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="underline underline-offset-4 text-[var(--aau-blue)] hover:text-[var(--aau-blue)]/80"
                  >
                    Sign in
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Reviewer Card */}
        {mode === "reviewer" && (
          <Card className="rounded-none shadow-none border border-gray-200">
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid gap-1">
                  <CardTitle className="text-lg">Reviewer Sign Up</CardTitle>
                  <CardDescription className="text-xs">
                    If you are student union or Director assigned by the admin
                    you can create your account.
                  </CardDescription>
                </div>

                {sharedFields}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="w-full cursor-pointer rounded-none bg-[var(--aau-blue)] hover:bg-[var(--aau-blue)]/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
                <div className="text-center text-sm text-gray-500">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="underline underline-offset-4 text-[var(--aau-blue)] hover:text-[var(--aau-blue)]/80"
                  >
                    Sign in
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
