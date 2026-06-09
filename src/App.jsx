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

const chartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, ticks: { color: "#444" }, grid: { color: "rgba(255,255,255,0.04)" } },
    x: { ticks: { color: "#444", maxRotation: 30 }, grid: { display: false } },
  },
});

export default function App() {
  const [active, setActive] = useState("Monday");
  const [logging, setLogging] = useState(false);
  const [activeSets, setActiveSets] = useState({});
  const [setCount, setSetCount] = useState({});
  const [tab, setTab] = useState("today");
  const [selectedEx, setSelectedEx] = useState("");
  const [history, setHistory] = useState([]);

  const day = workoutData[active];

  useEffect(() => {
    async function loadWorkouts() {
      const { data } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', 'barry')
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
  }, []);

  function switchDay(d) {
    setActive(d);
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
      dayName: active,
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
      user_id: 'barry',
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

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#fff", display: "flex", flexDirection: "column", maxWidth: "640px", margin: "0 auto" }}>

      {/* Nav */}
      <div style={{ display: "flex", borderBottom: "1px solid #1f1f1f", background: "#0d0d0d", position: "sticky", top: 0, zIndex: 20 }}>
        {["today", "history", "progress"].map(t => (
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
      </div>

      {/* TODAY */}
      {tab === "today" && (
        <>
          <div style={{ background: `linear-gradient(135deg, #111 60%, ${accentColor}26)`, borderBottom: "1px solid #1f1f1f", padding: "28px 20px 20px" }}>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", color: "#444", marginBottom: "6px", fontFamily: "'DM Sans', sans-serif" }}>WEEKLY TRAINING PLAN</p>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.6rem", color: accentColor, lineHeight: 1 }}>{day.focus.toUpperCase()}</div>
                <div style={{ fontSize: "1rem", color: "#666", fontFamily: "'DM Sans', sans-serif", fontWeight: 300, marginTop: "4px" }}>{active.toUpperCase()}</div>
                <div style={{ display: "inline-block", background: `${accentColor}26`, border: `1px solid ${accentColor}66`, color: accentColor, borderRadius: "20px", padding: "3px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 500, marginTop: "10px" }}>
                  {day.exercises.length} EXERCISES
                </div>
              </div>
              <span style={{ fontSize: "2.8rem", marginTop: "4px" }}>{day.emoji}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px", padding: "14px 16px 0", background: "#0d0d0d" }}>
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

                    {/* Column headers */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ flex: 1, textAlign: "center", fontSize: "0.75rem", color: "#444", fontFamily: "'DM Sans', sans-serif" }}>SET</span>
                      <span style={{ flex: 2, textAlign: "center", fontSize: "0.75rem", color: "#444", fontFamily: "'DM Sans', sans-serif" }}>WEIGHT (LBS)</span>
                      <span style={{ flex: 2, textAlign: "center", fontSize: "0.75rem", color: "#444", fontFamily: "'DM Sans', sans-serif" }}>REPS</span>
                    </div>

                    {/* Sets */}
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

                    {/* Add set button */}
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
            history.map((entry, i) => (
              <div key={i} style={{ background: "#161616", border: "1px solid #1f1f1f", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px" }}>
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
            ))
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
      )}

    </div>
  );
}
