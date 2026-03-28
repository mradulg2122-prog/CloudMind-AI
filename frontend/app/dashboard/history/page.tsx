'use client';
// =============================================================================
// CloudMind AI – app/dashboard/history/page.tsx (v4)
// Full-featured paginated, filterable, searchable prediction history table
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { fetchPredictionHistory } from '@/lib/api';
import { useToast } from '@/lib/toast';

const PAGE_SIZE = 15;

type SortKey = 'created_at' | 'predicted_requests' | 'recommended_servers' | 'action';
type SortDir = 'asc' | 'desc';

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { cls: string; icon: string }> = {
    'SCALE UP':   { cls: 'badge-blue',   icon: '🚀' },
    'SCALE DOWN': { cls: 'badge-green',  icon: '📉' },
    'KEEP SAME':  { cls: 'badge-yellow', icon: '✅' },
  };
  const { cls = 'badge-gray', icon = '—' } = map[action] ?? {};
  return <span className={`badge ${cls}`}>{icon} {action}</span>;
}

function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: string; sortDir: string }) {
  if (col !== sortKey) return <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>↕</span>;
  return <span style={{ color: 'var(--primary)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

export default function HistoryPage() {
  const { toast } = useToast();
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('ALL');
  const [page,    setPage]    = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    fetchPredictionHistory(500)
      .then(data => setRows(data as any[]))
      .catch(() => toast('Failed to load history', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let out = [...rows];
    if (filter !== 'ALL') out = out.filter(r => r.action === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r =>
        String(r.predicted_requests).includes(q) ||
        String(r.recommended_servers).includes(q) ||
        (r.action ?? '').toLowerCase().includes(q) ||
        (r.created_at ?? '').toLowerCase().includes(q)
      );
    }
    out.sort((a, b) => {
      let av: any = a[sortKey]; let bv: any = b[sortKey];
      if (typeof av === 'string') av = av.toLowerCase(); if (typeof bv === 'string') bv = bv.toLowerCase();
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return out;
  }, [rows, filter, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmtDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch { return s; }
  };

  const actionCounts = {
    ALL:        rows.length,
    'SCALE UP': rows.filter(r => r.action === 'SCALE UP').length,
    'SCALE DOWN': rows.filter(r => r.action === 'SCALE DOWN').length,
    'KEEP SAME': rows.filter(r => r.action === 'KEEP SAME').length,
  };

  const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  return (
    <div className="animate-fade">
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="page-title">Prediction History</div>
          <div className="section-sub">{rows.length} total records · Showing {filtered.length} after filters</div>
        </div>
        <button className="btn btn-secondary" onClick={() => { setSearch(''); setFilter('ALL'); setPage(1); }}>
          ✕ Clear Filters
        </button>
      </div>

      {/* ── Filter pills ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(actionCounts).map(([key, cnt]) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setPage(1); }}
            className={filter === key ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            {key} <span style={{ opacity: 0.7, marginLeft: 4 }}>({cnt})</span>
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            className="input"
            placeholder="🔍  Search by action, RPM, servers…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ height: 34 }}
          />
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
        </div>
      ) : pageRows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">No records found</div>
          <div className="empty-sub">Try adjusting your search or filter criteria</div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
          <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="sortable" style={thStyle} onClick={() => toggleSort('created_at')}>
                    Timestamp <SortIcon col="created_at" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="sortable" style={thStyle} onClick={() => toggleSort('predicted_requests')}>
                    Predicted RPM <SortIcon col="predicted_requests" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Load/Server</th>
                  <th className="sortable" style={thStyle} onClick={() => toggleSort('recommended_servers')}>
                    Servers <SortIcon col="recommended_servers" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="sortable" style={thStyle} onClick={() => toggleSort('action')}>
                    Scaling Action <SortIcon col="action" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r: any, i) => (
                  <tr key={r.id ?? i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'monospace' }}>
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {r.created_at ? fmtDate(r.created_at) : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {Math.round(r.predicted_requests).toLocaleString()} rpm
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {Math.round(r.load_per_server)} rpm
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {r.recommended_servers}
                    </td>
                    <td><ActionBadge action={r.action} /></td>
                    <td style={{ fontWeight: 700, color: 'var(--success-dark)', fontSize: 13 }}>
                      ${(r.recommended_servers * 50).toFixed(0)}/hr
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages} · {filtered.length} records
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, idx) => {
              const p = Math.max(1, Math.min(totalPages - 6, page - 3)) + idx;
              return (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)}>{p}</button>
              );
            })}
            <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}
