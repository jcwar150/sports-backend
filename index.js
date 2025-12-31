const https = require("https");
const axios = require("axios");
const express = require("express");

const RAPIDAPI_KEY = process.env.FOOTBALL_API_KEY;   // SportScore API Key
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// Cache para evitar notificaciones duplicadas
const notifiedEvents = new Map();

// --- Servidor Express mínimo ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("⚽ Worker de notificaciones corriendo en Render");
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

// --- Función para obtener detalle de un evento ---
function getEventDetails(eventId, sportId, home, away, score, status, eventKey) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/events/${eventId}`,
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "sportscore1.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const event = JSON.parse(data).data;

        // Estadísticas oficiales
        const cornersStat = event.statistics?.corner || event.statistics?.corners || 0;

        // Incidents para tarjetas rojas
        let redCards = 0;
        if (event.incidents) {
          event.incidents.forEach(incident => {
            if (incident.incident_type === "red_card") redCards++;
          });
        }

        // 1. Tarjeta roja en primer tiempo (fútbol)
        if (sportId === 1 && status.toLowerCase().includes("1st half") && redCards > 0) {
          const key = `${eventKey}-redcard1st`;
          if (!notifiedEvents.has(key)) {
            sendNotification(`🔴 Tarjeta roja en 1er tiempo: ${home} vs ${away} | Marcador: ${score}`);
            notifiedEvents.set(key, true);
          }
        }

        // 2. Corners ≤ 2 al terminar primer tiempo (fútbol)
        if (sportId === 1 && status.toLowerCase().includes("halftime") && cornersStat <= 2) {
          const key = `${eventKey}-cornersHT`;
          if (!notifiedEvents.has(key)) {
            sendNotification(`🟦 Solo ${cornersStat} corners en 1er tiempo: ${home} vs ${away}`);
            notifiedEvents.set(key, true);
          }
        }

        // 3. Prórroga en fútbol o básquet
        if (status.toLowerCase().includes("extra time") || status.toLowerCase().includes("overtime")) {
          const key = `${eventKey}-overtime`;
          if (!notifiedEvents.has(key)) {
            sendNotification(`⏱️ Prórroga en ${home} vs ${away} | Marcador: ${score}`);
            notifiedEvents.set(key, true);
          }
        }
      } catch (err) {
        console.error("❌ Error parseando detalle:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en detalle:", err.message));
  req.end();
}

// --- Función para obtener partidos en vivo ---
function getLiveEvents(sportId) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/sports/${sportId}/events/live`,
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
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
          const score = `${event.home_score?.current || 0} - ${event.away_score?.current || 0}`;
          const status = event.status_more || "";
          const eventKey = `${sportId}-${event.id}`;

          // Llamada al detalle del evento para estadísticas completas
          getEventDetails(event.id, sportId, home, away, score, status, eventKey);
        });
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
  console.log("🔄 Buscando partidos en vivo...");
  getLiveEvents(1); // ⚽ Fútbol
  getLiveEvents(2); // 🏀 Básquet
}, 5 * 60 * 1000);










  










