const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

let notifiedGames = new Map();
let dailyGames = {};
let currentDate = new Date().toISOString().split("T")[0];

const excludedCountries = ["Kazakhstan", "Russia","Taiwan","Montenegro","Bosnia-and-Herzegovina"];

let dailyStats = {
  closed: { won: 0, lost: 0 },
  overtime: { won: 0, lost: 0 },
  blowout: { won: 0, lost: 0 },
  total: { won: 0, lost: 0 }
};

function resetDailyGamesIfNeeded() {
  const today = new Date().toISOString().split("T")[0];
  if (today !== currentDate) {
    dailyGames = {};
    dailyStats = {
      closed: { won: 0, lost: 0 },
      overtime: { won: 0, lost: 0 },
      blowout: { won: 0, lost: 0 },
      total: { won: 0, lost: 0 }
    };
    currentDate = today;
  }
}

function saveGameRecord(game) {
  const key = `${game.teams?.home?.name} vs ${game.teams?.away?.name}`;
  if (!dailyGames[key]) {
    dailyGames[key] = {
      home: game.teams?.home?.name,
      away: game.teams?.away?.name,
      league: game.league?.name,
      country: game.country?.name,
      status: game.status?.short,
      time: game.status?.timer || null,
      pointsHome: game.scores?.home?.total,
      pointsAway: game.scores?.away?.total
    };
  }
}

app.get("/", (req, res) => res.send("🏀 Worker de Basket corriendo en Render"));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

