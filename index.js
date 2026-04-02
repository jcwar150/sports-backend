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

// --- Maps globales por deporte ---
const notifiedFootballGames = new Map();
const notifiedBasketGames = new Map();
const notifiedHockeyGames = new Map();

// --- Historial de partidos ---
let footballHistory = [];
let basketHistory = [];
let hockeyHistory = [];

// --- Control de fecha y estadísticas ---
let currentDate = new Date().toISOString().split("T")[0];
let dailyStats = {
  overtime: { won: 0, lost: 0 },
  blowout: { won: 0, lost: 0 },
  total: { won: 0, lost: 0 }
};

function resetDailyGamesIfNeeded() {
  const today = new Date().toISOString().split("T")[0];
  if (today !== currentDate) {
    dailyStats = { overtime:{won:0,lost:0}, blowout:{won:0,lost:0}, total:{won:0,lost:0} };
    notifiedFootballGames.clear();
    notifiedBasketGames.clear();
    notifiedHockeyGames.clear();
    footballHistory = [];
    basketHistory = [];
    hockeyHistory = [];
    currentDate = today;
  }
}

async function sendFootballNotification(message) {
  await axios.post("https://api.onesignal.com/notifications", {
    app_id: ONESIGNAL_APP_ID,
    filters: [
      { field: "tag", key: "football", relation: "=", value: "true" }
    ],
    headings: { en: "⚽ Fútbol" },
    contents: { en: message }
  }, {
    headers: {
      Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
}

async function sendBasketNotification(message) {
  await axios.post("https://api.onesignal.com/notifications", {
    app_id: ONESIGNAL_APP_ID,
    filters: [
      { field: "tag", key: "basket", relation: "=", value: "true" }
    ],
    headings: { en: "🏀 Basket" },
    contents: { en: message }
  }, {
    headers: {
      Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
}

async function sendHockeyNotification(message) {
  await axios.post("https://api.onesignal.com/notifications", {
    app_id: ONESIGNAL_APP_ID,
    filters: [
      { field: "tag", key: "hockey", relation: "=", value: "true" }
    ],
    headings: { en: "🏒 Hockey" },
    contents: { en: message }
  }, {
    headers: {
      Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
}


// --- Guardar partidos finalizados en historial ---
function saveToHistory(game, sport) {
  const record = {
    home: game.homeTeam?.name,
    away: game.awayTeam?.name,
    league: game.tournament?.name || "",
    country: game.tournament?.region?.name || "",
    pointsHome: game.homeScore?.current ?? 0,
    pointsAway: game.awayScore?.current ?? 0,
    status: game.status?.description || ""
  };

  if (sport === "football") footballHistory.push(record);
  if (sport === "basket") basketHistory.push(record);
  if (sport === "hockey") hockeyHistory.push(record);
}

// --- Endpoints de historial ---
app.get("/history-football", (req, res) => res.json({ games: footballHistory }));
app.get("/history-basket", (req, res) => res.json({ games: basketHistory }));
app.get("/history-hockey", (req, res) => res.json({ games: hockeyHistory }));

// --- Arrays de ligas y equipos ---
const strongTeams = [
  "Barcelona","Real Madrid","Bayern Munich","PSG","Manchester City",
  "Liverpool","Chelsea","Juventus","Inter","AC Milan",
  "Boca Juniors","River Plate","Flamengo","Palmeiras","Corinthians","São Paulo",
  "Colo-Colo","Universidad de Chile","Atlético Nacional","Millonarios",
  "Barcelona SC","LDU Quito","Independiente del Valle","Peñarol","Nacional",
  "Olimpia","Cerro Porteño","Alianza Lima","Universitario",
  "Bolívar","The Strongest","Caracas FC","Deportivo Táchira"
];

const mainFootballLeagues = [
  "Premier League","LaLiga","Serie A","Bundesliga","Ligue 1",
  "Brasileirão","Argentine Primera División","Primera A Colombia","LigaPro Ecuador",
  "Primera División Uruguay","Primera División Chile","Primera División Paraguay",
  "Primera División Perú","Primera División Bolivia","Primera División Venezuela",
  "UEFA Champions League","Copa Libertadores","Copa Sudamericana",
  "FIFA World Cup","Copa América","Euro"
];

const mainBasketLeagues = [
  "Liga Endesa","Liga Femenina Endesa","Betclic Élite","Pro A","Ligue Féminine de Basketball",
  "LBA Serie A","Serie A1 Femminile","easyCredit BBL","DBBL","BSL","Greek Basket League","LKL",
  "CBA","WCBA","NBB","Liga de Basquete Feminino","Liga Nacional de Básquet","Liga Femenina de Básquetbol",
  "Liga Uruguaya de Básquetbol","Liga Femenina de Básquetbol","NBL","WNBL","B.League","NBA","WNBA","NCAA","G-League",
  "EuroLeague","EuroCup","Basketball Champions League","EuroLeague Women","Basketball Champions League Americas","Liga Sudamericana de Clubes",
  "FIBA Basketball World Cup","FIBA Women’s Basketball World Cup","Olympic Basketball Tournament",
  "EuroBasket","EuroBasket Women","FIBA AmeriCup","FIBA Women’s AmeriCup","FIBA Asia Cup","FIBA Women’s Asia Cup",
  "FIBA AfroBasket","FIBA Women’s AfroBasket","FIBA Oceania Championship"
];

// --- Función Fútbol ---
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
          const homeRaw = game.homeTeam?.name || "";
          const awayRaw = game.awayTeam?.name || "";
          const league = game.tournament?.name || "Liga desconocida";
          const status = game.status?.description || "";
          const pointsHome = game.homeScore?.current ?? 0;
          const pointsAway = game.awayScore?.current ?? 0;

          if (!mainFootballLeagues.some(l => league.toLowerCase().includes(l.toLowerCase()))) return;

          const key = `${homeRaw} vs ${awayRaw}`;
          if (notifiedFootballGames.has(key)) return;

          const statusNorm = status.toLowerCase();
          const isStrongHome = strongTeams.some(t => homeRaw.toLowerCase() === t.toLowerCase());
          const isStrongAway = strongTeams.some(t => awayRaw.toLowerCase() === t.toLowerCase());

          // --- Notificación: equipo fuerte perdiendo al descanso ---
          if (statusNorm.includes("ht") || statusNorm.includes("half")) {
            if (isStrongHome && pointsHome < pointsAway) {
              sendFootballNotification(`⚽ Equipo fuerte perdiendo al descanso
${homeRaw} vs ${awayRaw}
Liga: ${league}
Marcador: ${pointsHome} - ${pointsAway}`);
              notifiedFootballGames.set(key, true);
            }
            if (isStrongAway && pointsAway < pointsHome) {
              sendFootballNotification(`⚽ Equipo fuerte perdiendo al descanso
${homeRaw} vs ${awayRaw}
Liga: ${league}
Marcador: ${pointsHome} - ${pointsAway}`);
              notifiedFootballGames.set(key, true);
            }
          }

          // --- Guardar en historial si terminó ---
          if (statusNorm.includes("finished") || statusNorm.includes("ended") || statusNorm.includes("final")) {
            saveToHistory(game, "football");
          }
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta fútbol:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición fútbol:", err.message));
  req.end();
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

          // Filtra solo ligas principales
          if (!mainBasketLeagues.some(l => league.toLowerCase().includes(l.toLowerCase()))) return;

          let state = notifiedBasketGames.get(key) || {
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
              const avgPrevQuarters = ((q1 + q2 + q3) / 3) -5;
              const suggestion = totalPoints + avgPrevQuarters;

              sendBasketNotification(`⚡ Último cuarto desbalanceado
${home} vs ${away}
Liga: ${league} | País: ${country}
⏱️ Estado: ${status} | Tiempo: ${timerVal}
🏀 ${pointsHome} - ${pointsAway}
📊 Diferencia: ${diff} puntos
💡 Sugerencia: Menos de ${Math.round(suggestion)}`);

              state.q4_blowout = true;
              state.initialTotal = totalPoints;
            }

            notifiedBasketGames.set(key, state);
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

            sendBasketNotification(`⏱️ Prórroga detectada
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total puntos: ${totalPoints}
💡 Sugerencia: Entre ${suggestionMin} y ${suggestionMax}`);

            state.ot = true;
            state.initialTotal = totalPoints;
            state.suggestionRange = { min: suggestionMin, max: suggestionMax };
            notifiedBasketGames.set(key, state);
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

            if (state.suggestionRange) {
              const { min, max } = state.suggestionRange;
              const won = finalTotal >= min && finalTotal <= max;
              sendBasketNotification(`✅ Final del partido
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total final: ${finalTotal}
💡 Estimado en prórroga: ${min}-${max}
📈 Resultado: ${won ? "Ganaba con el estimado" : "No entró en el rango"}`);
            }

            if (state.q4_blowout) {
              const initialTotal = state.initialTotal || 0;
              const won = finalTotal < initialTotal;
              sendBasketNotification(`✅ Final del partido
${home} vs ${away}
Liga: ${league} | País: ${country}
🏀 ${pointsHome} - ${pointsAway}
📊 Total final: ${finalTotal}
💡 Estimado en último cuarto: ${initialTotal}
📈 Resultado: ${won ? "Ganaba con el estimado" : "No entró en el rango"}`);
            }

            // --- Guardar en historial ---
            saveToHistory(game, "basket");

            notifiedBasketGames.set(key, state);
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

function getLiveHockeyEvents() {
  resetDailyGamesIfNeeded();

  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    path: `/api/v1/sport/ice-hockey/events/live`,
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
          const league = game.tournament?.name || "";
          const status = game.status?.description || "";
          const goalsHome = game.homeScore?.current ?? 0;
          const goalsAway = game.awayScore?.current ?? 0;

          // --- Filtra solo NHL ---
          if (!league.toLowerCase().includes("nhl")) return;

          const key = `${home} vs ${away}`;

          // --- Depuración: imprime siempre partido y estado ---
          console.log("DEBUG Hockey:", { partido: key, league, status, goalsHome, goalsAway });

          // --- Notificación de prueba: cualquier partido en vivo ---
          if (!notifiedHockeyGames.has(key)) {
            sendHockeyNotification(`🏒 NHL en vivo
${home} vs ${away}
Liga: ${league}
Estado: ${status}
Marcador: ${goalsHome} - ${goalsAway}`);
            notifiedHockeyGames.set(key, true);
          }

          // --- Guardar en historial si terminó ---
          const statusNorm = status.toLowerCase();
          if (
            statusNorm.includes("finished") ||
            statusNorm.includes("ended") ||
            statusNorm.includes("final")
          ) {
            saveToHistory(game, "hockey");
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



// --- Obtener hora local en Ecuador ---
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

// --- Scheduler con control de horario ---
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
}, 2 * 60 * 1000); // cada 3 minutos

// --- Resumen diario ---
function sendDailySummary() {
  const calcPercent = (won, lost) => {
    const total = won + lost;
    return total === 0 ? "0%" : ((won / total) * 100).toFixed(1) + "%";
  };

  const msg = `📊 Resumen del día (${currentDate})
- Prórroga Basket: Ganados ${dailyStats.overtime.won}, Perdidos ${dailyStats.overtime.lost}, %Ganados ${calcPercent(dailyStats.overtime.won, dailyStats.overtime.lost)}
- Desbalanceados Basket: Ganados ${dailyStats.blowout.won}, Perdidos ${dailyStats.blowout.lost}, %Ganados ${calcPercent(dailyStats.blowout.won, dailyStats.blowout.lost)}
- Total Basket: Ganados ${dailyStats.total.won}, Perdidos ${dailyStats.total.lost}, %Ganados ${calcPercent(dailyStats.total.won, dailyStats.total.lost)}

⚽ Fútbol: Se notificaron partidos con equipos fuertes perdiendo al descanso y se guardaron finales en historial.
🏒 Hockey: Se notificaron partidos ajustados en el último periodo y se guardaron finales en historial.`;

  sendHockeyNotification(msg);
}

// --- Ejecutar resumen diario a las 23:59 ---
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




