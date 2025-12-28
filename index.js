require('dotenv').config();
const axios = require('axios');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

// 🔎 Logs de verificación
console.log("=== VARIABLES DE ENTORNO ===");
console.log("ONESIGNAL_APP_ID:", ONESIGNAL_APP_ID || "MISSING");
console.log("ONESIGNAL_API_KEY:", ONESIGNAL_API_KEY ? ONESIGNAL_API_KEY.substring(0, 40) + "..." : "MISSING");
console.log("FOOTBALL_API_KEY:", FOOTBALL_API_KEY ? FOOTBALL_API_KEY.substring(0, 10) + "..." : "MISSING");
console.log("============================");

async function testNotification() {
  try {
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      contents: { en: "Prueba de notificación ✅" }
    }, {
      headers: {
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log("✅ Notificación enviada:", res.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

testNotification();










