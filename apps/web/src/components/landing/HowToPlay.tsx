'use client';
import React, { useState } from 'react';
import type { IconProps } from '@/components/layout/Icons';
import {
  BanknoteIcon, DiceIcon, HomeIcon, CoinsIcon, PrisonIcon, TradeIcon,
  HammerIcon, TrophyIcon, BuildIcon, HotelIcon, CyberIcon,
  ArrowUpIcon, ArrowDownIcon, TrashIcon, PlayIcon, ChevronDownIcon,
} from '@/components/layout/Icons';

type RuleItem = { Icon: React.ComponentType<IconProps>; title: string; sub: string };

const RULES: RuleItem[] = [
  { Icon: BanknoteIcon, title: 'All players start with 150,000 RWF.', sub: 'In-game money only — real entry fee is separate.' },
  { Icon: DiceIcon, title: 'On your turn, roll the dice to move forward.', sub: "Got doubles? You'll have another turn!" },
  { Icon: HomeIcon, title: 'Purchase properties and grow your financial empire.', sub: 'Once you own a property, other players pay rent when they land on it.' },
];

const EXTRA_RULES: RuleItem[] = [
  { Icon: HomeIcon, title: 'Build evenly across a full color set.', sub: 'You must own all properties in a group before building houses or hotels.' },
  { Icon: CoinsIcon, title: 'Pass Start to collect 20,000 RWF.', sub: 'Every time you complete a lap of the board.' },
  { Icon: PrisonIcon, title: 'Go to Prison — three ways.', sub: 'Roll doubles three times in a row, draw a "Go to Prison" card, or land on the space.' },
  { Icon: TradeIcon, title: 'Trade properties, cash & jail-free cards.', sub: "Negotiate with other players any time it's your turn. In paid lobbies, fair trade rules apply." },
  { Icon: HammerIcon, title: 'Auction when a property goes unbought.', sub: 'If a player skips buying, it goes to auction — highest bidder wins.' },
  { Icon: BanknoteIcon, title: 'Mortgage properties to raise cash.', sub: 'Get 50% of the property price. Unmortgage for 110% to resume collecting rent.' },
  { Icon: TrophyIcon, title: 'Last player standing wins.', sub: 'When all other players go bankrupt, you win the pot. We take our 10% cut; the rest is yours.' },
];

const PROPERTY_EXAMPLE = {
  name: 'Kigali CBD',
  flag: 'RW',
  color: '#6d28d9',
  rents: [
    { label: 'with rent', value: '10,000' },
    { label: 'with one house', value: '35,000' },
    { label: 'with two houses', value: '100,000' },
    { label: 'with three houses', value: '300,000' },
    { label: 'with four houses', value: '450,000' },
    { label: 'with a hotel', value: '500,000' },
  ],
  price: '70,000',
  housePrice: '20,000',
  hotelPrice: '20,000',
};

function RuleRow({ Icon, title, sub, compact }: RuleItem & { compact?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: compact ? '0.75rem' : '1.25rem', alignItems: 'flex-start' }}>
      <div style={{
        width: compact ? 32 : 48, height: compact ? 32 : 48, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, border: '1px solid var(--border)', color: 'var(--purple-light)',
      }}>
        <Icon size={compact ? 16 : 22} />
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: compact ? '0.9rem' : '1rem', marginBottom: '0.2rem' }}>{title}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: compact ? '0.82rem' : '0.87rem', lineHeight: 1.5 }}>{sub}</div>
      </div>
    </div>
  );
}

