const https = require("https");
const axios = require("axios");

// Variables de entorno en Render
const RAPIDAPI_KEY = process.env.FOOTBALL_API_KEY;   // SportScore API Key
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// Cache para guardar último estado de cada partido
const lastEvents = new Map();

// Función para enviar notificación con OneSignal
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

// Función para obtener partidos en vivo y filtrar corners/rojas
function getLiveFootball() {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: "/sports/1/events/live",
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
          const home = event.home_team.name;
          const away = event.away_team.name;
          const score = `${event.home_score.current} - ${event.away_score.current}`;
          const status = event.status_more;

          // Contadores
          let corners = 0;
          let redCards = 0;

          if (event.incidents) {
            event.incidents.forEach(incident => {
              if (incident.incident_type === "corner") corners++;
              if (incident.incident_type === "red_card") redCards++;
            });
          }

          // Construir mensaje
          const message = `⚽ ${home} vs ${away} | Marcador: ${score} | Estado: ${status} | 🟦 Corners: ${corners} | 🔴 Rojas: ${redCards}`;

          // Verificar si ya enviamos este mismo estado
          const lastKey = `${event.id}`;
          const lastData = `${score}-${corners}-${redCards}-${status}`;

          if (lastEvents.get(lastKey) !== lastData) {
            // Nuevo estado → enviar notificación
            sendNotification(message);
            lastEvents.set(lastKey, lastData);
          } else {
            console.log(`⏩ Sin cambios en ${home} vs ${away}, no se envía notificación`);
          }
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición:", err.message));
  req.end();
}

// Ejecutar cada 2 minutos
setInterval(getLiveFootball, 2 * 60 * 1000);






  










