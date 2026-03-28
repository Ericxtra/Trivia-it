import { useState, useEffect, useRef } from "react";

const TOTAL = 10;
const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

const SYSTEM_PROMPT = `Eres un generador de preguntas de trivia para un equipo de Soporte IT de nivel básico e intermedio.
Los temas son: Redes y TCP/IP, Sistemas Operativos (Windows/Linux), Hardware y Diagnóstico.
Genera exactamente 1 pregunta en formato JSON con esta estructura:
{
  "tema": "Redes y TCP/IP" | "Sistemas Operativos" | "Hardware y Diagnóstico",
  "dificultad": "Básico" | "Intermedio",
  "pregunta": "texto de la pregunta",
  "opciones": ["A) opción1", "B) opción2", "C) opción3", "D) opción4"],
  "correcta": 0,
  "explicacion": "explicación breve de por qué es correcta (1-2 oraciones)"
}
El campo "correcta" es el índice (0-3) de la opción correcta.
Ejemplos de temas: puertos TCP/UDP, modelo OSI, subnetting, ipconfig/ifconfig, DHCP, DNS, RAM/CPU/disco, BSOD, procesos del SO, RAID, POST, administración de usuarios.
NO repitas preguntas. Devuelve SOLO el JSON sin texto adicional ni backticks.`;

const TEMA_COLOR = {
  "Redes y TCP/IP": "#00ccff",
  "Sistemas Operativos": "#aa88ff",
  "Hardware y Diagnóstico": "#ffaa00",
};
const TEMA_ICON = {
  "Redes y TCP/IP": "🌐",
  "Sistemas Operativos": "🖥️",
  "Hardware y Diagnóstico": "🔧",
};
const DIFF_COLOR = { "Básico": "#00ffaa", "Intermedio": "#ffaa00" };

// LocalStorage leaderboard (shared per device; for true shared leaderboard use a backend)
function loadLB() {
  try { return JSON.parse(localStorage.getItem("trivia_it_lb") || "[]"); } catch { return []; }
}
function saveLB(entries) {
  try { localStorage.setItem("trivia_it_lb", JSON.stringify(entries)); } catch {}
}

export default function App() {
  const [screen, setScreen] = useState("intro");
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState("");
  const [leaderboard, setLeaderboard] = useState(loadLB);
  const [lastResult, setLastResult] = useState(null);

  function addResult(entry) {
    const updated = [entry, ...leaderboard].sort((a, b) => b.correct - a.correct || a.time - b.time);
    setLeaderboard(updated);
    saveLB(updated);
  }

  function startGame() {
    const n = playerName.trim();
    if (!n || n.length < 2) { setNameError("Ingresa un nombre válido."); return; }
    setNameError("");
    setScreen("game");
  }

  if (screen === "intro") return (
    <Intro
      playerName={playerName} setPlayerName={setPlayerName}
      nameError={nameError} onStart={startGame}
      onLeaderboard={() => setScreen("leaderboard")}
      leaderboard={leaderboard}
    />
  );
  if (screen === "game") return (
    <Game playerName={playerName.trim()} onFinish={(result) => {
      setLastResult(result);
      addResult(result);
      setScreen("leaderboard");
    }} />
  );
  if (screen === "leaderboard") return (
    <Leaderboard
      leaderboard={leaderboard} lastResult={lastResult}
      onBack={() => { setPlayerName(""); setLastResult(null); setScreen("intro"); }}
    />
  );
}

