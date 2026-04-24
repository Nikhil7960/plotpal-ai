// Plan persistence: every build plan gets a unique ID and is round-tripped
// through localStorage so refresh / share-via-URL / back-button never lose
// state. Deliberately minimal — no Dexie, no IndexedDB overhead yet.

import type { InfraType, Preferences, Scenario } from "./types";

const STORAGE_KEY = "plotpal.plans.v1";
const INDEX_KEY = "plotpal.plans.index.v1";

export interface SpaceSnapshot {
  location: string;
  coordinates: { lat: number; lng: number };
  suitability: number;
  description: string;
  reasons: string[];
  considerations: string[];
}

export interface GeneratedImage {
  id: string;          // variant id
  aesthetic: string;
  prompt: string;
  base64: string;      // raw base64 (no data: prefix)
  mime: string;
  createdAt: number;
  referenceSource?: "streetview" | "satellite";
}

export interface BeforeImageStored {
  base64: string;
  mime: string;
  source: "streetview" | "satellite";
  note?: string;
  fallbackReason?:
    | "no-google-key" | "no-coverage"
    | "metadata-failed" | "image-failed";
  createdAt: number;
}

export interface StoredPlan {
  id: string;
  createdAt: number;
  updatedAt: number;
  // Source context from Phase 1
  space: SpaceSnapshot;
  infra: InfraType;
  searchLocation?: string;
  // Phase 2 state
  preferences?: Preferences;
  scenario?: Scenario;
  // Phase 2.2 generated images
  images?: GeneratedImage[];
  beforeImage?: BeforeImageStored;
}

/** Generate a compact, url-safe random ID. Collision-free in practice. */
export function newPlanId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function readAll(): Record<string, StoredPlan> {
  if (typeof window === "undefined") return {};
  return safeParse(window.localStorage.getItem(STORAGE_KEY), {});
}

function writeAll(plans: Record<string, StoredPlan>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(
      Object.values(plans)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(p => ({ id: p.id, updatedAt: p.updatedAt, infra: p.infra, location: p.space.location }))
    ));
  } catch (err) {
    // Likely QuotaExceeded — fall back to dropping image base64 to reclaim space.
    console.warn("planStore: write failed, attempting compaction", err);
    compactByEvictingImages(plans);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans)); }
    catch (err2) { console.error("planStore: compaction failed too", err2); }
  }
}

function compactByEvictingImages(plans: Record<string, StoredPlan>) {
  // Drop images from the oldest plans until we're under ~3MB serialised.
  const sorted = Object.values(plans).sort((a, b) => a.updatedAt - b.updatedAt);
  for (const p of sorted) {
    if (p.images?.length) p.images = [];
    if (p.beforeImage) p.beforeImage = undefined;
    const approx = JSON.stringify(plans).length;
    if (approx < 3_000_000) return;
  }
}

export function getPlan(id: string): StoredPlan | null {
  return readAll()[id] ?? null;
}

export function listPlans(): StoredPlan[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function savePlan(plan: StoredPlan): StoredPlan {
  const all = readAll();
  const merged: StoredPlan = { ...plan, updatedAt: Date.now() };
  all[plan.id] = merged;
  writeAll(all);
  return merged;
}

export function createPlan(args: {
  space: SpaceSnapshot;
  infra: InfraType;
  searchLocation?: string;
}): StoredPlan {
  const now = Date.now();
  const plan: StoredPlan = {
    id: newPlanId(),
    createdAt: now,
    updatedAt: now,
    ...args,
  };
  savePlan(plan);
  return plan;
}

export function updatePlan(id: string, patch: Partial<StoredPlan>): StoredPlan | null {
  const existing = getPlan(id);
  if (!existing) return null;
  return savePlan({ ...existing, ...patch });
}

export function deletePlan(id: string): void {
  const all = readAll();
  if (!(id in all)) return;
  delete all[id];
  writeAll(all);
}

export function addImageToPlan(id: string, image: GeneratedImage): StoredPlan | null {
  const existing = getPlan(id);
  if (!existing) return null;
  const images = [...(existing.images ?? []), image];
  return savePlan({ ...existing, images });
}

export function replaceImagesOnPlan(id: string, images: GeneratedImage[]): StoredPlan | null {
  const existing = getPlan(id);
  if (!existing) return null;
  return savePlan({ ...existing, images });
}

export function setBeforeImage(id: string, before: BeforeImageStored | null): StoredPlan | null {
  const existing = getPlan(id);
  if (!existing) return null;
  return savePlan({ ...existing, beforeImage: before ?? undefined });
}
