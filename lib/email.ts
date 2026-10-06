import { incidentTitle } from './gates';
import { getReports, type Incident } from './incidents';
import { phx, age } from './util';

const list = (v?: string) =>
  (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const site = () => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Sends through Resend when RESEND_API_KEY is set; otherwise prints to the server log. */
export async function sendEmail(opts: { to: string[]; cc?: string[]; subject: string; html: string }): Promise<boolean> {
  const to = opts.to.filter(Boolean);
  if (!to.length) {
    console.log(`[email skipped: no recipient] ${opts.subject}`);
    return false;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email not sent: RESEND_API_KEY unset]\nTo: ${to.join(', ')}\nCc: ${(opts.cc || []).join(', ')}\nSubject: ${opts.subject}\n`);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Liberty Gates <onboarding@resend.dev>',
      to,
      cc: opts.cc?.filter(Boolean),
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) console.error('Email failed', res.status, await res.text());
  return res.ok;
}

async function incidentBody(inc: Incident, intro: string): Promise<string> {
  const reports = await getReports(inc.id);
  const rows = reports
    .filter((r) => r.kind === 'report')
    .map((r) => {
      const who = [r.reporter_name, r.reporter_lot && `Lot ${r.reporter_lot}`].filter(Boolean).join(', ');
      return `<li>${esc(phx(r.created_at))}${who ? ` · ${esc(who)}` : ''}${r.note ? `<br>${esc(r.note)}` : ''}</li>`;
    })
    .join('');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c2a30">
<p>${intro}</p>
<table style="border-collapse:collapse;font-size:15px">
<tr><td style="padding:2px 12px 2px 0;color:#5b6b70">Incident</td><td><b>#${inc.id}</b></td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#5b6b70">Gate</td><td><b>${esc(incidentTitle(inc))}</b></td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#5b6b70">First reported</td><td>${esc(phx(inc.created_at))} (${esc(age(inc.created_at))} ago)</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#5b6b70">Residents reporting</td><td>${inc.confirmations}</td></tr>
${inc.citycync_ticket ? `<tr><td style="padding:2px 12px 2px 0;color:#5b6b70">CityCync ticket</td><td>${esc(inc.citycync_ticket)}</td></tr>` : ''}
</table>
${rows ? `<p style="margin-bottom:4px"><b>Resident notes</b></p><ul style="margin-top:0">${rows}</ul>` : ''}
<p>Live status for all gates: <a href="${site()}/dashboard">${site()}/dashboard</a></p>
<p style="color:#5b6b70;font-size:13px">Sent automatically by the Liberty community gate reporting site. Please reply to the HOA liaison with the CityCync ticket number.</p>
</div>`;
}

export async function emailNewIncident(inc: Incident) {
  const security = inc.issue === 'intruder';
  await sendEmail({
    to: list(process.env.MANAGER_EMAIL),
    cc: list(process.env.LIAISON_EMAIL),
    subject: `${security ? 'Security report' : 'Gate problem'} #${inc.id}: ${incidentTitle(inc)}`,
    html: await incidentBody(
      inc,
      security
        ? 'Residents reported an intruder or suspicious activity at a community gate.'
        : 'Residents reported a gate problem in the Liberty community. Please open a work order.',
    ),
  });
}

export async function emailEscalation(inc: Incident) {
  await sendEmail({
    to: list(process.env.MANAGER_EMAIL),
    cc: [...list(process.env.PRESIDENT_EMAIL), ...list(process.env.LIAISON_EMAIL)],
    subject: `Still open after 48 hours: #${inc.id} ${incidentTitle(inc)}`,
    html: await incidentBody(inc, 'This gate problem has been open for more than 48 hours. The HOA president is copied.'),
  });
}

export async function emailMonthly(subject: string, html: string) {
  await sendEmail({ to: list(process.env.BOARD_EMAILS), cc: list(process.env.LIAISON_EMAIL), subject, html });
}