// ─── INTRO ───────────────────────────────────────────────────────────────────
function Intro({ playerName, setPlayerName, nameError, onStart, onLeaderboard, leaderboard }) {
  return (
    <div style={s.root}>
      <BgGrid />
      <div style={s.card}>
        <div style={s.logo}>⚙️</div>
        <h1 style={s.title}>IT SUPPORT<br /><span style={{ color: "#00ccff" }}>TRIVIA</span></h1>
        <p style={s.subtitle}>Redes · Sistemas Operativos · Hardware</p>
        <div style={s.tagRow}>
          <Tag color="#00ffaa">10 preguntas</Tag>
          <Tag color="#00ccff">IA en tiempo real</Tag>
          <Tag color="#ffaa00">Tabla de resultados</Tag>
        </div>
        <div style={s.inputWrap}>
          <input
            style={{ ...s.input, borderColor: nameError ? "#ff4466" : "rgba(255,255,255,0.15)" }}
            placeholder="Tu nombre o apodo..."
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onStart()}
            maxLength={24}
          />
          {nameError && <p style={s.inputError}>{nameError}</p>}
        </div>
        <button style={s.btnPrimary} onClick={onStart}>INICIAR TRIVIA →</button>
        {leaderboard.length > 0 && (
          <button style={s.btnSecondary} onClick={onLeaderboard}>
            🏆 Tabla de resultados ({leaderboard.length})
          </button>
        )}
        {leaderboard.slice(0, 3).map((e, i) => (
          <div key={i} style={s.miniRow}>
            <span>{["🥇","🥈","🥉"][i]}</span>
            <span style={{ flex: 1, color: "#aaa", fontSize: 13 }}>{e.name}</span>
            <span style={{ color: "#00ffaa", fontFamily: "monospace", fontSize: 13 }}>{e.correct}/{TOTAL}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GAME ────────────────────────────────────────────────────────────────────
function Game({ playerName, onFinish }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [details, setDetails] = useState([]);
  const [error, setError] = useState(null);
  const [streak, setStreak] = useState(0);
  const usedQ = useRef([]);
  const finished = useRef(false);

  useEffect(() => { fetchQ(); }, []); // eslint-disable-line

  async function fetchQ() {
    setLoading(true); setError(null); setSelected(null); setShowResult(false);
    const avoid = usedQ.current.length ? ` Evita repetir: ${usedQ.current.slice(-4).join(" | ")}` : "";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Genera una pregunta de soporte IT.${avoid}` }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content?.map(b => b.text || "").join("").trim();
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      usedQ.current.push(parsed.pregunta.slice(0, 40));
      setQuestion(parsed);
    } catch(e) {
      setError("Error al cargar pregunta: " + (e.message || "intenta de nuevo"));
    }
    setLoading(false);
  }

  function handleAnswer(idx) {
    if (selected !== null || showResult) return;
    setSelected(idx);
    setShowResult(true);
    const isCorrect = idx === question.correcta;
    const newStreak = isCorrect ? streak + 1 : 0;
    setStreak(newStreak);
    const pts = isCorrect ? (newStreak >= 3 ? 2 : 1) : 0;
    const newScore = score + pts;
    const newCorrect = correct + (isCorrect ? 1 : 0);
    setScore(newScore);
    setCorrect(newCorrect);
    const newDetails = [...details, { tema: question.tema, dificultad: question.dificultad, correct: isCorrect, pts }];
    setDetails(newDetails);
    if (round + 1 >= TOTAL && !finished.current) {
      finished.current = true;
      setTimeout(() => onFinish({
        name: playerName, score: newScore, correct: newCorrect,
        total: TOTAL, details: newDetails, time: Date.now(),
        date: new Date().toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      }), 1600);
    }
  }

  function next() { setRound(r => r + 1); fetchQ(); }

  return (
    <div style={s.root}>
      <BgGrid />
      <div style={s.card}>
        <div style={s.header}>
          <div>
            <div style={s.headerLabel}>JUGADOR</div>
            <div style={s.headerVal}>{playerName}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={s.headerLabel}>RONDA</div>
            <div style={{ ...s.headerVal, color: "#00ccff" }}>{round + 1}/{TOTAL}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={s.headerLabel}>PUNTOS</div>
            <div style={{ ...s.headerVal, color: "#00ffaa" }}>{score}{streak >= 3 ? " 🔥" : ""}</div>
          </div>
        </div>
        <div style={s.progressBg}>
          <div style={{ ...s.progressFill, width: `${(round / TOTAL) * 100}%` }} />
        </div>

        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={s.spinner} />
            <p style={{ color: "#555", fontSize: 13, marginTop: 16, fontFamily: "monospace" }}>Generando pregunta con IA...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ color: "#ff4466", marginBottom: 12, fontSize: 13 }}>{error}</p>
            <button style={s.btnPrimary} onClick={fetchQ}>Reintentar</button>
          </div>
        ) : question && (<>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Tag color={TEMA_COLOR[question.tema]}>{TEMA_ICON[question.tema]} {question.tema}</Tag>
            <Tag color={DIFF_COLOR[question.dificultad]}>{question.dificultad}</Tag>
          </div>
          <div style={s.questionBox}>
            <p style={s.questionText}>{question.pregunta}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, width: "100%" }}>
            {question.opciones.map((opt, idx) => {
              let bg = "rgba(255,255,255,0.04)", border = "1px solid rgba(255,255,255,0.1)", color = "#ddd";
              if (showResult) {
                if (idx === question.correcta) { bg = "rgba(0,255,170,0.12)"; border = "1px solid #00ffaa"; color = "#00ffaa"; }
                else if (idx === selected) { bg = "rgba(255,68,102,0.12)"; border = "1px solid #ff4466"; color = "#ff4466"; }
                else color = "#444";
              }
              return (
                <button key={idx} onClick={() => handleAnswer(idx)}
                  style={{ ...s.optBtn, background: bg, border, color, cursor: showResult ? "default" : "pointer" }}>
                  {opt}
                </button>
              );
            })}
          </div>
          {showResult && (
            <div style={s.explanBox}>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#bbb", lineHeight: 1.6 }}>
                {selected === question.correcta ? "✅ ¡Correcto! " : "❌ Incorrecto. "}{question.explicacion}
              </p>
              {round + 1 < TOTAL
                ? <button style={s.btnPrimary} onClick={next}>Siguiente →</button>
                : <p style={{ color: "#555", fontSize: 12, textAlign: "center", fontFamily: "monospace" }}>Guardando resultados...</p>
              }
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
function Leaderboard({ leaderboard, lastResult, onBack }) {
  const medal = i => ["🥇","🥈","🥉"][i] || `#${i+1}`;
  return (
    <div style={s.root}>
      <BgGrid />
      <div style={{ ...s.card, maxWidth: 560 }}>
        <h2 style={{ ...s.title, fontSize: 24, marginBottom: 4 }}>🏆 Tabla de Resultados</h2>
        <p style={s.subtitle}>Equipo de Soporte IT</p>

        {lastResult && (
          <div style={s.myResult}>
            <div style={{ fontSize: 11, color: "#555", fontFamily: "monospace", marginBottom: 8 }}>TU RESULTADO</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 32 }}>
                {lastResult.correct >= 9 ? "🥇" : lastResult.correct >= 7 ? "🥈" : lastResult.correct >= 5 ? "🥉" : "🔧"}
              </span>
              <div>
                <div style={{ color: "#fff", fontWeight: 700 }}>{lastResult.name}</div>
                <div style={{ color: "#555", fontSize: 12 }}>{lastResult.date}</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ color: "#00ffaa", fontSize: 26, fontWeight: 800, fontFamily: "monospace" }}>
                  {lastResult.correct}/{TOTAL}
                </div>
                <div style={{ color: "#555", fontSize: 11 }}>correctas</div>
              </div>
            </div>
            {["Redes y TCP/IP","Sistemas Operativos","Hardware y Diagnóstico"].map(tema => {
              const td = lastResult.details?.filter(d => d.tema === tema) || [];
              if (!td.length) return null;
              const tc = td.filter(d => d.correct).length;
              return (
                <div key={tema} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginBottom: 3 }}>
                    <span>{TEMA_ICON[tema]} {tema}</span>
                    <span style={{ color: TEMA_COLOR[tema] }}>{tc}/{td.length}</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                    <div style={{ height: "100%", width: `${(tc/td.length)*100}%`, background: TEMA_COLOR[tema], borderRadius: 4, transition: "width 1s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ width: "100%", marginBottom: 16 }}>
          <div style={s.lbHeader}>
            <span style={{ width: 32 }}>#</span>
            <span style={{ flex: 1 }}>Jugador</span>
            <span style={{ width: 70, textAlign: "center" }}>Correctas</span>
            <span style={{ width: 50, textAlign: "right" }}>Pts</span>
          </div>
          {leaderboard.length === 0 && (
            <p style={{ color: "#444", textAlign: "center", fontSize: 13, padding: 24 }}>Aún sin resultados.</p>
          )}
          {leaderboard.map((e, i) => (
            <div key={i} style={{
              ...s.lbRow,
              background: e.name === lastResult?.name && i === 0 ? "rgba(0,204,255,0.06)" : "rgba(255,255,255,0.02)",
              border: e.name === lastResult?.name && i === 0 ? "1px solid rgba(0,204,255,0.2)" : "1px solid rgba(255,255,255,0.05)",
            }}>
              <span style={{ width: 32, fontSize: 15 }}>{medal(i)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{e.name}</div>
                <div style={{ color: "#444", fontSize: 11 }}>{e.date}</div>
              </div>
              <div style={{ width: 70, textAlign: "center" }}>
                <span style={{
                  color: e.correct >= 9 ? "#00ffaa" : e.correct >= 7 ? "#ffaa00" : "#ff6666",
                  fontFamily: "monospace", fontWeight: 700, fontSize: 15,
                }}>{e.correct}/{TOTAL}</span>
              </div>
              <div style={{ width: 50, textAlign: "right", color: "#555", fontFamily: "monospace", fontSize: 13 }}>
                {e.score}
              </div>
            </div>
          ))}
        </div>
        <button style={s.btnPrimary} onClick={onBack}>Jugar de nuevo</button>
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function Tag({ color, children }) {
  return <span style={{ border: `1px solid ${color}`, color, borderRadius: 20, padding: "3px 11px", fontSize: 11, fontFamily: "monospace" }}>{children}</span>;
}

function BgGrid() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(0,204,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,255,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div style={{ position: "absolute", top: "15%", left: "5%", width: 320, height: 320, background: "radial-gradient(circle, rgba(0,204,255,0.07) 0%, transparent 70%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 260, height: 260, background: "radial-gradient(circle, rgba(170,136,255,0.06) 0%, transparent 70%)", borderRadius: "50%" }} />
      <style>{`* { box-sizing: border-box; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = {
  root: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080d14", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 16 },
  card: { background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 24px", maxWidth: 500, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  logo: { fontSize: 44, marginBottom: 8 },
  title: { fontSize: 34, fontWeight: 900, color: "#fff", textAlign: "center", lineHeight: 1.1, margin: "0 0 8px", letterSpacing: -1 },
  subtitle: { color: "#555", fontSize: 12, textAlign: "center", marginBottom: 18, letterSpacing: 2, textTransform: "uppercase" },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 22 },
  inputWrap: { width: "100%", marginBottom: 12 },
  input: { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid", borderRadius: 10, padding: "12px 16px", color: "#fff", fontSize: 15, outline: "none", fontFamily: "inherit" },
  inputError: { color: "#ff4466", fontSize: 12, margin: "4px 0 0" },
  btnPrimary: { background: "linear-gradient(135deg, #00ccff, #0055ee)", color: "#fff", border: "none", borderRadius: 10, padding: "13px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", fontFamily: "monospace", marginBottom: 10, letterSpacing: 0.5 },
  btnSecondary: { background: "rgba(255,255,255,0.05)", color: "#888", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", fontSize: 13, cursor: "pointer", fontFamily: "monospace", width: "100%", marginBottom: 12 },
  miniRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", width: "100%" },
  header: { display: "flex", justifyContent: "space-between", width: "100%", marginBottom: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10 },
  headerLabel: { color: "#444", fontSize: 10, fontFamily: "monospace", letterSpacing: 1 },
  headerVal: { color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "monospace" },
  progressBg: { width: "100%", height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 4, marginBottom: 18, overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #00ccff, #0055ee)", borderRadius: 4, transition: "width 0.4s ease" },
  spinner: { width: 38, height: 38, border: "3px solid rgba(0,204,255,0.15)", borderTop: "3px solid #00ccff", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" },
  questionBox: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 18, marginBottom: 14, width: "100%" },
  questionText: { color: "#fff", fontSize: 15, lineHeight: 1.65, margin: 0 },
  optBtn: { borderRadius: 10, padding: "11px 12px", fontSize: 13, lineHeight: 1.4, textAlign: "left", transition: "all 0.15s", fontFamily: "inherit" },
  explanBox: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16, width: "100%" },
  myResult: { width: "100%", background: "rgba(0,204,255,0.04)", border: "1px solid rgba(0,204,255,0.12)", borderRadius: 12, padding: 16, marginBottom: 16 },
  lbHeader: { display: "flex", gap: 8, padding: "6px 10px", fontSize: 10, color: "#444", fontFamily: "monospace", letterSpacing: 1, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 },
  lbRow: { display: "flex", alignItems: "center", gap: 8, padding: "10px 10px", borderRadius: 10, marginBottom: 5, width: "100%" },
};
