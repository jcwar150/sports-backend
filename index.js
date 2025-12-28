const axios = require("axios");

// ⚠️ Pon aquí tus valores reales
const ONESIGNAL_APP_ID = "886fb758-5e13-44df-87d4-3f3590e11491"; // tu App ID
const ONESIGNAL_API_KEY = "x6e7xyddzutk4aadjbrpwcax7"; // tu REST API Key

async function testNotification() {
  try {
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      headings: { en: "🔔 Prueba desde backend" },
      contents: { en: "Si ves esto, la API Key funciona ✅" }
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

// Ejecutar la prueba
testNotification();
;







