const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY; // tu RapidAPI key
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("⚽🏀🏒 Worker de deportes corriendo en Render"));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

// --- Mapa de categorías por deporte ---
let categoriesMap = {
  football: new Map(),
  basketball: new Map(),
  hockey: new Map()
};

// --- Función para cargar categorías ---
function fetchCategories(sportSlug) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportSlug}/categories`,
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
        if (json.data) {
          json.data.forEach(cat => {
            categoriesMap[sportSlug].set(cat.id, {
              name: cat.name,
              country: cat.country?.name || "País desconocido"
            });
          });
          console.log(`📂 Categorías cargadas para ${sportSlug}: ${categoriesMap[sportSlug].size}`);
        }
      } catch (err) {
        console.error("❌ Error parseando categorías:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición categorías:", err.message));
  req.end();
}

// --- Función para enviar notificación a OneSignal ---
async function sendNotification(message) {
  try {
    const response = await axios.post(
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
    console.log("📲 Notificación enviada:", response.data);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.response?.data || err.message);
  }
}

// --- Función para obtener partidos en vivo ---
function fetchLiveEvents(sportSlug, sportName) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportSlug}/events/live`,
    headers: {
      "x-rapidapi-key": API_SPORT_KEY,
      "x-rapidapi-host": "sportapi7.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", async () => {
      try {
        const json = JSON.parse(data);
        const games = json.data || json.events || [];
        if (games.length > 0) {
          for (const game of games) {
            const home = game.homeTeam?.name;
            const away = game.awayTeam?.name;
            const homeScore = game.homeScore?.current ?? 0;
            const awayScore = game.awayScore?.current ?? 0;

            // Buscar liga y país desde categorías
            const catId = game.category?.id || game.uniqueTournament?.category?.id;
            const catInfo = categoriesMap[sportSlug].get(catId) || {
              name: game.uniqueTournament?.name || "Liga desconocida",
              country: game.uniqueTournament?.category?.country?.name || "País desconocido"
            };

            const league = catInfo.name;
            const country = catInfo.country;
            const status = game.status?.description || game.status?.type || "live";
            const timer = game.status?.timer || "";

            const message = `${sportName} - ${league} (${country})\n${home} ${homeScore} - ${awayScore} ${away} | ${status} ${timer}`;
            console.log("📊 Partido:", message);
            await sendNotification(message);
          }
        } else {
          console.log(`⚠️ No se encontraron partidos en vivo de ${sportName}.`);
        }
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición:", err.message));
  req.end();
}

// --- Cargar categorías al inicio ---
fetchCategories("football");
fetchCategories("basketball");
fetchCategories("hockey");

// --- Loop cada 10 minutos ---
setInterval(() => {
  console.log("🔄 Buscando partidos en vivo...");
  fetchLiveEvents("football", "Fútbol");
  fetchLiveEvents("basketball", "Básquet");
  fetchLiveEvents("hockey", "Hockey");
}, 10 * 60 * 1000);

// --- Llamada inicial para probar inmediatamente ---
setTimeout(() => {
  fetchLiveEvents("football", "Fútbol");
  fetchLiveEvents("basketball", "Básquet");
  fetchLiveEvents("hockey", "Hockey");
}, 5000);
