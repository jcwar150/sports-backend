const https = require("https");
const express = require("express");

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("⚽ Worker de notificaciones corriendo en Render");
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

// --- Función para obtener estadísticas de un partido ---
function getEventStatistics(eventId, home, away, status) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/events/${eventId}/statistics`,
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

        // Buscar corner_kicks y red_cards
        const corners = stats.find(s => s.period === "all" && s.name === "corner_kicks");
        const redCards = stats.find(s => s.period === "all" && s.name === "red_cards");

        if (!corners) {
          console.log(`⏭️ ${home} vs ${away} | No hay datos de córneres`);
          return;
        }

        const totalCorners = parseInt(corners.home) + parseInt(corners.away);

        // Solo mostrar si es medio tiempo o prórroga
        if (status.includes("halftime") || status.includes("extra_time")) {
          if (totalCorners <= 2) {
            console.log(`⚠️ ${home} vs ${away} | Total córneres: ${totalCorners} (<=2)`);
          } else {
            console.log(`📊 ${home} vs ${away} | Total córneres: ${totalCorners}`);
          }
        }

        if (redCards) {
          console.log(`🟥 ${home} vs ${away} | Red Cards: Home ${redCards.home} - Away ${redCards.away}`);
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
          const home = event.home_team?.name || "Home";
          const away = event.away_team?.name || "Away";
          const status = event.status_more || "";

          console.log(`🔎 Revisando partido: ${home} vs ${away} | Estado: ${status}`);
          getEventStatistics(event.id, home, away, status);
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
}, 5 * 60 * 1000);










  










