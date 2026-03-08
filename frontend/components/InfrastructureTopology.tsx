'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  recommendedServers: number;
  cpuUsage: number;
  action?: 'SCALE UP' | 'SCALE DOWN' | 'KEEP SAME';
}

export default function InfrastructureTopology({ recommendedServers, cpuUsage, action }: Props) {
  const servers = Array.from({ length: recommendedServers }, (_, i) => {
    const variation = Math.sin(i * 2.3) * 0.15;
    const serverCpu = Math.max(0, Math.min(100, cpuUsage + variation * cpuUsage));
    return { id: i + 1, cpu: Math.round(serverCpu) };
  });

  const getCpuColor = (cpu: number) => {
    if (cpu >= 85) return '#f87171';
    if (cpu >= 65) return '#fbbf24';
    return '#4ade80';
  };

  const glowColor =
    action === 'SCALE UP'
      ? 'rgba(34,197,94,0.15)'
      : action === 'SCALE DOWN'
      ? 'rgba(239,68,68,0.15)'
      : 'rgba(59,130,246,0.08)';

  return (
    <section>
      <div className="section-title" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
        Infrastructure Topology
      </div>

      <motion.div
        layout
        style={{
          borderRadius: '18px',
          padding: '2rem 2.25rem',
          border: '1px solid rgba(59,130,246,0.15)',
          background: 'linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(15,23,42,0.7) 100%)',
          boxShadow: `0 0 40px ${glowColor}`,
          transition: 'box-shadow 0.6s ease',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.1rem' }}>
          <AnimatePresence mode="popLayout">
            {servers.map(({ id, cpu }) => {
              const cpuColor = getCpuColor(cpu);
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, scale: 0.4, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.4, y: 20 }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 24,
                    delay: (id - 1) * 0.06,
                  }}
                  whileHover={{ y: -6, boxShadow: `0 12px 28px ${cpuColor}30`, transition: { duration: 0.2 } }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.85rem',
                    borderRadius: '14px',
                    padding: '1.5rem 1.25rem 1.25rem',
                    border: `1px solid ${cpuColor}35`,
                    background: 'rgba(13,27,42,0.85)',
                    minWidth: '115px',
                    boxShadow: `0 4px 16px ${cpuColor}15`,
                    cursor: 'default',
                  }}
                >
                  {/* Pulsing status dot */}
                  <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: id * 0.3 }}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: cpuColor,
                        boxShadow: `0 0 6px ${cpuColor}`,
                      }}
                    />
                  </div>

                  <span style={{ fontSize: '2rem' }}>🖥️</span>

                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#94a3b8',
                        letterSpacing: '0.5px',
                        marginBottom: '0.4rem',
                      }}
                    >
                      SRV-{String(id).padStart(2, '0')}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        color: cpuColor,
                        lineHeight: 1,
                      }}
                    >
                      {cpu}%
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.2rem' }}>CPU</div>
                  </div>

                  {/* Mini bar */}
                  <div
                    style={{
                      width: '100%',
                      height: '5px',
                      borderRadius: '4px',
                      background: 'rgba(30,41,59,0.8)',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cpu}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: id * 0.06 }}
                      style={{
                        height: '100%',
                        borderRadius: '4px',
                        background: cpuColor,
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <p
          style={{
            marginTop: '1.25rem',
            fontSize: '0.75rem',
            color: '#475569',
            fontFamily: "'Space Mono', monospace",
          }}
        >
          {recommendedServers} active instance{recommendedServers !== 1 ? 's' : ''}&nbsp;·&nbsp;Load balanced across cluster
          {action && action !== 'KEEP SAME' && (
            <span
              style={{
                marginLeft: '0.75rem',
                color: action === 'SCALE UP' ? '#4ade80' : '#f87171',
                fontWeight: 700,
              }}
            >
              · {action === 'SCALE UP' ? '↑ Scaling Up' : '↓ Scaling Down'}
            </span>
          )}
        </p>
      </motion.div>
    </section>
  );
}
