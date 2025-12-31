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

// --- Función para enviar notificación (no la usamos aún en esta prueba) ---
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

          // Estadísticas oficiales (si existen)
          const cornersStat = event.statistics?.corner || event.statistics?.corners || 0;

          // Conteo manual de incidents como respaldo
          let cornersCount = 0;
          if (event.incidents) {
            event.incidents.forEach(incident => {
              if (
                incident.incident_type &&
                incident.incident_type.toLowerCase().includes("corner")
              ) {
                cornersCount++;
              }
            });
          }

          // Mostrar en logs
          console.log("📊 Partido:", home, "vs", away, "| Estado:", status, "| Marcador:", score);
          console.log("   ➡️ Estadísticas oficiales:", cornersStat, "corners");
          console.log("   ➡️ Conteo por incidents:", cornersCount, "corners");
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











  










