const axios = require("axios");

async function testNotification() {
  try {
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: "886fb758-5e13-44df-87d4-3f3590e11491",
      included_segments: ["All"],
      contents: { en: "Prueba con nueva API Key ✅" }
    }, {
      headers: {
        "Authorization": `Basic ${process.env.ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log("✅ Notificación enviada:", res.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

testNotification();








