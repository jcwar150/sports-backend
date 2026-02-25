const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY; // ✅ tu RapidAPI key
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

let notifiedGames = new Map();
let currentDate = new Date().toISOString().split("T")[0];

// --- Servidor Express ---
app.get("/", (req, res) => res.send("⚽ Worker de fútbol corriendo con RapidAPI"));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

// --- Función para enviar notificaciones a OneSignal ---
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

// --- Función para consultar partidos en vivo ---
function fetchLiveFootball() {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: "/api/v1/sport/football/events/live",
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

        // --- Recorrer partidos en vivo ---
        const games = json.data || json.events || json.response || [];

        if (games.length === 0) {
          console.log("⚠️ No se encontraron partidos en vivo.");
        } else {
          games.forEach(game => {
            const home = game.homeTeam?.name || game.teams?.home?.name;
            const away = game.awayTeam?.name || game.teams?.away?.name;
            const status = game.status?.type || game.status?.short || "live";
            const key = `${home} vs ${away}`;

            if (!notifiedGames.has(key)) {
              sendNotification(`⚽ Partido en vivo: ${home} vs ${away} | Estado: ${status}`);
              notifiedGames.set(key, true); // candado para no repetir
            }
          });
        }
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición:", err.message));
  req.end();
}

// --- Loop cada 5 minutos ---
setInterval(() => {
  console.log("🔄 Consultando partidos de fútbol en vivo...");
  fetchLiveFootball();
}, 5 * 60 * 1000);



