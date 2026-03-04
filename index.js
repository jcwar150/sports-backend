const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY; // tu RapidAPI key
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("📂 Worker de categorías en vivo corriendo en Render"));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

// --- Notificación OneSignal ---
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

// --- Categorías en vivo ---
function fetchLiveCategories(sportSlug, sportName) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: `/api/v1/sport/${sportSlug}/live-categories`,
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
        const categories = json.data || [];
        if (categories.length > 0) {
          let msg = `📂 Categorías en vivo de ${sportName}:\n`;
          categories.forEach(cat => {
            msg += `- ${cat.name} (${cat.country?.name}) | ID: ${cat.id}\n`;
          });
          console.log(msg); // imprime en servidor
          await sendNotification(msg); // envía notificación
        } else {
          console.log(`⚠️ No hay categorías en vivo para ${sportName}.`);
          await sendNotification(`⚠️ No hay categorías en vivo para ${sportName}.`);
        }
      } catch (err) {
        console.error("❌ Error parseando categorías:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición categorías:", err.message));
  req.end();
}

// --- Loop cada 10 minutos ---
setInterval(() => {
  console.log("🔄 Buscando categorías en vivo...");
  fetchLiveCategories("football", "Fútbol");
  fetchLiveCategories("basketball", "Básquet");
  fetchLiveCategories("hockey", "Hockey");
}, 10 * 60 * 1000);



