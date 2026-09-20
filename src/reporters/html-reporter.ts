import { AggregatedReport, Finding } from '../types/index.js';

export function renderHtmlReport(report: AggregatedReport): string {
  const verdictClass = report.verdict === 'PASS' ? 'pass' : report.verdict === 'WARN' ? 'warn' : 'fail';
  const durationSec = (report.durationMs / 1000).toFixed(1);

  const findingsJson = JSON.stringify(report.findings);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codeward Review Report &bull; ${escapeHtml(report.gitRef)}</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --accent: #58a6ff;
      --critical: #f85149;
      --critical-bg: rgba(248, 81, 73, 0.15);
      --warning: #d29922;
      --warning-bg: rgba(210, 153, 34, 0.15);
      --suggestion: #38bdf8;
      --suggestion-bg: rgba(56, 189, 248, 0.15);
      --pass: #3fb950;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 32px 16px; line-height: 1.5; }
    .container { max-width: 1040px; margin: 0 auto; }
    
    header { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    .title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .logo { font-size: 24px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; }
    .badge.fail { background: var(--critical-bg); color: var(--critical); border: 1px solid var(--critical); }
    .badge.warn { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning); }
    .badge.pass { background: rgba(63, 185, 80, 0.15); color: var(--pass); border: 1px solid var(--pass); }
    
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 14px; }
    .meta-item span { display: block; color: var(--text-muted); font-size: 12px; }
    
    .controls { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .filter-btn { background: var(--card-bg); border: 1px solid var(--border); color: var(--text); padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .filter-btn.active { border-color: var(--accent); color: var(--accent); }
    .search-box { flex: 1; min-width: 200px; background: var(--card-bg); border: 1px solid var(--border); color: #fff; padding: 8px 14px; border-radius: 6px; font-size: 14px; }
    .search-box:focus { outline: none; border-color: var(--accent); }

    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px; overflow: hidden; transition: transform 0.1s ease; }
    .card-header { padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); cursor: pointer; }
    .card-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; }
    .sev-pill { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
    .sev-CRITICAL { background: var(--critical-bg); color: var(--critical); border: 1px solid var(--critical); }
    .sev-WARNING { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning); }
    .sev-SUGGESTION { background: var(--suggestion-bg); color: var(--suggestion); border: 1px solid var(--suggestion); }

    .card-body { padding: 18px; font-size: 14px; }
    .loc-tag { font-family: monospace; color: var(--accent); font-size: 13px; margin-bottom: 8px; display: inline-block; }
    .code-block { background: #010409; border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px; overflow-x: auto; margin-top: 10px; white-space: pre; }
    .code-block.fix { border-color: rgba(63, 185, 80, 0.4); color: #7ee787; }
    .code-block.vuln { border-color: rgba(248, 81, 73, 0.4); color: #ff7b72; }
    .fix-header { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-weight: 600; font-size: 13px; color: var(--pass); }
    .copy-btn { background: #21262d; border: 1px solid var(--border); color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; }
    .copy-btn:hover { background: #30363d; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-row">
        <div class="logo">🛡️ CODEWARD</div>
        <div class="badge ${verdictClass}">${report.verdict}</div>
      </div>
      <p style="color: #e6edf3; font-size: 15px;">${escapeHtml(report.summary)}</p>
      <div class="meta-grid">
        <div class="meta-item"><span>TARGET DIFF</span><b>${escapeHtml(report.gitRef)}</b></div>
        <div class="meta-item"><span>LLM ENGINE</span><b>${escapeHtml(report.provider)} (${escapeHtml(report.model)})</b></div>
        <div class="meta-item"><span>AUDITED FILES</span><b>${report.stats.filesReviewed}</b></div>
        <div class="meta-item"><span>AUDIT DURATION</span><b>${durationSec}s</b></div>
        <div class="meta-item"><span>TIMESTAMP</span><b>${new Date(report.timestamp).toLocaleString()}</b></div>
      </div>
    </header>

    <div class="controls">
      <button class="filter-btn active" onclick="setFilter('ALL')">All (${report.stats.total})</button>
      <button class="filter-btn" onclick="setFilter('CRITICAL')" style="color: var(--critical);">Critical (${report.stats.critical})</button>
      <button class="filter-btn" onclick="setFilter('WARNING')" style="color: var(--warning);">Warning (${report.stats.warning})</button>
      <button class="filter-btn" onclick="setFilter('SUGGESTION')" style="color: var(--suggestion);">Suggestion (${report.stats.suggestion})</button>
      <input type="text" class="search-box" id="searchInput" placeholder="Filter findings by file, rule, or text..." oninput="applySearch()">
    </div>

    <div id="findingsContainer"></div>
  </div>

  <script>
    const findings = ${findingsJson};
    let currentFilter = 'ALL';
    let searchQuery = '';

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function render() {
      const container = document.getElementById('findingsContainer');
      const filtered = findings.filter(f => {
        if (currentFilter !== 'ALL' && f.severity !== currentFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return f.title.toLowerCase().includes(q) ||
                 f.file.toLowerCase().includes(q) ||
                 f.rule.toLowerCase().includes(q) ||
                 f.description.toLowerCase().includes(q);
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 48px; color: var(--text-muted); background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border);">No findings match the current criteria.</div>';
        return;
      }

      container.innerHTML = filtered.map((f, i) => \`
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span class="sev-pill sev-\${f.severity}">\${f.severity}</span>
              <span>\${escapeHtml(f.title)}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">\${escapeHtml(f.rule)} &bull; \${escapeHtml(f.agent || 'analyzer')}</div>
          </div>
          <div class="card-body">
            <div class="loc-tag">\${escapeHtml(f.file)}:L\${f.line}\${f.endLine && f.endLine !== f.line ? '-L' + f.endLine : ''}</div>
            <p style="color: #e6edf3; margin-bottom: 12px;">\${escapeHtml(f.description)}</p>
            \${f.codeSnippet ? \`
              <div style="font-weight: 600; font-size: 12px; color: var(--critical);">Flagged Code:</div>
              <div class="code-block vuln">\${escapeHtml(f.codeSnippet)}</div>
            \` : ''}
            \${f.suggestedFix ? \`
              <div class="fix-header">
                <span>Proposed Fix:</span>
                <button class="copy-btn" onclick="navigator.clipboard.writeText(\\\`\${f.suggestedFix.replace(/\\\\/g, '\\\\\\\\').replace(/\\\`/g, '\\\\\\\\\`')}\\\`); this.innerText = 'Copied!'; setTimeout(() => this.innerText = 'Copy', 1500)">Copy</button>
              </div>
              <div class="code-block fix">\${escapeHtml(f.suggestedFix)}</div>
            \` : ''}
          </div>
        </div>
      \`).join('');
    }

    function setFilter(type) {
      currentFilter = type;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.startsWith(type === 'ALL' ? 'All' : type.charAt(0) + type.slice(1).toLowerCase()));
      });
      render();
    }

    function applySearch() {
      searchQuery = document.getElementById('searchInput').value;
      render();
    }

    render();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
