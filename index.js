const https = require("https");
const axios = require("axios");
const express = require("express");

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("⚽🏀 Worker de notificaciones corriendo en Render");
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

// --- Función para enviar notificación ---
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
          "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("✅ Notificación enviada:", message);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.response?.data || err.message);
  }
}

// --- Función para revisar partidos en vivo ---
function getLiveEvents(sportId) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/sports/${sportId}/events/live`,
    headers: {
      "x-rapidapi-key": FOOTBALL_API_KEY,
      "x-rapidapi-host": "sportscore1.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        json.data.forEach(event => {
          const home = event.home_team?.name || "Home";
          const away = event.away_team?.name || "Away";
          const status = event.status_more?.toLowerCase() || "";

          console.log(`🔎 Revisando partido: ${home} vs ${away} | Estado: ${status}`);

          // --- Detectar prórroga ---
          if (status.includes("extra_time") || status.includes("overtime")) {
            const msg = `⏱️ ${home} vs ${away} ha entrado en PRÓRROGA (${status})`;
            console.log(msg);
            sendNotification(msg);
          }
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta live:", err.message);
      }
    });
  });

  req.on("error", err =>
    console.error("❌ Error en la petición live:", err.message)
  );
  req.end();
}

// --- Loop cada 5 minutos ---
setInterval(() => {
  console.log("🔄 Buscando partidos en vivo...");
  getLiveEvents(1); // ⚽ Fútbol
  getLiveEvents(3); // 🏀 Básquet
}, 5 * 60 * 1000);











  










