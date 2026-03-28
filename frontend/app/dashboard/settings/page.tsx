'use client';
// =============================================================================
// CloudMind AI – app/dashboard/settings/page.tsx
// System configuration settings page
// =============================================================================

import { useState } from 'react';
import { useToast } from '@/lib/toast';

interface Settings {
  refreshInterval: number;
  overloadThreshold: number;
  underloadThreshold: number;
  targetLoad: number;
  peakFactor: number;
  scaleDownFactor: number;
  alertsEnabled: boolean;
  emailAlerts: boolean;
  slackAlerts: boolean;
  autoScale: boolean;
  minServers: number;
  maxServers: number;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  dateFormat: string;
  defaultCostPerServer: number;
}

const DEFAULT_SETTINGS: Settings = {
  refreshInterval: 5,
  overloadThreshold: 300,
  underloadThreshold: 120,
  targetLoad: 200,
  peakFactor: 15,
  scaleDownFactor: 20,
  alertsEnabled: true,
  emailAlerts: false,
  slackAlerts: false,
  autoScale: true,
  minServers: 1,
  maxServers: 50,
  theme: 'light',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  defaultCostPerServer: 50,
};

function SettingsSection({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card card-p" style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ value, onChange, id }: { value: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? 'var(--primary)' : 'var(--border-strong)',
        position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
        boxShadow: value ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'block',
      }} />
    </button>
  );
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBlock: 14, borderBottom: '1px solid var(--surface-3)' }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 20 }}>{children}</div>
    </div>
  );
}

