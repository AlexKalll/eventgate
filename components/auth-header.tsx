"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { signOut, useSession } from "@/lib/auth-client";

function isActive(pathname: string, href: string) {
  return pathname === href;
}

export function AuthHeader({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session, isPending } = useSession();

  const currentSessionEmail = session?.user?.email || userEmail;

  // Don't hide header while session is loading - this prevents flicker during auth
  // Only hide header when session is fully loaded AND we're not on auth pages
  const isAuthPage = pathname === "/login" || pathname === "/sign-up";
  if (currentSessionEmail && !isPending && !isAuthPage) {
    return null;
  }

  // On auth pages, hide authenticated elements (email, sign out) so the header
  // doesn't flash to authenticated state before redirect completes
  const showAuthenticatedUI = currentSessionEmail && !isAuthPage;

  // Don't auto-redirect on auth pages - let users see the login/signup forms
  // React.useEffect(() => {
  //   if (session === null) {
  //     router.push("/");
  //   }
  // }, [session, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } finally {
      // Let useEffect handle redirect after session clears
    }
  };

  return (
    <header role="banner" className="sticky top-0 z-30 w-full">
      <div className="w-full bg-white text-gray-900 border-b border-gray-200">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-2 lg:px-8">
          <div className="flex items-center min-w-0">
            <Link href="/" className="flex items-center gap-3 group min-w-0">
              <img
                src="/aauLogo.png"
                alt="AAU Logo"
                className="h-12 w-auto object-contain"
              />
              <div className="h-10 w-0.5 mx-1 bg-cyan-700" />
              <div className="min-w-0">
                <div className="font-bold text-lg sm:text-xl tracking-wide leading-tight">
                  EventGate
                </div>
                <div className="text-[11px] sm:text-xs text-gray-500 tracking-wider uppercase">
                  Addis Ababa University
                </div>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex flex-1 items-center justify-center gap-2">
            <Link
              href="/login"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/login")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              Sign In
              {isActive(pathname, "/login") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
            <Link
              href="/sign-up"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/sign-up")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              Create Account
              {isActive(pathname, "/sign-up") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {showAuthenticatedUI && (
              <div className="hidden lg:block text-xs text-gray-500 truncate max-w-md">
                {currentSessionEmail}
              </div>
            )}
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  className="md:hidden h-9 w-9 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200"
                  aria-label="Open auth menu"
                >
                  <MenuIcon className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="fixed right-0 top-0 left-auto bottom-0 h-dvh w-[20rem] max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 rounded-none p-0 sm:max-w-[20rem]">
                <div className="flex h-full flex-col">
                  <div
                    className="border-b border-border px-4 py-4 text-white"
                    style={{ backgroundColor: "var(--aau-blue)" }}
                  >
                    <DialogTitle className="text-sm font-semibold tracking-wide">
                      Auth Menu
                    </DialogTitle>
                    {showAuthenticatedUI && (
                      <div className="mt-1 text-xs text-white/80 truncate">
                        {currentSessionEmail}
                      </div>
                    )}
                  </div>

                  <nav aria-label="Auth navigation" className="flex-1 p-2">
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/login") ? "default" : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Sign In
                      </Button>
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/sign-up") ? "default" : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Create Account
                      </Button>
                    </Link>
                  </nav>

                  {showAuthenticatedUI && (
                    <div className="border-t border-border p-3">
                      <Button
                        onClick={() => {
                          setMenuOpen(false);
                          handleSignOut();
                        }}
                        className="h-10 w-full rounded-none"
                      >
                        Sign out
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            {showAuthenticatedUI && (
              <Button
                onClick={handleSignOut}
                variant="secondary"
                className="hidden md:inline-flex h-9 border-none bg-white text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
