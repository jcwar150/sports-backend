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

// --- Función para obtener estadísticas de un partido ---
function getEventStatistics(event, status, league, sport) {
  const home = event.home_team?.name || "Home";
  const away = event.away_team?.name || "Away";

  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/events/${event.id}/statistics`,
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
        const stats = JSON.parse(data).data || [];

        const corners = stats.find(s => s.period === "all" && s.name === "corner_kicks");
        const redCards = stats.find(s => s.period === "all" && s.name === "red_cards");

        // --- Notificación de córneres al descanso ---
        if (status.includes("halftime") && corners) {
          const totalCorners = parseInt(corners.home) + parseInt(corners.away);
          if (totalCorners <= 2) {
            const msg = `⚠️ ${home} vs ${away} (${league}, ${sport}) | Total córneres: ${totalCorners} (<=2) al descanso`;
            console.log(msg);
            sendNotification(msg);
          }
        }

        // --- Notificación de tarjetas rojas SOLO en primer tiempo ---
        if (status.includes("1st") && redCards) {
          const totalRed = parseInt(redCards.home) + parseInt(redCards.away);
          if (totalRed > 0) {
            const msg = `🟥 ${home} vs ${away} (${league}, ${sport}) | Red Cards en 1er tiempo: Home ${redCards.home} - Away ${redCards.away}`;
            console.log(msg);
            sendNotification(msg);
          }
        }

        // --- Resumen final al terminar el partido ---
        if (status.includes("finished")) {
          let msg = `📌 Resumen final ${home} vs ${away} (${league}, ${sport})\n`;

          if (sport === "Fútbol") {
            const goalsHome = event.home_score?.current || 0;
            const goalsAway = event.away_score?.current || 0;
            const totalCorners = corners ? parseInt(corners.home) + parseInt(corners.away) : "N/D";
            const totalRed = redCards ? parseInt(redCards.home) + parseInt(redCards.away) : "N/D";

            msg += `⚽ Goles: ${home} ${goalsHome} - ${away} ${goalsAway}\n`;
            msg += `🟦 Córneres totales: ${totalCorners}\n`;
            msg += `🟥 Tarjetas rojas: ${totalRed}`;
          }

          if (sport === "Básquet") {
            const pointsHome = event.home_score?.current || 0;
            const pointsAway = event.away_score?.current || 0;
            const totalRed = redCards ? parseInt(redCards.home) + parseInt(redCards.away) : "N/D";

            msg += `🏀 Puntos: ${home} ${pointsHome} - ${away} ${pointsAway}\n`;
            msg += `🟥 Tarjetas rojas: ${totalRed}`;
          }

          console.log(msg);
          sendNotification(msg);
        }

      } catch (err) {
        console.error("❌ Error parseando statistics:", err.message);
      }
    });
  });

  req.on("error", err =>
    console.error("❌ Error en la petición statistics:", err.message)
  );
  req.end();
}

// --- Función para obtener partidos en vivo ---
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
          const status = event.status_more?.toLowerCase() || "";
          const league = event.tournament?.name || "Competición desconocida";
          const sport = event.sport_id === 1 ? "Fútbol" : event.sport_id === 2 ? "Básquet" : "Otro";

          console.log(`🔎 Revisando partido: ${event.home_team?.name} vs ${event.away_team?.name} | Estado: ${status} | Liga: ${league} | Deporte: ${sport}`);

          // --- Detectar prórroga ---
          if (status.includes("extra_time") || status.includes("overtime")) {
            const msg = `⏱️ ${event.home_team?.name} vs ${event.away_team?.name} (${league}, ${sport}) ha entrado en PRÓRROGA (${status})`;
            console.log(msg);
            sendNotification(msg);
          }

          // --- Revisar estadísticas ---
          getEventStatistics(event, status, league, sport);
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
}, 20 * 60 * 1000);











  










