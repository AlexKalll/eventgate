"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ClubMetric = {
  clubId: string;
  clubName: string;
  totalProposals: number;
  approved: number;
  rejected: number;
  pending: number;
  events: Array<{
    proposalId: string;
    title: string;
    description: string;
    status: string;
    createdAt: string;
    location: string;
    startTime: string;
    endTime: string;
  }>;
  leadership: {
    president: LeadContact;
    vicePresident: LeadContact;
    secretary: LeadContact;
  };
};

type LeadContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

type AnalyticsResponse = {
  academicYear: string;
  academicYears: string[];
  totals: {
    totalProposals: number;
    approvedEvents: number;
    totalRejections: number;
    totalPending: number;
  };
  clubs: ClubMetric[];
};

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-r border-gray-200 px-4 py-2 last:border-r-0">
      <p className="text-[11px] font-medium tracking-wide text-gray-500 uppercase">
        {label}
      </p>
      <p className="text-lg font-semibold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}

function CompactMetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Card className="rounded-none shadow-none border border-gray-200">
      <CardContent className="px-3 py-2">
        <p className="text-[11px] font-medium tracking-wide text-gray-500 uppercase truncate">
          {label}
        </p>
        <p className="mt-1 text-xl font-semibold text-gray-900">
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <main className="container mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="h-10 w-72 animate-pulse bg-gray-200" />
      <div className="mt-6 h-24 w-full animate-pulse border border-gray-200 bg-gray-100" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse border border-gray-200 bg-gray-100"
          />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="h-[420px] animate-pulse border border-gray-200 bg-gray-100 lg:col-span-2" />
        <div className="h-[420px] animate-pulse border border-gray-200 bg-gray-100" />
      </div>
    </main>
  );
}

