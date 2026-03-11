const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("🏀 Worker de Basket corriendo en Render"));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
let notifiedGames = new Map();
let currentDate = new Date().toISOString().split("T")[0];

let dailyStats = {
  overtime: { won: 0, lost: 0 },
  blowout: { won: 0, lost: 0 },
  total: { won: 0, lost: 0 }
};

// Lista de ligas principales (clubes + selecciones nacionales)
const mainLeagues = [
  "Liga Endesa", "Liga Femenina Endesa",
  "Betclic Élite", "Pro A", "Ligue Féminine de Basketball",
  "LBA Serie A", "Serie A1 Femminile",
  "easyCredit BBL", "DBBL",
  "BSL", "Greek Basket League", "LKL",
  "CBA", "WCBA",
  "NBB", "Liga de Basquete Feminino",
  "Liga Nacional de Básquet", "Liga Femenina de Básquetbol",
  "Liga Uruguaya de Básquetbol", "Liga Femenina de Básquetbol",
  "NBL", "WNBL",
  "B.League",
  "NBA", "WNBA", "NCAA", "G-League",
  "EuroLeague", "EuroCup", "Basketball Champions League",
  "EuroLeague Women", "Basketball Champions League Americas", "Liga Sudamericana de Clubes",
  "FIBA Basketball World Cup", "FIBA Women’s Basketball World Cup",
  "Olympic Basketball Tournament",
  "EuroBasket", "EuroBasket Women",
  "FIBA AmeriCup", "FIBA Women’s AmeriCup",
  "FIBA Asia Cup", "FIBA Women’s Asia Cup",
  "FIBA AfroBasket", "FIBA Women’s AfroBasket",
  "FIBA Oceania Championship"
];

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
          const league = game.tournament?.name || "Liga desconocida";
          const country =
            game.tournament?.region?.name ||
            game.tournament?.category?.name ||
            game.tournament?.country?.name ||
            "País desconocido";
          const status = game.status?.description || "";
          const timerVal = game.status?.timer || "sin dato";
          const pointsHome = game.homeScore?.current ?? 0;
          const pointsAway = game.awayScore?.current ?? 0;
          const diff = Math.abs(pointsHome - pointsAway);
          const key = `${home} vs ${away}`;

          // 🔎 Filtrar solo ligas principales
          if (!mainLeagues.some(l => league.toLowerCase().includes(l.toLowerCase()))) return;

          let state = notifiedGames.get(key) || {
            q4_started: false,
            q4_blowout: false,
            ot: false,
            final: false,
            suggestionRange: null
          };

          // --- Último cuarto desbalanceado ---
          if (status.toUpperCase().includes("4TH") && !state.q4_started) {
            state.q4_started = true;
            notifiedGames.set(key, state);

            if (diff >= 22 && !state.q4_blowout) {
              const totalPoints = pointsHome + pointsAway;
              const q1 = (game.homeScore?.period1 ?? 0) + (game.awayScore?.period1 ?? 0);
              const q2 = (game.homeScore?.period2 ?? 0) + (game.awayScore?.period2 ?? 0);
              const q3 = (game.homeScore?.period3 ?? 0) + (game.awayScore?.period3 ?? 0);
              const avgPrevQuarters = (q1 + q2 + q3) / 3;
              const suggestion = totalPoints + avgPrevQuarters;

              sendNotification(`⚡ Último cuarto desbalanceado
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Diferencia: ${diff} puntos
💡 Sugerencia: Menos de ${Math.round(suggestion)}`);

              state.q4_blowout = true;
              state.initialTotal = totalPoints;
              notifiedGames.set(key, state);
            }
          }

          // --- Prórroga ---
          if (
            status &&
            (
              status.toUpperCase().includes("OT") ||
              status.toUpperCase().includes("OVERTIME") ||
              status.toUpperCase().includes("ET") ||
              status.toUpperCase().includes("EXTRA")
            ) &&
            !state.ot && !state.final
          ) {
            const totalPoints = pointsHome + pointsAway;
            const suggestionMin = totalPoints + 22;
            const suggestionMax = totalPoints + 26;

            sendNotification(`⏱️ Prórroga detectada
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
💡 Sugerencia: Entre ${suggestionMin} y ${suggestionMax}`);

            state.ot = true;
            state.initialTotal = totalPoints;
            state.suggestionRange = { min: suggestionMin, max: suggestionMax };
            notifiedGames.set(key, state);
          }

         // --- Evaluación final ---
if (
  status &&
  (
    status.toUpperCase().includes("FT") ||
    status.toUpperCase().includes("FINAL") ||
    status.toUpperCase().includes("FINISHED") ||
    status.toUpperCase().includes("ENDED") ||
    status.toUpperCase().includes("FULL TIME")
  ) &&
  !state.final
) {
  state.final = true;
  const finalTotal = pointsHome + pointsAway;

  // Comparación de prórroga
  if (state.suggestionRange) {
    const { min, max } = state.suggestionRange;
    const won = finalTotal >= min && finalTotal <= max;
    sendNotification(`✅ Final del partido
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total final: ${finalTotal}
💡 Estimado en prórroga: ${min}-${max}
📈 Resultado: ${won ? "Ganaba con el estimado" : "No entró en el rango"}`);
  }

  // Comparación de último cuarto desbalanceado
  if (state.q4_blowout) {
    const initialTotal = state.initialTotal || 0;
    const won = finalTotal < initialTotal;
    sendNotification(`✅ Final del partido
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total final: ${finalTotal}
💡 Estimado en último cuarto: ${initialTotal}
📈 Resultado: ${won ? "Ganaba con el estimado" : "No entró en el rango"}`);
  }

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
function getLocalTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    hour: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour").value, 10);
  const day = now.getDay(); // 0 = domingo, 6 = sábado
  return { hour, day };
}

setInterval(() => {
  const { hour, day } = getLocalTime();

  let startHour = 12;
  let endHour = 24;

  if (day === 0 || day === 6) {
    startHour = 9;
    endHour = 22;
  }

  if (hour >= startHour && hour < endHour) {
    console.log(`🔄 [${hour}h Ecuador] Buscando partidos de basket...`);
    getLiveBasketEvents();
  } else {
    console.log(`⏸ [${hour}h Ecuador] Fuera de horario (${startHour}h-${endHour}h), no se hacen búsquedas.`);
  }
}, 3 * 60 * 1000); // cada 3 minutos
function sendDailySummary() {
  const calcPercent = (won, lost) => {
    const total = won + lost;
    return total === 0 ? "0%" : ((won / total) * 100).toFixed(1) + "%";
  };

  const msg = `📊 Resumen del día (${currentDate})
- Prórroga: Ganados ${dailyStats.overtime.won}, Perdidos ${dailyStats.overtime.lost}, %Ganados ${calcPercent(dailyStats.overtime.won, dailyStats.overtime.lost)}
- Desbalanceados: Ganados ${dailyStats.blowout.won}, Perdidos ${dailyStats.blowout.lost}, %Ganados ${calcPercent(dailyStats.blowout.won, dailyStats.blowout.lost)}
- Total: Ganados ${dailyStats.total.won}, Perdidos ${dailyStats.total.lost}, %Ganados ${calcPercent(dailyStats.total.won, dailyStats.total.lost)}`;

  sendNotification(msg);
}

// Ejecutar resumen diario a las 23:59
setInterval(() => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour").value, 10);
  const minute = parseInt(parts.find(p => p.type === "minute").value, 10);

  if (hour === 23 && minute === 59) {
    sendDailySummary();
  }
}, 60 * 1000); // cada minuto





