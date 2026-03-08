"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ExistingClubsSection } from "./existing-clubs-section";

type ClubRole = "PRESIDENT" | "VP" | "SECRETARY";
type SystemRole = "ADMIN" | "DIRECTOR" | "STUDENT_UNION";

type Club = {
  id: string;
  name: string;
  roleGrants: Array<{
    id: string;
    clubId: string;
    email: string;
    role: ClubRole;
  }>;
};

type SystemRoleGrant = { id: string; email: string; role: SystemRole };

const selectClassName =
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-none border bg-transparent px-3 py-1 text-base transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export default function AdminClient() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [systemRoleGrants, setSystemRoleGrants] = useState<SystemRoleGrant[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [clubName, setClubName] = useState("");
  const [presidentEmail, setPresidentEmail] = useState("");
  const [vpEmail, setVpEmail] = useState("");
  const [secretaryEmail, setSecretaryEmail] = useState("");
  const [editingClubId, setEditingClubId] = useState<string | null>(null);

  const [systemRole, setSystemRole] = useState<SystemRole>("DIRECTOR");
  const [systemRoleEmail, setSystemRoleEmail] = useState("");
  const [editingGrantId, setEditingGrantId] = useState<string | null>(null);
  const [editingGrantEmail, setEditingGrantEmail] = useState("");
  const [editingGrantRole, setEditingGrantRole] =
    useState<SystemRole>("DIRECTOR");

  const clubsByName = useMemo(() => {
    const map = new Map<string, Club>();
    for (const c of clubs) map.set(c.name.toLowerCase(), c);
    return map;
  }, [clubs]);

  const refresh = async () => {
    const [clubsRes, rolesRes] = await Promise.all([
      fetch("/api/admin/clubs", { cache: "no-store" }),
      fetch("/api/admin/system-role-grants", { cache: "no-store" }),
    ]);

    if (!clubsRes.ok) {
      throw new Error("Failed to load clubs");
    }
    if (!rolesRes.ok) {
      throw new Error("Failed to load system roles");
    }

    const clubsJson = await clubsRes.json();
    const rolesJson = await rolesRes.json();

    setClubs(clubsJson.clubs || []);
    setSystemRoleGrants(rolesJson.grants || []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (e: any) {
        setError(e?.message || "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveClub = async () => {
    setMessage(null);
    setError(null);

    const name = clubName.trim();
    if (!name) {
      setError("Club name is required");
      return;
    }

    const normalizedPresident = presidentEmail.trim().toLowerCase();
    const normalizedVp = vpEmail.trim().toLowerCase();
    const normalizedSecretary = secretaryEmail.trim().toLowerCase();

    if (!normalizedPresident || !normalizedPresident.includes("@")) {
      setError("Valid President email is required");
      return;
    }
    if (!normalizedVp || !normalizedVp.includes("@")) {
      setError("Valid VP email is required");
      return;
    }
    if (!normalizedSecretary || !normalizedSecretary.includes("@")) {
      setError("Valid Secretary email is required");
      return;
    }

    const res = await fetch("/api/admin/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clubId: editingClubId,
        name,
        presidentEmail: normalizedPresident,
        vpEmail: normalizedVp,
        secretaryEmail: normalizedSecretary,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message || "Failed to save club");
      return;
    }

    setMessage("Club saved.");
    await refresh();
  };

  const startEditClub = (club: Club) => {
    setMessage(null);
    setError(null);
    setEditingClubId(club.id);
    setClubName(club.name);
    setPresidentEmail(
      (club.roleGrants || []).find((g) => g.role === "PRESIDENT")?.email || ""
    );
    setVpEmail(
      (club.roleGrants || []).find((g) => g.role === "VP")?.email || ""
    );
    setSecretaryEmail(
      (club.roleGrants || []).find((g) => g.role === "SECRETARY")?.email || ""
    );
  };

  const cancelEditClub = () => {
    setEditingClubId(null);
    setClubName("");
    setPresidentEmail("");
    setVpEmail("");
    setSecretaryEmail("");
  };

  const deleteClub = async (clubId: string) => {
    setMessage(null);
    setError(null);

    const res = await fetch(
      `/api/admin/clubs?clubId=${encodeURIComponent(clubId)}`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message || "Failed to delete club");
      return;
    }

    setMessage("Club deleted.");
    await refresh();
  };

  const grantSystemRole = async () => {
    setMessage(null);
    setError(null);

    const email = systemRoleEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email");
      return;
    }

    const res = await fetch("/api/admin/system-role-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: systemRole }),
    });

    if (!res.ok) {
      setError("Failed to grant system role");
      return;
    }

    setSystemRoleEmail("");
    setMessage("System role granted.");
    await refresh();
  };

  const startEditSystemGrant = (grant: SystemRoleGrant) => {
    setMessage(null);
    setError(null);
    setEditingGrantId(grant.id);
    setEditingGrantEmail(grant.email);
    setEditingGrantRole(grant.role);
  };

  const cancelEditSystemGrant = () => {
    setEditingGrantId(null);
    setEditingGrantEmail("");
    setEditingGrantRole("DIRECTOR");
  };

  const saveSystemGrant = async () => {
    if (!editingGrantId) return;
    setMessage(null);
    setError(null);

    const email = editingGrantEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email");
      return;
    }

    const res = await fetch("/api/admin/system-role-grants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingGrantId,
        email,
        role: editingGrantRole,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message || "Failed to update system role");
      return;
    }

    setMessage("System role updated.");
    cancelEditSystemGrant();
    await refresh();
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Clubs</h1>
      <p className="text-sm text-muted-foreground">
        Manage clubs and role assignments.
      </p>

      {loading && (
        <p className="mt-6 text-sm text-muted-foreground">Loading...</p>
      )}
      {!loading && error && (
        <p className="mt-6 text-sm text-destructive">{error}</p>
      )}
      {!loading && message && (
        <p className="mt-6 text-sm text-emerald-700">{message}</p>
      )}

      <div className="mt-8 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{editingClubId ? "Edit Club" : "Club"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="clubName">Club Name</Label>
              <Input
                id="clubName"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder=" Computer Science Society"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="presidentEmail">President Email</Label>
                <Input
                  id="presidentEmail"
                  type="email"
                  value={presidentEmail}
                  onChange={(e) => setPresidentEmail(e.target.value)}
                  placeholder="president@club.edu"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vpEmail">VP Email</Label>
                <Input
                  id="vpEmail"
                  type="email"
                  value={vpEmail}
                  onChange={(e) => setVpEmail(e.target.value)}
                  placeholder="vp@club.edu"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="secretaryEmail">Secretary Email</Label>
                <Input
                  id="secretaryEmail"
                  type="email"
                  value={secretaryEmail}
                  onChange={(e) => setSecretaryEmail(e.target.value)}
                  placeholder="secretary@club.edu"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveClub}>
                {editingClubId ? "Update Club" : "Save Club"}
              </Button>
              {editingClubId && (
                <Button variant="outline" onClick={cancelEditClub}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <ExistingClubsSection
          clubs={clubs}
          loading={loading}
          onEdit={startEditClub}
          onDelete={deleteClub}
        />

        <Card>
          <CardHeader>
            <CardTitle>Grant System Roles</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="systemRole">Role</Label>
                <select
                  id="systemRole"
                  className={selectClassName}
                  value={systemRole}
                  onChange={(e) => setSystemRole(e.target.value as SystemRole)}
                >
                  <option value="DIRECTOR">Director</option>
                  <option value="STUDENT_UNION">Student Union</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="systemRoleEmail">User Email</Label>
                <Input
                  id="systemRoleEmail"
                  type="email"
                  value={systemRoleEmail}
                  onChange={(e) => setSystemRoleEmail(e.target.value)}
                  placeholder="user@school.edu"
                />
              </div>
            </div>

            <Button onClick={grantSystemRole}>Grant</Button>

            <div className="grid gap-1 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Existing grants</div>
              {systemRoleGrants.length === 0 && <div>No system roles yet.</div>}
              {systemRoleGrants.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-col gap-2 border border-border/50 p-3 md:flex-row md:items-center md:gap-3"
                >
                  {editingGrantId === g.id ? (
                    <>
                      <select
                        className={selectClassName}
                        value={editingGrantRole}
                        onChange={(e) =>
                          setEditingGrantRole(e.target.value as SystemRole)
                        }
                      >
                        <option value="DIRECTOR">Director</option>
                        <option value="STUDENT_UNION">Student Union</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <Input
                        type="email"
                        value={editingGrantEmail}
                        onChange={(e) => setEditingGrantEmail(e.target.value)}
                        placeholder="user@school.edu"
                      />
                      <div className="flex gap-2">
                        <Button onClick={saveSystemGrant}>Save</Button>
                        <Button
                          variant="outline"
                          onClick={cancelEditSystemGrant}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {g.role}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {g.email}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-none"
                        onClick={() => startEditSystemGrant(g)}
                      >
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
