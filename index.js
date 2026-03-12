const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("⚽🏀🏒 Worker de deportes corriendo en Render"));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
let notifiedGames = new Map();
let currentDate = new Date().toISOString().split("T")[0];

let dailyStats = {
  overtime: { won: 0, lost: 0 },
  blowout: { won: 0, lost: 0 },
  total: { won: 0, lost: 0 }
};

const mainLeagues = [
  "Liga Endesa","Liga Femenina Endesa","Betclic Élite","Pro A","Ligue Féminine de Basketball",
  "LBA Serie A","Serie A1 Femminile","easyCredit BBL","DBBL","BSL","Greek Basket League","LKL",
  "CBA","WCBA","NBB","Liga de Basquete Feminino","Liga Nacional de Básquet","Liga Femenina de Básquetbol",
  "Liga Uruguaya de Básquetbol","Liga Femenina de Básquetbol","NBL","WNBL","B.League","NBA","WNBA","NCAA","G-League",
  "EuroLeague","EuroCup","Basketball Champions League","EuroLeague Women","Basketball Champions League Americas","Liga Sudamericana de Clubes",
  "FIBA Basketball World Cup","FIBA Women’s Basketball World Cup","Olympic Basketball Tournament",
  "EuroBasket","EuroBasket Women","FIBA AmeriCup","FIBA Women’s AmeriCup","FIBA Asia Cup","FIBA Women’s Asia Cup",
  "FIBA AfroBasket","FIBA Women’s AfroBasket","FIBA Oceania Championship"
];

