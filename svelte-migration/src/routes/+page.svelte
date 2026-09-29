<script lang="ts">
  import ReportForm from '$lib/components/ReportForm.svelte';
  import type { DispatchRole } from '$lib/governance/dispatch';

  // Demo-only role switcher, so the masked/unauthorized view (Policy
  // Enforcer, Pillar 4) is easy to see without wiring real session context.
  let demoRole = $state<DispatchRole>('citizen');
</script>

<main style="max-width:480px;margin:2rem auto;font-family:sans-serif;color:#f8fafc;background:#080c0a;padding:1.5rem;border-radius:16px">
  <h1 style="font-size:1.1rem">Dispatch Model demo — Report Submission</h1>
  <label style="display:block;margin-bottom:1rem;font-size:0.8rem">
    Viewing as role:
    <select bind:value={demoRole}>
      <option value="citizen">citizen</option>
      <option value="dispatch_staff">dispatch_staff</option>
      <option value="representative">representative</option>
    </select>
  </label>

  <ReportForm role={demoRole} />
</main>
