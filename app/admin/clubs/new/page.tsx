"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export default function AdminAddClubPage() {
  const [clubName, setClubName] = useState("");
  const [presidentEmail, setPresidentEmail] = useState("");
  const [vpEmail, setVpEmail] = useState("");
  const [secretaryEmail, setSecretaryEmail] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setClubName("");
    setPresidentEmail("");
    setVpEmail("");
    setSecretaryEmail("");
  };

  const save = async () => {
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

    if (normalizedPresident && !normalizedPresident.includes("@")) {
      setError("President email is invalid");
      return;
    }
    if (normalizedVp && !normalizedVp.includes("@")) {
      setError("VP email is invalid");
      return;
    }
    if (normalizedSecretary && !normalizedSecretary.includes("@")) {
      setError("Secretary email is invalid");
      return;
    }

    const res = await fetch("/api/admin/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

    setMessage("Club created.");
    clear();
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      <Card className="rounded-none border border-gray-200">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Add Club</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a new club and optionally set leadership emails.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-none border border-gray-200">
        <CardHeader>
          <CardTitle>Add Club</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="clubName">Club Name</Label>
                <span className="text-xs text-muted-foreground">Required</span>
              </div>
              <Input
                id="clubName"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Computer Science Society"
              />
              <p className="text-xs text-muted-foreground">
                Use the official club name that appears on proposals.
              </p>
            </div>

            <div className="rounded border border-border bg-muted/40 p-4">
              <p className="text-sm font-medium mb-3">Leadership emails</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="presidentEmail">President (optional)</Label>
                  <Input
                    id="presidentEmail"
                    type="email"
                    value={presidentEmail}
                    onChange={(e) => setPresidentEmail(e.target.value)}
                    placeholder="president@club.edu"
                  />
                
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="vpEmail">Vice President (optional)</Label>
                  <Input
                    id="vpEmail"
                    type="email"
                    value={vpEmail}
                    onChange={(e) => setVpEmail(e.target.value)}
                    placeholder="vp@club.edu"
                  />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="secretaryEmail">Secretary (optional)</Label>
                  <Input
                    id="secretaryEmail"
                    type="email"
                    value={secretaryEmail}
                    onChange={(e) => setSecretaryEmail(e.target.value)}
                    placeholder="secretary@club.edu"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={save}>Create</Button>
              <Button variant="outline" onClick={clear}>
                Clear
              </Button>
            </div>
          </div>

          <div className="rounded-none border border-dashed border-border bg-muted/30 p-4 space-y-3 text-sm text-muted-foreground">
            <p className="text-foreground font-medium">Tips</p>
            <ul className="list-disc pl-4 space-y-2">
              <li>Only the club name is required to create a club record.</li>
              <li>
                Add leader emails now to auto-notify them on proposal changes.
              </li>
              <li>You can edit these contacts later.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {(message || error) && (
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
                onClick={() => {
                  setMessage(null);
                  setError(null);
                }}
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
