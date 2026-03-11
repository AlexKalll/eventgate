"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { MenuIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { signOut, useSession } from "@/lib/auth-client";

function isActive(pathname: string, href: string) {
  if (href === "/admin/clubs") {
    return pathname === "/admin" || pathname === "/admin/clubs";
  }
  return pathname === href;
}

export function AdminHeader({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { data: session, isPending } = useSession();

  const currentSessionEmail = session?.user?.email || userEmail;

  React.useEffect(() => {
    if (!isPending && session === null) {
      router.push("/");
    }
  }, [session, isPending, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
    }
  };

  return (
    <header role="banner" className="sticky top-0 z-30 w-full">
      <div className="w-full text-gray-900 bg-white border-b border-gray-200">
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
              href="/admin/clubs"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/admin/clubs")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              Clubs
              {isActive(pathname, "/admin/clubs") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
            <Link
              href="/admin/clubs/new"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/admin/clubs/new")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              Add Club
              {isActive(pathname, "/admin/clubs/new") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
            <Link
              href="/admin/system-roles"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/admin/system-roles")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              System Roles
              {isActive(pathname, "/admin/system-roles") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
            <Link
              href="/admin/users"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/admin/users")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              Users
              {isActive(pathname, "/admin/users") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
            <Link
              href="/admin/locations"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/admin/locations")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              Locations
              {isActive(pathname, "/admin/locations") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
          </nav>

          <div className="flex items-center gap-2 justify-end">
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  className="hidden md:inline-flex h-9 px-3 gap-2 text-gray-700 border-none bg-white hover:bg-white"
                  aria-label="Open account menu"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="fixed right-4 top-16 left-auto bottom-auto w-[18rem] max-w-[calc(100%-2rem)] translate-x-0 translate-y-0 rounded-none p-0">
                <div className="flex flex-col">
                  <div
                    className="px-5 py-4 text-white"
                    style={{ backgroundColor: "var(--aau-blue)" }}
                  >
                    <DialogTitle className="text-sm font-semibold tracking-wide">
                      Account
                    </DialogTitle>
                    <div className="mt-1.5 text-xs text-white/70 truncate">
                      {currentSessionEmail}
                    </div>
                  </div>

                  <div className="border-t border-border p-2">
                    <Button
                      onClick={() => {
                        setAccountOpen(false);
                        handleSignOut();
                      }}
                      variant="outline"
                      className="h-10 w-full rounded-none gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  className="md:hidden h-9 w-9 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200"
                  aria-label="Open admin menu"
                >
                  <MenuIcon className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="fixed right-0 top-0 left-auto bottom-0 h-dvh w-[20rem] max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 rounded-none p-0 sm:max-w-[20rem]">
                <div className="flex h-full flex-col">
                  <div className="border-b border-gray-200 bg-white px-4 py-4 text-gray-900">
                    <DialogTitle className="text-sm font-semibold tracking-wide">
                      Menu
                    </DialogTitle>
                    <div className="mt-1 text-xs text-gray-500 truncate">
                      {currentSessionEmail}
                    </div>
                  </div>

                  <nav aria-label="Admin navigation" className="flex-1 p-2">
                    <Link
                      href="/admin/clubs"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/admin/clubs")
                            ? "default"
                            : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Clubs
                      </Button>
                    </Link>
                    <Link
                      href="/admin/clubs/new"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/admin/clubs/new")
                            ? "default"
                            : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Add Club
                      </Button>
                    </Link>
                    <Link
                      href="/admin/system-roles"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/admin/system-roles")
                            ? "default"
                            : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        System Roles
                      </Button>
                    </Link>
                    <Link
                      href="/admin/users"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/admin/users")
                            ? "default"
                            : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Users
                      </Button>
                    </Link>
                    <Link
                      href="/admin/locations"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/admin/locations")
                            ? "default"
                            : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Locations
                      </Button>
                    </Link>
                  </nav>

                  <div className="border-t border-gray-200 p-3">
                    <Button
                      onClick={() => {
                        setMenuOpen(false);
                        handleSignOut();
                      }}
                      variant="outline"
                      className="h-10 w-full rounded-none gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </header>
  );
}