async function sendNotification(message) {
  try {
    await axios.post(
      "https://api.onesignal.com/notifications",
      {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        contents: { en: message }
      },
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.response?.data || err.message);
  }
}
function getLiveBasketEvents() {
  resetDailyGamesIfNeeded();
  const today = new Date().toISOString().split("T")[0];
  const options = {
    method: "GET",
    hostname: "v1.basketball.api-sports.io",
    path: `/games?date=${today}&timezone=Europe/London`,
    headers: { "x-apisports-key": API_SPORT_KEY }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        json.response.forEach(game => {
          const home = game.teams?.home?.name;
          const away = game.teams?.away?.name;
          const league = game.league?.name;
          const country = game.country?.name;
          const status = game.status?.short || "";
          const timer = game.status?.timer || "";
          const pointsHome = game.scores?.home?.total || 0;
          const pointsAway = game.scores?.away?.total || 0;
          const diff = Math.abs(pointsHome - pointsAway);
          const key = `${home} vs ${away}`;

          let state = notifiedGames.get(key) || {
            q3_closed: false,
            q4_blowout: false,
            ot: false,
            final: false,
            initialTotal: 0,
            pointsQ3: { home: 0, away: 0 }
          };
// Función auxiliar: detecta último minuto del Q3 usando tiempo transcurrido
function isLastMinuteQ3(status, timer) {
  if (status !== "Q3") return false;

  const [min, sec] = timer.split(":").map(Number);
  const elapsedSeconds = (min * 60) + sec;

  // Duración del cuarto: si ya pasaron más de 600 seg → es de 12 min
  const quarterDuration = elapsedSeconds > 600 ? 720 : 600;

  // Último minuto → cuando ya se jugaron (duración - 60) segundos
  return elapsedSeconds >= (quarterDuration - 60);
}

// --- Cerrado: notificación en el último minuto del Q3 ---
if (isLastMinuteQ3(status, timer) && diff <= 2 && !state.q3_closed) {
  const totalPoints = pointsHome + pointsAway;
  const promedioQ = totalPoints / 3;
  const sugerencia = totalPoints + promedioQ;

  sendNotification(`🔥 Partido cerrado detectado en el último minuto del Q3
${home} vs ${away}
🏀 ${pointsHome} - ${pointsAway}
⏱️ Tiempo transcurrido: ${timer} | Restante: ${(quarterDuration*60 - elapsedSeconds)/60 | 0}:${((quarterDuration*60 - elapsedSeconds)%60).toString().padStart(2,"0")}
📊 Total puntos hasta Q3: ${totalPoints}
💡 Promedio dinámico: ${promedioQ.toFixed(1)} puntos por cuarto
👉 Sugerencia: Más de ${sugerencia.toFixed(0)} puntos`);

  state.q3_closed = true;
  state.initialTotal = totalPoints;
  state.pointsQ3 = { home: pointsHome, away: pointsAway };
  notifiedGames.set(key, state);
}

// --- Desbalanceado: notificación en el último minuto del Q3 ---
if (isLastMinuteQ3(status, timer) && diff >= 20 && !state.q4_blowout) {
  const totalPoints = pointsHome + pointsAway;
  const promedioA = pointsHome / 3;
  const promedioB = pointsAway / 3;
  const promedioTotal = promedioA + promedioB;
  const sugerencia = totalPoints + promedioTotal;

  sendNotification(`⚡ Partido desbalanceado detectado en el último minuto del Q3
${home} vs ${away}
🏀 ${pointsHome} - ${pointsAway}
⏱️ Tiempo transcurrido: ${timer} | Restante: ${(quarterDuration*60 - elapsedSeconds)/60 | 0}:${((quarterDuration*60 - elapsedSeconds)%60).toString().padStart(2,"0")}
📊 Total puntos hasta Q3: ${totalPoints}
💡 Promedio A: ${promedioA.toFixed(1)} | Promedio B: ${promedioB.toFixed(1)}
👉 Sugerencia: Menos de ${sugerencia.toFixed(0)} puntos`);

  state.q4_blowout = true;
  state.initialTotal = totalPoints;
  state.pointsQ3 = { home: pointsHome, away: pointsAway };
  notifiedGames.set(key, state);
}

// --- Todos los partidos en curso: mostrar cálculo ---
if (["Q1","Q2","Q3","Q4"].includes(status)) {
  const totalPoints = pointsHome + pointsAway;
  const promedioQ = totalPoints / (status === "Q1" ? 1 : status === "Q2" ? 2 : status === "Q3" ? 3 : 4);

  // Detectar duración del cuarto
  const [min, sec] = timer.split(":").map(Number);
  const elapsedSeconds = (min * 60) + sec;
  const quarterDuration = elapsedSeconds > 600 ? 720 : 600;
  const remainingSeconds = quarterDuration - elapsedSeconds;
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;

  sendNotification(`📡 Partido en curso
${home} vs ${away}
🏀 ${pointsHome} - ${pointsAway}
⏱️ Tiempo transcurrido: ${timer} | Restante: ${remainingMin}:${remainingSec.toString().padStart(2,"0")}
📊 Total puntos: ${totalPoints}
💡 Promedio por cuarto: ${promedioQ.toFixed(1)}
👉 Sugerencia: Podría terminar con ~${(promedioQ*4).toFixed(0)} puntos`);
}
          // --- Prórroga: notificación al entrar en vivo ---
          if ((status === "OT" || status === "ET" || status.startsWith("OT")) && !state.ot && !state.final) {
            const totalPoints = pointsHome + pointsAway;
            const suggestion = totalPoints + 26;

            sendNotification(`⏱️ Prórroga detectada
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
💡 Sugerencia: Menos de ${suggestion}`);

            state.ot = true;                 // candado: ya se notificó la prórroga
            state.initialTotal = totalPoints;
            notifiedGames.set(key, state);   // mantener hasta FT/AOT
          }

          // --- Evaluación final ---
          if ((status === "FT" || status === "AOT") && !state.final) {
            if (state.q3_closed || state.q4_blowout || state.ot) {
              const totalPoints = pointsHome + pointsAway;
              const outcomes = [];

              // Cerrado dinámico
              if (state.q3_closed) {
                const totalQ3 = state.pointsQ3.home + state.pointsQ3.away;
                const promedioQ = totalQ3 / 3;
                const puntosQ4 = totalPoints - totalQ3;
                const closedWin = puntosQ4 >= promedioQ;

                outcomes.push({
                  label: "Cerrado (dinámico)",
                  win: closedWin,
                  suggestion: `Último cuarto ≥ ${promedioQ.toFixed(1)} puntos`
                });

                if (closedWin) {
                  dailyStats.closed.won++; dailyStats.total.won++;
                } else {
                  dailyStats.closed.lost++; dailyStats.total.lost++;
                }
              }

              // Desbalanceado dinámico
              if (state.q4_blowout) {
                const totalQ3 = state.pointsQ3.home + state.pointsQ3.away;
                const promedioA = state.pointsQ3.home / 3;
                const promedioB = state.pointsQ3.away / 3;
                const promedioTotal = promedioA + promedioB;
                const puntosQ4 = totalPoints - totalQ3;
                const blowoutWin = puntosQ4 <= promedioTotal;

                outcomes.push({
                  label: "Desbalanceado (dinámico)",
                  win: blowoutWin,
                  suggestion: `Último cuarto ≤ ${promedioTotal.toFixed(1)} puntos`
                });

                if (blowoutWin) {
                  dailyStats.blowout.won++; dailyStats.total.won++;
                } else {
                  dailyStats.blowout.lost++; dailyStats.total.lost++;
                }
              }

              // Prórroga (evaluar al final, siempre MENOS de)
              if (state.ot) {
                const overtimeWin = totalPoints <= state.initialTotal + 26;

                outcomes.push({
                  label: "Prórroga (todas)",
                  win: overtimeWin,
                  suggestion: `Menos de ${state.initialTotal + 26} puntos`
                });

                if (overtimeWin) {
                  dailyStats.overtime.won++; dailyStats.total.won++;
                } else {
                  dailyStats.overtime.lost++; dailyStats.total.lost++;
                }
              }

              const overallWin = outcomes.some(o => o.win);
              const resultText = overallWin ? "Ganaste" : "Perdiste";

              const breakdown = outcomes
                .map(o => `• ${o.label}: ${o.win ? "Ganaste" : "Perdiste"} | Sugerencia: ${o.suggestion}`)
                .join("\n");

              sendNotification(`✅ Partido terminado: ${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 Resultado final: ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
🎯 Resultado general: ${resultText}
${breakdown}`);
            }

            // 🔒 Candado final para evitar repeticiones
            state.final = true;
            notifiedGames.set(key, state);
            notifiedGames.delete(key);
          }
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta basket:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición basket:", err.message));
  req.end();
}
// --- Loop cada 30 segundos ---
setInterval(() => {
  console.log("🔄 Buscando partidos de basket...");
  getLiveBasketEvents();
}, 15 * 1000);

// --- Resumen diario a las 23:59 ---
function sendDailySummary() {
  const calcPercent = (won, lost) => {
    const total = won + lost;
    return total === 0 ? "0%" : ((won / total) * 100).toFixed(1) + "%";
  };

  const msg = `📊 Resumen del día (${currentDate})
- Partido cerrado: Ganados ${dailyStats.closed.won}, Perdidos ${dailyStats.closed.lost}, %Ganados ${calcPercent(dailyStats.closed.won, dailyStats.closed.lost)}
- Prórroga: Ganados ${dailyStats.overtime.won}, Perdidos ${dailyStats.overtime.lost}, %Ganados ${calcPercent(dailyStats.overtime.won, dailyStats.overtime.lost)}
- Desbalanceados: Ganados ${dailyStats.blowout.won}, Perdidos ${dailyStats.blowout.lost}, %Ganados ${calcPercent(dailyStats.blowout.won, dailyStats.blowout.lost)}
- General: Ganados ${dailyStats.total.won}, Perdidos ${dailyStats.total.lost}, %Ganados ${calcPercent(dailyStats.total.won, dailyStats.total.lost)}`;

  sendNotification(msg);

  // Reset stats para el nuevo día
  dailyStats = {
    closed: { won: 0, lost: 0 },
    overtime: { won: 0, lost: 0 },
    blowout: { won: 0, lost: 0 },
    total: { won: 0, lost: 0 }
  };
}

// --- Loop para enviar resumen a las 23:59 ---
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 23 && now.getMinutes() === 59) {
    sendDailySummary();
  }
}, 60 * 1000);
