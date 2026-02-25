const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

let notifiedGames = new Map();

app.get("/", (req, res) => res.send("⚽ Worker de fútbol con clasificación por competición"));
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

// --- Función para consultar categorías en vivo ---
function fetchLiveCategories(sportId) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportId}/live-categories`,
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
        const categories = json.data || json.response || [];

        categories.forEach(cat => {
          console.log(`📌 Categoría en vivo: ${cat.name} (ID: ${cat.id})`);
          fetchLiveEventsByCategory(sportId, cat.id, cat.name);
        });
      } catch (err) {
        console.error("❌ Error parseando categorías:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición categorías:", err.message));
  req.end();
}

// --- Función para consultar partidos en vivo por categoría ---
function fetchLiveEventsByCategory(sportId, categoryId, categoryName) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportId}/events/live?categoryId=${categoryId}`,
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
          const home = game.homeTeam?.name || game.teams?.home?.name;
          const away = game.awayTeam?.name || game.teams?.away?.name;
          const key = `${home} vs ${away} (${categoryName})`;

          if (!notifiedGames.has(key)) {
            sendNotification(`⚽ ${categoryName}: ${home} vs ${away} en vivo`);
            notifiedGames.set(key, true);
          }
        });
      } catch (err) {
        console.error("❌ Error parseando partidos:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición partidos:", err.message));
  req.end();
}

// --- Loop cada 5 minutos: fútbol (ID=1) ---
setInterval(() => {
  console.log("🔄 Consultando categorías en vivo de fútbol...");
  fetchLiveCategories(1);
}, 5 * 60 * 1000);