export default function DirectorAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedYear) params.set("academicYear", selectedYear);
        if (search.trim()) params.set("q", search.trim());

        const response = await fetch(`/api/director/analytics?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as
          | AnalyticsResponse
          | { message?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            (body as { message?: string } | null)?.message ||
              "Failed to load analytics",
          );
        }

        const parsed = body as AnalyticsResponse;
        setData(parsed);
        if (!selectedYear && parsed.academicYear) {
          setSelectedYear(parsed.academicYear);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load analytics",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    const id = window.setTimeout(run, 180);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [selectedYear, search]);

  const csvRows = useMemo(() => {
    if (!data) return [];
    const header = [
      "Academic Year",
      "Club",
      "Total Proposals",
      "Approved",
      "Rejected",
      "Pending",
      "President Name",
      "President Email",
      "President Phone",
      "Vice President Name",
      "Vice President Email",
      "Vice President Phone",
      "Secretary Name",
      "Secretary Email",
      "Secretary Phone",
    ];
    const rows = data.clubs.map((club) => [
      data.academicYear,
      club.clubName,
      String(club.totalProposals),
      String(club.approved),
      String(club.rejected),
      String(club.pending),
      club.leadership.president?.name || "",
      club.leadership.president?.email || "",
      club.leadership.president?.phone || "",
      club.leadership.vicePresident?.name || "",
      club.leadership.vicePresident?.email || "",
      club.leadership.vicePresident?.phone || "",
      club.leadership.secretary?.name || "",
      club.leadership.secretary?.email || "",
      club.leadership.secretary?.phone || "",
    ]);
    return [header, ...rows];
  }, [data]);

  const clubs = useMemo(() => data?.clubs || [], [data]);
  const selectedClub =
    clubs.find((club) => club.clubId === selectedClubId) || clubs[0] || null;
  const selectedEvent = selectedClub
    ? selectedClub.events.find((event) => event.proposalId === selectedEventId) ||
      selectedClub.events[0] ||
      null
    : null;

  useEffect(() => {
    if (!clubs.length) {
      setSelectedClubId("");
      return;
    }
    const exists = clubs.some((club) => club.clubId === selectedClubId);
    if (!exists) {
      setSelectedClubId(clubs[0].clubId);
    }
  }, [clubs, selectedClubId]);

  useEffect(() => {
    if (!selectedClub || selectedClub.events.length === 0) {
      setSelectedEventId("");
      return;
    }
    const exists = selectedClub.events.some(
      (event) => event.proposalId === selectedEventId,
    );
    if (!exists) {
      setSelectedEventId(selectedClub.events[0].proposalId);
    }
  }, [selectedClub, selectedEventId]);

  const exportCsv = () => {
    if (!csvRows.length || !data) return;
    const csv = csvRows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `club-analytics-${data.academicYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return <AnalyticsSkeleton />;
  }

  if (error && !data) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <Card className="rounded-none shadow-none border border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      </main>
    );
  }

  const totals = data?.totals || {
    totalProposals: 0,
    approvedEvents: 0,
    totalRejections: 0,
    totalPending: 0,
  };
  const years = data?.academicYears || (selectedYear ? [selectedYear] : []);

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        Club Activity Analytics
      </h1>

      <Card className="mt-6 rounded-none shadow-none border border-gray-200">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">Reporting Period</p>
            <p className="text-sm text-gray-500">
              Track proposal performance by academic year.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="whitespace-nowrap">Academic Year:</span>
              <select
                className="h-9 min-w-36 border border-gray-300 bg-white px-2 text-sm focus:border-[var(--aau-blue)] focus:outline-none"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2 h-4 w-4 text-gray-400" />
              <input
                className="h-9 w-full min-w-56 border border-gray-300 bg-white pl-8 pr-2 text-sm focus:border-[var(--aau-blue)] focus:outline-none"
                placeholder="Search clubs or events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <Button
              onClick={exportCsv}
              className="rounded-none bg-[var(--aau-blue)] hover:bg-[var(--aau-blue)]/90"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 hidden md:block border border-gray-200 bg-white">
        <div className="grid grid-cols-4">
          <MetricCard label="Total Proposals" value={totals.totalProposals} />
          <MetricCard label="Approved Events" value={totals.approvedEvents} />
          <MetricCard label="Total Rejections" value={totals.totalRejections} />
          <MetricCard label="Pending Review" value={totals.totalPending} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 grid-cols-2 md:hidden">
        <CompactMetricCard label="Total Proposals" value={totals.totalProposals} />
        <CompactMetricCard label="Approved Events" value={totals.approvedEvents} />
        <CompactMetricCard label="Total Rejections" value={totals.totalRejections} />
        <CompactMetricCard label="Pending Review" value={totals.totalPending} />
      </div>

      <div className="mt-6">
        <Card className="rounded-none shadow-none border border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Proposal Status per Club</CardTitle>
          </CardHeader>
          <CardContent>
            {clubs.length === 0 ? (
              <p className="text-sm text-gray-500">
                No proposals found for the selected filters.
              </p>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-12">
                <div className="lg:col-span-7 border border-gray-200 h-[620px]">
                  <div className="h-full overflow-auto">
                    <table className="min-w-[640px] w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Club</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          <th className="px-3 py-2 text-right font-medium">Approved</th>
                          <th className="px-3 py-2 text-right font-medium">Pending</th>
                          <th className="px-3 py-2 text-right font-medium">Rejected</th>
                          <th className="px-3 py-2 text-right font-medium">Approval Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clubs.map((club) => {
                          const total = Math.max(1, club.totalProposals);
                          const approvalRate = Math.round(
                            (club.approved / total) * 100,
                          );
                          return (
                            <tr
                              key={club.clubId}
                              className={`border-t border-gray-200 align-middle cursor-pointer transition-colors ${
                                selectedClub?.clubId === club.clubId
                                  ? "bg-blue-50/60"
                                  : "hover:bg-gray-50"
                              }`}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedClubId(club.clubId)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedClubId(club.clubId);
                                }
                              }}
                            >
                              <td className="px-3 py-3 font-medium text-gray-900">
                                {club.clubName}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700">
                                {club.totalProposals}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700">
                                {club.approved}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700">
                                {club.pending}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700">
                                {club.rejected}
                              </td>
                              <td className="px-3 py-3 text-right font-medium text-gray-900">
                                {approvalRate}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedClub ? (
                  <div className="lg:col-span-5 border border-gray-200 lg:sticky lg:top-24 self-start h-[620px] flex flex-col">
                    <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">
                        {selectedClub.clubName} proposals in {data?.academicYear}
                      </p>
                    </div>
                    <div className="border-b border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Club Leadership
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {[
                          {
                            label: "President",
                            contact: selectedClub.leadership.president,
                          },
                          {
                            label: "Vice President",
                            contact: selectedClub.leadership.vicePresident,
                          },
                          {
                            label: "Secretary",
                            contact: selectedClub.leadership.secretary,
                          },
                        ].map(({ label, contact }) => {
                          const lead = contact;
                          const displayName =
                            lead.name || lead.email || lead.phone || "Not available";
                          return (
                            <div
                              key={label}
                              className="rounded border border-gray-200 bg-gray-50 px-2 py-2"
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                {label}
                              </span>
                              <div className="mt-1 text-sm font-medium text-gray-900">
                                {displayName}
                              </div>
                              <div className="mt-1 text-xs text-gray-600 break-words">
                                {lead.email || "-"}
                              </div>
                              <div className="text-xs text-gray-600">
                                {lead.phone || "-"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="h-full overflow-hidden">
                      {selectedClub.events.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-gray-500">
                          No proposal events found for this club in the selected year.
                        </p>
                      ) : (
                        <div className="grid h-full grid-rows-[170px,1fr]">
                          <div className="overflow-y-auto border-b border-gray-200">
                            {selectedClub.events.map((event) => (
                              <button
                                key={event.proposalId}
                                type="button"
                                className={`w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 ${
                                  selectedEvent?.proposalId === event.proposalId
                                    ? "bg-blue-50"
                                    : "hover:bg-gray-50"
                                }`}
                                onClick={() => setSelectedEventId(event.proposalId)}
                              >
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {event.title}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(event.createdAt).toLocaleDateString()}
                                </p>
                              </button>
                            ))}
                          </div>

                          {selectedEvent ? (
                            <div className="m-3 border border-blue-200 bg-blue-50/50 p-4 overflow-y-auto">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="text-base font-semibold text-gray-900">
                                  {selectedEvent.title}
                                </p>
                                <p className="text-sm font-medium text-blue-700">
                                  {selectedEvent.status.replaceAll("_", " ")}
                                </p>
                              </div>
                              <p className="mt-2 text-sm text-gray-600">
                                Submitted:{" "}
                                {new Date(selectedEvent.createdAt).toLocaleDateString()}
                              </p>
                              <p className="mt-3 text-sm leading-6 text-gray-800 whitespace-pre-wrap">
                                {selectedEvent.description || "No description provided."}
                              </p>
                              <p className="mt-3 text-sm text-gray-600">
                                Location: {selectedEvent.location}
                              </p>
                              <p className="text-sm text-gray-600">
                                Time: {new Date(selectedEvent.startTime).toLocaleString()} -{" "}
                                {new Date(selectedEvent.endTime).toLocaleString()}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
