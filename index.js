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

// Lista de países que no queremos incluir
const excludedCountries = ["Kazakhstan", "Russia"];

// Estadísticas diarias
let dailyStats = {
  closed: { won: 0, lost: 0 },
  overtime: { won: 0, lost: 0 },
  blowout: { won: 0, lost: 0 },
  total: { won: 0, lost: 0 }
};

function resetDailyGamesIfNeeded() {
  const today = new Date().toISOString().split("T")[0];
  if (today !== currentDate) {
    console.log("🔄 Nuevo día, reseteando registro de partidos y estadísticas");
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
            if (excludedCountries.includes(g.country?.name)) return false;

            const status = g.status?.short;
            const pointsHome = g.scores?.home?.total || 0;
            const pointsAway = g.scores?.away?.total || 0;
            const diff = Math.abs(pointsHome - pointsAway);

            if (["OT", "ET"].includes(status)) return true;

            if (status === "Q4") {
              const time = g.status?.timer || "";
              if (time) {
                const [min] = time.split(":").map(Number);
                let quarterDuration = 10;
                if ((g.league?.name || "").toLowerCase().includes("nba")) quarterDuration = 12;

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
  res.json({ date: currentDate, games: dailyGames, stats: dailyStats });
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
          // Excluir países
          if (excludedCountries.includes(game.country?.name)) return;

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
                const msg = `⚡ Último cuarto (5 min restantes, diferencia ≥30)
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
            if (state.ot || state.q4_30 || state.q4_2) {
              const totalPoints = pointsHome + pointsAway;
              let resultText = "";
              let suggestionText = "";

              if (state.q4_2) {
                // Partido cerrado: diferencia ≤3 → Ganaste si final > inicial + 26
                if (totalPoints > state.initialTotal + 26) {
                  resultText = "Ganaste";
                  dailyStats.closed.won++;
                  dailyStats.total.won++;
                } else {
                  resultText = "Perdiste";
                  dailyStats.closed.lost++;
                  dailyStats.total.lost++;
                }
                suggestionText = `💡 Sugerencia: Más de ${state.initialTotal + 26} puntos`;
              } else if (state.q4_30) {
                // Desbalanceado: diferencia ≥25 → Ganaste si final ≤ inicial + 26
                if (totalPoints <= state.initialTotal + 26) {
                  resultText = "Ganaste";
                  dailyStats.blowout.won++;
                  dailyStats.total.won++;
                } else {
                  resultText = "Perdiste";
                  dailyStats.blowout.lost++;
                  dailyStats.total.lost++;
                }
                suggestionText = `💡 Sugerencia: Menos de ${state.initialTotal + 26} puntos`;
              } else if (state.ot) {
                // Prórroga: depende del formato
                const isTwoHalves = (league.toLowerCase().includes("ncaa") || league.toLowerCase().includes("college"));
                if (isTwoHalves) {
                  // 2 tiempos: Ganaste si final > inicial + 26
                  if (totalPoints > state.initialTotal + 26) {
                    resultText = "Ganaste";
                    dailyStats.overtime.won++;
                    dailyStats.total.won++;
                  } else {
                    resultText = "Perdiste";
                    dailyStats.overtime.lost++;
                    dailyStats.total.lost++;
                  }
                  suggestionText = `💡 Sugerencia: Más de ${state.initialTotal + 26} puntos`;
                } else {
                  // 4 tiempos: Ganaste si final ≤ inicial + 26
                  if (totalPoints <= state.initialTotal + 26) {
                    resultText = "Ganaste";
                    dailyStats.overtime.won++;
                    dailyStats.total.won++;
                  } else {
                    resultText = "Perdiste";
                    dailyStats.overtime.lost++;
                    dailyStats.total.lost++;
                  }
                  suggestionText = `💡 Sugerencia: Menos de ${state.initialTotal + 26} puntos`;
                }
              }

              const msg = `✅ Partido terminado: ${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 Resultado final: ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
🎯 ${resultText}
${suggestionText}`;
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

// --- Loop cada 30 segundos ---
setInterval(() => {
  console.log("🔄 Buscando partidos de basket...");
  getLiveBasketEvents();
}, 30 * 1000);

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
