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
    president: string | null;
    vicePresident: string | null;
    secretary: string | null;
  };
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
    <Card className="rounded-none shadow-none border border-gray-200">
      <CardContent className="p-5">
        <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
          {label}
        </p>
        <p className="mt-2 text-3xl font-semibold text-gray-900">
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
      "President",
      "Vice President",
      "Secretary",
    ];
    const rows = data.clubs.map((club) => [
      data.academicYear,
      club.clubName,
      String(club.totalProposals),
      String(club.approved),
      String(club.rejected),
      String(club.pending),
      club.leadership.president || "",
      club.leadership.vicePresident || "",
      club.leadership.secretary || "",
    ]);
    return [header, ...rows];
  }, [data]);

  const clubs = useMemo(() => data?.clubs || [], [data]);
  const selectedClub =
    clubs.find((club) => club.clubId === selectedClubId) || clubs[0] || null;

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

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Proposals"
          value={totals.totalProposals}
        />
        <MetricCard
          label="Approved Events"
          value={totals.approvedEvents}
        />
        <MetricCard
          label="Total Rejections"
          value={totals.totalRejections}
        />
        <MetricCard
          label="Pending Review"
          value={totals.totalPending}
        />
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
              <div className="space-y-3">
                <div className="overflow-x-auto border border-gray-200">
                  <table className="min-w-[640px] w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
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

                {selectedClub ? (
                  <div className="border border-gray-200">
                    <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">
                        {selectedClub.clubName} proposals in {data?.academicYear}
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {selectedClub.events.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-gray-500">
                          No proposal events found for this club in the selected year.
                        </p>
                      ) : (
                        selectedClub.events.map((event) => (
                          <div
                            key={event.proposalId}
                            className="border-b border-gray-100 px-3 py-3 last:border-b-0"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-medium text-gray-900">{event.title}</p>
                              <p className="text-xs font-medium text-gray-600">
                                {event.status.replaceAll("_", " ")}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-gray-600">
                              Submitted:{" "}
                              {new Date(event.createdAt).toLocaleDateString()}
                            </p>
                            <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                              {event.description || "No description provided."}
                            </p>
                            <p className="text-xs text-gray-600">
                              Location: {event.location}
                            </p>
                            <p className="text-xs text-gray-600">
                              Time: {new Date(event.startTime).toLocaleString()} -{" "}
                              {new Date(event.endTime).toLocaleString()}
                            </p>
                          </div>
                        ))
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
