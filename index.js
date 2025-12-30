// index.js
const https = require("https");
const OneSignal = require("onesignal-node");

// Variables de entorno (Render)
const RAPIDAPI_KEY = process.env.FOOTBALL_API_KEY;   // tu key de SportScore
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// Cliente OneSignal
const client = new OneSignal.Client(ONESIGNAL_APP_ID, ONESIGNAL_API_KEY);

async function sendNotification(message) {
  try {
    await client.createNotification({
      contents: { en: message },
      included_segments: ["All"]
    });
    console.log("✅ Notificación enviada:", message);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err.message);
  }
}

function getLiveFootball() {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: "/sports/1/events/live", // ⚽ fútbol en vivo
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

          // Mensaje básico
          const message = `⚽ Partido en vivo: ${home} vs ${away} | Marcador: ${score} | Estado: ${status}`;

          // Enviar notificación
          sendNotification(message);
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición:", err.message));
  req.end();
}

// Ejecutar cada minuto
setInterval(getLiveFootball, 60 * 1000);





  










