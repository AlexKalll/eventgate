"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Info,
  MessageSquare,
} from "lucide-react";

type NotificationItem = {
  id: string;
  proposalId: string;
  eventTitle: string;
  stage: "LEAD" | "STUDENT_UNION" | "DIRECTOR";
  decision: "APPROVED" | "REJECTED";
  role: string;
  comment: string | null;
  timestamp: string;
  readAt: string | null;
};

type NotificationTab = "all" | "unread" | "important" | "archived";
type Audience = "vp" | "secretary" | "student-union" | "director";

const TABS: Array<{ id: NotificationTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "important", label: "Important" },
  { id: "archived", label: "Archived" },
];

function relativeTime(input: string) {
  const now = Date.now();
  const at = new Date(input).getTime();
  const minutes = Math.max(1, Math.floor((now - at) / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function dayLabel(input: string) {
  const date = new Date(input);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  return target.toLocaleDateString();
}

export function RoleNotificationsPage({
  audience,
  backHref,
  backLabel,
}: {
  audience: Audience;
  backHref: string;
  backLabel: string;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchNotifications = async () => {
      try {
        const res = await fetch(
          `/api/notifications/${audience}?limit=100&tab=${activeTab}`,
          {
            cache: "no-store",
          },
        );
        if (!res.ok) return;
        const body = await res.json();
        if (!mounted) return;
        setItems((body?.notifications || []) as NotificationItem[]);
        setUnreadCount(Number(body?.unreadCount || 0));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 20 * 1000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [activeTab, audience]);

  const handleMarkAllRead = async () => {
    const res = await fetch(`/api/notifications/${audience}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markAllRead" }),
    });
    if (!res.ok) return;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        readAt: item.readAt || new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
    window.dispatchEvent(
      new CustomEvent("eventgate:notifications-updated", {
        detail: { audience },
      }),
    );
  };

  const updateNotification = async (
    id: string,
    action: "markRead" | "archive" | "unarchive",
  ) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/notifications/${audience}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;

      if (action === "markRead") {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        const target = items.find((item) => item.id === id);
        setItems((prev) => prev.filter((item) => item.id !== id));
        if (target && !target.readAt && action === "archive") {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
      window.dispatchEvent(
        new CustomEvent("eventgate:notifications-updated", {
          detail: { audience },
        }),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const grouped = items.reduce<Record<string, NotificationItem[]>>(
    (acc, item) => {
      const label = dayLabel(item.timestamp);
      if (!acc[label]) acc[label] = [];
      acc[label].push(item);
      return acc;
    },
    {},
  );

  return (
    <div className="min-h-svh bg-white">
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="rounded-none border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && activeTab !== "archived" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-3 text-[13px] text-[var(--aau-blue)] hover:text-[var(--aau-blue)]"
                  onClick={handleMarkAllRead}
                >
                  Mark all as read
                </Button>
              ) : null}
              <span className="text-xs text-gray-500">Unread: {unreadCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 px-6 border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setActiveTab(tab.id);
                }}
                className={`h-10 px-3 text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "text-(--aau-blue) border-(--aau-blue)"
                    : "text-gray-600 border-transparent hover:text-(--aau-blue)"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-6 py-5 space-y-5">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-3 w-16 bg-gray-200 rounded" />
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Card
                    key={`notif-skeleton-${idx}`}
                    className="rounded-none border border-gray-200 bg-white"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="h-5 w-5 rounded-full bg-gray-200 mt-0.5" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="h-4 w-48 bg-gray-200 rounded" />
                            <div className="h-3 w-72 bg-gray-200 rounded" />
                            <div className="h-8 w-56 bg-gray-100 rounded border border-gray-200" />
                            <div className="flex items-center gap-2 pt-1">
                              <div className="h-8 w-24 bg-gray-200 rounded" />
                              <div className="h-8 w-20 bg-gray-200 rounded" />
                            </div>
                          </div>
                        </div>
                        <div className="h-3 w-12 bg-gray-200 rounded mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : items.length === 0 ? (
              <Card className="rounded-none border border-gray-200 bg-white">
                <CardContent className="p-10 text-center">
                  <p className="text-gray-600 mb-4">No notifications in this section.</p>
                  <Link href={backHref}>
                    <Button
                      className="rounded-none"
                      style={{ backgroundColor: "var(--aau-blue)" }}
                    >
                      {backLabel}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              Object.entries(grouped).map(([label, entries]) => (
                <section key={label} className="space-y-3">
                  <h2 className="text-xs font-semibold tracking-wide text-gray-500">
                    {label}
                  </h2>
                  {entries.map((item) => {
                    const unread = !item.readAt;
                    const isImportant = item.decision === "REJECTED";
                    const isArchived = activeTab === "archived";

                    return (
                      <Card
                        key={item.id}
                        className={`rounded-none border ${
                          unread
                            ? "border-blue-200 bg-white"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="mt-0.5 text-gray-500">
                                {isImportant ? (
                                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                                ) : item.decision === "APPROVED" ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : item.stage === "LEAD" ? (
                                  <MessageSquare className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <Info className="h-5 w-5 text-gray-500" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900">
                                  {item.eventTitle}
                                </div>
                                <div className="text-sm text-gray-700 mt-0.5">
                                  {item.role.replace("_", " ")}{" "}
                                  {item.decision === "APPROVED"
                                    ? "approved"
                                    : "rejected"}{" "}
                                  this proposal at{" "}
                                  {item.stage === "LEAD"
                                    ? "Lead stage"
                                    : item.stage === "STUDENT_UNION"
                                      ? "Student Union stage"
                                      : "Director stage"}
                                  .
                                </div>
                                {item.comment ? (
                                  <div className="mt-2 rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
                                    &quot;{item.comment}&quot;
                                  </div>
                                ) : null}
                                <div className="mt-3 flex items-center gap-2">
                                  {unread && !isArchived ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-md text-xs"
                                      onClick={() =>
                                        updateNotification(item.id, "markRead")
                                      }
                                      disabled={updatingId === item.id}
                                    >
                                      Mark as read
                                    </Button>
                                  ) : null}
                                  {!isArchived ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 rounded-md text-xs text-gray-600 hover:text-gray-900"
                                      onClick={() =>
                                        updateNotification(item.id, "archive")
                                      }
                                      disabled={updatingId === item.id}
                                    >
                                      <Archive className="h-3.5 w-3.5 mr-1" />
                                      Archive
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 rounded-md text-xs text-gray-600 hover:text-gray-900"
                                      onClick={() =>
                                        updateNotification(item.id, "unarchive")
                                      }
                                      disabled={updatingId === item.id}
                                    >
                                      Restore
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
                              {relativeTime(item.timestamp)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </section>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
