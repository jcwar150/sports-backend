require('dotenv').config();
const axios = require('axios');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

console.log("App ID:", ONESIGNAL_APP_ID);
console.log("API Key:", ONESIGNAL_API_KEY ? ONESIGNAL_API_KEY.substring(0,25) + "..." : "MISSING");

async function testNotification() {
  try {
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"], // envía a todos los dispositivos registrados
      headings: { en: "🔔 Test Notification" },
      contents: { en: "Si ves esto, la integración funciona ✅" }
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










