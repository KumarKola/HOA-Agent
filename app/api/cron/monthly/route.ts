import { NextResponse } from 'next/server';
import { ENTRANCES, GATE_TYPES, incidentTitle } from '@/lib/gates';
import { getMonthIncidents, getOpenIncidents, phoenixMonthStart } from '@/lib/incidents';
import { emailMonthly } from '@/lib/email';
import { age } from '@/lib/util';

export const dynamic = 'force-dynamic';

// Runs on the 1st of each month (vercel.json). Emails the board last month's summary.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const month = await getMonthIncidents(1);
  const open = await getOpenIncidents();
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(phoenixMonthStart(1).getTime() - 7 * 3600 * 1000),
  );
  const fixed = month.filter((i) => i.resolution === 'fixed' && i.resolved_at);
  const avgH = fixed.length
    ? fixed.reduce((s, i) => s + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime()), 0) / fixed.length / 3600000
    : null;
  const cell = 'padding:4px 10px;border-bottom:1px solid #dde3e2;text-align:left';
  const rows = ENTRANCES.map((e) => {
    const counts = GATE_TYPES.map((g) => month.filter((i) => i.entrance === e.id && i.gate === g.id).length);
    return `<tr><td style="${cell}">${e.name}</td>${counts.map((c) => `<td style="${cell}">${c}</td>`).join('')}<td style="${cell}"><b>${counts.reduce((a, b) => a + b, 0)}</b></td></tr>`;
  }).join('');
  const oldest = open[0];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c2a30">
<h2 style="margin:0 0 8px">Gate report for ${label}</h2>
<p><b>${month.length}</b> incidents reported. ${fixed.length} fixed${avgH !== null ? `, average time to fix <b>${avgH.toFixed(1)} hours</b>` : ''}. ${open.length} still open today.</p>
<table style="border-collapse:collapse;font-size:14px"><tr><th style="${cell}">Entrance</th>${GATE_TYPES.map((g) => `<th style="${cell}">${g.label}</th>`).join('')}<th style="${cell}">Total</th></tr>${rows}</table>
${oldest ? `<p>Longest open: <b>#${oldest.id} ${incidentTitle(oldest)}</b>, open ${age(oldest.created_at)}.</p>` : '<p>No incidents are open.</p>'}
<p><a href="${(process.env.SITE_URL || '').replace(/\/$/, '')}/dashboard">Open the live dashboard</a></p></div>`;
  await emailMonthly(`Liberty gate report: ${label}`, html);
  return NextResponse.json({ month: label, incidents: month.length, open: open.length });
}
