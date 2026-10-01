'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { timeAgo } from '@/lib/device-view';
import type { WakeLogDto } from '@/lib/types';
import { useApp } from './AppProvider';
import { Icon } from './Icons';
import { Sheet } from './Sheet';

const RESULT_LABEL = { sent: 'Sent', partial: 'Partly sent', failed: 'Failed' } as const;
const RESULT_TONE = { sent: 'pill--ok', partial: 'pill--warn', failed: 'pill--danger' } as const;

export function HistoryView({ initial }: { initial: { items: WakeLogDto[]; total: number } }) {
  const { api, toast } = useApp();
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await api<{ items: WakeLogDto[]; total: number }>(`/api/history?limit=50&offset=${items.length}`);
      setItems((current) => [...current, ...page.items]);
      setTotal(page.total);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function clear() {
    setConfirming(false);
    try {
      await api('/api/history', { method: 'DELETE' });
      setItems([]);
      setTotal(0);
      toast('History cleared.', 'success');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Wake history</h1>
          <p>{total === 0 ? 'No wake attempts yet.' : `${total} attempt${total === 1 ? '' : 's'} logged on this server.`}</p>
        </div>
        {total > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(true)}>
            <Icon name="trash" />
            Clear
          </button>
        )}
      </header>

      <div className="alert" style={{ marginBottom: 16 }}>
        <Icon name="info" />
        <span>
          “Sent” means the packets left this server. Wake-on-LAN has no acknowledgement, so ConnectWOL cannot know whether the computer actually woke up.
        </span>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <h2>Nothing logged</h2>
          <p>Every time you wake a computer, the attempt shows up here.</p>
        </div>
      ) : (
        <ul className="log">
          {items.map((item) => (
            <li key={item.id} className="log__item">
              <div className="log__top">
                <span className="log__name">{item.deviceName}</span>
                <span className={`pill ${RESULT_TONE[item.result]}`}>{RESULT_LABEL[item.result]}</span>
              </div>
              <span className="log__time" title={new Date(item.createdAt).toLocaleString()}>
                {timeAgo(item.createdAt)} · {item.mode === 'remote' ? 'direct to another network' : 'same network'} · ×{item.repeat}
              </span>
              <span className="log__detail">
                <span className="mono">{item.mac}</span>
                {item.destinations.length > 0 && <> → <span className="mono">{item.destinations.join(', ')}</span></>}
              </span>
              {item.result !== 'sent' && item.detail && <span className="log__detail">{item.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {items.length < total && (
        <div style={{ display: 'grid', placeItems: 'center', marginTop: 18 }}>
          <button type="button" className="btn btn--ghost" onClick={() => void loadMore()} disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Load more
          </button>
        </div>
      )}

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Clear the history?"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" onClick={() => void clear()}>
              <Icon name="trash" /> Clear history
            </button>
          </>
        }
      >
        <p>All {total} entries will be permanently removed from this server.</p>
      </Sheet>
    </div>
  );
}
