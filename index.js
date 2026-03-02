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
            const league = game.uniqueTournament?.name || "Liga desconocida";
            const country = game.uniqueTournament?.category?.country?.name || "País desconocido";
            const status = game.status?.description || game.status?.type || "live";

            // Calcular minutos jugados
            let minutesPlayed = "";
            if (game.startTimestamp) {
              const now = Math.floor(Date.now() / 1000);
              const elapsed = Math.floor((now - game.startTimestamp) / 60);
              minutesPlayed = `${elapsed}'`;
            }

            const message = `${sportName} - ${league} (${country})\n${home} ${homeScore} - ${awayScore} ${away} | ${status} ${minutesPlayed}`;
            console.log("📊 Partido:", message); // Mostrar en consola
            await sendNotification(message); // Enviar notificación
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

// --- Loop cada 10 minutos ---
setInterval(() => {
  console.log("🔄 Buscando partidos en vivo...");
  fetchLiveEvents("football", "Fútbol");
  fetchLiveEvents("basketball", "Básquet");
  fetchLiveEvents("hockey", "Hockey");
}, 10 * 60 * 1000);

// --- Llamada inicial para probar inmediatamente ---
fetchLiveEvents("football", "Fútbol");
fetchLiveEvents("basketball", "Básquet");
fetchLiveEvents("hockey", "Hockey");


