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
// Función auxiliar: detecta si estamos en el minuto 1 del último cuarto (Q4)
function isFirstMinuteQ4(status, timer) {
  if (status !== "Q4") return false;
  const [min] = timer.split(":").map(Number);
  return min === 1; // exactamente minuto 1 transcurrido
}

// --- Cerrado: notificación al minuto 1 del Q4 ---
if (isFirstMinuteQ4(status, timer) && diff <= 2 && !state.q4_closed) {
  const totalPoints = pointsHome + pointsAway;
  const promedioQ = totalPoints / 4;
  const sugerencia = totalPoints + promedioQ;

  sendNotification(`🔥 Partido cerrado detectado al minuto 1 del Q4
${home} vs ${away}
🏀 ${pointsHome} - ${pointsAway}
Liga: ${league} | País: ${country}
⏱️ Tiempo transcurrido: ${timer}
📊 Total puntos hasta ahora: ${totalPoints}
💡 Promedio dinámico: ${promedioQ.toFixed(1)} puntos por cuarto
👉 Sugerencia: Más de ${sugerencia.toFixed(0)} puntos`);

  state.q4_closed = true;
  state.initialTotal = totalPoints;
  state.pointsQ4 = { home: pointsHome, away: pointsAway };
  notifiedGames.set(key, state);
}

// --- Desbalanceado: notificación al minuto 1 del Q4 ---
if (isFirstMinuteQ4(status, timer) && diff >= 20 && !state.q4_blowout) {
  const totalPoints = pointsHome + pointsAway;
  const promedioA = pointsHome / 4;
  const promedioB = pointsAway / 4;
  const promedioTotal = promedioA + promedioB;
  const sugerencia = totalPoints + promedioTotal;

  sendNotification(`⚡ Partido desbalanceado detectado al minuto 1 del Q4
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
⏱️ Tiempo transcurrido: ${timer}
📊 Total puntos hasta ahora: ${totalPoints}
💡 Promedio A: ${promedioA.toFixed(1)} | Promedio B: ${promedioB.toFixed(1)}
👉 Sugerencia: Menos de ${sugerencia.toFixed(0)} puntos`);

  state.q4_blowout = true;
  state.initialTotal = totalPoints;
  state.pointsQ4 = { home: pointsHome, away: pointsAway };
  notifiedGames.set(key, state);
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
