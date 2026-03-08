"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, MenuIcon, Settings } from "lucide-react";
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

export function DirectorHeader({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { data: session, isPending } = useSession();

  const currentSessionEmail = session?.user?.email || userEmail;

  React.useEffect(() => {
    if (!isPending && session === null) {
      router.push("/");
    }
  }, [isPending, session, router]);

  React.useEffect(() => {
    if (isPending || session === null) return;

    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/notifications/director?limit=10", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = await response.json();
        setUnreadCount(Number(body?.unreadCount || 0));
      } catch {}
    };

    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 20 * 1000);
    const handleNotificationsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ audience?: string }>;
      if (
        !customEvent.detail?.audience ||
        customEvent.detail.audience === "director"
      ) {
        fetchNotifications();
      }
    };
    window.addEventListener(
      "eventgate:notifications-updated",
      handleNotificationsUpdated as EventListener,
    );

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(
        "eventgate:notifications-updated",
        handleNotificationsUpdated as EventListener,
      );
    };
  }, [isPending, session]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } finally {
    }
  };

  return (
    <header role="banner" className="sticky top-0 z-30 w-full">
      <div className="w-full text-gray-900 bg-white border-b border-gray-200">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-2 lg:px-8">
          <div className="flex items-center min-w-0">
            <Link
              href="/director"
              className="flex items-center gap-3 group min-w-0"
            >
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
              href="/director"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/director")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              Review Dashboard
              {isActive(pathname, "/director") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
            <Link
              href="/director/approved"
              className={`relative inline-flex items-center h-9 px-3 text-sm font-medium transition-colors ${
                isActive(pathname, "/director/approved")
                  ? "text-[var(--aau-blue)]"
                  : "text-gray-700 hover:text-[var(--aau-blue)]"
              }`}
            >
              Reviewed Proposals
              {isActive(pathname, "/director/approved") && (
                <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--aau-blue)]" />
              )}
            </Link>
          </nav>

          <div className="flex items-center gap-2 justify-end">
            <Link href="/director/notifications" className="block">
              <Button
                variant="secondary"
                className="relative h-9 w-9 p-0 text-gray-700 border-none bg-white hover:bg-gray-100"
                aria-label="Open notifications page"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] leading-5 font-semibold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Button>
            </Link>

            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  className="hidden md:inline-flex h-9 px-3 gap-2 text-gray-700 border-none bg-white hover:bg-white"
                  aria-label="Open account settings"
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
                  aria-label="Open menu"
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

                  <nav aria-label="Director navigation" className="flex-1 p-2">
                    <Link
                      href="/director"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/director") ? "default" : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Review Dashboard
                      </Button>
                    </Link>
                    <Link
                      href="/director/approved"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/director/approved")
                            ? "default"
                            : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Reviewed Proposals
                      </Button>
                    </Link>
                    <Link
                      href="/director/notifications"
                      onClick={() => setMenuOpen(false)}
                      className="block"
                    >
                      <Button
                        variant={
                          isActive(pathname, "/director/notifications")
                            ? "default"
                            : "ghost"
                        }
                        className="h-10 w-full justify-start rounded-none"
                      >
                        Notifications
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
