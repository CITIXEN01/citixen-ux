/**
 * The Dispatch Pipeline itself:
 *   UI Action -> Event Payload -> Governance Middleware / Policy Validator
 *   -> Authorization & Audit Dispatcher -> State Store / API Engine
 *
 * This wraps the hazard-report submission — the Svelte equivalent of
 * app.html's existing `submitReport()`/`finalizeSubmitReport()` — but the
 * shape here is generic on purpose: a second dispatcher (e.g. for
 * dispatch.html's "assign crew" action, or rep.html's "constituent
 * update" draft) should follow the same 4-step shape, not reinvent it.
 */
import {
  ReportPayloadSchema,
  highestClassification,
  type ReportPayload,
  type ReportPayloadInput
} from './schema';
import { recordAuditEvent, getSessionActorId, type AuditEvent } from './auditStore';

/**
 * Roles this pipeline currently knows about. CITIXEN UX has no real login
 * for citizens (zero-account by design), so 'citizen' is the default,
 * unauthenticated role every visitor has. 'dispatch_staff' and
 * 'representative' map to the existing UI-only access-code curtains in
 * dispatch.html/rep.html (documented there as NOT real authentication) —
 * carried through here as the same honest non-claim, not upgraded into a
 * real auth system just because this is now typed.
 */
export type DispatchRole = 'citizen' | 'dispatch_staff' | 'representative';

export interface DispatchContext {
  role: DispatchRole;
}

export interface DispatchResult<T> {
  ok: boolean;
  data?: T;
  errors?: string[];
  auditEvent: AuditEvent;
}

/** The "API Engine" step is injected rather than hardcoded to `fetch`, so
 *  this same dispatcher is unit-testable and so a caller can point it at
 *  the existing `/api/report/submit` Vercel function (see
 *  api/report/submit.js in the current static-site repo) without this
 *  module needing to know the transport. */
export type ReportApiEngine = (payload: ReportPayload) => Promise<{ id: string }>;

export async function dispatchReportSubmission(
  rawPayload: ReportPayloadInput,
  ctx: DispatchContext,
  apiEngine: ReportApiEngine
): Promise<DispatchResult<{ id: string }>> {
  const traceId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const actorId = getSessionActorId();
  const classification = highestClassification(rawPayload);

  // --- Governance Middleware / Policy Validator (schema validation) ---
  const parsed = ReportPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join('; ');
    const auditEvent: AuditEvent = {
      traceId,
      timestamp,
      actorId,
      actionType: 'report.submit',
      classification,
      outcome: 'validation_error',
      detail
    };
    recordAuditEvent(auditEvent);
    return { ok: false, errors: parsed.error.issues.map((i) => i.message), auditEvent };
  }
  const payload = parsed.data;

  // --- Authorization (ABAC/RBAC) ---
  // Submitting a NEW hazard report is CITIXEN's core public, zero-account
  // feature — every 'citizen' visitor may dispatch it. Staff/rep roles act
  // on EXISTING reports through their own consoles (assign/close/flag),
  // which are separate dispatchers, not this one; routing a staff/rep
  // actor through report.submit is a real misuse to catch and deny, not
  // just a hypothetical example.
  if (ctx.role !== 'citizen') {
    const auditEvent: AuditEvent = {
      traceId,
      timestamp,
      actorId,
      actionType: 'report.submit',
      classification,
      outcome: 'denied',
      detail: `role '${ctx.role}' is not permitted to dispatch report.submit`
    };
    recordAuditEvent(auditEvent);
    return {
      ok: false,
      errors: ['This role cannot submit a new report from here.'],
      auditEvent
    };
  }

  // --- Authorization & Audit Dispatcher -> State Store / API Engine ---
  try {
    const result = await apiEngine(payload);
    const auditEvent: AuditEvent = {
      traceId,
      timestamp,
      actorId,
      actionType: 'report.submit',
      classification,
      outcome: 'authorized',
      detail: `report ${result.id} accepted`
    };
    recordAuditEvent(auditEvent);
    return { ok: true, data: result, auditEvent };
  } catch (err) {
    const auditEvent: AuditEvent = {
      traceId,
      timestamp,
      actorId,
      actionType: 'report.submit',
      classification,
      outcome: 'denied',
      detail: err instanceof Error ? err.message : 'API engine error'
    };
    recordAuditEvent(auditEvent);
    return {
      ok: false,
      errors: ['Submission failed — this will be queued offline if you stay on this page.'],
      auditEvent
    };
  }
}
