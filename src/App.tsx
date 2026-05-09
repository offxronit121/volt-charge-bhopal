import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import {
  onSnapshot, collection, setDoc, doc, addDoc, query, where, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
import {
  Zap, Navigation, CheckCircle2, LogOut, BarChart3, TrendingUp, MapPin,
  Loader2, Star, XCircle, Settings, RefreshCw, Plus, Shield, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './lib/firebase';
import type { Station, Booking, UserLocation } from './types';

const BHOPAL_CENTER: [number, number] = [23.2599, 77.4126];
const SLOTS = ["09:00 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM", "07:00 PM"];
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const INITIAL_STATIONS: Station[] = [
  { id: 'mp-nagar',     name: 'MP Nagar EV Grid',       lat: 23.2325, lng: 77.4334, address: 'Zone 1, MP Nagar',                 chargerType: 'CCS2 Fast', pricing: 18, isAvailable: true },
  { id: 'arera-colony', name: 'Arera Smart Charge',      lat: 23.2120, lng: 77.4225, address: 'E-3, Arera Colony',               chargerType: 'Type 2 AC', pricing: 15, isAvailable: true },
  { id: 'db-mall',      name: 'DB City Supercharger',    lat: 23.2345, lng: 77.4300, address: 'Arera Hills',                     chargerType: 'CCS2 Fast', pricing: 22, isAvailable: true },
  { id: 'habibganj',    name: 'Habibganj Station Hub',   lat: 23.2200, lng: 77.4450, address: 'Rani Kamalapati Railway Station', chargerType: 'CCS2 Fast', pricing: 19, isAvailable: true },
  { id: 'gulmohar',     name: 'Gulmohar Eco Point',      lat: 23.1900, lng: 77.4400, address: 'Gulmohar Colony',                 chargerType: 'Type 2 AC', pricing: 14, isAvailable: true },
  { id: 'indrapuri',    name: 'Indrapuri Tech Charge',   lat: 23.2500, lng: 77.4650, address: 'Indrapuri Sector C',              chargerType: 'CCS2 Fast', pricing: 20, isAvailable: true },
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
}

const createMarkerIcon = (isAvailable: boolean, isFastCharge: boolean) => L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.4);
      background:${isAvailable ? '#10b981' : '#ef4444'};transition:background 0.5s;">
      <svg viewBox="0 0 24 24" width="${isFastCharge ? 18 : 16}" height="${isFastCharge ? 18 : 16}"
        stroke="white" stroke-width="2.5" fill="${isFastCharge ? 'white' : 'none'}">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, 14, { duration: 1.5 }); }, [center, map]);
  return null;
}

