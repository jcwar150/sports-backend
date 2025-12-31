const https = require("https");
const axios = require("axios");
const express = require("express");

const RAPIDAPI_KEY = process.env.FOOTBALL_API_KEY;   // SportScore API Key
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// --- Servidor Express mínimo ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("⚽ Worker de notificaciones corriendo en Render");
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

// --- Función para enviar notificación (lista para usar si quieres) ---
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

// --- Función para obtener incidents de un partido ---
function getEventIncidents(eventId, home, away, score, status) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/events/${eventId}/incidents`,
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
        const incidents = JSON.parse(data).data || [];

        // Mostrar incidents crudos para depuración
        console.log("📋 Incidents crudos para", home, "vs", away, ":", JSON.stringify(incidents, null, 2));

        // Contar córneres (normalizando tipos)
        const corners = incidents.filter(
          inc => inc.incident_type && inc.incident_type.toLowerCase().includes("corner")
        ).length;

        // Contar tarjetas rojas (normalizando tipos)
        const redCards = incidents.filter(
          inc => inc.incident_type && inc.incident_type.toLowerCase().includes("red")
        ).length;

        // Mostrar resumen en logs
        console.log("📊 Partido:", home, "vs", away, "| Estado:", status, "| Marcador:", score);
        console.log("   ➡️ Córneres detectados:", corners);
        console.log("   ➡️ Tarjetas rojas detectadas:", redCards);

      } catch (err) {
        console.error("❌ Error parseando incidents:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición incidents:", err.message));
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

          // Llamada al endpoint de incidents para este partido
          getEventIncidents(event.id, home, away, score, status);
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta live:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición live:", err.message));
  req.end();
}

// --- Loop cada 5 minutos ---
setInterval(() => {
  console.log("🔄 Buscando partidos en vivo...");
  getLiveEvents(1); // ⚽ Fútbol
  getLiveEvents(2); // 🏀 Básquet
}, 5 * 60 * 1000);












  










