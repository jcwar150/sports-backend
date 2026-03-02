const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("⚽🏀🏒 Worker corriendo con RapidAPI"));
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
    console.log("📢 Notificación enviada:", message);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.response?.data || err.message);
  }
}

function fetchLiveEvents(sportId, sportName, callback) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportId}/events/live`,
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
        const games = json.data || json.events || json.response || [];
        let message = "";

        games.forEach(game => {
          const home = game.homeTeam?.name || game.teams?.home?.name;
          const away = game.awayTeam?.name || game.teams?.away?.name;
          const status = game.status?.type || game.status?.short || "live";
          message += `• ${sportName}: ${home} vs ${away} (${status})\n`;
        });

        callback(message);
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
        callback("");
      }
    });
  });

  req.on("error", err => {
    console.error("❌ Error en la petición:", err.message);
    callback("");
  });
  req.end();
}

// --- Loop cada 10 minutos ---
setInterval(() => {
  console.log("🔄 Consultando partidos en vivo...");

  let allMessages = "";

  fetchLiveEvents(1, "⚽ Fútbol", msg1 => {
    allMessages += msg1;
    fetchLiveEvents(3, "🏀 Básquet", msg2 => {
      allMessages += msg2;
      fetchLiveEvents(4, "🏒 Hockey", msg3 => {
        allMessages += msg3;

        if (allMessages.trim().length > 0) {
          sendNotification(allMessages.trim());
        } else {
          console.log("⚠️ No se encontraron partidos en vivo en ninguno de los deportes.");
        }
      });
    });
  });
}, 10 * 60 * 1000);
