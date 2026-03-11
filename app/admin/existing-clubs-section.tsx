"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmation } from "@/components/ui/confirmation-card";
import { Trash2 } from "lucide-react";
import { Edit } from "lucide-react";

type ClubRole = "PRESIDENT" | "VP" | "SECRETARY";

type Club = {
  id: string;
  name: string;
  roleGrants: Array<{
    id: string;
    clubId: string;
    email: string;
    phoneNumber?: string | null;
    role: ClubRole;
  }>;
};

function getClubLeadEmail(club: Club, role: ClubRole) {
  const grant = (club.roleGrants || []).find((g) => g.role === role);
  return grant?.email || "-";
}

function getClubLeadPhone(club: Club, role: ClubRole) {
  const grant = (club.roleGrants || []).find((g) => g.role === role);
  return grant?.phoneNumber || "-";
}

export function ExistingClubsSection({
  clubs,
  loading = false,
  onEdit,
  onDelete,
}: {
  clubs: Club[];
  loading?: boolean;
  onEdit: (club: Club) => void;
  onDelete: (clubId: string) => void;
}) {
  const { requestConfirmation, ConfirmationComponent } = useConfirmation();
  return (
    <>
      <ConfirmationComponent />
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-gray-900">
            ADDIS ABABA UNIVERSITY CLUBS
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {loading ? (
            <div className="grid gap-3 animate-pulse">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={`club-skeleton-${idx}`}
                  className="border border-border p-3 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="h-4 w-48 bg-gray-200 rounded" />
                    <div className="flex gap-2">
                      <div className="h-8 w-14 bg-gray-200 rounded" />
                      <div className="h-8 w-8 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-72 bg-gray-100 rounded" />
                    <div className="h-3 w-64 bg-gray-100 rounded" />
                    <div className="h-3 w-60 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : clubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clubs yet.</p>
          ) : (
            <div className="grid gap-3">
              {clubs.map((c) => (
                <div key={c.id} className="border border-border p-3 ">
                  <div className="flex items-start justify-between gap-4">
                    <div className="font-medium">{c.name.toUpperCase()}</div>
                    <div className="flex gap-2 ">
                      <Button
                        className="rounded-none hover:bg-white"
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(c)}
                      >
                        Edit
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        className="rounded-none bg-white hover:bg-white "
                        variant="destructive"
                        size="sm"
                        aria-label={`Delete ${c.name}`}
                        title={`Delete ${c.name}`}
                        onClick={async () => {
                          const confirmed = await requestConfirmation(
                            "Delete Club",
                            `Are you sure you want to delete ${c.name.toUpperCase()}? This action cannot be undone and will also remove all associated club role grants.`,
                            () => {},
                            {
                              variant: "destructive",
                              confirmText: "Delete",
                              cancelText: "Cancel",
                            },
                          );
                          if (confirmed) {
                            onDelete(c.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 bg-white hover:bg-white text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                    <div>
                      President: {getClubLeadEmail(c, "PRESIDENT")} •{" "}
                      {getClubLeadPhone(c, "PRESIDENT")}
                    </div>
                    <div>
                      VP: {getClubLeadEmail(c, "VP")} •{" "}
                      {getClubLeadPhone(c, "VP")}
                    </div>
                    <div>
                      Secretary: {getClubLeadEmail(c, "SECRETARY")} •{" "}
                      {getClubLeadPhone(c, "SECRETARY")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
