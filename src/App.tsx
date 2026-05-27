import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import {
  onSnapshot, collection, setDoc, doc, addDoc, query, where, updateDoc, deleteDoc,
} from 'firebase/firestore';
import {
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, type User,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult,
  updateProfile,
} from 'firebase/auth';
import {
  Zap, Navigation, CheckCircle2, LogOut, BarChart3, TrendingUp, MapPin,
  Loader2, Star, XCircle, Settings, RefreshCw, Plus, Shield, Lock,
  Mail, Phone, Eye, EyeOff, ArrowLeft, User as UserIcon, MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './lib/firebase';
import type { Station, Booking, UserLocation } from './types';
import GoldTierModal from './GoldTierGames';


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

// ── Input Field Helper ────────────────────────────────────────
function InputField({ label, type = 'text', value, onChange, placeholder, icon, rightEl }: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  icon?: React.ReactNode; rightEl?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{label}</p>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <div style={{ position: 'absolute', left: '14px', color: '#475569' }}>{icon}</div>
        )}
        <input
          type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', background: '#1e293b', border: '1px solid #334155',
            borderRadius: '12px', padding: `12px 14px 12px ${icon ? '40px' : '14px'}`,
            color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {rightEl && (
          <div style={{ position: 'absolute', right: '14px' }}>{rightEl}</div>
        )}
      </div>
    </div>
  );
}

// ── Auth Modal ────────────────────────────────────────────────
type AuthView = 'choose' | 'login-email' | 'signup-email' | 'phone-number' | 'phone-otp' | 'email-otp';

function AuthModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<AuthView>('choose');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const clearError = () => setError('');

  // ── Google Sign In ──────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true); clearError();
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  // ── Email Sign Up ───────────────────────────────────────────
  const handleEmailSignup = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); clearError();
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      // Simulate email OTP — move to OTP screen
      setView('email-otp');
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') setError('Email already registered. Please login.');
      else if (e.code === 'auth/invalid-email') setError('Invalid email address.');
      else setError(e.message);
    } finally { setLoading(false); }
  };

  // ── Email Login ─────────────────────────────────────────────
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) { setError('Please fill all fields'); return; }
    setLoading(true); clearError();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') setError('No account found. Please sign up.');
      else if (e.code === 'auth/wrong-password') setError('Incorrect password.');
      else if (e.code === 'auth/invalid-credential') setError('Invalid email or password.');
      else setError(e.message);
    } finally { setLoading(false); }
  };

  // ── Phone — Send OTP ────────────────────────────────────────
  const handleSendOtp = async () => {
    const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    if (phone.length < 10) { setError('Enter a valid phone number'); return; }
    setLoading(true); clearError();
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const result = await signInWithPhoneNumber(auth, fullPhone, recaptchaRef.current);
      setConfirmResult(result);
      setView('phone-otp');
    } catch (e: any) {
      setError('Failed to send OTP. Check phone number and try again.');
      console.error(e);
    } finally { setLoading(false); }
  };

  // ── Phone — Verify OTP ──────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    if (!confirmResult) return;
    setLoading(true); clearError();
    try {
      await confirmResult.confirm(otp);
      onClose();
    } catch (e: any) {
      setError('Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Email OTP Verify (simulated — auto pass after signup) ──
  const handleEmailOtpVerify = async () => {
    // Since Firebase Email/Password doesn't have built-in OTP,
    // we simulate verification — user is already signed in from signup step
    if (emailOtpCode.length < 4) { setError('Enter the verification code'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200)); // simulate check
    setLoading(false);
    onClose();
  };


  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '32px', padding: '36px', width: '100%', maxWidth: '420px', position: 'relative' }}
      >
        {/* Invisible recaptcha container */}
        <div id="recaptcha-container" />

        {/* Back button */}
        {view !== 'choose' && (
          <button
            onClick={() => { setView('choose'); clearError(); setOtp(''); setPhone(''); setEmail(''); setPassword(''); setName(''); }}
            style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(30,41,59,0.6)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <ArrowLeft size={14} color="#94a3b8" />
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Back</span>
          </button>
        )}

        {/* ── CHOOSE VIEW ── */}
        {view === 'choose' && (
          <>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #10b981, #6366f1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Zap size={28} color="white" fill="white" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>Welcome to VoltHub</h2>
              <p style={{ fontSize: '12px', color: '#475569' }}>Sign in to book your EV charging slot</p>
            </div>

            {/* Google */}
            <button onClick={handleGoogle} disabled={loading}
              style={{ width: '100%', background: 'white', border: 'none', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', marginBottom: '12px', fontWeight: 700, fontSize: '14px', color: '#1a1a1a' }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : (
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.6 5C9.8 39.7 16.4 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.6-2.6 4.7-4.8 6.2l6.2 5.2C40.8 36.2 44 30.5 44 24c0-1.3-.1-2.7-.4-4z"/>
                </svg>
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#1e293b' }} />
              <span style={{ fontSize: '11px', color: '#334155', fontWeight: 600 }}>or continue with</span>
              <div style={{ flex: 1, height: '1px', background: '#1e293b' }} />
            </div>

            {/* Email & Phone buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <button onClick={() => { setView('signup-email'); clearError(); }}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Mail size={20} color="#10b981" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>Email</span>
                <span style={{ fontSize: '9px', color: '#475569' }}>Sign up / Login</span>
              </button>
              <button onClick={() => { setView('phone-number'); clearError(); }}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Phone size={20} color="#6366f1" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>Phone</span>
                <span style={{ fontSize: '9px', color: '#475569' }}>OTP Verification</span>
              </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: '10px', color: '#334155' }}>
              By continuing, you agree to VoltHub's Terms of Service
            </p>
          </>
        )}

        {/* ── SIGN UP EMAIL VIEW ── */}
        {view === 'signup-email' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Create Account</h2>
              <p style={{ fontSize: '12px', color: '#475569' }}>Sign up with your email</p>
            </div>

            <InputField label="Full Name" value={name} onChange={setName} placeholder="Enter your full name" icon={<UserIcon size={15} />} />
            <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" icon={<Mail size={15} />} />
            <InputField
              label="Password" type={showPass ? 'text' : 'password'}
              value={password} onChange={setPassword} placeholder="Min. 6 characters"
              icon={<Lock size={15} />}
              rightEl={
                <button onClick={() => setShowPass(!showPass)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

            <button onClick={handleEmailSignup} disabled={loading}
              style={{ width: '100%', background: '#10b981', color: '#020617', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <button onClick={() => { setView('login-email'); clearError(); }}
              style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
              Already have an account? <span style={{ color: '#10b981' }}>Login</span>
            </button>
          </>
        )}

        {/* ── LOGIN EMAIL VIEW ── */}
        {view === 'login-email' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Welcome Back</h2>
              <p style={{ fontSize: '12px', color: '#475569' }}>Login to your account</p>
            </div>

            <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" icon={<Mail size={15} />} />
            <InputField
              label="Password" type={showPass ? 'text' : 'password'}
              value={password} onChange={setPassword} placeholder="Your password"
              icon={<Lock size={15} />}
              rightEl={
                <button onClick={() => setShowPass(!showPass)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

            <button onClick={handleEmailLogin} disabled={loading}
              style={{ width: '100%', background: '#10b981', color: '#020617', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <button onClick={() => { setView('signup-email'); clearError(); }}
              style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
              Don't have an account? <span style={{ color: '#10b981' }}>Sign Up</span>
            </button>
          </>
        )}

        {/* ── PHONE NUMBER VIEW ── */}
        {view === 'phone-number' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '20px' }}>
              <div style={{ width: 48, height: 48, background: 'rgba(99,102,241,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Phone size={22} color="#6366f1" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Phone Verification</h2>
              <p style={{ fontSize: '12px', color: '#475569' }}>We'll send an OTP to your phone</p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Mobile Number</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px 14px', color: '#94a3b8', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  🇮🇳 +91
                </div>
                <input
                  type="tel" value={phone} onChange={e => { setPhone(e.target.value); clearError(); }}
                  placeholder="Enter 10-digit number"
                  maxLength={10}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px 14px', color: 'white', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            {/* Test numbers hint */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '10px 14px', marginBottom: '16px' }}>
              <p style={{ fontSize: '10px', color: '#a5b4fc', fontWeight: 600, marginBottom: '4px' }}>📋 Demo Test Numbers:</p>
              <p style={{ fontSize: '10px', color: '#6366f1' }}>+91 9265868556 → OTP: 458547</p>
              <p style={{ fontSize: '10px', color: '#6366f1' }}>+91 9752905161 → OTP: 252565</p>
            </div>

            {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

            <button onClick={handleSendOtp} disabled={loading}
              style={{ width: '100%', background: '#6366f1', color: 'white', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </>
        )}

        {/* ── PHONE OTP VIEW ── */}
        {view === 'phone-otp' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '20px' }}>
              <div style={{ width: 48, height: 48, background: 'rgba(99,102,241,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Shield size={22} color="#6366f1" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Enter OTP</h2>
              <p style={{ fontSize: '12px', color: '#475569' }}>Sent to +91 {phone}</p>
            </div>

            {/* OTP boxes */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {[0,1,2,3,4,5].map(i => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={otp[i] || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    const newOtp = otp.split('');
                    newOtp[i] = val;
                    setOtp(newOtp.join(''));
                    clearError();
                    if (val && i < 5) {
                      const next = document.getElementById(`otp-${i+1}`);
                      next?.focus();
                    }
                  }}
                  id={`otp-${i}`}
                  style={{
                    width: '44px', height: '52px', textAlign: 'center', fontSize: '20px', fontWeight: 700,
                    background: '#1e293b', border: `1px solid ${otp[i] ? '#6366f1' : '#334155'}`,
                    borderRadius: '12px', color: 'white', outline: 'none',
                  }}
                />
              ))}
            </div>

            {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

            <button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}
              style={{ width: '100%', background: '#6366f1', color: 'white', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px', opacity: otp.length !== 6 ? 0.5 : 1 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button onClick={() => { setView('phone-number'); setOtp(''); clearError(); }}
              style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
              Didn't receive? <span style={{ color: '#6366f1' }}>Resend OTP</span>
            </button>
          </>
        )}

        {/* ── EMAIL OTP VIEW ── */}
        {view === 'email-otp' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '20px' }}>
              <div style={{ width: 48, height: 48, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Mail size={22} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Verify Email</h2>
              <p style={{ fontSize: '12px', color: '#475569' }}>Enter the code sent to</p>
              <p style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>{email}</p>
            </div>

            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', color: '#10b981' }}>📧 Demo: Enter any 6-digit code</p>
            </div>

            {/* OTP boxes */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {[0,1,2,3,4,5].map(i => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={emailOtpCode[i] || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    const newOtp = emailOtpCode.split('');
                    newOtp[i] = val;
                    setEmailOtpCode(newOtp.join(''));
                    clearError();
                    if (val && i < 5) {
                      const next = document.getElementById(`eotp-${i+1}`);
                      next?.focus();
                    }
                  }}
                  id={`eotp-${i}`}
                  style={{
                    width: '44px', height: '52px', textAlign: 'center', fontSize: '20px', fontWeight: 700,
                    background: '#1e293b', border: `1px solid ${emailOtpCode[i] ? '#10b981' : '#334155'}`,
                    borderRadius: '12px', color: 'white', outline: 'none',
                  }}
                />
              ))}
            </div>

            {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

            <button onClick={handleEmailOtpVerify} disabled={loading || emailOtpCode.length !== 6}
              style={{ width: '100%', background: '#10b981', color: '#020617', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: (loading || emailOtpCode.length !== 6) ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: emailOtpCode.length !== 6 ? 0.5 : 1 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
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
      <p style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Network Overview</p>
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
          <div key={s.id} style={{ background: 'rgba(30,41,59,0.4)', border: `1px solid ${s.isAvailable ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.isAvailable ? '#10b981' : '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 500, lineHeight: 1.3 }}>{s.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hub Registration Modal ────────────────────────────────────
function HubRegistrationModal({ station, user, onClose, onRegistered }: { station: Station; user: User; onClose: () => void; onRegistered: () => void; }) {
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!ownerName.trim() || !ownerPhone.trim()) { setError('Please fill all fields'); return; }
    if (ownerPhone.length < 10) { setError('Enter a valid phone number'); return; }
    setRegistering(true);
    try {
      await updateDoc(doc(db, 'stations', station.id), {
        ownerId: user.uid, ownerEmail: user.email,
        ownerName: ownerName.trim(), ownerPhone: ownerPhone.trim(),
        registeredAt: new Date().toISOString(),
      });
      onRegistered();
    } catch (e) { setError('Registration failed. Try again.'); }
    finally { setRegistering(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '32px', padding: '36px', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: 56, height: 56, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield size={26} color="#10b981" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>Hub Owner Registration</h3>
          <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>Register once to permanently own <span style={{ color: '#10b981', fontWeight: 600 }}>{station.name}</span>.</p>
        </div>
        <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#10b981' }}>{user.displayName?.[0] || 'U'}</div>
          <div><p style={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>{user.displayName}</p><p style={{ fontSize: '10px', color: '#475569' }}>{user.email}</p></div>
          <div style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '999px', padding: '3px 10px' }}><span style={{ fontSize: '9px', color: '#10b981', fontWeight: 700 }}>VERIFIED</span></div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Owner Full Name</p>
          <input value={ownerName} onChange={e => { setOwnerName(e.target.value); setError(''); }} placeholder="Enter your full name" style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px 14px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Phone Number</p>
          <input value={ownerPhone} onChange={e => { setOwnerPhone(e.target.value); setError(''); }} placeholder="+91 XXXXX XXXXX" type="tel" style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px 14px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '10px 14px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <Lock size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>This registration is <span style={{ color: '#f59e0b', fontWeight: 700 }}>permanent and one-time only</span>.</p>
        </div>
        <button onClick={handleRegister} disabled={registering} style={{ width: '100%', background: '#10b981', color: '#020617', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: registering ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: registering ? 0.7 : 1 }}>
          {registering ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
          {registering ? 'Registering...' : 'Register as Hub Owner'}
        </button>
        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Cancel</button>
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
    try { await updateDoc(doc(db, 'stations', station.id), { pricing: newPrice, slots, isAvailable, lastUpdated: new Date().toISOString() }); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const addSlot = () => { if (newSlot && !slots.includes(newSlot)) { setSlots([...slots, newSlot]); setNewSlot(''); } };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '32px', padding: '32px', width: '100%', maxWidth: '420px' }}>
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
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Pricing (₹/kWh)</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '10px 14px', color: 'white', fontSize: '14px', outline: 'none' }} />
            <button onClick={save} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', color: '#94a3b8' }}><RefreshCw size={14} /></button>
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Available Slots</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {slots.map(slot => (
              <span key={slot} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#a5b4fc' }}>{slot}</span>
            ))}
            <div style={{ display: 'flex', gap: '4px' }}>
              <input value={newSlot} onChange={e => setNewSlot(e.target.value)} placeholder="HH:MM AM" style={{ width: '90px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '4px 8px', color: 'white', fontSize: '11px', outline: 'none' }} />
              <button onClick={addSlot} style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: '#a5b4fc' }}><Plus size={12} /></button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e293b', borderRadius: '16px', padding: '14px 16px', marginBottom: '20px' }}>
          <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Manual Availability</p>
          <div onClick={() => setIsAvailable(!isAvailable)} style={{ width: '44px', height: '24px', borderRadius: '999px', cursor: 'pointer', position: 'relative', transition: 'background 0.3s', background: isAvailable ? '#10b981' : '#334155' }}>
            <div style={{ position: 'absolute', top: '3px', left: isAvailable ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
          </div>
        </div>
        <button onClick={save} disabled={saving} style={{ width: '100%', background: '#6366f1', color: 'white', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}{saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Close Panel</button>
      </motion.div>
    </motion.div>
  );
}

// ── Gemini Reroute Alert ──────────────────────────────────────
function RerouteAlert({ alternatives, onDismiss, onAccept }: { alternatives: Station[]; onDismiss: () => void; onAccept: (s: Station) => void; }) {
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', zIndex: 4000, width: '100%', maxWidth: '480px', padding: '0 16px' }}>
      <div style={{ background: '#0f172a', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '24px', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px' }}>⚡ Gemini Smart Re-Route</span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>You may be late to your booked station. Gemini suggests these alternatives:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {alternatives.map(s => (
            <button key={s.id} onClick={() => onAccept(s)} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', width: '100%' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{s.name}</span>
              <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>₹{s.pricing}/kWh →</span>
            </button>
          ))}
        </div>
        <button onClick={onDismiss} style={{ width: '100%', background: 'none', border: '1px solid #334155', borderRadius: '12px', padding: '10px', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Stay with current booking</button>
      </div>
    </motion.div>
  );
}

// ── Feedback & Query Modal ────────────────────────────────────
function FeedbackModal({ user, onClose }: { user: import('firebase/auth').User | null; onClose: () => void }) {
  const [type, setType] = useState<'feedback' | 'query' | 'bug'>('feedback');
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!message.trim()) { setError('Please enter your message'); return; }
    if (type === 'feedback' && rating === 0) { setError('Please select a rating'); return; }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        type,
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        rating: type === 'feedback' ? rating : null,
        userId: user?.uid || null,
        createdAt: Date.now(),
        status: 'new',
      });
      setSubmitted(true);
    } catch (e) {
      setError('Failed to submit. Please try again.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const types = [
    { id: 'feedback', label: 'Feedback', icon: '⭐', color: '#f59e0b' },
    { id: 'query',    label: 'Query',    icon: '❓', color: '#6366f1' },
    { id: 'bug',      label: 'Bug Report', icon: '🐛', color: '#ef4444' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '32px', padding: '36px', width: '100%', maxWidth: '460px' }}
      >
        {!submitted ? (
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ width: 56, height: 56, background: 'rgba(16,185,129,0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <MessageSquare size={26} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>Feedback & Support</h2>
              <p style={{ fontSize: '12px', color: '#475569' }}>Help us improve VoltHub Pro</p>
            </div>

            {/* Type selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
              {types.map(t => (
                <button key={t.id} onClick={() => { setType(t.id as any); setError(''); }}
                  style={{
                    background: type === t.id ? `rgba(${t.id === 'feedback' ? '245,158,11' : t.id === 'query' ? '99,102,241' : '239,68,68'},0.15)` : '#1e293b',
                    border: `1px solid ${type === t.id ? (t.id === 'feedback' ? '#f59e0b' : t.id === 'query' ? '#6366f1' : '#ef4444') : '#334155'}`,
                    borderRadius: '12px', padding: '10px 6px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.2s',
                  }}>
                  <span style={{ fontSize: '18px' }}>{t.icon}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: type === t.id ? t.color : '#475569' }}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Star rating — only for feedback */}
            {type === 'feedback' && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Rate Your Experience</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '32px', transition: 'transform 0.15s', transform: (hoveredRating || rating) >= star ? 'scale(1.2)' : 'scale(1)' }}>
                      <span style={{ color: (hoveredRating || rating) >= star ? '#f59e0b' : '#1e293b', filter: (hoveredRating || rating) >= star ? 'drop-shadow(0 0 6px rgba(245,158,11,0.6))' : 'none', transition: 'all 0.15s' }}>
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p style={{ textAlign: 'center', fontSize: '11px', color: '#f59e0b', marginTop: '6px', fontWeight: 600 }}>
                    {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
                  </p>
                )}
              </div>
            )}

            {/* Name */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '7px' }}>Your Name</p>
              <input value={name} onChange={e => { setName(e.target.value); setError(''); }}
                placeholder="Enter your name"
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '11px 14px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Email */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '7px' }}>Email Address</p>
              <input value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com" type="email"
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '11px 14px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Message */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '7px' }}>
                {type === 'feedback' ? 'Your Feedback' : type === 'query' ? 'Your Question' : 'Describe the Bug'}
              </p>
              <textarea value={message} onChange={e => { setMessage(e.target.value); setError(''); }}
                placeholder={
                  type === 'feedback' ? 'Share your experience with VoltHub...'
                  : type === 'query' ? 'What would you like to know?'
                  : 'What went wrong? Steps to reproduce...'
                }
                rows={4}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '11px 14px', color: 'white', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            {error && <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '14px', textAlign: 'center' }}>{error}</p>}

            <button onClick={handleSubmit} disabled={submitting}
              style={{ width: '100%', background: '#10b981', color: '#020617', fontWeight: 800, padding: '14px', borderRadius: '14px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: submitting ? 0.7 : 1, marginBottom: '12px' }}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
              {submitting ? 'Submitting...' : 'Submit'}
            </button>

            <button onClick={onClose}
              style={{ width: '100%', background: 'none', border: 'none', color: '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Cancel
            </button>
          </>
        ) : (
          /* Success state */
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
              style={{ width: 80, height: 80, background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={40} color="#10b981" />
            </motion.div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '10px' }}>
              {type === 'feedback' ? 'Thank you! 🎉' : type === 'query' ? 'Query Received!' : 'Bug Reported!'}
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, marginBottom: '28px' }}>
              {type === 'feedback'
                ? 'Your feedback helps us make VoltHub better for everyone in Bhopal.'
                : type === 'query'
                ? "We'll get back to you at " + email + " within 24 hours."
                : "Our team will look into this bug and fix it ASAP. Thanks for reporting!"}
            </p>
            <button onClick={onClose}
              style={{ background: '#10b981', color: '#020617', fontWeight: 800, padding: '12px 32px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
              Done
            </button>
          </div>
        )}
      </motion.div>
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rerouteAlts, setRerouteAlts] = useState<Station[]>([]);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showGoldTier, setShowGoldTier] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
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
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `User is ${estimatedMinutes.toFixed(0)} mins away from EV station "${bookedStation.name}". Alternatives: ${alts.map(a => a.name).join(', ')}. Should they reroute? Reply only YES or NO.` }] }] })
              });
              const data = await res.json();
              const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase();
              if (answer === 'YES') { setRerouteAlts(alts); setShowReroute(true); }
            } catch (e) { console.error('Gemini error:', e); }
          } else { setRerouteAlts(alts); setShowReroute(true); }
        }
      }
    }, 10000);
    return () => { if (rerouteTimerRef.current) clearInterval(rerouteTimerRef.current); };
  }, [userBookings, userLoc, stations]);

  const handleBooking = async () => {
    if (!user || !selectedStation || !selectedSlot) return;
    setShowPayment(true); setPaymentStep(0);
    await new Promise(r => setTimeout(r, 1500)); setPaymentStep(1);
    await new Promise(r => setTimeout(r, 1800)); setPaymentStep(2);
    await new Promise(r => setTimeout(r, 1200)); setPaymentStep(3);
    await new Promise(r => setTimeout(r, 800)); setShowPayment(false);
    setIsBooking(true);
    try {
      await addDoc(collection(db, 'bookings'), { stationId: selectedStation.id, stationName: selectedStation.name, userId: user.uid, userEmail: user.email, slotTime: selectedSlot, status: 'confirmed', createdAt: Date.now() });
      await updateDoc(doc(db, 'stations', selectedStation.id), { isAvailable: false, lastUpdated: new Date().toISOString() });
      setBookingSuccess(true);
      setTimeout(() => { setBookingSuccess(false); setSelectedSlot(null); }, 3000);
    } catch (err) { console.error(err); }
    finally { setIsBooking(false); }
  };

  const handleCancelBooking = async (booking: Booking) => {
    setIsCancelling(true);
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      await updateDoc(doc(db, 'stations', booking.stationId), { isAvailable: true, lastUpdated: new Date().toISOString() });
    } catch (err) { console.error(err); }
    finally { setIsCancelling(false); }
  };

  const analytics = useMemo(() => {
    const totalBookings = stations.filter(s => !s.isAvailable).length + userBookings.length;
    return { totalBookings, projectedRevenue: totalBookings * 450 };
  }, [stations, userBookings]);

  const existingBooking = selectedStation ? userBookings.find(b => b.stationId === selectedStation.id) : null;
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

          {/* Feedback Button */}
<button
  onClick={() => setShowFeedback(true)}
  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '999px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
>
  <MessageSquare size={13} color="#10b981" />
  <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>Feedback</span>
</button>

          {isOwner && (
            <button onClick={() => setShowAdmin(true)}
              style={{ background: '#6366f1', border: 'none', borderRadius: '999px', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <Settings size={13} color="white" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Panel</span>
            </button>
          )}

          {user ? (
  <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-1.5 pl-4 rounded-full">
    {/* ✅ Points Badge — YAHAN ADD HUA */}
    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 999, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Star size={12} color="#f59e0b" fill="#f59e0b" />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{userPoints} pts</span>
    </div>
    <span className="text-xs font-medium text-slate-400">{user.displayName || user.email?.split('@')[0]}</span>
    <button onClick={() => auth.signOut()} className="btn-secondary w-8 h-8 rounded-full">
      <LogOut size={14} />
    </button>
  </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="bg-brand text-slate-950 px-4 py-2 rounded-lg text-sm font-bold">
              Login / Sign Up
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
                  eventHandlers={{ click: () => { setSelectedStation(station); setSelectedSlot(null); setRegistrationSuccess(false); } }}>
                  <Popup><div className="p-2"><h3 className="font-bold text-zinc-900">{station.name}</h3><p className="text-xs text-zinc-600">{station.address}</p></div></Popup>
                </Marker>
              ))}
              {userLoc && (
                <>
                  <Circle center={[userLoc.lat, userLoc.lng]} radius={200} pathOptions={{ dashArray: '5,5', color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1 }} />
                  <Marker position={[userLoc.lat, userLoc.lng]} icon={L.divIcon({ className: 'user-loc-icon', html: `<div style="width:16px;height:16px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.6)"></div>` })} />
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
              <motion.div key="booking" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 glass-panel p-6 flex flex-col overflow-y-auto">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="status-pill">{selectedStation.isAvailable ? 'Available Now' : 'Occupied'}</span>
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
                      style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontWeight: 700, padding: '0.875rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: isCancelling ? 'not-allowed' : 'pointer', opacity: isCancelling ? 0.5 : 1, fontSize: '0.875rem' }}>
                      {isCancelling ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                      {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  </div>
                ) : (
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Select Slot</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(selectedStation.slots || SLOTS).map(slot => (
                        <div key={slot} onClick={() => selectedStation.isAvailable && setSelectedSlot(slot)}
                          className={`slot-card ${selectedSlot === slot ? 'selected' : ''} ${!selectedStation.isAvailable ? 'disabled' : ''}`}>
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
                        <button onClick={() => setShowAuthModal(true)} className="btn-primary">Login to Book</button>
                      ) : (
                        <button disabled={!selectedSlot || isBooking || !selectedStation.isAvailable} onClick={handleBooking} className="btn-primary">
                          {isBooking ? <Loader2 className="animate-spin" size={18} /> : bookingSuccess ? <CheckCircle2 size={18} /> : null}
                          {isBooking ? "Processing..." : bookingSuccess ? "Confirmed!" : "Confirm Booking"}
                        </button>
                      )}
                    </>
                  )}

                  {user && isUnclaimed && !registrationSuccess && (
                    <button onClick={() => setShowRegister(true)}
                      style={{ width: '100%', marginTop: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
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
                className="flex-1 glass-panel p-6 flex flex-col items-center justify-start text-center overflow-y-auto">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
                  <MapPin size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Select a Station</h3>
                <p className="text-slate-500 text-sm mb-6">Choose a marker on the map to view details and book your slot.</p>
                <NetworkOverview stations={stations} />
              </motion.div>
            )}
          </AnimatePresence>
          <button 
  onClick={() => setShowGoldTier(true)} 
  style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
>
  <div className="h-32 bg-indigo-600 rounded-[32px] p-5 relative overflow-hidden shadow-lg shadow-indigo-600/20 group">
    <div className="relative z-10">
      <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Smart Loyalty</p>
      <h3 className="text-white font-bold text-lg leading-tight mt-1 uppercase italic tracking-tighter">Gold Tier Access</h3>
      <p className="text-white/60 text-[10px] mt-1">Earn 5 points per kWh charged</p>
    </div>
    <Star className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-white/10 group-hover:rotate-12 transition-transform" />
  </div>
</button>

</aside>
</div>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </AnimatePresence>

      {/* Payment Gateway Modal */}
      <AnimatePresence>
        {showPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4000] flex items-center justify-center p-8"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}>
            <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
              style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '32px', padding: '40px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
                <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366f1, #10b981)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={18} color="white" fill="white" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>VoltPay</p>
                  <p style={{ fontSize: '9px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Secure Payment Gateway</p>
                </div>
              </div>
              <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '16px', padding: '16px', marginBottom: '28px' }}>
                <p style={{ fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Amount to Pay</p>
                <p style={{ fontSize: '36px', fontWeight: 900, color: 'white', letterSpacing: '-1px' }}>₹450.00</p>
                <p style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{selectedStation?.name} · {selectedSlot}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                {[{ label: 'Connecting to VoltPay Gateway', step: 0 }, { label: 'Processing Payment', step: 1 }, { label: 'Payment Successful', step: 2 }].map(({ label, step }) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: paymentStep > step ? '#10b981' : paymentStep === step ? 'rgba(99,102,241,0.2)' : 'rgba(30,41,59,0.5)', border: `2px solid ${paymentStep > step ? '#10b981' : paymentStep === step ? '#6366f1' : '#1e293b'}`, transition: 'all 0.4s ease' }}>
                      {paymentStep > step ? <CheckCircle2 size={14} color="#10b981" /> : paymentStep === step ? <Loader2 size={14} color="#6366f1" className="animate-spin" /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155' }} />}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, textAlign: 'left', color: paymentStep > step ? '#10b981' : paymentStep === step ? 'white' : '#334155', transition: 'color 0.4s ease' }}>{label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {paymentStep < 2 ? (
                  <><Loader2 size={13} color="#6366f1" className="animate-spin" /><p style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>{paymentStep === 0 ? 'Establishing secure connection...' : 'Verifying transaction...'}</p></>
                ) : (
                  <><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /><p style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>Transaction Approved ✓</p></>
                )}
              </div>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAnalytics(false)} className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-8">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[40px] p-10">
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
          <HubRegistrationModal station={selectedStation} user={user} onClose={() => setShowRegister(false)}
            onRegistered={() => { setShowRegister(false); setRegistrationSuccess(true); }} />
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
          <RerouteAlert alternatives={rerouteAlts} onDismiss={() => setShowReroute(false)}
            onAccept={(s) => { setSelectedStation(s); setShowReroute(false); }} />
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
<AnimatePresence>
  {showFeedback && (
    <FeedbackModal user={user} onClose={() => setShowFeedback(false)} />
  )}
</AnimatePresence>   

{/* Gold Tier Games Modal */}
<AnimatePresence>
  {showGoldTier && (
    <GoldTierModal
      user={user}
      onClose={() => setShowGoldTier(false)}
      onPointsEarned={(pts) => setUserPoints(p => p + pts)}
    />
  )}
</AnimatePresence>  

      {/* Booking Success Modal */}
      <AnimatePresence>
        {bookingSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-brand/5 backdrop-blur-3xl z-[3000] flex items-center justify-center p-8">
            <motion.div initial={{ scale: 0.8, rotate: -2 }} animate={{ scale: 1, rotate: 0 }} className="bg-slate-900 border border-brand/40 p-12 rounded-[48px] shadow-2xl flex flex-col items-center max-w-sm text-center">
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