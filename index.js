const https = require("https");
const axios = require("axios");
const express = require("express");

const API_SPORT_KEY = process.env.FOOTBALL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

// Guardamos partidos notificados: "Home vs Away" -> último estado
let notifiedGames = new Map();

app.get("/", (req, res) => {
  res.send("🏀 Worker de Basket corriendo en Render");
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

// --- Endpoint para que Flutter consuma partidos que cumplen condiciones ---
app.get("/live-basket", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const options = {
    method: "GET",
    hostname: "v1.basketball.api-sports.io",
    path: `/games?date=${today}&timezone=Europe/London`,
    headers: {
      "x-apisports-key": API_SPORT_KEY
    }
  };

  const reqApi = https.request(options, apiRes => {
    let data = "";
    apiRes.on("data", chunk => (data += chunk));
    apiRes.on("end", () => {
      try {
        const json = JSON.parse(data);
        const games = json.response
          .filter(g => {
            const status = g.status?.short;
            const pointsHome = g.scores?.home?.total || 0;
            const pointsAway = g.scores?.away?.total || 0;
            const diff = Math.abs(pointsHome - pointsAway);

            // condición 1: prórroga (OT, ET, AOT)
            if (["OT", "ET", "AOT"].includes(status)) return true;

            // condición 2: último cuarto con diferencia >=20 o <=5 y faltando <= 5 min
            if (status === "Q4") {
              const time = g.status?.timer || ""; // ej: "05:00"
              if (time) {
                const [min] = time.split(":").map(Number);
                if (min <= 5 && (diff >= 20 || diff <= 5)) return true;
              }
            }
            return false;
          })
          .map(game => ({
            home: game.teams?.home?.name,
            away: game.teams?.away?.name,
            pointsHome: game.scores?.home?.total,
            pointsAway: game.scores?.away?.total,
            league: game.league?.name,
            country: game.country?.name,
            status: game.status?.short,
            time: game.status?.timer || null,
            statistics: game.statistics || null // si la API expone estadísticas
          }));
        res.json({ games });
      } catch (err) {
        res.status(500).json({ error: "Error parseando respuesta" });
      }
    });
  });

  reqApi.on("error", err => res.status(500).json({ error: err.message }));
  reqApi.end();
});

// --- Endpoint para ver eventos de un partido (probar timeouts) ---
app.get("/game-events/:id", (req, res) => {
  const gameId = req.params.id;
  const options = {
    method: "GET",
    hostname: "v1.basketball.api-sports.io",
    path: `/events?game=${gameId}&timezone=Europe/London`,
    headers: {
      "x-apisports-key": API_SPORT_KEY
    }
  };

  const reqApi = https.request(options, apiRes => {
    let data = "";
    apiRes.on("data", chunk => (data += chunk));
    apiRes.on("end", () => {
      try {
        const json = JSON.parse(data);
        res.json(json); // devolvemos todo para inspección
      } catch (err) {
        res.status(500).json({ error: "Error parseando respuesta" });
      }
    });
  });

  reqApi.on("error", err => res.status(500).json({ error: err.message }));
  reqApi.end();
});

// --- Función para revisar partidos y notificar ---
function getLiveBasketEvents() {
  const today = new Date().toISOString().split("T")[0];
  const options = {
    method: "GET",
    hostname: "v1.basketball.api-sports.io",
    path: `/games?date=${today}&timezone=Europe/London`,
    headers: {
      "x-apisports-key": API_SPORT_KEY
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);

        if (!json.response || json.response.length === 0) {
          console.log("⏭️ No hay partidos de basket para hoy");
          return;
        }

        json.response.forEach(game => {
          const home = game.teams?.home?.name || "Home";
          const away = game.teams?.away?.name || "Away";
          const key = `${home} vs ${away}`;
          const pointsHome = game.scores?.home?.total || 0;
          const pointsAway = game.scores?.away?.total || 0;
          const league = game.league?.name || "Liga desconocida";
          const country = game.country?.name || "País desconocido";
          const status = game.status?.short || "";
          const time = game.status?.timer || "";
          const diff = Math.abs(pointsHome - pointsAway);

          console.log(`🔎 ${key} | Estado: ${status} | Tiempo: ${time} | Liga: ${league} | País: ${country}`);

          const lastStatus = notifiedGames.get(key);

          // --- Condición 1: prórroga ---
          if (["OT", "ET", "AOT"].includes(status) && lastStatus !== status) {
            const msg = `⏱️ PRÓRROGA en ${home} vs ${away} (${league}, ${country})\n🏀 ${pointsHome} - ${pointsAway}`;
            sendNotification(msg);
            notifiedGames.set(key, status);
          }

          // --- Condición 2: último cuarto, ≤5 min ---
          if (status === "Q4" && time) {
            const [min] = time.split(":").map(Number);
            if (min <= 5) {
              if (diff >= 20 && lastStatus !== "Q4-20") {
                const msg = `⚡ Último cuarto (≤5 min, diferencia ≥20)\n${home} vs ${away}\n🏀 ${pointsHome} - ${pointsAway}`;
                sendNotification(msg);
                notifiedGames.set(key, "Q4-20");
              }
              if (diff <= 5 && lastStatus !== "Q4-5") {
                const msg = `🔥 Último cuarto (≤5 min, diferencia ≤5)\n${home} vs ${away}\n🏀 ${pointsHome} - ${pointsAway}`;
                sendNotification(msg);
                notifiedGames.set(key, "Q4-5");
              }
            }
          }

          // --- Limpiar cuando termina ---
          if (["FT", "AOT"].includes(status) && notifiedGames.has(key)) {
            console.log(`✅ Partido terminado: ${key}, limpiando de la lista`);
            notifiedGames.delete(key);
          }
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta basket:", err.message);
      }
    });
  });

  req.on("error", err =>
    console.error("❌ Error en la petición basket:", err.message)
  );
  req.end();
}

// --- Loop cada 2 minutos ---
setInterval(() => {
  console.log("🔄 Buscando partidos de basket (OT/ET/AOT y Q4 con diferencia ≥20 o ≤5)...");
  getLiveBasketEvents();
}, 1 * 60 * 1000);















  










