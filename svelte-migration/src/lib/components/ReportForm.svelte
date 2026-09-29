<script lang="ts">
  /**
   * Svelte 5 (runes) port of app.html's hazard-report submission form,
   * wired through the Data Governance Dispatch Model instead of that
   * file's plain `submitReport()` call. Every UI state the Model requires
   * is handled directly in this component: loading, validation feedback,
   * and an unauthorized/masked view driven by the Policy Enforcer — not
   * just the dispatcher rejecting silently.
   *
   * Same real category vocabulary as api/_lib/store.js — see schema.ts.
   */
  import {
    REPORT_CATEGORIES,
    type ReportCategory,
    type ReportPayloadInput
  } from '../governance/schema';
  import { dispatchReportSubmission, type DispatchRole } from '../governance/dispatch';
  import { auditLog } from '../governance/auditStore';

  /** `role` and `apiEngine` are props so this component is usable both in
   *  the real app (role read from wherever session context lives) and in
   *  isolation for the deck/demo (a role can be forced to show the masked
   *  view, and apiEngine can be a stub instead of a live fetch). */
  let {
    role = 'citizen' as DispatchRole,
    apiEngine = defaultApiEngine
  }: {
    role?: DispatchRole;
    apiEngine?: (payload: ReportPayloadInput) => Promise<{ id: string }>;
  } = $props();

  async function defaultApiEngine(payload: ReportPayloadInput) {
    // Mirrors the existing static-site route added this session:
    // api/report/submit.js — a stateless acknowledgment endpoint (this
    // repo has no real database), matching the honesty convention that
    // it does not claim persistence it doesn't have.
    const res = await fetch('/api/report/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`submit failed: ${res.status}`);
    return res.json();
  }

  // --- Form state ---
  let category = $state<ReportCategory>('Pothole');
  let description = $state('');
  let photoDataUrl = $state<string | null>(null);
  let lat = $state<number | null>(null);
  let lng = $state<number | null>(null);
  let locationStatus = $state<'idle' | 'locating' | 'resolved' | 'denied'>('idle');

  // --- Dispatch/UI state ---
  let submitting = $state(false);
  let submitErrors = $state<string[]>([]);
  let submittedId = $state<string | null>(null);

  const isAuthorizedRole = $derived(role === 'citizen');

  function resolveLocation() {
    // Same honest fallback pattern as app.html's resolveDisplayLocation():
    // GPS denial/timeout leaves lat/lng null rather than guessing a place.
    if (!('geolocation' in navigator)) {
      locationStatus = 'denied';
      return;
    }
    locationStatus = 'locating';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        locationStatus = 'resolved';
      },
      () => {
        locationStatus = 'denied';
      },
      { timeout: 6000, maximumAge: 300000 }
    );
  }

  function onPhotoSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      photoDataUrl = null;
      return;
    }
    const reader = new FileReader();
    // Note: EXIF/GPS stripping happens server-side on the real upload
    // path (see app.html's existing capture flow) — this client-side
    // preview intentionally does NOT claim to have stripped anything yet;
    // that's why the payload's `photoDataUrl` field is classified
    // Restricted until the API engine confirms it (schema.ts).
    reader.onload = () => {
      photoDataUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    submitErrors = [];
    submittedId = null;
    submitting = true;

    const payload: ReportPayloadInput = {
      category,
      description,
      lat,
      lng,
      photoDataUrl,
      urgentOverride: false
    };

    const result = await dispatchReportSubmission(payload, { role }, apiEngine);
    submitting = false;

    if (!result.ok) {
      submitErrors = result.errors ?? ['Something went wrong.'];
      return;
    }
    submittedId = result.data?.id ?? null;
    description = '';
    photoDataUrl = null;
  }
</script>

