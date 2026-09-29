/**
 * In-memory audit log store (Pillar 3: Auditability). A real deployment
 * would persist this server-side (an audit table, a log sink); this store
 * is the client-visible mirror of "every dispatched action carries event
 * metadata" so the UI can show a live audit trail (useful for the
 * dispatch/rep console views, and for demoing the model in the pitch deck).
 */
import { writable } from 'svelte/store';
import type { Classification } from './schema';

export interface AuditEvent {
  traceId: string;
  timestamp: string; // ISO 8601
  actorId: string;
  actionType: string;
  classification: Classification;
  outcome: 'authorized' | 'denied' | 'validation_error';
  detail?: string;
}

export const auditLog = writable<AuditEvent[]>([]);

export function recordAuditEvent(event: AuditEvent) {
  auditLog.update((events) => [event, ...events].slice(0, 200)); // cap for a demo store
}

/**
 * CITIXEN UX is zero-account by product design (no login, no persistent
 * identity — see CAPACITOR_NOTES.md and the honesty convention carried
 * through the whole existing static-site codebase). A generic governance
 * framework's "actorId" normally means an authenticated user id; here it
 * is deliberately a per-session, non-identifying trace id instead, so this
 * audit layer stays honest about what the product actually knows about
 * who's dispatching an action — nothing. Rotates per browser session, not
 * persisted, never sent anywhere the rest of this app doesn't already send
 * telemetry.
 */
export function getSessionActorId(): string {
  const KEY = 'citixen_session_actor_id';
  if (typeof sessionStorage === 'undefined') return 'anonymous-session';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `anon-${crypto.randomUUID()}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}
