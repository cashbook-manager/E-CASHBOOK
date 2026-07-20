export function fmtMoney(n: number | null | undefined, currency = 'OMR'): string {
  const v = Number(n ?? 0);
  return `${currency} ${v.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })}`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  // Mobile browsers (especially iOS Safari) can silently ignore a click on an
  // anchor that isn't actually attached to the page, so we mount it, click it,
  // then clean it up right after.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a moment to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');
}

export function exportCSV(filename: string, rows: (string | number)[][]) {
  downloadFile(filename, toCSV(rows), 'text/csv;charset=utf-8;');
}

export function printHTML(title: string, bodyHtml: string) {
  const html = `<!doctype html><html><head><title>${title}</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;padding:24px;color:#111;}
    h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:0 0 16px;color:#555}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
    th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb}
    th{background:#f9fafb;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
    .muted{color:#6b7280} .right{text-align:right}
    .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600}
    .print-btn{position:fixed;top:12px;right:12px;padding:10px 16px;border-radius:10px;border:none;background:#0284c7;color:#fff;font-weight:600;font-size:14px}
    @media print{.no-print,.print-btn{display:none}}
  </style></head><body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  ${bodyHtml}
  </body></html>`;

  // Opening a real Blob URL in a new tab is far more reliable across mobile
  // browsers and in-app webviews than window.open('') + document.write, which
  // many mobile browsers block or silently no-op.
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');

  if (!w) {
    // Popup was blocked (common in some mobile webviews). Fall back to
    // downloading the report as an HTML file the user can open and print
    // from their device's own browser/share sheet.
    downloadFile(`${title.toLowerCase().replace(/\s+/g, '-')}.html`, html, 'text/html');
    URL.revokeObjectURL(url);
    return;
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
}