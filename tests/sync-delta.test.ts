import { describe, it, expect, vi } from "vitest";

// useSyncData pulls in next-auth/react and the store (idb-keyval) — stub both.
vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => {},
  del: async () => {},
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

import { touchedSince } from "@/hooks/useSyncData";
import { generateId } from "@/lib/utils";

describe("touchedSince — the delta-sync filter", () => {
  const items = [
    { id: "1", createdAt: "2026-07-01T00:00:00Z" },
    { id: "2", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-10T00:00:00Z" },
    { id: "3", createdAt: "2026-07-12T00:00:00Z" },
  ];

  it("returns everything when there is no marker (first push)", () => {
    expect(touchedSince(items, "")).toHaveLength(3);
  });

  it("returns only items touched after the marker", () => {
    const changed = touchedSince(items, "2026-07-05T00:00:00Z");
    expect(changed.map((i) => i.id).sort()).toEqual(["2", "3"]);
  });

  it("prefers updatedAt over createdAt", () => {
    // id 2 was created before the marker but edited after — must be included
    const changed = touchedSince(items, "2026-07-09T00:00:00Z");
    expect(changed.map((i) => i.id)).toEqual(["2", "3"]);
  });

  it("returns nothing when nothing changed", () => {
    expect(touchedSince(items, "2026-07-13T00:00:00Z")).toHaveLength(0);
  });
});

describe("generateId", () => {
  it("produces unique, non-trivial ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id.length).toBeGreaterThanOrEqual(13);
  });
});
