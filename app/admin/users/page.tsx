"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useConfirmation } from "@/components/ui/confirmation-card";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  roles: string[];
};

type UsersCacheEntry = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  timestamp: number;
};

const USERS_CACHE_TTL_MS = 60_000;
const usersCache = new Map<string, UsersCacheEntry>();

const cacheKey = (page: number, query: string) =>
  `${page}::${query.trim().toLowerCase()}`;

const getFreshCache = (page: number, query: string) => {
  const key = cacheKey(page, query);
  const entry = usersCache.get(key);
  if (!entry) return null;
  return Date.now() - entry.timestamp < USERS_CACHE_TTL_MS ? entry : null;
};

const setUsersCache = (
  page: number,
  query: string,
  data: Omit<UsersCacheEntry, "timestamp">,
) => {
  usersCache.set(cacheKey(page, query), {
    ...data,
    timestamp: Date.now(),
  });
};

const clearUsersCache = () => usersCache.clear();

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(!Boolean(getFreshCache(1, "")));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const { requestConfirmation, ConfirmationComponent } = useConfirmation();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isAbortError = (e: unknown) => {
    if (!e) return false;
    if (
      typeof e === "object" &&
      "name" in e &&
      (e as any).name === "AbortError"
    ) {
      return true;
    }
    const msg =
      typeof e === "object" && e && "message" in e
        ? String((e as any).message)
        : "";
    return msg.toLowerCase().includes("abort");
  };

  const refresh = async (
    pageOverride?: number,
    queryOverride?: string,
    opts?: { force?: boolean },
  ) => {
    const pageToUse = pageOverride ?? page;
    const queryToUse = (queryOverride ?? query).trim();

    const cached = !opts?.force && getFreshCache(pageToUse, queryToUse);
    if (cached) {
      setUsers(cached.users);
      setTotal(cached.total);
      setPage(cached.page);
      setPageSize(cached.pageSize);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/admin/users?page=${pageToUse}&q=${encodeURIComponent(
          queryToUse,
        )}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error("Failed to load users");
      const json = await res.json();
      const nextUsers = json.users || [];
      const nextTotal = json.total || 0;
      const nextPage = json.page || pageToUse;
      const nextPageSize = json.pageSize || 20;

      setUsers(nextUsers);
      setTotal(nextTotal);
      setPage(nextPage);
      setPageSize(nextPageSize);

      setUsersCache(pageToUse, queryToUse, {
        users: nextUsers,
        total: nextTotal,
        page: nextPage,
        pageSize: nextPageSize,
      });
    } catch (e) {
      if (isAbortError(e)) return;
      throw e;
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cached = getFreshCache(1, "");
        if (cached) {
          setUsers(cached.users);
          setTotal(cached.total);
          setPage(cached.page);
          setPageSize(cached.pageSize);
        }

        await refresh(1, "", { force: !cached });
        setInitialLoaded(true);
      } catch (e: any) {
        if (!isAbortError(e)) {
          setError(e?.message || "Failed to load users");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialLoaded) return;

    const handle = setTimeout(async () => {
      setIsRefetching(true);
      setMessage(null);
      setError(null);
      try {
        await refresh(1, query);
      } catch (e: any) {
        if (!isAbortError(e)) {
          setError(e?.message || "Failed to load users");
        }
      } finally {
        setIsRefetching(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query, initialLoaded]);

  useEffect(() => {
    if (!message && !error) return;
    setToastOpen(true);
    const handle = setTimeout(() => setToastOpen(false), 4000);
    return () => clearTimeout(handle);
  }, [message, error]);

  const goToPage = async (nextPage: number) => {
    setMessage(null);
    setError(null);
    setIsRefetching(true);
    try {
      await refresh(nextPage);
    } finally {
      setIsRefetching(false);
    }
  };

  const deleteUser = async (u: AdminUser) => {
    const confirmed = await requestConfirmation(
      "Delete User",
      `Delete user ${u.email}? This will remove their sessions/accounts too.`,
      () => {},
      { variant: "destructive", confirmText: "Delete", cancelText: "Cancel" },
    );
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setIsRefetching(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message || "Failed to delete user");
        return;
      }

      setMessage("User deleted.");
      const nextPage = users.length === 1 ? Math.max(1, page - 1) : page;
      clearUsersCache();
      await refresh(nextPage, query, { force: true });
    } finally {
      setIsRefetching(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 grid gap-6 animate-pulse">
        <Card className="rounded-none">
          <CardHeader className="space-y-2">
            <div className="h-5 w-24 bg-gray-200 rounded" />
            <div className="h-10 w-72 bg-gray-100 rounded" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={`users-skeleton-${idx}`} className="h-14 bg-gray-100 rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 grid gap-6">
      <ConfirmationComponent />

      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="q">Search (email or name)</Label>
            <Input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="user@school.edu or John"
            />
          </div>

          <div
            className={`grid gap-2 text-sm text-muted-foreground ${
              isRefetching ? "opacity-60 transition-opacity" : ""
            }`}
          >
            <div className="font-medium text-foreground">All users</div>
            {users.length === 0 && <div>No users found.</div>}
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-2 border border-border/50 p-3 md:flex-row md:items-center md:gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {u.email}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.name}
                    {u.roles?.length ? (
                      <>
                        <span className="mx-1">·</span>
                        <span>[{u.roles.join(", ")}]</span>
                      </>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {u.emailVerified ? "Verified" : "Not verified"} · Created{" "}
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    aria-label={`Delete ${u.email}`}
                    title={`Delete ${u.email}`}
                    onClick={() => deleteUser(u)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pt-2 border-t border-border/60">
              <div className="text-xs text-muted-foreground">
                Showing {users.length ? (page - 1) * pageSize + 1 : 0}-
                {(page - 1) * pageSize + users.length} of {total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  onClick={() => goToPage(page + 1)}
                  disabled={(page - 1) * pageSize + users.length >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {(message || error) && toastOpen && (
        <div
          className="fixed bottom-4 right-4 z-50 w-88 max-w-[calc(100vw-2rem)]"
          role="status"
          aria-live={error ? "assertive" : "polite"}
        >
          <div
            className={
              error
                ? "border border-destructive/30 bg-background"
                : "border border-border bg-background"
            }
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div
                  className={
                    error
                      ? "text-sm font-medium text-destructive"
                      : "text-sm font-medium text-foreground"
                  }
                >
                  {error ? "Action failed" : "Update"}
                </div>
                <div
                  className={
                    error
                      ? "mt-1 text-sm text-destructive/90"
                      : "mt-1 text-sm text-muted-foreground"
                  }
                >
                  {error || message}
                </div>
              </div>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                aria-label="Dismiss"
                onClick={() => setToastOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