export function HowToPlay() {
  const [showAll, setShowAll] = useState(false);

  return (
    <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem 5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3rem', alignItems: 'start' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '2rem', color: 'var(--text-primary)' }}>
            How to play
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {RULES.map((r, i) => <RuleRow key={i} {...r} />)}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <BuildIcon size={22} />
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                  Own a full property set? Start building houses and hotels
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.87rem', lineHeight: 1.6, marginLeft: '1.85rem' }}>
                Players will pay you a large amount of money when they land on properties with buildings.
                Build hotels to maximize income and make other players lose their money.
              </p>

              <div style={{ display: 'flex', gap: '6px', marginLeft: '1.85rem', flexWrap: 'wrap' }}>
                {[
                  { name: 'Kigali CBD', color: '#6d28d9', code: 'RW', hotels: 0, houses: 4 },
                  { name: 'Tokyo', color: '#6d28d9', code: 'JP', hotels: 1, houses: 0 },
                  { name: 'REG', color: '#374151', code: 'UT', hotels: 0, houses: 0, utility: true },
                  { name: 'New York', color: '#166534', code: 'US', hotels: 0, houses: 3 },
                ].map((p, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)', overflow: 'hidden', minWidth: '80px', textAlign: 'center',
                  }}>
                    <div style={{ height: '6px', background: p.color }} />
                    <div style={{ padding: '8px 6px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>{p.code}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{p.name}</div>
                      {p.hotels > 0 && <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'center' }}><HotelIcon size={14} /></div>}
                      {p.houses > 0 && !p.hotels && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--green-pos)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                          <HomeIcon size={12} /> ×{p.houses}
                        </div>
                      )}
                      {'utility' in p && p.utility && (
                        <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'center' }}><CyberIcon size={14} /></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!showAll ? (
                <button onClick={() => setShowAll(true)} style={{
                  background: 'none', border: '1px solid var(--border-bright)',
                  borderRadius: 'var(--radius-md)', color: 'var(--purple-light)',
                  padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem',
                  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}>
                  Show all rules <ChevronDownIcon size={14} />
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {EXTRA_RULES.map((r, i) => <RuleRow key={i} {...r} compact />)}
                  <button onClick={() => setShowAll(false)} style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
                    padding: '8px 16px', cursor: 'pointer', fontSize: '0.82rem', alignSelf: 'flex-start',
                  }}>
                    Show less
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginTop: '2.5rem', color: 'var(--purple-light)', fontWeight: 700, fontSize: '1.05rem',
          }}>
            <PlayIcon size={18} />
            Be rich. Get richer. Do not bankrupt.
          </div>
        </div>

        <div style={{ position: 'sticky', top: '80px' }}>
          <PropertyCard />
        </div>
      </div>
    </section>
  );
}

function PropertyCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {['100$', 'Kigali CBD', 'Surprise'].map((l, i) => (
          <div key={i} style={{
            background: i === 1 ? 'rgba(124,58,237,0.2)' : 'var(--bg-elevated)',
            border: '1px solid ' + (i === 1 ? 'var(--purple-primary)' : 'var(--border)'),
            borderRadius: 'var(--radius-sm)', padding: '4px 8px',
            fontSize: '0.7rem', color: i === 1 ? 'white' : 'var(--text-muted)',
          }}>{l}</div>
        ))}
      </div>

      <div className="card" style={{ width: '220px', overflow: 'hidden' }}>
        <div style={{ height: '8px', background: '#6d28d9' }} />
        <div style={{ padding: '1rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>RW</div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Kigali CBD</div>
          </div>

          <div style={{ fontSize: '0.78rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>when</span><span>get</span>
            </div>
            {PROPERTY_EXAMPLE.rents.map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '3px 0',
                color: i === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                fontWeight: i > 0 ? 500 : 400,
              }}>
                <span>{r.label}</span>
                <span style={{ color: 'var(--green-pos)' }}>{r.value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '0.75rem' }}>
            <button style={{ flex: 1, padding: '8px', background: 'var(--purple-primary)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
              <ArrowUpIcon size={16} />
            </button>
            <button style={{ flex: 1, padding: '8px', background: 'var(--purple-primary)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
              <ArrowDownIcon size={16} />
            </button>
            <button style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--red-neg)', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
              <TrashIcon size={16} />
            </button>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: '0.75rem', paddingTop: '0.75rem',
            borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-secondary)',
          }}>
            <div><div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Price</div><div style={{ fontWeight: 600 }}>70,000</div></div>
            <div><div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', display: 'flex', justifyContent: 'center' }}><HomeIcon size={12} /></div><div style={{ fontWeight: 600 }}>20,000</div></div>
            <div><div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', display: 'flex', justifyContent: 'center' }}><HotelIcon size={12} /></div><div style={{ fontWeight: 600 }}>20,000</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
