import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { supabase } from './supabase';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const workoutData = {
  Monday: {
    label: "MON", focus: "Chest & Triceps", emoji: "🔥", color: "#FF6B35",
    exercises: ["Flat Press Machine","Incline Dumbbell Press","Chest Flies","Dips","Overhead Tricep Extension","Straight Bar Pushdowns"],
  },
  Tuesday: {
    label: "TUE", focus: "Traps & Shoulders", emoji: "💪", color: "#F7C59F",
    exercises: ["Smith Machine Shoulder Press","Lat Raises","Shoulder Press","Dumbbell Shrugs","Smith Machine Shrugs","Smith Machine Behind the Back Shrugs"],
  },
  Wednesday: {
    label: "WED", focus: "Back & Biceps", emoji: "🏋️", color: "#4ECDC4",
    exercises: ["Wide Grip Lat Pulldowns","Bent Over Rows","Wide Grip Seated Chest Supported Row","Pullovers","Incline Curls","Cross Body Hammer Curls"],
  },
  Thursday: {
    label: "THU", focus: "Legs", emoji: "⚡", color: "#A8DADC",
    exercises: ["Squats","Leg Extension","Leg Curl","Calf Raises","RDLs"],
  },
  Friday: {
    label: "FRI", focus: "Chest & Arms (Growth)", emoji: "💥", color: "#FFD166",
    exercises: ["Flat Press Machine","Incline Dumbbell Press","Chest Flies","High Low Cables","Incline Curls","Cross Body Hammer Curls","Overhead Tricep Extension","Straight Bar Pushdowns"],
  },
};

const days = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

const EXERCISE_LIBRARY = {
  Chest: ["Flat Press Machine","Incline Dumbbell Press","Chest Flies","Dips","Cable Crossover","Push-ups","High Low Cables","Decline Press"],
  Back: ["Wide Grip Lat Pulldown","Bent Over Rows","Seated Chest Supported Row","Pullovers","T-Bar Row","Single Arm Dumbbell Row","Seated Cable Row","Face Pulls"],
  Shoulders: ["Smith Machine Shoulder Press","Lat Raises","Shoulder Press","Dumbbell Shrugs","Smith Machine Shrugs","Front Raises","Arnold Press","Reverse Pec Deck"],
  Triceps: ["Overhead Tricep Extension","Straight Bar Pushdowns","Dips","Rope Pushdowns","Skull Crushers","Close Grip Bench Press","Diamond Push-ups","Tricep Kickbacks"],
  Biceps: ["Incline Curls","Cross Body Hammer Curls","Dumbbell Curls","Cable Curls","Preacher Curls","Concentration Curls","Cable Hammer Curls","Bayesian Curls"],
  Legs: ["Squats","Leg Extension","Leg Curl","Calf Raises","RDLs","Leg Press","Walking Lunges","Hip Thrusts"],
};

const MUSCLE_GROUPS = ["Chest","Back","Shoulders","Triceps","Biceps","Legs"];
const GENERATED_TOTAL_EXERCISES = 8;

const chartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, ticks: { color: "#444" }, grid: { color: "rgba(255,255,255,0.04)" } },
    x: { ticks: { color: "#444", maxRotation: 30 }, grid: { display: false } },
  },
});

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 1024);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isDesktop;
}

