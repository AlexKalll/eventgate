"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Pencil, Trash2, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Location = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const LOCATIONS_CACHE_TTL_MS = 60_000;
let locationsCache: Location[] | null = null;
let locationsCacheTimestamp = 0;

const isLocationsCacheFresh = () =>
  Boolean(locationsCache) &&
  Date.now() - locationsCacheTimestamp < LOCATIONS_CACHE_TTL_MS;

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(!isLocationsCacheFresh());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  // Add/Edit dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(
    null,
  );
  const [locationName, setLocationName] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [locationCapacity, setLocationCapacity] = useState("");
  const [locationActive, setLocationActive] = useState(true);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const refresh = async (opts?: { force?: boolean }) => {
    if (!opts?.force && isLocationsCacheFresh() && locationsCache) {
      setLocations(locationsCache);
      return;
    }

    const locationsRes = await fetch("/api/admin/locations");
    if (!locationsRes.ok) throw new Error("Failed to load locations");
    const locationsJson = await locationsRes.json();
    const nextLocations = locationsJson.locations || [];
    locationsCache = nextLocations;
    locationsCacheTimestamp = Date.now();
    setLocations(nextLocations);
  };

  useEffect(() => {
    (async () => {
      if (isLocationsCacheFresh() && locationsCache) {
        setLocations(locationsCache);
      }

      setLoading(!isLocationsCacheFresh());
      setError(null);
      try {
        await refresh({ force: !isLocationsCacheFresh() });
      } catch (e: any) {
        setError(e?.message || "Failed to load locations");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!message && !error) return;
    setToastOpen(true);
    const handle = setTimeout(() => setToastOpen(false), 4000);
    return () => clearTimeout(handle);
  }, [message, error]);

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingLocationId(null);
    setLocationName("");
    setLocationDescription("");
    setLocationCapacity("");
    setLocationActive(true);
    setDialogError(null);
  };

  const openAddDialog = () => {
    setMessage(null);
    setError(null);
    setDialogError(null);
    setEditingLocationId(null);
    setLocationName("");
    setLocationDescription("");
    setLocationCapacity("");
    setLocationActive(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (location: Location) => {
    setMessage(null);
    setError(null);
    setDialogError(null);
    setEditingLocationId(location.id);
    setLocationName(location.name);
    setLocationDescription(location.description || "");
    setLocationCapacity(location.capacity?.toString() || "");
    setLocationActive(location.isActive);
    setIsDialogOpen(true);
  };

  const saveLocation = async () => {
    setDialogError(null);
    setDialogLoading(true);

    const name = locationName.trim();
    if (!name) {
      setDialogError("Location name is required");
      setDialogLoading(false);
      return;
    }

    const capacity = locationCapacity ? parseInt(locationCapacity, 10) : null;
    const description = locationDescription.trim() || null;

    try {
      let res;

      if (editingLocationId) {
        // Update existing location
        res = await fetch("/api/admin/locations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingLocationId,
            name,
            description,
            capacity,
            isActive: locationActive,
          }),
        });
      } else {
        // Create new location
        res = await fetch("/api/admin/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            capacity,
          }),
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDialogError(body?.message || "Failed to save location");
        return;
      }

      setMessage(editingLocationId ? "Location updated." : "Location added.");
      closeDialog();
      await refresh({ force: true });
    } catch (e: any) {
      setDialogError(e?.message || "Failed to save location");
    } finally {
      setDialogLoading(false);
    }
  };

  const deleteLocation = async (locationId: string) => {
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/locations?id=${encodeURIComponent(locationId)}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message || "Failed to delete location");
        return;
      }

      setMessage("Location deleted.");
      await refresh({ force: true });
    } catch (e: any) {
      setError(e?.message || "Failed to delete location");
    }
  };

  const toggleLocationStatus = async (location: Location) => {
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: location.id,
          isActive: !location.isActive,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message || "Failed to update location status");
        return;
      }

      setMessage(
        `Location ${location.isActive ? "deactivated" : "activated"}.`,
      );
      await refresh({ force: true });
    } catch (e: any) {
      setError(e?.message || "Failed to update location status");
    }
  };

  const activeLocations = locations.filter((l) => l.isActive);
  const inactiveLocations = locations.filter((l) => !l.isActive);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      <Card className="rounded-none border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Event Locations</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage predefined venues for event proposals
              </p>
            </div>
            <Button
              onClick={openAddDialog}
              className="bg-[var(--aau-blue)] hover:bg-[var(--aau-blue)]/90 rounded-none"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card className="rounded-none border border-gray-200">
          <CardContent className="p-6">
            <div className="space-y-4 animate-pulse">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`location-skeleton-${idx}`}
                    className="p-4 border border-gray-200 bg-white rounded-none space-y-3"
                  >
                    <div className="h-4 w-40 bg-gray-200 rounded" />
                    <div className="h-3 w-52 bg-gray-100 rounded" />
                    <div className="h-3 w-28 bg-gray-100 rounded" />
                    <div className="h-8 w-24 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && locations.length === 0 && (
        <Card className="rounded-none border border-gray-200">
          <CardContent className="text-center py-12 border-2 border-dashed border-gray-200 rounded-none">
            <MapPin className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No locations have been added yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Click &quot;Add Location&quot; to create your first venue.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && activeLocations.length > 0 && (
        <Card className="rounded-none border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Active Locations ({activeLocations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeLocations.map((location) => (
                <div
                  key={location.id}
                  className="p-4 border border-gray-200 bg-white rounded-none hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {location.name}
                      </h3>
                      {location.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {location.description}
                        </p>
                      )}
                      {location.capacity && (
                        <p className="text-xs text-gray-400 mt-2">
                          Capacity: {location.capacity}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-[var(--aau-blue)] rounded-none"
                        onClick={() => openEditDialog(location)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-600 rounded-none"
                        onClick={() => deleteLocation(location.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto p-0 text-xs text-gray-500"
                    onClick={() => toggleLocationStatus(location)}
                  >
                    Deactivate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && inactiveLocations.length > 0 && (
        <Card className="rounded-none border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Inactive Locations ({inactiveLocations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inactiveLocations.map((location) => (
                <div
                  key={location.id}
                  className="p-4 border border-gray-200 bg-gray-50 rounded-none opacity-60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-700 truncate">
                        {location.name}
                      </h3>
                      {location.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {location.description}
                        </p>
                      )}
                      {location.capacity && (
                        <p className="text-xs text-gray-400 mt-2">
                          Capacity: {location.capacity}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-[var(--aau-blue)] rounded-none"
                        onClick={() => openEditDialog(location)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-600 rounded-none"
                        onClick={() => deleteLocation(location.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto p-0 text-xs text-gray-500"
                    onClick={() => toggleLocationStatus(location)}
                  >
                    Activate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocationId ? "Edit Location" : "Add New Location"}
            </DialogTitle>
            <DialogDescription>
              {editingLocationId
                ? "Update the location details below."
                : "Enter the details for the new venue."}
            </DialogDescription>
          </DialogHeader>

          {dialogError && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              {dialogError}
            </p>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="locationName">Location Name *</Label>
              <Input
                id="locationName"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g., Main Auditorium, Conference Room A"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="locationDescription">
                Description (optional)
              </Label>
              <Input
                id="locationDescription"
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                placeholder="Brief description of the venue"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="locationCapacity">Capacity (optional)</Label>
              <Input
                id="locationCapacity"
                type="number"
                min="1"
                value={locationCapacity}
                onChange={(e) => setLocationCapacity(e.target.value)}
                placeholder="e.g., 200"
              />
            </div>

            {editingLocationId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="locationActive"
                  checked={locationActive}
                  onChange={(e) => setLocationActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="locationActive" className="font-normal">
                  Active (available for proposals)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={dialogLoading}
            >
              Cancel
            </Button>
            <Button onClick={saveLocation} disabled={dialogLoading}>
              {dialogLoading
                ? "Saving..."
                : editingLocationId
                  ? "Update"
                  : "Add Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {(message || error) && toastOpen && (
        <div
          className="fixed bottom-4 right-4 z-50 w-88 max-w-[calc(100vw-2rem)]"
          role="status"
          aria-live={error ? "assertive" : "polite"}
        >
          <div
            className={
              error
                ? "border border-red-300 bg-white"
                : "border border-gray-200 bg-white"
            }
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div
                  className={
                    error
                      ? "text-sm font-medium text-red-600"
                      : "text-sm font-medium text-gray-900"
                  }
                >
                  {error ? "Action failed" : "Success"}
                </div>
                <div
                  className={
                    error
                      ? "mt-1 text-sm text-red-500"
                      : "mt-1 text-sm text-gray-500"
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
