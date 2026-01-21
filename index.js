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

function resetDailyGamesIfNeeded() {
  const today = new Date().toISOString().split("T")[0];
  if (today !== currentDate) {
    console.log("🔄 Nuevo día, reseteando registro de partidos");
    dailyGames = {};
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
    console.log(`📝 Partido registrado: ${key}`);
  }
}

app.get("/", (req, res) => {
  res.send("🏀 Worker de Basket corriendo en Render");
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

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
    console.log("✅ Notificación enviada:", message);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.response?.data || err.message);
  }
}
app.get("/live-basket", (req, res) => {
  resetDailyGamesIfNeeded();
  const today = new Date().toISOString().split("T")[0];
  const options = {
    method: "GET",
    hostname: "v1.basketball.api-sports.io",
    path: `/games?date=${today}&timezone=Europe/London`,
    headers: { "x-apisports-key": API_SPORT_KEY }
  };

  const reqApi = https.request(options, apiRes => {
    let data = "";
    apiRes.on("data", chunk => (data += chunk));
    apiRes.on("end", () => {
      try {
        const json = JSON.parse(data);
        const games = json.response
          .filter(g => {
            const status = g.status?.short;
            const pointsHome = g.scores?.home?.total || 0;
            const pointsAway = g.scores?.away?.total || 0;
            const diff = Math.abs(pointsHome - pointsAway);

            if (["OT", "ET"].includes(status)) return true;

            if (status === "Q4") {
              const time = g.status?.timer || "";
              if (time) {
                const [min] = time.split(":").map(Number);
                const leagueName = g.league?.name || "";
                let quarterDuration = 10;
                if (leagueName.toLowerCase().includes("nba")) quarterDuration = 12;

                const remaining = quarterDuration - min;
                if (remaining === 5 && (diff >= 30 || diff <= 2)) return true;
              }
            }
            return false;
          })
          .map(game => {
            saveGameRecord(game);
            return {
              home: game.teams?.home?.name,
              away: game.teams?.away?.name,
              pointsHome: game.scores?.home?.total,
              pointsAway: game.scores?.away?.total,
              league: game.league?.name,
              country: game.country?.name,
              status: game.status?.short,
              time: game.status?.timer || null
            };
          });
        res.json({ games });
      } catch (err) {
        res.status(500).json({ error: "Error parseando respuesta" });
      }
    });
  });

  reqApi.on("error", err => res.status(500).json({ error: err.message }));
  reqApi.end();
});

app.get("/daily-record", (req, res) => {
  resetDailyGamesIfNeeded();
  res.json({ date: currentDate, games: dailyGames });
});
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

        if (!json.response || json.response.length === 0) {
          console.log("⏭️ No hay partidos de basket para hoy");
          return;
        }

        json.response.forEach(game => {
          saveGameRecord(game);

          const home = game.teams?.home?.name || "Home";
          const away = game.teams?.away?.name || "Away";
          const key = `${home} vs ${away}`;
          const pointsHome = game.scores?.home?.total || 0;
          const pointsAway = game.scores?.away?.total || 0;
          const league = game.league?.name || "Liga desconocida";
          const country = game.country?.name || "País desconocido";
          const status = game.status?.short || "";
          const time = game.status?.timer || "";
          const diff = Math.abs(pointsHome - pointsAway);

          if (!notifiedGames.has(key)) {
            notifiedGames.set(key, { ot: false, q4_30: false, q4_2: false, final: false, initialTotal: null });
          }
          const state = notifiedGames.get(key);

          // --- Notificación de prórroga ---
          if (["OT", "ET"].includes(status) && !state.ot) {
            const totalPoints = pointsHome + pointsAway;
            const suggestion = totalPoints + 26;

            const msg = `⏱️ PRÓRROGA en ${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
💡 Sugerencia: ${suggestion}`;
            sendNotification(msg);

            state.ot = true;
            state.initialTotal = totalPoints;
            notifiedGames.set(key, state);
          }

          // --- Último cuarto, exactamente 5 min restantes ---
          if (status === "Q4" && time) {
            const [min] = time.split(":").map(Number);
            let quarterDuration = 10;
            if (league.toLowerCase().includes("nba")) quarterDuration = 12;
            const remaining = quarterDuration - min;

            if (remaining === 5) {
              const totalPoints = pointsHome + pointsAway;
              const suggestion = totalPoints + 26;

              if (diff >= 25 && !state.q4_30) {
                const msg = `⚡ Último cuarto (5 min restantes, diferencia ≥25)
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
💡 Sugerencia: ${suggestion}`;
                sendNotification(msg);

                state.q4_30 = true;
                state.initialTotal = totalPoints;
              } else if (diff <= 3 && !state.q4_2) {
                const msg = `🔥 Último cuarto (5 min restantes, diferencia ≤3)
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
💡 Sugerencia: ${suggestion}`;
                sendNotification(msg);

                state.q4_2 = true;
                state.initialTotal = totalPoints;
              }
              notifiedGames.set(key, state);
            }
          }
 // --- Notificación al finalizar el partido ---
          if (["FT", "AOT"].includes(status) && !state.final) {
            // Solo notificar si el partido ya cumplió alguna condición inicial
            if (state.ot || state.q4_30 || state.q4_2) {
              const totalPoints = pointsHome + pointsAway;
              let resultText = "";

              if (state.q4_2) {
                // Partido cerrado: ganar si total final > inicial + 26
                if (totalPoints > state.initialTotal + 26) {
                  resultText = "Ganaste";
                } else {
                  resultText = "Perdiste";
                }
              } else if (state.q4_30 || state.ot) {
                // Desbalanceado y prórroga: ganar si total final ≤ inicial + 26
                if (totalPoints <= state.initialTotal + 26) {
                  resultText = "Ganaste";
                } else {
                  resultText = "Perdiste";
                }
              }

              const msg = `✅ Partido terminado: ${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 Resultado final: ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
🎯 ${resultText}`;
              sendNotification(msg);
            }
            state.final = true;
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
} // <-- cierre de la función getLiveBasketEvents

// --- Loop cada minuto ---
setInterval(() => {
  console.log("🔄 Buscando partidos de basket (OT/ET y Q4 con diferencia ≥30 o ≤2)...");
  getLiveBasketEvents();
}, 60 * 1000);