function resetDailyGamesIfNeeded() {
  const today = new Date().toISOString().split("T")[0];
  if (today !== currentDate) {
    dailyStats = { overtime:{won:0,lost:0}, blowout:{won:0,lost:0}, total:{won:0,lost:0} };
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
        headings: { en: "📢 Deportes" },
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

          let state = notifiedGames.get(key) || {
            q4_started: false,
            q4_blowout: false,
            ot: false,
            final: false,
            suggestionRange: null
          };

          const statusNorm = status.toLowerCase();

          // --- Último cuarto desbalanceado ---
          if (
            (statusNorm.includes("4th") ||
             statusNorm.includes("q4") ||
             statusNorm.includes("quarter 4") ||
             statusNorm.includes("fourth")) 
            && !state.q4_started
          ) {
            state.q4_started = true;

            if (diff >= 22) {
              const totalPoints = pointsHome + pointsAway;
              const q1 = (game.homeScore?.period1 ?? 0) + (game.awayScore?.period1 ?? 0);
              const q2 = (game.homeScore?.period2 ?? 0) + (game.awayScore?.period2 ?? 0);
              const q3 = (game.homeScore?.period3 ?? 0) + (game.awayScore?.period3 ?? 0);
              const avgPrevQuarters = (q1 + q2 + q3) / 3;
              const suggestion = totalPoints + avgPrevQuarters;

              sendNotification(`⚡ Último cuarto desbalanceado
${home} vs ${away}
Liga: ${league} | País: ${country}
⏱️ Estado: ${status} | Tiempo: ${timerVal}
🏀 ${pointsHome} - ${pointsAway}
📊 Diferencia: ${diff} puntos
💡 Sugerencia: Menos de ${Math.round(suggestion)}`);

              state.q4_blowout = true;
              state.initialTotal = totalPoints;
            } else {
              state.q4_blowout = false; // ignorar si no cumple
            }

            notifiedGames.set(key, state);
          }

          // --- Prórroga ---
          if (
            (statusNorm.includes("ot") ||
             statusNorm.includes("overtime") ||
             statusNorm.includes("et") ||
             statusNorm.includes("extra"))
            && !state.ot && !state.final
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
            (statusNorm.includes("ft") ||
             statusNorm.includes("final") ||
             statusNorm.includes("finished") ||
             statusNorm.includes("ended") ||
             statusNorm.includes("full time"))
            && !state.final
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



// Lista de ligas principales de fútbol (clubes + internacionales + selecciones)
const mainFootballLeagues = [
  // Europa
  "Premier League","LaLiga","Serie A","Bundesliga","Ligue 1",
  "Eredivisie","Primeira Liga","Super Lig",

  // Sudamérica
  "Brasileirão","Argentine Primera División","Primera A Colombia","LigaPro Ecuador",
  "Primera División Uruguay","Primera División Chile","Primera División Paraguay",
  "Primera División Perú","Primera División Bolivia","Primera División Venezuela",

  // Norteamérica y Centroamérica
  "MLS","Liga MX","Concacaf Champions Cup",

  // Competiciones internacionales de clubes
  "UEFA Champions League","UEFA Europa League","UEFA Conference League",
  "Copa Libertadores","Copa Sudamericana",

  // Selecciones nacionales
  "FIFA World Cup","Copa América","Euro","Africa Cup of Nations",
  "Asian Cup","Gold Cup","Olympic Football Tournament"
];

// Función auxiliar para obtener estadísticas de un partido
function getFootballStats(eventId, home, away, league, status, state) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    path: `/api/v1/sport/football/events/${eventId}/statistics`,
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
        const stats = JSON.parse(data);
        const corners = stats?.statistics?.corners ?? null;
        const shotsTotal = stats?.statistics?.shotsTotal ?? null;

        // --- Mitad del partido ---
        if (status.toUpperCase().includes("HT") && !state.htNotified) {
          if ((corners !== null && corners <= 2) || (shotsTotal !== null && shotsTotal <= 10)) {
            sendNotification(`⚽ Mitad del partido
${home} vs ${away}
Liga: ${league}
🏟️ Corners: ${corners ?? "no disponible"}
🎯 Remates: ${shotsTotal ?? "no disponible"}
💡 Condición cumplida: ${(corners !== null && corners <= 2) ? "≤2 corners" : ""} ${(shotsTotal !== null && shotsTotal <= 10) ? "≤10 remates" : ""}`);
          }
          state.htNotified = true;
          state.initialCorners = corners;
          state.initialShots = shotsTotal;
          notifiedGames.set(`${home} vs ${away}`, state);
        }

        // --- Final del partido ---
        if ((status.toUpperCase().includes("FT") || status.toUpperCase().includes("FINAL") || status.toUpperCase().includes("FINISHED")) && !state.finalNotified) {
          sendNotification(`✅ Final del partido
${home} vs ${away}
Liga: ${league}
🏟️ Corners totales: ${corners ?? "no disponible"}
🎯 Remates totales: ${shotsTotal ?? "no disponible"}
📈 En el HT: ${state.initialCorners ?? "no disponible"} corners, ${state.initialShots ?? "no disponible"} remates`);
          state.finalNotified = true;
          notifiedGames.set(`${home} vs ${away}`, state);
        }
      } catch (err) {
        console.error("❌ Error parseando estadísticas fútbol:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición stats fútbol:", err.message));
  req.end();
}

// Función principal para eventos en vivo
function getLiveFootballEvents() {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    path: `/api/v1/sport/football/events/live`,
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
          const status = game.status?.description || "";
          const eventId = game.id;
          const key = `${home} vs ${away}`;

          // 🔎 Filtrar solo ligas principales
          if (!mainFootballLeagues.some(l => league.toLowerCase().includes(l.toLowerCase()))) return;

          let state = notifiedGames.get(key) || {
            htNotified: false,
            finalNotified: false,
            initialCorners: null,
            initialShots: null
          };

          // Llamada al endpoint de estadísticas
          getFootballStats(eventId, home, away, league, status, state);
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta fútbol:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición fútbol:", err.message));
  req.end();
}


function getLiveHockeyEvents() {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    path: `/api/v1/sport/icehockey/events/live`,
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
          const status = game.status?.description || "";
          const pointsHome = game.homeScore?.current ?? 0;
          const pointsAway = game.awayScore?.current ?? 0;
          const diff = Math.abs(pointsHome - pointsAway);

          // Último período (3rd) con diferencia ≤ 3
          if (status.toUpperCase().includes("3RD") && diff <= 3) {
            sendNotification(`🏒 Último período ajustado
${home} vs ${away}
Liga: ${league}
🏆 Marcador: ${pointsHome} - ${pointsAway}
📊 Diferencia: ${diff} (≤ 3)`);
          }

          // Evaluación final del partido
          if (status.toUpperCase().includes("FT") || status.toUpperCase().includes("FINAL") || status.toUpperCase().includes("FINISHED")) {
            sendNotification(`✅ Final del partido de hockey
${home} vs ${away}
Liga: ${league}
🏆 Marcador final: ${pointsHome} - ${pointsAway}
📊 Diferencia final: ${diff}`);
          }
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta hockey:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición hockey:", err.message));
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

  // Fines de semana: horario distinto
  if (day === 0 || day === 6) {
    startHour = 9;
    endHour = 22;
  }

  if (hour >= startHour && hour < endHour) {
    console.log(`🔄 [${hour}h Ecuador] Buscando partidos...`);
    getLiveBasketEvents();
    getLiveFootballEvents();
    getLiveHockeyEvents();
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
- Prórroga Basket: Ganados ${dailyStats.overtime.won}, Perdidos ${dailyStats.overtime.lost}, %Ganados ${calcPercent(dailyStats.overtime.won, dailyStats.overtime.lost)}
- Desbalanceados Basket: Ganados ${dailyStats.blowout.won}, Perdidos ${dailyStats.blowout.lost}, %Ganados ${calcPercent(dailyStats.blowout.won, dailyStats.blowout.lost)}
- Total Basket: Ganados ${dailyStats.total.won}, Perdidos ${dailyStats.total.lost}, %Ganados ${calcPercent(dailyStats.total.won, dailyStats.total.lost)}
⚽ Fútbol: Se notificaron partidos con corners ≤2 o remates ≤10 en HT, y se enviaron totales al FT.
🏒 Hockey: Se notificaron partidos ajustados en el 3rd period (diferencia ≤3) y resultados finales.`;

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