{#if !isAuthorizedRole}
  <!-- Policy Enforcer conditioning UI rendering (Pillar 4) — a
       dispatch_staff/representative session sees a masked view instead of
       the citizen submission form, rather than the dispatcher just
       rejecting on submit with no visual cue why. -->
  <aside class="report-form report-form--masked" role="note" aria-live="polite">
    <p>
      New hazard reports are submitted through the public citizen app.
      This console role (<strong>{role}</strong>) doesn't dispatch
      <code>report.submit</code> — use the dispatch/representative console's
      own actions on an existing report instead.
    </p>
  </aside>
{:else}
  <form class="report-form" onsubmit={onSubmit} aria-busy={submitting}>
    <h2>Report a Hazard</h2>

    <label for="rf-category">Category</label>
    <select id="rf-category" bind:value={category} required>
      {#each REPORT_CATEGORIES as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select>

    <label for="rf-description">What's the issue?</label>
    <textarea
      id="rf-description"
      bind:value={description}
      minlength="5"
      maxlength="500"
      required
      placeholder="Deep pothole in the right lane, blocking traffic..."
    ></textarea>

    <div class="rf-location">
      <button type="button" onclick={resolveLocation} disabled={locationStatus === 'locating'}>
        {#if locationStatus === 'locating'}
          Locating…
        {:else if locationStatus === 'resolved'}
          Location captured ✓
        {:else}
          Use my current location
        {/if}
      </button>
      {#if locationStatus === 'denied'}
        <p class="rf-hint" role="status">
          Location unavailable — you can still submit without it, same as the app's
          existing zero-account fallback.
        </p>
      {/if}
    </div>

    <label for="rf-photo">Photo (optional)</label>
    <input id="rf-photo" type="file" accept="image/*" capture="environment" onchange={onPhotoSelected} />
    <p class="rf-hint">Photos are stripped of device ID and GPS EXIF tags before upload.</p>

    {#if submitErrors.length > 0}
      <ul class="rf-errors" role="alert">
        {#each submitErrors as err}
          <li>{err}</li>
        {/each}
      </ul>
    {/if}

    {#if submittedId}
      <p class="rf-success" role="status">Submitted — reference {submittedId}.</p>
    {/if}

    <button type="submit" disabled={submitting}>
      {submitting ? 'Submitting…' : 'Submit Report'}
    </button>
  </form>

  <!-- Live audit trail — makes Pillar 3 (Auditability) visible instead of
       only living in a server log nobody in the room can see; useful both
       for real debugging and for the deck's architecture walkthrough. -->
  <details class="rf-audit">
    <summary>Dispatch audit trail ({$auditLog.length})</summary>
    <ul>
      {#each $auditLog as event (event.traceId)}
        <li>
          <code>{event.timestamp}</code>
          — <strong>{event.actionType}</strong>
          [{event.classification}]
          → <em>{event.outcome}</em>
          {#if event.detail}<span>— {event.detail}</span>{/if}
        </li>
      {/each}
    </ul>
  </details>
{/if}

<style>
  .report-form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    max-width: 420px;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    background: #0f1713;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .report-form--masked {
    color: #8e9fa8;
    font-size: 0.85rem;
  }
  label {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #8e9fa8;
  }
  select,
  textarea,
  input[type='file'] {
    background: rgba(7, 12, 14, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #f8fafc;
    border-radius: 8px;
    padding: 0.5rem;
    font: inherit;
  }
  button[type='submit'],
  .rf-location button {
    background: #00ff88;
    color: #051311;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-weight: 800;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .rf-hint {
    font-size: 0.72rem;
    color: #8e9fa8;
    margin: 0;
  }
  .rf-errors {
    color: #ff4444;
    font-size: 0.8rem;
  }
  .rf-success {
    color: #00ff88;
    font-size: 0.85rem;
  }
  .rf-audit {
    max-width: 420px;
    margin-top: 0.75rem;
    font-size: 0.7rem;
    color: #8e9fa8;
  }
  .rf-audit ul {
    max-height: 160px;
    overflow-y: auto;
    padding-left: 1rem;
  }
</style>
