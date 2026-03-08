const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("🏀 Worker de básquet corriendo en Render"));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

// --- Notificación OneSignal ---
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
    console.log("📲 Notificación enviada:", message);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.response?.data || err.message);
  }
}

// --- Arrays globales ---
let results = [];
let notifiedGames = new Set();

// --- Hora local Ecuador ---
function getLocalTime() {
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
  const day = now.getDay(); // 0 = domingo, 6 = sábado
  return { hour, minute, day };
}

// --- Clasificación de partidos ---
function classifyBasketballGame(game) {
  const home = game.homeTeam?.name;
  const away = game.awayTeam?.name;
  const homeScore = game.homeScore?.current ?? 0;
  const awayScore = game.awayScore?.current ?? 0;
  const diff = Math.abs(homeScore - awayScore);

  const statusDesc = game.status?.description || "";
  const timer = game.status?.timer || "";
  const gameId = `${home}-${away}-${statusDesc}`;

  // --- Último cuarto desbalanceado ---
  if (statusDesc.includes("4th quarter")) {
    const minute = parseInt(timer.replace("'", ""), 10);
    if (!isNaN(minute) && minute >= 1 && minute <= 25 && diff > 15) {
      if (!notifiedGames.has(gameId)) {
        const message = `🏀 Partido desbalanceado!\n${home} ${homeScore} - ${awayScore} ${away}\nDiferencia: ${diff} puntos en el último cuarto (min ${minute}').`;
        console.log(message);
        sendNotification(message);
        results.push({ type: "desbalanceado", diff, win: homeScore > awayScore });
        notifiedGames.add(gameId);
      }
    }
  }

  // --- Prórroga ---
  if (statusDesc.includes("OT")) {
    if (!notifiedGames.has(gameId)) {
      const message = `🏀 Partido en prórroga!\n${home} ${homeScore} - ${awayScore} ${away}`;
      console.log(message);
      sendNotification(message);
      results.push({ type: "prorroga", diff, win: homeScore > awayScore });
      notifiedGames.add(gameId);
    }
  }
}

// --- Obtener partidos en vivo ---
function fetchLiveBasketball() {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
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
        if (games.length > 0) {
          games.forEach(game => classifyBasketballGame(game));
        } else {
          console.log("⚠️ No se encontraron partidos en vivo de básquet.");
        }
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición:", err.message));
  req.end();
}

// --- Resumen al final del día ---
function summarizeResults() {
  const total = results.length;
  const wins = results.filter(r => r.win).length;
  const losses = total - wins;
  const avg = total > 0 ? (wins / total * 100).toFixed(2) : 0;

  const summary = `📊 Resumen del día:\nTotal partidos: ${total}\nGanados: ${wins}\nPerdidos: ${losses}\nPromedio de éxito: ${avg}%`;
  console.log(summary);
  sendNotification(summary);

  results = [];
  notifiedGames.clear();
}

// --- Loop cada 5 minutos con horarios diferenciados ---
setInterval(() => {
  const { hour, day } = getLocalTime();

  let startHour = 12;
  let endHour = 24;

  // Si es sábado (6) o domingo (0), usar 9h-22h
  if (day === 0 || day === 6) {
    startHour = 9;
    endHour = 22;
  }

  if (hour >= startHour && hour < endHour) {
    console.log(`🔄 [${hour}h Ecuador] Buscando partidos en vivo de básquet...`);
    fetchLiveBasketball();
  } else {
    console.log(`⏸ [${hour}h Ecuador] Fuera de horario (${startHour}h-${endHour}h), no se hacen búsquedas.`);
  }
}, 5 * 60 * 1000);

// --- Resumen diario exactamente a medianoche hora local ---
function scheduleMidnightSummary() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const localHour = parseInt(parts.find(p => p.type === "hour").value, 10);
  const localMinute = parseInt(parts.find(p => p.type === "minute").value, 10);
  const localSecond = parseInt(parts.find(p => p.type === "second").value, 10);

  const secondsUntilMidnight =
    (24 - localHour - 1) * 3600 +
    (60 - localMinute - 1) * 60 +
    (60 - localSecond);

  const msUntilMidnight = secondsUntilMidnight * 1000;

  setTimeout(() => {
    summarizeResults();
    scheduleMidnightSummary(); // reprogramar para la siguiente medianoche
  }, msUntilMidnight);
}




