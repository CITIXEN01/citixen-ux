/**
 * Governance schema for the hazard-report dispatch — the SvelteKit
 * equivalent of app.html's `submitReport()` payload, ported to the Data
 * Governance Dispatch Model (Classification -> Validation -> Auditability
 * -> Policy Enforcement).
 *
 * Category vocabulary is copied verbatim from api/_lib/store.js's
 * `CATEGORIES` constant in the existing static-HTML app — this schema does
 * not invent a new taxonomy, it formalizes the one already in production.
 */
import { z } from 'zod';

/** Same 5 categories store.js already seeds. Keep these two lists in sync
 *  by hand until the Svelte migration reads from a shared package. */
export const REPORT_CATEGORIES = [
  'Pothole',
  'Streetlight',
  'Signage',
  'Sidewalk',
  'Drainage'
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/**
 * Sensitivity classification per governance Pillar 1. This app is
 * zero-account/zero-PII by design (see CAPACITOR_NOTES.md and
 * api/_lib/jurisdictions.js's Fourth Amendment framing in the existing
 * codebase) — so there is deliberately no "PII" tier populated with real
 * user data here. GPS coordinates are Restricted pre-submission (raw,
 * precise) and become Public only after the existing `fuzzCoord()`-style
 * rounding is applied server-side, exactly as index.html's public ledger
 * already does. This enum exists so the Policy Enforcer (Pillar 4) can
 * condition rendering/dispatch on it, not to imply this app collects PII
 * it does not actually collect.
 */
export const Classification = {
  Public: 'Public',
  Internal: 'Internal',
  Confidential: 'Confidential',
  Restricted: 'Restricted'
} as const;
export type Classification = (typeof Classification)[keyof typeof Classification];

/** Per-field classification map for the report payload below. Declared
 *  once so the audit dispatcher (dispatch.ts) can tag each event with the
 *  highest classification level actually present in that payload, rather
 *  than a single hardcoded label. */
export const FIELD_CLASSIFICATION: Record<keyof ReportPayloadInput, Classification> = {
  category: Classification.Public,
  description: Classification.Internal,
  lat: Classification.Restricted,
  lng: Classification.Restricted,
  photoDataUrl: Classification.Restricted, // Restricted until EXIF/GPS-stripped server-side
  urgentOverride: Classification.Internal
};

/**
 * Validation (Pillar 2). Mirrors the real constraints app.html's report
 * form already enforces client-side (category from the fixed vocabulary,
 * a non-empty description, real numeric coordinates when GPS resolved).
 * `photoDataUrl` is optional at the schema level because the existing app
 * already allows submission without a photo when camera permission is
 * denied (see app.html's honest permission-fallback behavior) — the
 * schema should not be stricter than the product actually is.
 */
export const ReportPayloadSchema = z.object({
  category: z.enum(REPORT_CATEGORIES),
  description: z
    .string()
    .trim()
    .min(5, 'Description must be at least 5 characters.')
    .max(500, 'Description must be 500 characters or fewer.'),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  photoDataUrl: z.string().startsWith('data:image/').nullable(),
  /** Set by the CIP-intercept flow (see app.html's existing
   *  findInterceptMatch()/urgentOverride bookkeeping) when a citizen
   *  proceeds despite a matching scheduled capital project. Not user-set
   *  directly in the form UI. */
  urgentOverride: z.boolean().default(false)
});

export type ReportPayloadInput = z.input<typeof ReportPayloadSchema>;
export type ReportPayload = z.output<typeof ReportPayloadSchema>;

/** Highest classification level present across a payload's populated
 *  fields — used to tag the audit event (Pillar 3) and to decide whether
 *  the Policy Enforcer should mask anything in a downstream view. */
export function highestClassification(payload: Partial<ReportPayloadInput>): Classification {
  const order: Classification[] = [
    Classification.Public,
    Classification.Internal,
    Classification.Confidential,
    Classification.Restricted
  ];
  let highestIndex = 0;
  for (const key of Object.keys(payload) as (keyof ReportPayloadInput)[]) {
    if (payload[key] === undefined || payload[key] === null) continue;
    const level = FIELD_CLASSIFICATION[key];
    const idx = order.indexOf(level);
    if (idx > highestIndex) highestIndex = idx;
  }
  return order[highestIndex];
}