export default function App() {
  const isDesktop = useIsDesktop();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [active, setActive] = useState("Monday");
  const [logging, setLogging] = useState(false);
  const [activeSets, setActiveSets] = useState({});
  const [setCount, setSetCount] = useState({});
  const [tab, setTab] = useState("today");
  const [selectedEx, setSelectedEx] = useState("");
  const [history, setHistory] = useState([]);

  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [generatedWorkout, setGeneratedWorkout] = useState(null);

  const day = generatedWorkout || workoutData[active];

  // Check for existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load workouts when user is available
  useEffect(() => {
    if (!user) return;
    async function loadWorkouts() {
      const { data } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) {
        setHistory(data.map(row => ({
          date: row.date,
          dayName: row.day_name,
          name: row.name,
          color: row.color,
          emoji: row.emoji,
          exercises: row.exercises,
        })));
      }
    }
    loadWorkouts();
  }, [user]);

  async function handleLogin() {
    setAuthError('');
    setAuthSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthSubmitting(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setHistory([]);
  }

  function switchDay(d) {
    setActive(d);
    setLogging(false);
    setActiveSets({});
    setSetCount({});
    setGeneratedWorkout(null);
  }

  function toggleGroup(g) {
    setSelectedGroups(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  }

  function generateWorkout() {
    if (selectedGroups.length === 0) return;

    const perGroup = Math.floor(GENERATED_TOTAL_EXERCISES / selectedGroups.length);
    let exercises = [];

    selectedGroups.forEach(group => {
      const pool = [...EXERCISE_LIBRARY[group]];
      // Shuffle pool
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      exercises.push(...pool.slice(0, perGroup));
    });

    setGeneratedWorkout({
      label: "GEN", focus: "Custom Workout", emoji: "🎲", color: "#9B5DE5",
      exercises,
    });
    setGeneratorOpen(false);
    setActiveSets({});
    setSetCount({});
  }

  function clearGeneratedWorkout() {
    setGeneratedWorkout(null);
    setSelectedGroups([]);
    setLogging(false);
    setActiveSets({});
    setSetCount({});
  }

  function updateSet(key, value) {
    setActiveSets(prev => ({ ...prev, [key]: value }));
  }

  function addSet(ei) {
    setSetCount(prev => ({ ...prev, [ei]: (prev[ei] || 3) + 1 }));
  }

  function getSetCount(ei) {
    return setCount[ei] || 3;
  }

  async function saveWorkout() {
    const entry = {
      date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }),
      dayName: generatedWorkout ? "Generated" : active,
      name: day.focus,
      color: day.color,
      emoji: day.emoji,
      exercises: day.exercises.map((ex, ei) => ({
        name: ex,
        sets: Array.from({ length: getSetCount(ei) }, (_, si) => ({
          weight: parseFloat(activeSets[`${ei}-${si}-w`]) || 0,
          reps: parseInt(activeSets[`${ei}-${si}-r`]) || 0,
          done: !!(activeSets[`${ei}-${si}-w`] || activeSets[`${ei}-${si}-r`]),
        }))
      }))
    };

    const { error } = await supabase.from('workouts').insert({
      user_id: user.id,
      date: entry.date,
      day_name: entry.dayName,
      name: entry.name,
      color: entry.color,
      emoji: entry.emoji,
      exercises: entry.exercises,
    });

    if (error) { console.error('Error saving workout:', error); return; }

    setHistory(prev => [entry, ...prev]);
    setLogging(false);
    setActiveSets({});
    setSetCount({});
    setGeneratedWorkout(null);
  }

  // Progress data
  const totalWorkouts = history.length;
  const totalVol = history.reduce((a, h) => a + h.exercises.reduce((b, ex) => b + ex.sets.reduce((c, s) => c + (s.weight * s.reps), 0), 0), 0);
  const activeWeeks = new Set(history.map(h => {
    const d = new Date(h.date);
    const jan = new Date(d.getFullYear(), 0, 1);
    return d.getFullYear() + 'W' + Math.ceil(((d - jan) / 86400000 + jan.getDay() + 1) / 7);
  })).size;

  const weekMap = {};
  history.forEach(h => {
    const d = new Date(h.date);
    const jan = new Date(d.getFullYear(), 0, 1);
    const wk = 'W' + Math.ceil(((d - jan) / 86400000 + jan.getDay() + 1) / 7);
    weekMap[wk] = (weekMap[wk] || 0) + 1;
  });
  const freqLabels = Object.keys(weekMap).sort().slice(-10);
  const freqData = freqLabels.map(k => weekMap[k]);

  const allExercises = [...new Set(history.flatMap(h => h.exercises.map(e => e.name)))];
  const currentEx = selectedEx || allExercises[0] || "";
  const volEntries = history.filter(h => h.exercises.some(e => e.name === currentEx)).slice(0, 12).reverse();
  const volLabels = volEntries.map(h => h.date.split(',')[0]);
  const volData = volEntries.map(h => {
    const ex = h.exercises.find(e => e.name === currentEx);
    return ex ? Math.round(ex.sets.reduce((a, s) => a + (s.weight * s.reps), 0)) : 0;
  });

  const accentColor = day.color;

  // Loading state
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#333", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", letterSpacing: "0.15em" }}>LOADING...</div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3rem", color: "#FF6B35", letterSpacing: "0.1em", marginBottom: "4px" }}>WORKOUT TRACKER</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", color: "#333", letterSpacing: "0.2em", marginBottom: "48px" }}>SIGN IN TO CONTINUE</div>

        <div style={{ width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ padding: "14px 16px", background: "#161616", border: "1px solid #2a2a2a", borderRadius: "8px", color: "#ccc", fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", outline: "none" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ padding: "14px 16px", background: "#161616", border: "1px solid #2a2a2a", borderRadius: "8px", color: "#ccc", fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", outline: "none" }}
          />

          {authError && (
            <div style={{ color: "#ff4444", fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", textAlign: "center" }}>
              {authError}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={authSubmitting}
            style={{ padding: "14px", background: "#FF6B351a", border: "1px solid #FF6B35", color: "#FF6B35", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem", letterSpacing: "0.1em", borderRadius: "8px", cursor: authSubmitting ? "not-allowed" : "pointer", opacity: authSubmitting ? 0.6 : 1, marginTop: "4px" }}
          >
            {authSubmitting ? "SIGNING IN..." : "SIGN IN"}
          </button>
        </div>
      </div>
    );
  }

  const navItems = ["today", "history", "progress"];

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d0d", color: "#fff",
      display: "flex",
      flexDirection: isDesktop ? "row" : "column",
      maxWidth: isDesktop ? "1280px" : "640px",
      margin: "0 auto",
    }}>

      {/* Nav: sidebar on desktop, top bar on mobile */}
      {isDesktop ? (
        <div style={{
          width: "220px", flexShrink: 0,
          borderRight: "1px solid #1f1f1f",
          display: "flex", flexDirection: "column",
          padding: "28px 0", position: "sticky", top: 0,
          height: "100vh",
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.4rem", color: "#FF6B35", letterSpacing: "0.08em", padding: "0 24px", marginBottom: "32px" }}>
            WORKOUT
          </div>
          {navItems.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              textAlign: "left",
              padding: "14px 24px",
              fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem", letterSpacing: "0.1em",
              color: tab === t ? accentColor : "#444",
              background: tab === t ? `${accentColor}14` : "transparent",
              border: "none",
              borderLeft: `3px solid ${tab === t ? accentColor : "transparent"}`,
              cursor: "pointer",
            }}>
              {t.toUpperCase()}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={handleLogout} style={{ padding: "14px 24px", textAlign: "left", background: "transparent", border: "none", color: "#444", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", cursor: "pointer", letterSpacing: "0.05em" }}>
            SIGN OUT
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", borderBottom: "1px solid #1f1f1f", background: "#0d0d0d", position: "sticky", top: 0, zIndex: 20 }}>
          {navItems.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "14px 8px",
              fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "0.1em",
              color: tab === t ? accentColor : "#444",
              background: "transparent", border: "none",
              borderBottom: `2px solid ${tab === t ? accentColor : "transparent"}`,
              cursor: "pointer",
            }}>
              {t.toUpperCase()}
            </button>
          ))}
          <button onClick={handleLogout} style={{ padding: "14px 12px", background: "transparent", border: "none", color: "#333", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", cursor: "pointer", letterSpacing: "0.05em" }}>
            OUT
          </button>
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, minWidth: 0 }}>

      {/* GENERATOR — muscle group picker */}
      {tab === "today" && generatorOpen && (
        <div style={{ padding: "24px 16px" }}>
          <button onClick={() => setGeneratorOpen(false)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#888", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", marginBottom: "20px" }}>
            ← Cancel
          </button>

          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", color: "#9B5DE5", letterSpacing: "0.05em", marginBottom: "6px" }}>
            PICK MUSCLE GROUPS
          </div>
          <div style={{ fontSize: "0.85rem", color: "#666", fontFamily: "'DM Sans', sans-serif", marginBottom: "20px" }}>
            8 exercises total, split evenly across your picks.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: "10px", marginBottom: "24px" }}>
            {MUSCLE_GROUPS.map(g => {
              const isSelected = selectedGroups.includes(g);
              return (
                <button key={g} onClick={() => toggleGroup(g)} style={{
                  padding: "18px 10px",
                  background: isSelected ? "#9B5DE51a" : "#161616",
                  border: `1px solid ${isSelected ? "#9B5DE5" : "#2a2a2a"}`,
                  color: isSelected ? "#9B5DE5" : "#888",
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "0.05em",
                  borderRadius: "8px", cursor: "pointer",
                }}>
                  {g.toUpperCase()}
                </button>
              );
            })}
          </div>

          {selectedGroups.length > 0 && (
            <div style={{ fontSize: "0.8rem", color: "#555", fontFamily: "'DM Sans', sans-serif", marginBottom: "14px", textAlign: "center" }}>
              {Math.floor(GENERATED_TOTAL_EXERCISES / selectedGroups.length)} exercise{Math.floor(GENERATED_TOTAL_EXERCISES / selectedGroups.length) !== 1 ? "s" : ""} per group · {Math.floor(GENERATED_TOTAL_EXERCISES / selectedGroups.length) * selectedGroups.length} total
            </div>
          )}

          <button
            onClick={generateWorkout}
            disabled={selectedGroups.length === 0}
            style={{
              width: "100%", padding: "16px",
              background: selectedGroups.length === 0 ? "#1a1a1a" : "#9B5DE51a",
              border: `1px solid ${selectedGroups.length === 0 ? "#2a2a2a" : "#9B5DE5"}`,
              color: selectedGroups.length === 0 ? "#444" : "#9B5DE5",
              fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem", letterSpacing: "0.1em",
              borderRadius: "10px", cursor: selectedGroups.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            GENERATE
          </button>
        </div>
      )}

      {/* TODAY */}
      {tab === "today" && !generatorOpen && (
        <>
          <div style={{ background: `linear-gradient(135deg, #111 60%, ${accentColor}26)`, borderBottom: "1px solid #1f1f1f", padding: "28px 20px 20px" }}>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", color: "#444", marginBottom: "6px", fontFamily: "'DM Sans', sans-serif" }}>{generatedWorkout ? "ON-DEMAND WORKOUT" : "WEEKLY TRAINING PLAN"}</p>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.6rem", color: accentColor, lineHeight: 1 }}>{day.focus.toUpperCase()}</div>
                <div style={{ fontSize: "1rem", color: "#666", fontFamily: "'DM Sans', sans-serif", fontWeight: 300, marginTop: "4px" }}>{generatedWorkout ? selectedGroups.join(" + ").toUpperCase() : active.toUpperCase()}</div>
                <div style={{ display: "inline-block", background: `${accentColor}26`, border: `1px solid ${accentColor}66`, color: accentColor, borderRadius: "20px", padding: "3px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 500, marginTop: "10px" }}>
                  {day.exercises.length} EXERCISES
                </div>
              </div>
              <span style={{ fontSize: "2.8rem", marginTop: "4px" }}>{day.emoji}</span>
            </div>
          </div>

          <div style={{ padding: "14px 16px 0", background: "#0d0d0d" }}>
            {generatedWorkout ? (
              <button onClick={clearGeneratedWorkout} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid #2a2a2a", color: "#888", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", borderRadius: "6px", cursor: "pointer" }}>
                ← Back to weekly plan
              </button>
            ) : (
              <button onClick={() => { setGeneratorOpen(true); setSelectedGroups([]); }} style={{ width: "100%", padding: "10px", background: "#9B5DE51a", border: "1px solid #9B5DE5", color: "#9B5DE5", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", borderRadius: "6px", cursor: "pointer" }}>
                🎲 GENERATE WORKOUT
              </button>
            )}
          </div>

          <div style={{ display: generatedWorkout ? "none" : "flex", gap: "6px", padding: "14px 16px 0", background: "#0d0d0d" }}>
            {days.map(d => (
              <button key={d} onClick={() => switchDay(d)} style={{
                flex: 1,
                background: active === d ? `${workoutData[d].color}1a` : "transparent",
                border: `1px solid ${active === d ? workoutData[d].color : "#2a2a2a"}`,
                color: active === d ? workoutData[d].color : "#555",
                fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem",
                letterSpacing: "0.1em", padding: "10px 6px", cursor: "pointer", borderRadius: "6px",
              }}>
                {workoutData[d].label}
              </button>
            ))}
          </div>

          <div style={{ padding: "16px" }}>
            {logging ? (
              <>
                <button onClick={() => { setLogging(false); setActiveSets({}); setSetCount({}); }} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#888", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", marginBottom: "14px" }}>
                  ← Back
                </button>

                {day.exercises.map((ex, ei) => (
                  <div key={ei} style={{ background: "#161616", border: "1px solid #1f1f1f", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem", color: accentColor, marginBottom: "12px", letterSpacing: "0.05em" }}>{ex}</div>

                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ flex: 1, textAlign: "center", fontSize: "0.75rem", color: "#444", fontFamily: "'DM Sans', sans-serif" }}>SET</span>
                      <span style={{ flex: 2, textAlign: "center", fontSize: "0.75rem", color: "#444", fontFamily: "'DM Sans', sans-serif" }}>WEIGHT (LBS)</span>
                      <span style={{ flex: 2, textAlign: "center", fontSize: "0.75rem", color: "#444", fontFamily: "'DM Sans', sans-serif" }}>REPS</span>
                    </div>

                    {Array.from({ length: getSetCount(ei) }, (_, si) => {
                      const hasData = activeSets[`${ei}-${si}-w`] || activeSets[`${ei}-${si}-r`];
                      return (
                        <div key={si} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{
                            flex: 1, textAlign: "center", fontSize: "0.75rem",
                            fontFamily: "'DM Sans', sans-serif",
                            color: hasData ? accentColor : "#444",
                            fontWeight: hasData ? 600 : 400,
                          }}>{si + 1}</span>
                          <input type="number" min="0" placeholder="0"
                            value={activeSets[`${ei}-${si}-w`] || ""}
                            onChange={e => updateSet(`${ei}-${si}-w`, e.target.value)}
                            style={{
                              flex: 2, padding: "7px 4px", textAlign: "center",
                              border: `1px solid ${hasData ? accentColor + '66' : "#2a2a2a"}`,
                              borderRadius: "6px", background: "#0d0d0d", color: "#ccc",
                              fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
                            }}
                          />
                          <input type="number" min="0" placeholder="0"
                            value={activeSets[`${ei}-${si}-r`] || ""}
                            onChange={e => updateSet(`${ei}-${si}-r`, e.target.value)}
                            style={{
                              flex: 2, padding: "7px 4px", textAlign: "center",
                              border: `1px solid ${hasData ? accentColor + '66' : "#2a2a2a"}`,
                              borderRadius: "6px", background: "#0d0d0d", color: "#ccc",
                              fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
                            }}
                          />
                        </div>
                      );
                    })}

                    <button
                      onClick={() => addSet(ei)}
                      style={{
                        width: "100%", marginTop: "10px", padding: "8px",
                        background: "transparent",
                        border: `1px dashed ${accentColor}44`,
                        color: accentColor, borderRadius: "6px",
                        fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
                        cursor: "pointer", letterSpacing: "0.05em",
                      }}
                    >
                      + Add Set
                    </button>
                  </div>
                ))}

                <button onClick={saveWorkout} style={{ width: "100%", padding: "16px", marginTop: "8px", background: `${accentColor}1a`, border: `1px solid ${accentColor}`, color: accentColor, fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem", letterSpacing: "0.1em", borderRadius: "10px", cursor: "pointer" }}>
                  ✓ LOG WORKOUT
                </button>
              </>
            ) : (
              <>
                {day.exercises.map((ex, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "10px", background: "#161616", border: "1px solid #1f1f1f", fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", color: "#ccc", marginBottom: "8px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
                    {ex}
                  </div>
                ))}
                <button onClick={() => setLogging(true)} style={{ width: "100%", padding: "16px", marginTop: "8px", background: `${accentColor}1a`, border: `1px solid ${accentColor}`, color: accentColor, fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem", letterSpacing: "0.1em", borderRadius: "10px", cursor: "pointer" }}>
                  + START LOGGING
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div style={{ padding: "16px" }}>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#333", fontFamily: "'DM Sans', sans-serif" }}>No workouts logged yet.</div>
          ) : (
            <div style={{
              display: isDesktop ? "grid" : "block",
              gridTemplateColumns: isDesktop ? "repeat(2, 1fr)" : undefined,
              gap: isDesktop ? "10px" : 0,
            }}>
              {history.map((entry, i) => (
                <div key={i} style={{ background: "#161616", border: "1px solid #1f1f1f", borderRadius: "10px", padding: "14px 16px", marginBottom: isDesktop ? 0 : "10px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#444", fontFamily: "'DM Sans', sans-serif", marginBottom: "4px" }}>{entry.date}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem", color: entry.color, marginBottom: "8px" }}>{entry.emoji} {entry.name.toUpperCase()}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {entry.exercises.map((ex, ei) => {
                      const vol = ex.sets.reduce((a, s) => a + (s.weight * s.reps), 0);
                      return (
                        <span key={ei} style={{ fontSize: "0.75rem", background: "#1f1f1f", borderRadius: "20px", padding: "3px 10px", color: "#666", fontFamily: "'DM Sans', sans-serif" }}>
                          {ex.name}{vol ? ` · ${Math.round(vol).toLocaleString()} lbs` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROGRESS */}
      {tab === "progress" && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "16px" }}>
            {[
              { val: totalWorkouts, lbl: "WORKOUTS" },
              { val: activeWeeks, lbl: "ACTIVE WEEKS" },
              { val: totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + "k" : Math.round(totalVol), lbl: "TOTAL LBS" },
            ].map((m, i) => (
              <div key={i} style={{ background: "#161616", border: "1px solid #1f1f1f", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", color: accentColor }}>{m.val}</div>
                <div style={{ fontSize: "0.72rem", color: "#444", fontFamily: "'DM Sans', sans-serif", marginTop: "2px" }}>{m.lbl}</div>
              </div>
            ))}
          </div>

          <div style={{
            display: isDesktop ? "grid" : "block",
            gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined,
            gap: isDesktop ? "12px" : 0,
          }}>
            <div style={{ background: "#161616", border: "1px solid #1f1f1f", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: "#555", marginBottom: "12px" }}>WORKOUTS PER WEEK</div>
              <div style={{ position: "relative", height: "200px" }}>
                {freqLabels.length > 0 ? (
                  <Bar data={{ labels: freqLabels, datasets: [{ data: freqData, backgroundColor: `${accentColor}44`, borderColor: accentColor, borderWidth: 1.5 }] }} options={chartOptions()} />
                ) : (
                  <div style={{ textAlign: "center", paddingTop: "80px", color: "#333", fontFamily: "'DM Sans', sans-serif" }}>No data yet</div>
                )}
              </div>
            </div>

            <div style={{ background: "#161616", border: "1px solid #1f1f1f", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: "#555", marginBottom: "12px" }}>EXERCISE VOLUME OVER TIME</div>
              {allExercises.length > 0 ? (
                <>
                  <select value={currentEx} onChange={e => setSelectedEx(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #2a2a2a", borderRadius: "6px", fontSize: "0.85rem", fontFamily: "'DM Sans', sans-serif", background: "#0d0d0d", color: "#aaa", marginBottom: "12px" }}>
                    {allExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                  </select>
                  <div style={{ position: "relative", height: "200px" }}>
                    <Line data={{ labels: volLabels, datasets: [{ data: volData, borderColor: accentColor, backgroundColor: `${accentColor}18`, borderWidth: 2, tension: 0.35, fill: true, pointRadius: 5, pointBackgroundColor: accentColor }] }} options={chartOptions()} />
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "80px 0", color: "#333", fontFamily: "'DM Sans', sans-serif" }}>Log workouts to see volume trends</div>
              )}
            </div>
          </div>
        </div>
      )}

      </div>

    </div>
  );
}
