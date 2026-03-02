const https = require("https");
const axios = require("axios");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Función para enviar notificación a OneSignal
async function sendNotification(message) {
  try {
    const response = await axios.post("https://api.onesignal.com/notifications", {
      app_id: process.env.ONESIGNAL_APP_ID, // tu App ID
      included_segments: ["All"], // a quién enviar
      headings: { en: "Partido en vivo" },
      contents: { en: message }
    }, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${process.env.ONESIGNAL_REST_API_KEY}` // tu REST API Key
      }
    });

    console.log("📲 Notificación enviada:", response.data);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.message);
  }
}

// Función para obtener partidos en vivo y enviar notificación
function fetchLiveEvents(sportSlug, sportName) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportSlug}/events/live`,
    headers: {
      "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
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
            await sendNotification(message);
          }
        }
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición:", err.message));
  req.end();
}

// --- Ejecutar cada 10 minutos ---
setInterval(() => {
  fetchLiveEvents("football", "Fútbol");
  fetchLiveEvents("basketball", "Básquet");
  fetchLiveEvents("hockey", "Hockey");
}, 10 * 60 * 1000);

// Endpoint para probar manualmente
app.get("/test", (req, res) => {
  fetchLiveEvents("football", "Fútbol");
  fetchLiveEvents("basketball", "Básquet");
  fetchLiveEvents("hockey", "Hockey");
  res.send("✅ Notificaciones enviadas si hay partidos en vivo.");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});


