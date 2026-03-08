const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

let notifiedGames = new Map();
let currentDate = new Date().toISOString().split("T")[0];

let dailyStats = {
  overtime: { won: 0, lost: 0 },
  blowout: { won: 0, lost: 0 },
  total: { won: 0, lost: 0 }
};

function resetDailyGamesIfNeeded() {
  const today = new Date().toISOString().split("T")[0];
  if (today !== currentDate) {
    dailyStats = {
      overtime: { won: 0, lost: 0 },
      blowout: { won: 0, lost: 0 },
      total: { won: 0, lost: 0 }
    };
    notifiedGames.clear();
    currentDate = today;
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
        headings: { en: "🏀 Basket Alert" },
        contents: { en: message }
      },
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("📲 Notificación enviada:", message);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.response?.data || err.message);
  }
}

function getLiveBasketEvents() {
  resetDailyGamesIfNeeded();

  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    path: `/api/v1/sport/basketball/events/live`,
    headers: {
      "x-rapidapi-key": API_SPORT_KEY,
      "x-rapidapi-host": "sportapi7.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        const games = json.data || json.events || [];
        games.forEach(game => {
          const home = game.homeTeam?.name;
          const away = game.awayTeam?.name;
          const status = game.status?.description || "";
          const timer = game.status?.timer || "";
          const pointsHome = game.homeScore?.current ?? 0;
          const pointsAway = game.awayScore?.current ?? 0;
          const diff = Math.abs(pointsHome - pointsAway);
          const key = `${home} vs ${away}`;

          let state = notifiedGames.get(key) || {
            q4_blowout: false,
            ot: false,
            otFinal: false,
            final: false,
            initialTotal: 0,
            estimadoFinal: 0
          };

          // --- Desbalanceado: último cuarto ---
          if (status.toUpperCase().includes("4TH") && diff >= 15 && !state.q4_blowout) {
            const totalPointsQ3 = pointsHome + pointsAway; // aproximado
            const promedioQ = totalPointsQ3 / 3;
            const estimadoFinal = totalPointsQ3 + promedioQ;

            sendNotification(`⚡ Partido desbalanceado en Q4
${home} vs ${away}
🏀 ${pointsHome} - ${pointsAway}
⏱️ Tiempo: ${timer}
📊 Total puntos hasta Q3: ${totalPointsQ3}
💡 Estimado final: ${estimadoFinal.toFixed(0)} puntos`);

            state.q4_blowout = true;
            state.initialTotal = totalPointsQ3;
            state.estimadoFinal = estimadoFinal;
            notifiedGames.set(key, state);
          }

          // --- Prórroga ---
          if ((status.toUpperCase().includes("OT")) && !state.ot && !state.final) {
            const totalPoints = pointsHome + pointsAway;
            const suggestion = totalPoints + 26;

            sendNotification(`⏱️ Prórroga detectada
${home} vs ${away}
🏀 ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
💡 Sugerencia: Menos de ${suggestion}`);

            state.ot = true;
            state.initialTotal = totalPoints;
            notifiedGames.set(key, state);
          }

          // --- Evaluación final ---
          if (status.toUpperCase().includes("FT") && !state.final) {
            if (state.q4_blowout || state.ot) {
              const totalPoints = pointsHome + pointsAway;
              const outcomes = [];

              if (state.q4_blowout) {
                const estimadoFinal = state.estimadoFinal || 0;
                const blowoutWin = totalPoints <= estimadoFinal;
                outcomes.push({ label: "Desbalanceado", win: blowoutWin });
                if (blowoutWin) { dailyStats.blowout.won++; dailyStats.total.won++; }
                else { dailyStats.blowout.lost++; dailyStats.total.lost++; }
              }

              if (state.ot && !state.otFinal) {
                const overtimeWin = totalPoints <= state.initialTotal + 26;
                outcomes.push({ label: "Prórroga", win: overtimeWin });
                if (overtimeWin) { dailyStats.overtime.won++; dailyStats.total.won++; }
                else { dailyStats.overtime.lost++; dailyStats.total.lost++; }
                state.otFinal = true;
              }

              const overallWin = outcomes.some(o => o.win);
              const resultText = overallWin ? "Ganaste" : "Perdiste";
              const breakdown = outcomes.map(o => `• ${o.label}: ${o.win ? "Ganaste" : "Perdiste"}`).join("\n");

              sendNotification(`✅ Partido terminado: ${home} vs ${away}
🏀 Resultado final: ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
🎯 Resultado general: ${resultText}
${breakdown}`);
            }
            state.final = true;
            notifiedGames.set(key, state);
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

// --- Loop cada 15 segundos ---
setInterval(() => {
  console.log("🔄 Buscando partidos de basket...");
  getLiveBasketEvents();
}, 180 * 1000);

// --- Resumen diario a las 23:59 ---
function sendDailySummary() {
  const calcPercent = (won, lost) => {
    const total = won + lost;
    return total === 0 ? "0%" : ((won / total) * 100).toFixed(1) + "%";
  };

  const msg = `📊 Resumen del día (${currentDate})
- Prórroga: Ganados ${dailyStats.overtime.won}, Perdidos ${dailyStats.overtime.lost}, %Ganados ${calcPercent(dailyStats.overtime.won, dailyStats.overtime.lost)}
- Desbalanceados: Ganados ${dailyStats.blowout.won}, Perdidos ${dailyStats.blowout.lost}, %Ganados ${calcPercent(dailyStats.blowout.won, dailyStats.blowout.lost)}
- General: Ganados ${dailyStats.total.won}, Perdidos ${dailyStats.total.lost}, %Ganados ${calcPercent(dailyStats.total.won, dailyStats.total.lost)}`;

  sendNotification(msg);
  dailyStats = { overtime: { won: 0, lost: 0 }, blowout: { won: 0, lost: 0 }, total: { won: 0, lost: 0 } };
  notifiedGames.clear();
}

setInterval(() => {
  const now = new Date();
  if (now.getHours() === 23 && now.getMinutes() === 59) {





