const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY; // mismo nombre en env
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🏀 Worker de notificaciones Basket corriendo en Render");
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

// --- Endpoint para que Flutter consuma los partidos en vivo ---
app.get("/live-basket", (req, res) => {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const options = {
    method: "GET",
    hostname: "v1.basketball.api-sports.io",
    path: `/games?date=${today}&timezone=Europe/London`,
    headers: {
      "x-apisports-key": API_SPORT_KEY
    }
  };

  const reqApi = https.request(options, apiRes => {
    let data = "";
    apiRes.on("data", chunk => (data += chunk));
    apiRes.on("end", () => {
      try {
        const json = JSON.parse(data);
        const games = json.response
          .filter(g => ["Q1","Q2","Q3","Q4","OT"].includes(g.status?.short)) // solo partidos en curso
          .map(game => ({
            home: game.teams?.home?.name,
            away: game.teams?.away?.name,
            pointsHome: game.scores?.home?.total,
            pointsAway: game.scores?.away?.total,
            league: game.league?.name,
            country: game.country?.name,
            status: game.status?.short
          }));
        res.json({ games });
      } catch (err) {
        res.status(500).json({ error: "Error parseando respuesta" });
      }
    });
  });

  reqApi.on("error", err => res.status(500).json({ error: err.message }));
  reqApi.end();
});

// --- Función para revisar partidos en vivo y detectar prórrogas ---
function getLiveBasketEvents() {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const options = {
    method: "GET",
    hostname: "v1.basketball.api-sports.io",
    path: `/games?date=${today}&timezone=Europe/London`,
    headers: {
      "x-apisports-key": API_SPORT_KEY
    }
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
          const home = game.teams?.home?.name || "Home";
          const away = game.teams?.away?.name || "Away";
          const pointsHome = game.scores?.home?.total || 0;
          const pointsAway = game.scores?.away?.total || 0;
          const league = game.league?.name || "Liga desconocida";
          const country = game.country?.name || "País desconocido";
          const status = game.status?.short || "";

          console.log(`🔎 ${home} vs ${away} | Estado: ${status} | Liga: ${league} | País: ${country}`);

          // --- Detectar prórroga ---
          if (status === "OT") {
            const msg = `⏱️ PRÓRROGA en ${home} vs ${away} (${league}, ${country})\n🏀 Marcador: ${home} ${pointsHome} - ${away} ${pointsAway}`;
            console.log(msg);
            sendNotification(msg);
          }
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta basket:", err.message);
      }
    });
  });

  req.on("error", err =>
    console.error("❌ Error en la petición basket:", err.message)
  );
  req.end();
}

// --- Loop cada 2 minutos ---
setInterval(() => {
  console.log("🔄 Buscando partidos de basket en vivo...");
  getLiveBasketEvents();
}, 2 * 60 * 1000);











  










