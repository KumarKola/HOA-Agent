'use client';

import { useActionState } from 'react';
import { saveTracking, type SaveState } from './actions';

export default function TrackingForm({ id, ticket, update }: { id: number; ticket: string; update: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveTracking, {
    ok: true,
    message: '',
    ticket,
    update,
  });
  return (
    <form action={action} className="step" style={{ gap: 8 }}>
      <input type="hidden" name="id" value={id} />
      <label className="field" htmlFor={`ticket-${id}`}>
        CityCync ticket no.
        <input id={`ticket-${id}`} name="ticket" defaultValue={state.ticket} placeholder="e.g. WO-50117" maxLength={40} />
      </label>
      <label className="field" htmlFor={`update-${id}`}>
        Update for residents (shown on the status page)
        <input
          id={`update-${id}`}
          name="update"
          defaultValue={state.update}
          placeholder="e.g. Gate vendor coming Thursday morning"
          maxLength={200}
        />
      </label>
      <div className="inline">
        <button className="btn ghost" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {state.message && (
          <span className="small" role="status" style={{ color: state.ok ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>
            {state.ok ? '✓ ' : ''}
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
