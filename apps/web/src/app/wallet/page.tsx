'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { api, getErrorMsg } from '@/lib/api';
import { useRouter } from 'next/navigation';

const PROVIDERS = [
  { id: 'MTN_MOMO',     label: 'MTN MoMo',    icon: '📱', color: '#f59e0b', placeholder: '07XXXXXXXX' },
  { id: 'AIRTEL_MONEY', label: 'Airtel Money', icon: '📲', color: '#ef4444', placeholder: '07XXXXXXXX' },
  { id: 'USDT',         label: 'USDT',         icon: '₮',  color: '#22c55e', placeholder: 'TRC20 address' },
];

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [balance, setBalance]   = useState<any>(null);
  const [txs, setTxs]           = useState<any[]>([]);
  const [tab, setTab]           = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [provider, setProvider] = useState('MTN_MOMO');
  const [amount, setAmount]     = useState(0);
  const [phone, setPhone]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    api.getBalance().then(({ data }) => setBalance(data)).catch(() => {});
    api.getTransactions().then(({ data }) => setTxs(data?.data || [])).catch(() => {});
  }, [user]);

  async function handleAction() {
    if (!amount || !phone) { setMsg({ type: 'err', text: 'Fill in all fields' }); return; }
    setLoading(true); setMsg(null);
    try {
      if (tab === 'deposit') {
        await api.deposit({ amount, provider, phoneOrAddress: phone });
        setMsg({ type: 'ok', text: 'Deposit request sent! Check your phone to confirm.' });
      } else {
        await api.withdraw({ amount, provider, phoneOrAddress: phone });
        setMsg({ type: 'ok', text: 'Withdrawal initiated! Funds will arrive shortly.' });
      }
      const { data } = await api.getBalance();
      setBalance(data);
    } catch (err) {
      setMsg({ type: 'err', text: getErrorMsg(err) });
    } finally { setLoading(false); }
  }

  if (authLoading || !user) return null;

  const selectedProv = PROVIDERS.find(p => p.id === provider)!;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 1.5rem 4rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '2rem' }}>Wallet</h1>

        {/* Balance cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Real Balance', value: balance?.real ?? '—', color: 'var(--green-pos)', icon: '💵' },
            { label: 'Bonus Balance', value: balance?.bonus ?? '—', color: 'var(--purple-light)', icon: '🎁' },
            { label: 'Total',  value: balance?.total ?? '—', color: 'var(--gold)', icon: '💰' },
          ].map(b => (
            <div key={b.label} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>{b.icon}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{b.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: b.color }}>
                {typeof b.value === 'number' ? `${b.value.toLocaleString()} RWF` : b.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {(['deposit','withdraw','history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', borderRadius: '50px', border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--purple-primary)' : 'var(--bg-elevated)',
              color: tab === t ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.88rem', transition: 'all 0.15s',
            }}>
              {t === 'deposit' ? '⬇ Deposit' : t === 'withdraw' ? '⬆ Withdraw' : '📋 History'}
            </button>
          ))}
        </div>

        {/* Deposit / Withdraw form */}
        {(tab === 'deposit' || tab === 'withdraw') && (
          <div className="card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
              {tab === 'deposit' ? 'Add funds to wallet' : 'Withdraw to mobile money'}
            </h3>

            {msg && (
              <div style={{ background: msg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 'var(--radius-md)', padding: '0.75rem', color: msg.type === 'ok' ? 'var(--green-pos)' : 'var(--red-neg)', fontSize: '0.87rem', marginBottom: '1.25rem' }}>{msg.text}</div>
            )}

            {/* Provider selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Payment provider</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => setProvider(p.id)} style={{
                    flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    border: `2px solid ${provider === p.id ? p.color : 'var(--border)'}`,
                    background: provider === p.id ? `${p.color}18` : 'var(--bg-elevated)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: '1.4rem' }}>{p.icon}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: provider === p.id ? p.color : 'var(--text-secondary)' }}>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick amounts */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Amount (RWF)</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                {QUICK_AMOUNTS.map(a => (
                  <button key={a} onClick={() => setAmount(a)} style={{
                    padding: '6px 14px', borderRadius: '50px', border: `1px solid ${amount === a ? 'var(--purple-primary)' : 'var(--border)'}`,
                    background: amount === a ? 'rgba(124,58,237,0.15)' : 'var(--bg-elevated)',
                    color: amount === a ? 'var(--purple-light)' : 'var(--text-secondary)',
                    fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{a.toLocaleString()}</button>
                ))}
              </div>
              <input type="number" className="input" placeholder="Or enter custom amount"
                value={amount || ''} onChange={e => setAmount(parseInt(e.target.value) || 0)} min={500} />
            </div>

            {/* Phone / Address */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                {provider === 'USDT' ? 'TRC20 / ERC20 Address' : 'Phone Number'}
              </label>
              <input className="input" placeholder={selectedProv.placeholder} value={phone} onChange={e => setPhone(e.target.value)} />
              {tab === 'deposit' && provider !== 'USDT' && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>You will receive a USSD prompt to confirm the payment.</p>
              )}
            </div>

            {/* Fee info */}
            {amount > 0 && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
                <div><div style={{ color: 'var(--text-muted)' }}>Amount</div><div style={{ fontWeight: 700 }}>{amount.toLocaleString()} RWF</div></div>
                <div><div style={{ color: 'var(--text-muted)' }}>Fee</div><div style={{ fontWeight: 700, color: 'var(--red-neg)' }}>−{Math.max(100, Math.floor(amount * 0.01)).toLocaleString()} RWF</div></div>
                <div><div style={{ color: 'var(--text-muted)' }}>{tab === 'deposit' ? 'You receive' : 'You get'}</div><div style={{ fontWeight: 700, color: 'var(--green-pos)' }}>{(amount - Math.max(100, Math.floor(amount * 0.01))).toLocaleString()} RWF</div></div>
              </div>
            )}

            <button onClick={handleAction} disabled={loading} className={tab === 'deposit' ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Processing…' : tab === 'deposit' ? '⬇ Deposit Now' : '⬆ Withdraw Now'}
            </button>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
              🔒 Secured · {tab === 'deposit' ? 'Min 500 RWF' : 'Min 1,000 RWF'} · Funds held on game join, deducted on game start
            </p>
          </div>
        )}

        {/* Transaction history */}
        {tab === 'history' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {txs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions yet.</div>
            ) : (
              txs.map((tx: any) => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: tx.type === 'DEPOSIT' || tx.type === 'GAME_PAYOUT' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                      {tx.type === 'DEPOSIT' ? '⬇' : tx.type === 'GAME_PAYOUT' ? '🏆' : tx.type === 'GAME_ENTRY' ? '🎮' : '⬆'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{tx.type.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(tx.createdAt).toLocaleDateString()} · {tx.provider}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: ['DEPOSIT','GAME_PAYOUT'].includes(tx.type) ? 'var(--green-pos)' : 'var(--red-neg)' }}>
                      {['DEPOSIT','GAME_PAYOUT'].includes(tx.type) ? '+' : '-'}{Number(tx.net).toLocaleString()} RWF
                    </div>
                    <div style={{ fontSize: '0.72rem', color: tx.status === 'COMPLETED' ? 'var(--green-pos)' : tx.status === 'PENDING' ? 'var(--gold)' : 'var(--text-muted)' }}>{tx.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
