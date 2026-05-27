import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from './lib/firebase';
import type { User } from 'firebase/auth';
import { Star, X, Zap, Brain, Grid3X3, Target, Trophy, ChevronRight, RotateCcw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
type GameScreen = 'menu' | 'quiz' | 'cardflip' | 'looptap';

// ── Firestore Points Helper ───────────────────────────────────
async function addPointsToUser(uid: string, pts: number) {
  try {
    const ref = doc(db, 'users', uid);
    await setDoc(ref, { 
      points: increment(pts),
      updatedAt: Date.now() 
    }, { merge: true }); 
    console.log('Points saved:', pts);
  } catch (e) {
    console.error('Points save error:', e);
    throw e;  
  }
}

// ─────────────────────────────────────────────────────────────
// GAME 1 — EV QUIZ
// ─────────────────────────────────────────────────────────────
const QUIZ_QUESTIONS = [
  {
    q: 'EV mein kaunsa motor use hota hai?',
    options: ['Diesel Engine', 'Electric Motor', 'Steam Turbine', 'Petrol Engine'],
    ans: 1,
  },
  {
    q: 'CCS2 charger kya hai?',
    options: ['Slow AC Charger', 'DC Fast Charger', 'Solar Charger', 'Wireless Charger'],
    ans: 1,
  },
  {
    q: 'CO₂ emissions EV mein kya hoti hain?',
    options: ['Petrol se zyada', 'Diesel se zyada', 'Zero tail-pipe emissions', 'Same as CNG'],
    ans: 2,
  },
  {
    q: 'India mein EV charging standard kaunsa hai?',
    options: ['CHAdeMO', 'Tesla NACS', 'Bharat AC-001 / CCS2', 'J1772'],
    ans: 2,
  },
  {
    q: 'Ek fully charged EV average kitne km chalti hai?',
    options: ['50–80 km', '150–400 km', '600–800 km', '1000+ km'],
    ans: 1,
  },
];

function EVQuiz({ user, onExit, onPointsEarned }: { user: User; onExit: () => void; onPointsEarned: (pts: number) => void }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wrongAns, setWrongAns] = useState(false);

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === QUIZ_QUESTIONS[current].ans;
    if (correct) {
      setScore(s => s + 10);
      setWrongAns(false);
    } else {
      setWrongAns(true);
    }
    setTimeout(() => {
      if (current + 1 < QUIZ_QUESTIONS.length) {
        setCurrent(c => c + 1);
        setSelected(null);
        setWrongAns(false);
      } else {
        setDone(true);
      }
    }, 900);
  };

  const handleSave = async () => {
    if (saved || score === 0) return;
    setSaving(true);
    await addPointsToUser(user.uid, score);
    setSaving(false);
    setSaved(true);
    onPointsEarned(score);
  };

  const q = QUIZ_QUESTIONS[current];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={20} color="#f59e0b" />
          <span style={{ fontWeight: 800, fontSize: 16, color: 'white' }}>EV Quiz</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 999, padding: '4px 14px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>🏆 {score} pts</span>
          </div>
          <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
            <X size={14} color="#64748b" />
          </button>
        </div>
      </div>

      {!done ? (
        <>
          {/* Progress bar */}
          <div style={{ background: '#1e293b', borderRadius: 999, height: 6, marginBottom: 24, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${((current) / QUIZ_QUESTIONS.length) * 100}%` }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: 999 }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Question */}
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Question {current + 1} of {QUIZ_QUESTIONS.length}
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={current}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 24, lineHeight: 1.4 }}
            >
              {q.q}
            </motion.p>
          </AnimatePresence>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.options.map((opt, i) => {
              let bg = 'rgba(30,41,59,0.8)';
              let border = '1px solid rgba(255,255,255,0.06)';
              let color = '#94a3b8';
              if (selected !== null) {
                if (i === QUIZ_QUESTIONS[current].ans) { bg = 'rgba(16,185,129,0.15)'; border = '1px solid #10b981'; color = '#10b981'; }
                else if (i === selected && selected !== QUIZ_QUESTIONS[current].ans) { bg = 'rgba(239,68,68,0.15)'; border = '1px solid #ef4444'; color = '#ef4444'; }
              }
              return (
                <motion.button
                  key={i}
                  whileHover={selected === null ? { scale: 1.02 } : {}}
                  whileTap={selected === null ? { scale: 0.98 } : {}}
                  onClick={() => handleAnswer(i)}
                  style={{ background: bg, border, borderRadius: 14, padding: '14px 18px', textAlign: 'left', cursor: selected !== null ? 'default' : 'pointer', color, fontWeight: 600, fontSize: 14, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {['A','B','C','D'][i]}
                  </span>
                  {opt}
                </motion.button>
              );
            })}
          </div>

          {wrongAns && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', color: '#ef4444', fontSize: 12, fontWeight: 600, marginTop: 12 }}>
              ❌ Galat jawab! Sahi option green mein hai.
            </motion.p>
          )}
        </>
      ) : (
        /* Done screen */
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, background: 'rgba(245,158,11,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Trophy size={40} color="#f59e0b" />
          </div>
          <h3 style={{ fontSize: 26, fontWeight: 900, color: 'white', marginBottom: 8 }}>Quiz Complete!</h3>
          <p style={{ fontSize: 14, color: '#475569', marginBottom: 6 }}>Tumne {score / 10} / {QUIZ_QUESTIONS.length} sahi jawab diye</p>
          <p style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b', marginBottom: 28 }}>+{score} Points</p>
          {!saved ? (
            <button onClick={handleSave} disabled={saving || score === 0}
              style={{ background: score > 0 ? '#f59e0b' : '#334155', color: '#020617', fontWeight: 800, padding: '14px 32px', borderRadius: 14, border: 'none', cursor: saving || score === 0 ? 'not-allowed' : 'pointer', fontSize: 14, marginBottom: 12 }}>
              {saving ? 'Saving...' : score === 0 ? 'Koi points nahi mile 😔' : '💾 Click To Save Points'}
            </button>
          ) : (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 14, padding: '12px 24px', marginBottom: 12 }}>
              <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>✅ {score} Points are added to Accounts</span>
            </div>
          )}
          <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}>
            Back to Games
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GAME 2 — CARD FLIP MEMORY GAME
// ─────────────────────────────────────────────────────────────
const CARD_EMOJIS = ['⚡', '🔋', '🚗', '🌱', '☀️', '🔌'];

function shuffle<T>(arr: T[]): T[] {
  return [...arr, ...arr].sort(() => Math.random() - 0.5).map((v, i) => ({ val: v, id: i } as any));
}

function CardFlipGame({ user, onExit, onPointsEarned }: { user: User; onExit: () => void; onPointsEarned: (pts: number) => void }) {
  const [cards, setCards] = useState(() => shuffle(CARD_EMOJIS));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(false);

  const resetGame = () => {
    setCards(shuffle(CARD_EMOJIS));
    setFlipped([]);
    setMatched([]);
    setScore(0);
    setMoves(0);
    setDone(false);
    setSaved(false);
    setLocked(false);
  };

  const handleFlip = (id: number) => {
    if (locked || flipped.includes(id) || matched.includes(id) || flipped.length === 2) return;
    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);
    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [a, b] = newFlipped;
      if ((cards[a] as any).val === (cards[b] as any).val) {
        const newMatched = [...matched, a, b];
        setMatched(newMatched);
        setScore(s => s + 20);
        setFlipped([]);
        setLocked(false);
        if (newMatched.length === cards.length) setTimeout(() => setDone(true), 400);
      } else {
        setTimeout(() => { setFlipped([]); setLocked(false); }, 900);
      }
    }
  };

  const handleSave = async () => {
    if (saved || score === 0) return;
    setSaving(true);
    await addPointsToUser(user.uid, score);
    setSaving(false);
    setSaved(true);
    onPointsEarned(score);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Grid3X3 size={20} color="#6366f1" />
          <span style={{ fontWeight: 800, fontSize: 16, color: 'white' }}>Memory Cards</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 999, padding: '4px 12px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8' }}>🏆 {score} pts</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '4px 12px' }}>
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{moves} moves</span>
          </div>
          <button onClick={resetGame} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
            <RotateCcw size={13} color="#64748b" />
          </button>
          <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
            <X size={14} color="#64748b" />
          </button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>Cards match karo — har pair = +20 pts. Matched: {matched.length / 2}/{CARD_EMOJIS.length}</p>

      {!done ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, flex: 1 }}>
          {cards.map((card: any, i) => {
            const isFlipped = flipped.includes(i) || matched.includes(i);
            const isMatchedCard = matched.includes(i);
            return (
              <motion.div
                key={card.id}
                onClick={() => handleFlip(i)}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  height: 70,
                  borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isMatchedCard || flipped.includes(i) ? 'default' : 'pointer',
                  background: isMatchedCard
                    ? 'rgba(16,185,129,0.15)'
                    : isFlipped
                    ? 'rgba(99,102,241,0.15)'
                    : 'rgba(30,41,59,0.8)',
                  border: isMatchedCard
                    ? '1px solid rgba(16,185,129,0.4)'
                    : isFlipped
                    ? '1px solid rgba(99,102,241,0.4)'
                    : '1px solid rgba(255,255,255,0.06)',
                  fontSize: isFlipped ? 28 : 22,
                  userSelect: 'none',
                  transition: 'background 0.2s, border 0.2s',
                  boxShadow: isMatchedCard ? '0 0 12px rgba(16,185,129,0.2)' : 'none',
                }}
              >
                {isFlipped ? card.val : '?'}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, background: 'rgba(99,102,241,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Trophy size={40} color="#818cf8" />
          </div>
          <h3 style={{ fontSize: 26, fontWeight: 900, color: 'white', marginBottom: 8 }}>Sab Match!</h3>
          <p style={{ fontSize: 14, color: '#475569', marginBottom: 6 }}>{moves} moves mein complete kiya</p>
          <p style={{ fontSize: 32, fontWeight: 900, color: '#818cf8', marginBottom: 28 }}>+{score} Points</p>
          {!saved ? (
            <button onClick={handleSave} disabled={saving}
              style={{ background: '#6366f1', color: 'white', fontWeight: 800, padding: '14px 32px', borderRadius: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, marginBottom: 12 }}>
              {saving ? 'Saving...' : '💾 Points Save Karo'}
            </button>
          ) : (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 14, padding: '12px 24px', marginBottom: 12 }}>
              <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>✅ {score} Points Add Ho Gaye!</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={resetGame} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontWeight: 700, padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontSize: 13 }}>
              🔄 Dobara Khelo
            </button>
            <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}>
              Menu
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GAME 3 — LOOP TAP GAME
// ─────────────────────────────────────────────────────────────
function LoopTapGame({ user, onExit, onPointsEarned }: { user: User; onExit: () => void; onPointsEarned: (pts: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });
  const [targetSize, setTargetSize] = useState(60);
  const [flash, setFlash] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [missFlash, setMissFlash] = useState(false);
  const arenaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const moveTarget = useCallback(() => {
    setTargetPos({
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
    });
    setTargetSize(Math.max(35, 65 - score * 0.5));
  }, [score]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(20);
    setDone(false);
    setSaved(false);
    setPlaying(true);
    setTargetSize(60);
    moveTarget();
  };

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          clearInterval(moveRef.current!);
          setPlaying(false);
          setDone(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    moveRef.current = setInterval(() => {
      moveTarget();
    }, 1200);

    return () => {
      clearInterval(timerRef.current!);
      clearInterval(moveRef.current!);
    };
  }, [playing, moveTarget]);

  const handleTap = () => {
    if (!playing) return;
    const pts = Math.max(5, Math.round(targetSize / 5));
    setScore(s => s + pts);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    moveTarget();
  };

  const handleMiss = (e: React.MouseEvent) => {
    if (!playing) return;
    // Only count as miss if not clicking the target
    const target = (e.target as HTMLElement).closest('[data-target]');
    if (!target) {
      setMissFlash(true);
      setTimeout(() => setMissFlash(false), 150);
    }
  };

  const handleSave = async () => {
    if (saved || score === 0) return;
    setSaving(true);
    await addPointsToUser(user.uid, score);
    setSaving(false);
    setSaved(true);
    onPointsEarned(score);
  };

  const timerColor = timeLeft > 10 ? '#10b981' : timeLeft > 5 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Target size={20} color="#10b981" />
          <span style={{ fontWeight: 800, fontSize: 16, color: 'white' }}>Loop Tap</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 999, padding: '4px 12px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>🏆 {score} pts</span>
          </div>
          {playing && (
            <div style={{ background: `rgba(${timerColor === '#10b981' ? '16,185,129' : timerColor === '#f59e0b' ? '245,158,11' : '239,68,68'},0.15)`, border: `1px solid ${timerColor}40`, borderRadius: 999, padding: '4px 12px', minWidth: 60, textAlign: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: timerColor }}>{timeLeft}s</span>
            </div>
          )}
          <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
            <X size={14} color="#64748b" />
          </button>
        </div>
      </div>

      {!playing && !done && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, animation: 'pulse 2s infinite' }}>
            <Target size={40} color="#10b981" />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 10 }}>Loop Tap Game</h3>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 6, lineHeight: 1.6, maxWidth: 260 }}>
            20 seconds mein moving target pe tap karo.<br />
            <span style={{ color: '#10b981', fontWeight: 600 }}>Jitna fast, utne zyada points!</span>
          </p>
          <p style={{ fontSize: 11, color: '#334155', marginBottom: 28 }}>Small target = More points per tap</p>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={startGame}
            style={{ background: 'linear-gradient(135deg, #10b981, #6366f1)', color: 'white', fontWeight: 800, padding: '14px 40px', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 15 }}>
            🎯 Start Game
          </motion.button>
        </div>
      )}

      {playing && (
        <div
          ref={arenaRef}
          onClick={handleMiss}
          style={{
            flex: 1,
            background: missFlash ? 'rgba(239,68,68,0.05)' : 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 20,
            position: 'relative',
            overflow: 'hidden',
            cursor: 'crosshair',
            transition: 'background 0.1s',
          }}
        >
          {/* Score flash */}
          <AnimatePresence>
            {flash && (
              <motion.div
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -30, scale: 1.3 }}
                exit={{ opacity: 0 }}
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 20, fontWeight: 900, color: '#10b981', zIndex: 10, pointerEvents: 'none' }}
              >
                +{Math.max(5, Math.round(targetSize / 5))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Moving target */}
          <motion.div
            data-target="true"
            animate={{ left: `${targetPos.x}%`, top: `${targetPos.y}%` }}
            transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
            onClick={(e) => { e.stopPropagation(); handleTap(); }}
            style={{
              position: 'absolute',
              width: targetSize,
              height: targetSize,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.9), rgba(99,102,241,0.7))',
              border: '3px solid rgba(255,255,255,0.6)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 20px rgba(16,185,129,0.5), 0 0 40px rgba(99,102,241,0.3)',
              zIndex: 5,
            }}
          >
            <Zap size={targetSize * 0.35} color="white" fill="white" />
          </motion.div>

          {/* Timer ring overlay */}
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < timeLeft ? timerColor : '#1e293b', transition: 'background 0.3s' }} />
            ))}
          </div>
        </div>
      )}

      {done && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Trophy size={40} color="#10b981" />
          </div>
          <h3 style={{ fontSize: 26, fontWeight: 900, color: 'white', marginBottom: 8 }}>Time Up!</h3>
          <p style={{ fontSize: 14, color: '#475569', marginBottom: 6 }}>20 seconds mein itne points kama liye!</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: '#10b981', marginBottom: 28 }}>+{score} Points</p>
          {!saved ? (
            <button onClick={handleSave} disabled={saving || score === 0}
              style={{ background: score > 0 ? '#10b981' : '#334155', color: '#020617', fontWeight: 800, padding: '14px 32px', borderRadius: 14, border: 'none', cursor: saving || score === 0 ? 'not-allowed' : 'pointer', fontSize: 14, marginBottom: 12 }}>
              {saving ? 'Saving...' : score === 0 ? 'Koi points nahi 😔' : '💾 Points Save Karo'}
            </button>
          ) : (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 14, padding: '12px 24px', marginBottom: 12 }}>
              <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>✅ {score} Points Account Mein Add Ho Gaye!</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={startGame} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontWeight: 700, padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontSize: 13 }}>
              🔄 Play Again 
            </button>
            <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}>
              Menu
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GOLD TIER MODAL — Main wrapper
// ─────────────────────────────────────────────────────────────
export default function GoldTierModal({ user, onClose, onPointsEarned }: {
  user: User | null;
  onClose: () => void;
  onPointsEarned: (pts: number) => void;
}) {
  const [screen, setScreen] = useState<GameScreen>('menu');

  const games = [
    { id: 'quiz' as GameScreen,     icon: <Brain size={28} color="#f59e0b" />,   title: 'EV Quiz',         desc: '5 questions • 10 pts each',         color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',    border: 'rgba(245,158,11,0.25)' },
    { id: 'cardflip' as GameScreen, icon: <Grid3X3 size={28} color="#818cf8" />, title: 'Memory Cards',    desc: 'Cards match karo • 20 pts/pair',     color: '#818cf8', bg: 'rgba(99,102,241,0.1)',   border: 'rgba(99,102,241,0.25)' },
    { id: 'looptap' as GameScreen,  icon: <Target size={28} color="#10b981" />,  title: 'Loop Tap',        desc: '20 sec challenge • Fast tap = more pts', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  ];

  if (!user) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
          style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 32, padding: 40, maxWidth: 380, width: '100%', textAlign: 'center' }}>
          <Star size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 8 }}>Gold Tier Access</h3>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 24 }}>First Login to Play Game and Earn Points</p>
          <button onClick={onClose} style={{ background: '#6366f1', color: 'white', fontWeight: 800, padding: '12px 32px', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 14 }}>
            Login Karo
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={screen === 'menu' ? onClose : undefined}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
        style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 36, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: screen === 'menu' ? 24 : 0 }}>
          {screen !== 'menu' ? (
            <button onClick={() => setScreen('menu')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '7px 14px', cursor: 'pointer' }}>
              <ChevronRight size={14} color="#64748b" style={{ transform: 'rotate(180deg)' }} />
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Games</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #f59e0b, #f97316)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={18} color="white" fill="white" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: 'white', lineHeight: 1 }}>Gold Tier</h2>
                <p style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Earn & Play</p>
              </div>
            </div>
          )}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>
            <X size={15} color="#64748b" />
          </button>
        </div>

        {/* Game screens */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            {screen === 'menu' && (
              <motion.div key="menu" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* User greeting */}
                <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 16, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>
                    {user.displayName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Hey, {user.displayName?.split(' ')[0] || 'Player'}! 👋</p>
                    <p style={{ fontSize: 11, color: '#475569' }}>Play Games, Earn Points — Accounts saved</p>
                  </div>
                </div>

                {/* Game cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {games.map(game => (
                    <motion.button key={game.id} whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setScreen(game.id)}
                      style={{ background: game.bg, border: `1px solid ${game.border}`, borderRadius: 18, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left' }}>
                      <div style={{ width: 52, height: 52, background: 'rgba(15,23,42,0.6)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {game.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: 'white', marginBottom: 3 }}>{game.title}</p>
                        <p style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{game.desc}</p>
                      </div>
                      <ChevronRight size={18} color={game.color} />
                    </motion.button>
                  ))}
                </div>

                <p style={{ textAlign: 'center', fontSize: 10, color: '#1e293b', marginTop: 20, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Points Firestore /users/{user.uid}/points mein save honge
                </p>
              </motion.div>
            )}

            {screen === 'quiz' && (
              <motion.div key="quiz" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <EVQuiz user={user} onExit={() => setScreen('menu')} onPointsEarned={onPointsEarned} />
              </motion.div>
            )}

            {screen === 'cardflip' && (
              <motion.div key="cardflip" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <CardFlipGame user={user} onExit={() => setScreen('menu')} onPointsEarned={onPointsEarned} />
              </motion.div>
            )}

            {screen === 'looptap' && (
              <motion.div key="looptap" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <LoopTapGame user={user} onExit={() => setScreen('menu')} onPointsEarned={onPointsEarned} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