function SliderSetting({ label, sub, value, min, max, unit, onChange }: {
  label: string; sub?: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ paddingBlock: 14, borderBottom: '1px solid var(--surface-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)', background: 'var(--primary-muted)', padding: '3px 12px', borderRadius: 'var(--radius-full)' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" className="input" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ accentColor: 'var(--primary)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'prediction' | 'alerts' | 'display' | 'scaling'>('prediction');

  const set = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    setSettings(s => ({ ...s, [key]: val }));
    setSaved(false);
  };

  const save = () => {
    // In production: POST /settings
    toast('Settings saved successfully!', 'success');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
    toast('Settings reset to defaults', 'info');
  };

  const TABS: { key: typeof activeTab; label: string; icon: string }[] = [
    { key: 'prediction', label: 'Prediction Engine',  icon: '⚡' },
    { key: 'scaling',    label: 'Scaling Rules',       icon: '📈' },
    { key: 'alerts',     label: 'Alerts & Notify',     icon: '🔔' },
    { key: 'display',    label: 'Display & UI',        icon: '🎨' },
  ];

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="section-sub">Configure platform preferences, scaling rules, and alert thresholds</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={reset}>↺ Reset Defaults</button>
          <button className="btn btn-primary btn-lg" onClick={save}>
            {saved ? '✓ Saved!' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Tab sidebar ── */}
        <div className="card card-p" style={{ position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: activeTab === key ? 700 : 500,
                  background: activeTab === key ? 'var(--primary-muted)' : 'transparent',
                  color: activeTab === key ? 'var(--primary)' : 'var(--text-secondary)',
                  textAlign: 'left', width: '100%',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{icon}</span> {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div>
          {activeTab === 'prediction' && (
            <>
              <SettingsSection title="Prediction Engine" sub="ML model and prediction interval configuration">
                <SliderSetting label="Auto-refresh Interval" sub="Dashboard and Live Monitoring refresh rate" value={settings.refreshInterval} min={1} max={60} unit="s" onChange={v => set('refreshInterval', v)} />
                <SliderSetting label="Default Cost per Server" sub="Used to calculate estimated cost in results" value={settings.defaultCostPerServer} min={1} max={500} unit="$" onChange={v => set('defaultCostPerServer', v)} />
                <SliderSetting label="Target Load per Server" sub="Optimal req/server target for fleet sizing" value={settings.targetLoad} min={50} max={1000} unit=" rpm" onChange={v => set('targetLoad', v)} />
              </SettingsSection>
              <SettingsSection title="Decision Engine Thresholds" sub="Thresholds that trigger scale-up or scale-down actions">
                <SliderSetting label="Overload Threshold" sub="Load above this → SCALE UP" value={settings.overloadThreshold} min={100} max={1000} unit=" rpm" onChange={v => set('overloadThreshold', v)} />
                <SliderSetting label="Underload Threshold" sub="Load below this → SCALE DOWN" value={settings.underloadThreshold} min={10} max={500} unit=" rpm" onChange={v => set('underloadThreshold', v)} />
                <SliderSetting label="Peak Detection Sensitivity" sub="% above rolling avg to trigger spike detection" value={settings.peakFactor} min={5} max={50} unit="%" onChange={v => set('peakFactor', v)} />
                <SliderSetting label="Scale-Down Sensitivity" sub="% below rolling avg to trigger scale-down" value={settings.scaleDownFactor} min={5} max={50} unit="%" onChange={v => set('scaleDownFactor', v)} />
              </SettingsSection>
            </>
          )}

          {activeTab === 'scaling' && (
            <SettingsSection title="Auto-Scaling Rules" sub="Configure server fleet size limits and auto-scaling behaviour">
              <SettingRow label="Auto-Scaling Enabled" sub="Apply scaling actions automatically">
                <ToggleSwitch id="toggle-autoscale" value={settings.autoScale} onChange={v => set('autoScale', v)} />
              </SettingRow>
              <SliderSetting label="Minimum Servers" sub="Fleet will never scale below this" value={settings.minServers} min={1} max={20} unit=" srv" onChange={v => set('minServers', v)} />
              <SliderSetting label="Maximum Servers" sub="Fleet will never scale above this" value={settings.maxServers} min={2} max={200} unit=" srv" onChange={v => set('maxServers', v)} />
              <div style={{ paddingBlock: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Timezone</div>
                <select
                  className="input select"
                  value={settings.timezone}
                  onChange={e => set('timezone', e.target.value)}
                >
                  {['UTC', 'US/Eastern', 'US/Pacific', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </SettingsSection>
          )}

          {activeTab === 'alerts' && (
            <SettingsSection title="Alerts & Notifications" sub="Configure when and how you receive system alerts">
              <SettingRow label="Alerts Enabled" sub="Show system alerts on the Alerts page">
                <ToggleSwitch id="toggle-alerts" value={settings.alertsEnabled} onChange={v => set('alertsEnabled', v)} />
              </SettingRow>
              <SettingRow label="Email Notifications" sub="Send critical alerts to your email address">
                <ToggleSwitch id="toggle-email" value={settings.emailAlerts} onChange={v => set('emailAlerts', v)} />
              </SettingRow>
              <SettingRow label="Slack Notifications" sub="Post alerts to a Slack webhook">
                <ToggleSwitch id="toggle-slack" value={settings.slackAlerts} onChange={v => set('slackAlerts', v)} />
              </SettingRow>
              {settings.emailAlerts && (
                <div style={{ paddingBlock: 14, borderBottom: '1px solid var(--surface-3)' }}>
                  <label>Alert Email Address</label>
                  <input type="email" className="input" placeholder="ops-team@company.com" style={{ marginTop: 6 }} />
                </div>
              )}
              {settings.slackAlerts && (
                <div style={{ paddingBlock: 14 }}>
                  <label>Slack Webhook URL</label>
                  <input type="text" className="input" placeholder="https://hooks.slack.com/services/..." style={{ marginTop: 6 }} />
                </div>
              )}
            </SettingsSection>
          )}

          {activeTab === 'display' && (
            <SettingsSection title="Display & UI Preferences" sub="Customize how the dashboard looks and behaves">
              <SettingRow label="Theme" sub="Choose dashboard colour scheme">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['light', 'dark', 'system'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => set('theme', t)}
                      className={`btn btn-${settings.theme === t ? 'primary' : 'secondary'} btn-sm`}
                      style={{ textTransform: 'capitalize' }}
                    >{t}</button>
                  ))}
                </div>
              </SettingRow>
              <SettingRow label="Date Format" sub="Used in History and Reports pages">
                <select
                  className="select"
                  style={{ width: 160 }}
                  value={settings.dateFormat}
                  onChange={e => set('dateFormat', e.target.value)}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </SettingRow>
            </SettingsSection>
          )}

          {/* Version info */}
          <div className="card card-p" style={{ background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>CloudMind AI</strong> v4.0.0 · Random Forest Model v3 · FastAPI Backend
              </div>
              <span className="badge badge-green">Production Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
