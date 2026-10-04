import React, { useState } from 'react';
import { CryptoStatusBadge } from '../common/CryptoStatusBadge';
import {
  IconSearch,
  IconArrowDownRight,
  IconArrowUpRight,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconX,
} from '../common/Icons';

export interface CryptoLedgerItem {
  id: string;
  type: 'deposit' | 'withdrawal' | string;
  asset: 'USDT' | 'BTC' | string;
  network: string;
  amount: number;
  amountUsd?: number;
  feeAmount?: number;
  netAmount?: number;
  txHash?: string;
  toAddress?: string;
  status: string;
  rejectionReason?: string;
  internalNotes?: string;
  createdAt: string;
  completedAt?: string;
  proofImageUrl?: string;
}

interface Props {
  transactions: CryptoLedgerItem[];
  stealthMode?: boolean;
}

export const CryptoActivityLedger: React.FC<Props> = ({ transactions, stealthMode }) => {
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<CryptoLedgerItem | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const getExplorerUrl = (hash: string, network: string) => {
    if (!hash) return '#';
    if (network?.includes('TRC20')) return `https://tronscan.org/#/transaction/${hash}`;
    if (network?.includes('ERC20')) return `https://etherscan.io/tx/${hash}`;
    if (network?.includes('BEP20')) return `https://bscscan.com/tx/${hash}`;
    if (network?.includes('BTC')) return `https://mempool.space/tx/${hash}`;
    return `https://blockchair.com/search?q=${hash}`;
  };

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.asset.toLowerCase().includes(q) ||
        t.network.toLowerCase().includes(q) ||
        (t.txHash && t.txHash.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const fmtUsd = (val: number) => {
    if (stealthMode) return '$ ••••••••';
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      marginTop: 'var(--space-6)',
      boxShadow: 'var(--shadow-card)',
    }}>
      {/* Header & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
            Crypto Payment Activity & Audit Ledger
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Real-time on-chain verification tracking for all manual deposits and withdrawals.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: 250,
        }}>
          <IconSearch size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search TXID, asset, ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '12px',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'All Activity' },
          { id: 'deposit', label: 'Deposits' },
          { id: 'withdrawal', label: 'Withdrawals' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id as any)}
            style={{
              background: filterType === tab.id ? 'var(--bg-elevated)' : 'transparent',
              border: filterType === tab.id ? '1px solid var(--brand-mint-500)' : '1px solid var(--border-subtle)',
              color: filterType === tab.id ? 'var(--brand-mint-500)' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}

        <div style={{ width: 1, background: 'var(--border-subtle)', margin: '0 4px' }} />

        {[
          { id: 'all', label: 'All Statuses' },
          { id: 'PENDING_VERIFICATION', label: 'Pending Verification' },
          { id: 'PENDING_REVIEW', label: 'Under Review' },
          { id: 'COMPLETED', label: 'Completed' },
          { id: 'REJECTED', label: 'Declined' },
        ].map(st => (
          <button
            key={st.id}
            type="button"
            onClick={() => setFilterStatus(st.id)}
            style={{
              background: filterStatus === st.id ? 'var(--bg-elevated)' : 'transparent',
              border: '1px solid var(--border-subtle)',
              color: filterStatus === st.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Table / List View */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: 8 }}>📑</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>No crypto activity records match your criteria.</div>
          <div style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
            Submit a deposit claim or request a withdrawal to see verified records here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(tx => {
            const isDeposit = tx.type === 'deposit';
            return (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1.4fr 1.2fr 1fr auto',
                  alignItems: 'center',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  background: isDeposit ? 'var(--color-gain-bg)' : 'var(--color-loss-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isDeposit ? (
                    <IconArrowDownRight size={16} color="var(--color-gain)" />
                  ) : (
                    <IconArrowUpRight size={16} color="var(--color-loss)" />
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isDeposit ? 'Crypto Deposit' : 'Crypto Withdrawal'} • {tx.asset}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {tx.network?.replace('_', ' ')} • {new Date(tx.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <CryptoStatusBadge status={tx.status} size="sm" />
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {tx.txHash ? (
                    <span>{tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Pending Dispatch</span>
                  )}
                </div>

                <div style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  fontSize: 'var(--text-base)',
                  color: isDeposit ? 'var(--color-gain)' : 'var(--color-loss)',
                }}>
                  {isDeposit ? '+' : '-'}{fmtUsd(tx.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction Receipt Drawer Modal */}
      {selectedTx && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 'var(--z-modal)',
          padding: 'var(--space-4)',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: 520,
            padding: '24px',
            boxShadow: 'var(--shadow-modal)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-sm)',
                  background: selectedTx.type === 'deposit' ? 'var(--color-gain-bg)' : 'var(--color-loss-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {selectedTx.type === 'deposit' ? '↓' : '↑'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                    {selectedTx.type === 'deposit' ? 'Deposit Audit Receipt' : 'Withdrawal Audit Receipt'}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {selectedTx.id}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Status Highlight Card */}
            <div style={{
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verification State</div>
                <div style={{ marginTop: 4 }}>
                  <CryptoStatusBadge status={selectedTx.status} />
                </div>
              </div>
              <div style={{
                textAlign: 'right',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xl)',
                fontWeight: 800,
                color: selectedTx.type === 'deposit' ? 'var(--color-gain)' : 'var(--color-loss)',
              }}>
                {selectedTx.type === 'deposit' ? '+' : '-'}${selectedTx.amount.toFixed(2)} USD
              </div>
            </div>

            {/* Audit Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--text-xs)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Asset / Network:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedTx.asset} ({selectedTx.network})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Initiated Timestamp:</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {new Date(selectedTx.createdAt).toLocaleString()}
                </span>
              </div>
              {selectedTx.toAddress && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Address:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {selectedTx.toAddress.slice(0, 10)}...{selectedTx.toAddress.slice(-6)}
                  </span>
                </div>
              )}
              {selectedTx.feeAmount ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Network Gas Fee:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    ${selectedTx.feeAmount.toFixed(2)}
                  </span>
                </div>
              ) : null}

              {selectedTx.txHash && (
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 6,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Blockchain Transaction Hash (TXID):</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--brand-mint-500)',
                      wordBreak: 'break-all',
                    }}>
                      {selectedTx.txHash}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedTx.txHash!)}
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '4px 8px',
                          color: copiedHash ? 'var(--brand-mint-500)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                        title="Copy Hash"
                      >
                        {copiedHash ? '✓' : <IconCopy size={12} />}
                      </button>
                      <a
                        href={getExplorerUrl(selectedTx.txHash, selectedTx.network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'var(--brand-mint-500)',
                          color: '#07090e',
                          borderRadius: 'var(--radius-xs)',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          textDecoration: 'none',
                        }}
                        title="View on Explorer"
                      >
                        <IconExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {selectedTx.rejectionReason && (
                <div style={{
                  background: 'var(--color-loss-bg)',
                  border: '1px solid var(--color-loss-border)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-loss)',
                  marginTop: 6,
                }}>
                  <strong>Compliance Rejection Reason:</strong>
                  <div style={{ marginTop: 2 }}>{selectedTx.rejectionReason}</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