// ── Map Legend ────────────────────────────────────────────────
function MapLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: '24px', right: '24px', zIndex: 400,
      background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
      padding: '12px 16px', minWidth: '160px',
    }}>
      <p style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
        Station States
      </p>
      {[
        { color: '#10b981', label: 'Available',      glow: 'rgba(16,185,129,0.7)',  isZap: false },
        { color: '#ef4444', label: 'Occupied',        glow: 'rgba(239,68,68,0.7)',   isZap: false },
        { color: '#3b82f6', label: 'Your Pos',        glow: 'rgba(59,130,246,0.7)',  isZap: false },
        { color: '#f59e0b', label: 'Fast Charge Hub', glow: 'rgba(245,158,11,0.7)',  isZap: true  },
      ].map(({ color, label, glow, isZap }) => (
        <div key={label} className="legend-item"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          {isZap ? (
            <svg className="legend-dot" style={{ '--glow-color': glow, borderRadius: '2px' } as React.CSSProperties}
              viewBox="0 0 24 24" width="12" height="12" stroke={color} strokeWidth="2.5" fill={color}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          ) : (
            <div className="legend-dot"
              style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, ['--glow-color' as string]: glow }}
            />
          )}
          <span className="legend-label" style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, transition: 'color 0.3s' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Network Overview ──────────────────────────────────────────
function NetworkOverview({ stations }: { stations: Station[] }) {
  const available = stations.filter(s => s.isAvailable).length;
  const total = stations.length;
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;

  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
        Network Overview
      </p>
      <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>System Availability</span>
          <span style={{ fontSize: '20px', fontWeight: 800, color: pct > 50 ? '#10b981' : '#ef4444' }}>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct > 50 ? '#10b981' : '#ef4444', borderRadius: '999px', transition: 'width 0.8s ease' }} />
        </div>
      </div>
      <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
        <p style={{ fontSize: '10px', color: '#475569', marginBottom: '8px', fontWeight: 600 }}>Grid Distribution</p>
        <div style={{ display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden', gap: '2px' }}>
          <div style={{ flex: available, background: '#10b981', transition: 'flex 0.8s ease' }} />
          <div style={{ flex: total - available, background: '#ef4444', transition: 'flex 0.8s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>● {available} Free</span>
          <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>{total - available} Busy ●</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {stations.map(s => (
          <div key={s.id} style={{
            background: 'rgba(30,41,59,0.4)', border: `1px solid ${s.isAvailable ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.isAvailable ? '#10b981' : '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 500, lineHeight: 1.3 }}>{s.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hub Registration Modal ────────────────────────────────────
function HubRegistrationModal({ station, user, onClose, onRegistered }: {
  station: Station;
  user: User;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!ownerName.trim() || !ownerPhone.trim()) {
      setError('Please fill all fields');
      return;
    }
    if (ownerPhone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    setRegistering(true);
    try {
      await updateDoc(doc(db, 'stations', station.id), {
        ownerId: user.uid,
        ownerEmail: user.email,
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim(),
        registeredAt: new Date().toISOString(),
      });
      onRegistered();
    } catch (e) {
      setError('Registration failed. Try again.');
      console.error(e);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '32px', padding: '36px', width: '100%', maxWidth: '400px' }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: 56, height: 56, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield size={26} color="#10b981" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>Hub Owner Registration</h3>
          <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
            Register once to permanently own and manage <span style={{ color: '#10b981', fontWeight: 600 }}>{station.name}</span>. This slot is available only once.
          </p>
        </div>

        {/* Google account info */}
        <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#10b981' }}>
            {user.displayName?.[0] || 'U'}
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>{user.displayName}</p>
            <p style={{ fontSize: '10px', color: '#475569' }}>{user.email}</p>
          </div>
          <div style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '999px', padding: '3px 10px' }}>
            <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 700 }}>VERIFIED</span>
          </div>
        </div>

        {/* Form */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Owner Full Name</p>
          <input
            value={ownerName}
            onChange={e => { setOwnerName(e.target.value); setError(''); }}
            placeholder="Enter your full name"
            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px 14px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Phone Number</p>
          <input
            value={ownerPhone}
            onChange={e => { setOwnerPhone(e.target.value); setError(''); }}
            placeholder="+91 XXXXX XXXXX"
            type="tel"
            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px 14px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '16px', textAlign: 'center' }}>{error}</p>
        )}

        {/* Warning */}
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '10px 14px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <Lock size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
            This registration is <span style={{ color: '#f59e0b', fontWeight: 700 }}>permanent and one-time only</span>. Once registered, no other user can claim this hub.
          </p>
        </div>

        <button
          onClick={handleRegister}
          disabled={registering}
          style={{ width: '100%', background: '#10b981', color: '#020617', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: registering ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: registering ? 0.7 : 1 }}
        >
          {registering ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
          {registering ? 'Registering...' : 'Register as Hub Owner'}
        </button>

        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────
function AdminPanel({ station, onClose }: { station: Station; onClose: () => void }) {
  const [newPrice, setNewPrice] = useState(station.pricing);
  const [newSlot, setNewSlot] = useState('');
  const [slots, setSlots] = useState<string[]>(station.slots || SLOTS);
  const [isAvailable, setIsAvailable] = useState(station.isAvailable);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'stations', station.id), {
        pricing: newPrice, slots, isAvailable,
        lastUpdated: new Date().toISOString(),
      });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const addSlot = () => {
    if (newSlot && !slots.includes(newSlot)) {
      setSlots([...slots, newSlot]);
      setNewSlot('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '32px', padding: '32px', width: '100%', maxWidth: '420px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={18} color="#6366f1" />
            <span style={{ fontWeight: 800, fontSize: '16px', fontStyle: 'italic', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '1px' }}>Station Admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '999px', padding: '4px 10px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>LIVE OPS</span>
          </div>
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{station.name}</h3>
        <p style={{ fontSize: '11px', color: '#475569', marginBottom: '20px' }}>Registered Hub · Owner Access Only</p>

        {/* Pricing */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Pricing (₹/kWh)</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number" value={newPrice}
              onChange={e => setNewPrice(Number(e.target.value))}
              style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '10px 14px', color: 'white', fontSize: '14px', outline: 'none' }}
            />
            <button onClick={save} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', color: '#94a3b8' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Slots */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Available Slots</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {slots.map(slot => (
              <span key={slot} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#a5b4fc' }}>
                {slot}
              </span>
            ))}
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                value={newSlot} onChange={e => setNewSlot(e.target.value)}
                placeholder="HH:MM AM"
                style={{ width: '90px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '4px 8px', color: 'white', fontSize: '11px', outline: 'none' }}
              />
              <button onClick={addSlot} style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: '#a5b4fc' }}>
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Availability Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e293b', borderRadius: '16px', padding: '14px 16px', marginBottom: '20px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Manual Availability</p>
          <div
            onClick={() => setIsAvailable(!isAvailable)}
            style={{ width: '44px', height: '24px', borderRadius: '999px', cursor: 'pointer', position: 'relative', transition: 'background 0.3s', background: isAvailable ? '#10b981' : '#334155' }}
          >
            <div style={{ position: 'absolute', top: '3px', left: isAvailable ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
          </div>
        </div>

        <button onClick={save} disabled={saving}
          style={{ width: '100%', background: '#6366f1', color: 'white', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Close Panel
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Gemini Reroute Alert ──────────────────────────────────────
function RerouteAlert({ alternatives, onDismiss, onAccept }: {
  alternatives: Station[];
  onDismiss: () => void;
  onAccept: (s: Station) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', zIndex: 4000, width: '100%', maxWidth: '480px', padding: '0 16px' }}
    >
      <div style={{ background: '#0f172a', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '24px', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px' }}>⚡ Gemini Smart Re-Route</span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
          You may be late to your booked station. Gemini suggests these alternatives:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {alternatives.map(s => (
            <button key={s.id} onClick={() => onAccept(s)}
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', width: '100%' }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{s.name}</span>
              <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>₹{s.pricing}/kWh →</span>
            </button>
          ))}
        </div>
        <button onClick={onDismiss} style={{ width: '100%', background: 'none', border: '1px solid #334155', borderRadius: '12px', padding: '10px', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          Stay with current booking
        </button>
      </div>
    </motion.div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState(0);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showReroute, setShowReroute] = useState(false);
  const [rerouteAlts, setRerouteAlts] = useState<Station[]>([]);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const rerouteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLoc({ lat: BHOPAL_CENTER[0], lng: BHOPAL_CENTER[1] })
      );
    }
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stations'), (snapshot) => {
      if (snapshot.empty) {
        INITIAL_STATIONS.forEach(s => setDoc(doc(db, 'stations', s.id), s));
      } else {
        setStations(snapshot.docs.map(d => d.data() as Station));
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) { setUserBookings([]); return; }
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setUserBookings(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Booking)));
    });
    return unsub;
  }, [user]);

  // Gemini re-routing every 10s
  useEffect(() => {
    if (!userBookings.length || !userLoc || !stations.length) return;
    const bookedStation = stations.find(s => s.id === userBookings[0]?.stationId);
    if (!bookedStation) return;

    rerouteTimerRef.current = setInterval(async () => {
      const dist = parseFloat(calculateDistance(userLoc.lat, userLoc.lng, bookedStation.lat, bookedStation.lng));
      const estimatedMinutes = (dist / 30) * 60;

      if (estimatedMinutes > 10) {
        const alts = stations.filter(s => s.isAvailable && s.id !== bookedStation.id).slice(0, 2);
        if (alts.length) {
          if (GEMINI_API_KEY) {
            try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: `User is ${estimatedMinutes.toFixed(0)} mins away from EV station "${bookedStation.name}". Alternatives: ${alts.map(a => a.name).join(', ')}. Should they reroute? Reply only YES or NO.` }] }]
                })
              });
              const data = await res.json();
              const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase();
              if (answer === 'YES') { setRerouteAlts(alts); setShowReroute(true); }
            } catch (e) { console.error('Gemini error:', e); }
          } else {
            setRerouteAlts(alts); setShowReroute(true);
          }
        }
      }
    }, 10000);

    return () => { if (rerouteTimerRef.current) clearInterval(rerouteTimerRef.current); };
  }, [userBookings, userLoc, stations]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (err) { console.error(err); }
  };

const handleBooking = async () => {
  if (!user || !selectedStation || !selectedSlot) return;

  // Show payment gateway popup first
  setShowPayment(true);
  setPaymentStep(0);

  // Step 1 - Connecting
  await new Promise(r => setTimeout(r, 1500));
  setPaymentStep(1);

  // Step 2 - Processing
  await new Promise(r => setTimeout(r, 1800));
  setPaymentStep(2);

  // Step 3 - Success
  await new Promise(r => setTimeout(r, 1200));
  setPaymentStep(3);
  await new Promise(r => setTimeout(r, 800));
  setShowPayment(false);

  // Now actually book
  setIsBooking(true);
  try {
    await addDoc(collection(db, 'bookings'), {
      stationId: selectedStation.id,
      stationName: selectedStation.name,
      userId: user.uid,
      userEmail: user.email,
      slotTime: selectedSlot,
      status: 'confirmed',
      createdAt: Date.now()
    });
    await updateDoc(doc(db, 'stations', selectedStation.id), {
      isAvailable: false,
      lastUpdated: new Date().toISOString()
    });
    setBookingSuccess(true);
    setTimeout(() => { setBookingSuccess(false); setSelectedSlot(null); }, 3000);
  } catch (err) { console.error(err); }
  finally { setIsBooking(false); }
};

  const handleCancelBooking = async (booking: Booking) => {
    setIsCancelling(true);
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      await updateDoc(doc(db, 'stations', booking.stationId), {
        isAvailable: true, lastUpdated: new Date().toISOString()
      });
    } catch (err) { console.error(err); }
    finally { setIsCancelling(false); }
  };

  const analytics = useMemo(() => {
    const totalBookings = stations.filter(s => !s.isAvailable).length + userBookings.length;
    return { totalBookings, projectedRevenue: totalBookings * 450 };
  }, [stations, userBookings]);

  const existingBooking = selectedStation
    ? userBookings.find(b => b.stationId === selectedStation.id)
    : null;

  // Only the registered owner of this exact station can access admin
  const isOwner = !!(user && selectedStation?.ownerId === user.uid);
  const isUnclaimed = selectedStation && !selectedStation.ownerId;

  return (
    <div className="w-screen h-screen bg-bento-bg text-slate-200 p-6 flex flex-col font-sans overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-bento-bg" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">VoltHub Pro</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Bhopal Smart Grid</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-full px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-brand rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">Firebase Live</span>
          </div>

          {/* Show Admin button only if user is owner of selected station */}
          {isOwner && (
            <button
              onClick={() => setShowAdmin(true)}
              style={{ background: '#6366f1', border: 'none', borderRadius: '999px', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <Settings size={13} color="white" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Panel</span>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-1.5 pl-4 rounded-full">
              <span className="text-xs font-medium text-slate-400">{user.displayName}</span>
              <button onClick={() => auth.signOut()} className="btn-secondary w-8 h-8 rounded-full">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className="bg-brand text-slate-950 px-4 py-2 rounded-lg text-sm font-bold">
              Login
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">

        {/* Map */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="relative flex-1 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
            <MapContainer center={BHOPAL_CENTER} zoom={13} zoomControl={false} style={{ width: '100%', height: '100%' }}>
              <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              {stations.map(station => (
                <Marker key={station.id} position={[station.lat, station.lng]}
                  icon={createMarkerIcon(station.isAvailable, station.chargerType === 'CCS2 Fast')}
                  eventHandlers={{ click: () => { setSelectedStation(station); setSelectedSlot(null); setRegistrationSuccess(false); } }}
                >
                  <Popup><div className="p-2"><h3 className="font-bold text-zinc-900">{station.name}</h3><p className="text-xs text-zinc-600">{station.address}</p></div></Popup>
                </Marker>
              ))}
              {userLoc && (
                <>
                  <Circle center={[userLoc.lat, userLoc.lng]} radius={200} pathOptions={{ dashArray: '5,5', color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1 }} />
                  <Marker position={[userLoc.lat, userLoc.lng]} icon={L.divIcon({
                    className: 'user-loc-icon',
                    html: `<div style="width:16px;height:16px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.6)"></div>`
                  })} />
                </>
              )}
              {selectedStation && <MapUpdater center={[selectedStation.lat, selectedStation.lng]} />}
            </MapContainer>

            <div className="absolute top-4 right-4 flex flex-col gap-2 z-[400]">
              <button className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-xl hover:bg-slate-800">+</button>
              <button className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-xl hover:bg-slate-800">-</button>
            </div>

            <div className="absolute bottom-6 left-6 flex gap-4 z-[400]">
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-3 rounded-2xl">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Stations Online</p>
                <p className="text-lg font-bold">{stations.length}</p>
              </div>
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-3 rounded-2xl">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Available Now</p>
                <p className="text-lg font-bold text-brand">{stations.filter(s => s.isAvailable).length}</p>
              </div>
            </div>

            <MapLegend />
          </div>

          {/* Analytics Row */}
          <div className="grid grid-cols-3 gap-6 h-32">
            <div className="bento-card">
              <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Projected Revenue</p>
              <p className="text-2xl font-bold italic tracking-tight">₹{analytics.projectedRevenue.toLocaleString()}</p>
              <div className="text-[10px] text-brand mt-1 font-medium">+12.5% from yesterday</div>
            </div>
            <div className="bento-card">
              <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Bookings Today</p>
              <p className="text-2xl font-bold italic tracking-tight">{analytics.totalBookings}</p>
              <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div className="w-[70%] h-full bg-brand rounded-full"></div>
              </div>
            </div>
            <button onClick={() => setShowAnalytics(!showAnalytics)}
              className={`rounded-3xl p-5 flex flex-col justify-center items-center transition-all ${showAnalytics ? 'bg-brand text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
              <BarChart3 className="w-6 h-6 mb-1" />
              <p className="text-[10px] font-bold uppercase tracking-widest">{showAnalytics ? 'Close Analytics' : 'Open Analytics'}</p>
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 flex flex-col gap-6 relative">
          <AnimatePresence mode="wait">
            {selectedStation ? (
              <motion.div key="booking"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="flex-1 glass-panel p-6 flex flex-col overflow-y-auto"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="status-pill">{selectedStation.isAvailable ? 'Available Now' : 'Occupied'}</span>

                    {/* Hub owner badge */}
                    {selectedStation.ownerId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '999px', padding: '3px 10px' }}>
                        <Lock size={10} color="#10b981" />
                        <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 700 }}>REGISTERED HUB</span>
                      </div>
                    )}
                  </div>

                  <h2 className="text-2xl font-bold leading-tight">{selectedStation.name}</h2>
                  <p className="text-slate-500 text-xs flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {userLoc ? calculateDistance(userLoc.lat, userLoc.lng, selectedStation.lat, selectedStation.lng) : '--'}km away
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-slate-800/30 border border-white/5 p-3 rounded-2xl text-center">
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Type</p>
                    <p className="text-xs font-bold text-slate-300">{selectedStation.chargerType}</p>
                  </div>
                  <div className="bg-slate-800/30 border border-white/5 p-3 rounded-2xl text-center">
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Pricing</p>
                    <p className="text-xs font-bold text-slate-300">₹{selectedStation.pricing}/kWh</p>
                  </div>
                </div>

                {/* Registration success message */}
                {registrationSuccess && (
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '14px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <p style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>Hub registered! You now have admin access.</p>
                  </div>
                )}

                {existingBooking ? (
                  <div className="flex-1">
                    <div className="bg-brand/10 border border-brand/30 rounded-2xl p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={16} className="text-brand" />
                        <p className="text-xs font-bold text-brand uppercase tracking-widest">Your Booking</p>
                      </div>
                      <p className="text-white font-bold text-lg">{existingBooking.slotTime}</p>
                      <p className="text-slate-400 text-xs mt-1">Slot confirmed • ₹450.00</p>
                    </div>
                    <button onClick={() => handleCancelBooking(existingBooking)} disabled={isCancelling}
                      style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontWeight: 700, padding: '0.875rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: isCancelling ? 'not-allowed' : 'pointer', opacity: isCancelling ? 0.5 : 1, fontSize: '0.875rem' }}
                    >
                      {isCancelling ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                      {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  </div>
                ) : (
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Select Slot</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(selectedStation.slots || SLOTS).map(slot => (
                        <div key={slot}
                          onClick={() => selectedStation.isAvailable && setSelectedSlot(slot)}
                          className={`slot-card ${selectedSlot === slot ? 'selected' : ''} ${!selectedStation.isAvailable ? 'disabled' : ''}`}
                        >
                          <span>{slot}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-5">
                  {!existingBooking && (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Estimated Cost</p>
                          <p className="text-lg font-bold text-brand">₹450.00</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Wait Time</p>
                          <p className="text-lg font-bold">~ 5 Mins</p>
                        </div>
                      </div>
                      {!user ? (
                        <button onClick={handleLogin} className="btn-primary">Login to Book</button>
                      ) : (
                        <button disabled={!selectedSlot || isBooking || !selectedStation.isAvailable} onClick={handleBooking} className="btn-primary">
                          {isBooking ? <Loader2 className="animate-spin" size={18} /> : bookingSuccess ? <CheckCircle2 size={18} /> : null}
                          {isBooking ? "Processing..." : bookingSuccess ? "Confirmed!" : "Confirm Booking"}
                        </button>
                      )}
                    </>
                  )}

                  {/* Register as Hub Owner — only if unclaimed and logged in */}
                  {user && isUnclaimed && !registrationSuccess && (
                    <button
                      onClick={() => setShowRegister(true)}
                      style={{ width: '100%', marginTop: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <Shield size={13} color="#10b981" />
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>Register as Hub Owner</span>
                    </button>
                  )}

                  <button onClick={() => setSelectedStation(null)}
                    style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Cancel Selection
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 glass-panel p-6 flex flex-col items-center justify-start text-center overflow-y-auto"
              >
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
                  <MapPin size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Select a Station</h3>
                <p className="text-slate-500 text-sm mb-6">Choose a marker on the map to view details and book your slot.</p>
                <NetworkOverview stations={stations} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-32 bg-indigo-600 rounded-[32px] p-5 relative overflow-hidden shadow-lg shadow-indigo-600/20 group">
            <div className="relative z-10">
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Smart Loyalty</p>
              <h3 className="text-white font-bold text-lg leading-tight mt-1 uppercase italic tracking-tighter">Gold Tier Access</h3>
              <p className="text-white/60 text-[10px] mt-1">Earn 5 points per kWh charged</p>
            </div>
            <Star className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-white/10 group-hover:rotate-12 transition-transform" />
          </div>
        </aside>
      </div>

{/* Payment Gateway Modal */}
<AnimatePresence>
  {showPayment && (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[4000] flex items-center justify-center p-8"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '32px', padding: '40px', width: '100%', maxWidth: '360px', textAlign: 'center' }}
      >
        {/* Gateway Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366f1, #10b981)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="white" fill="white" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>VoltPay</p>
            <p style={{ fontSize: '9px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Secure Payment Gateway</p>
          </div>
        </div>

        {/* Amount */}
        <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '16px', padding: '16px', marginBottom: '28px' }}>
          <p style={{ fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Amount to Pay</p>
          <p style={{ fontSize: '36px', fontWeight: 900, color: 'white', letterSpacing: '-1px' }}>₹450.00</p>
          <p style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{selectedStation?.name} · {selectedSlot}</p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Connecting to VoltPay Gateway', step: 0 },
            { label: 'Processing Payment', step: 1 },
            { label: 'Payment Successful', step: 2 },
          ].map(({ label, step }) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: paymentStep > step ? '#10b981' : paymentStep === step ? 'rgba(99,102,241,0.2)' : 'rgba(30,41,59,0.5)',
                border: `2px solid ${paymentStep > step ? '#10b981' : paymentStep === step ? '#6366f1' : '#1e293b'}`,
                transition: 'all 0.4s ease',
              }}>
                {paymentStep > step ? (
                  <CheckCircle2 size={14} color="#10b981" />
                ) : paymentStep === step ? (
                  <Loader2 size={14} color="#6366f1" className="animate-spin" />
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155' }} />
                )}
              </div>
              <span style={{
                fontSize: '12px', fontWeight: 600, textAlign: 'left',
                color: paymentStep > step ? '#10b981' : paymentStep === step ? 'white' : '#334155',
                transition: 'color 0.4s ease',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Status text */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {paymentStep < 2 ? (
            <>
              <Loader2 size={13} color="#6366f1" className="animate-spin" />
              <p style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                {paymentStep === 0 ? 'Establishing secure connection...' : 'Verifying transaction...'}
              </p>
            </>
          ) : (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>Transaction Approved ✓</p>
            </>
          )}
        </div>

        {/* Security badge */}
        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Lock size={10} color="#334155" />
          <p style={{ fontSize: '10px', color: '#334155', fontWeight: 600 }}>256-bit SSL Encrypted · PCI DSS Compliant</p>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

      {/* Analytics Modal */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowAnalytics(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-8"
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[40px] p-10"
            >
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-1">VoltHub <span className="text-brand">Insights</span></h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Real-time operational intelligence</p>
                </div>
                <button onClick={() => setShowAnalytics(false)} className="btn-secondary">Close</button>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-800/20 border border-white/5 p-6 rounded-3xl">
                  <div className="flex items-center gap-2 text-brand mb-4"><TrendingUp size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Growth</span></div>
                  <p className="text-4xl font-black italic">18.4%</p>
                  <p className="text-slate-500 text-xs mt-2">New user registrations this week</p>
                </div>
                <div className="bg-slate-800/20 border border-white/5 p-6 rounded-3xl">
                  <div className="flex items-center gap-2 text-indigo-400 mb-4"><Zap size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Efficiency</span></div>
                  <p className="text-4xl font-black italic">94.2%</p>
                  <p className="text-slate-500 text-xs mt-2">Uptime across all Bhopal charging nodes</p>
                </div>
              </div>
              <div className="mt-8 p-6 bg-slate-800/10 border border-white/5 rounded-3xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Historical Load</p>
                <div className="flex items-end gap-2 h-20">
                  {[40, 70, 45, 90, 65, 80, 50, 95, 30].map((h, i) => (
                    <div key={i} className="flex-1 bg-brand/20 rounded-t-lg hover:bg-brand transition-all" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hub Registration Modal */}
      <AnimatePresence>
        {showRegister && selectedStation && user && (
          <HubRegistrationModal
            station={selectedStation}
            user={user}
            onClose={() => setShowRegister(false)}
            onRegistered={() => {
              setShowRegister(false);
              setRegistrationSuccess(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdmin && selectedStation && isOwner && (
          <AdminPanel station={selectedStation} onClose={() => setShowAdmin(false)} />
        )}
      </AnimatePresence>

      {/* Gemini Reroute Alert */}
      <AnimatePresence>
        {showReroute && (
          <RerouteAlert
            alternatives={rerouteAlts}
            onDismiss={() => setShowReroute(false)}
            onAccept={(s) => { setSelectedStation(s); setShowReroute(false); }}
          />
        )}
      </AnimatePresence>

      {/* Booking Success Modal */}
      <AnimatePresence>
        {bookingSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand/5 backdrop-blur-3xl z-[3000] flex items-center justify-center p-8"
          >
            <motion.div initial={{ scale: 0.8, rotate: -2 }} animate={{ scale: 1, rotate: 0 }}
              className="bg-slate-900 border border-brand/40 p-12 rounded-[48px] shadow-2xl flex flex-col items-center max-w-sm text-center"
            >
              <div className="w-24 h-24 bg-brand/20 rounded-full flex items-center justify-center mb-8">
                <CheckCircle2 className="text-brand" size={48} />
              </div>
              <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-3">Node Reserved</h3>
              <p className="text-slate-400 text-sm mb-10 leading-relaxed">
                System has locked your slot for <span className="text-white font-bold">{selectedSlot}</span>. The charger is standing by at <span className="text-brand font-bold">{selectedStation?.name}</span>.
              </p>
              <button className="w-full bg-brand text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-3">
                <Navigation size={20} />
                INITIATE NAVIGATION
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}