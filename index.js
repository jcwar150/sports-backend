    // --- Condición 2: último cuarto, <=5 min y diferencia >=20 ---
          if (status === "Q4" && lastStatus !== "Q4") {
            if (time) {
              const [min] = time.split(":").map(Number);
              if (min <= 5 && diff >= 20) {
                const msg = `⚡ Último cuarto (≤5 min, diferencia ≥20)\n${home} vs ${away} (${league}, ${country})\n🏀 Marcador: ${home} ${pointsHome} - ${away} ${pointsAway}`;
                console.log(msg);
                sendNotification(msg);
                notifiedGames.set(key, "Q4");
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
  console.log("🔄 Buscando partidos de basket (OT y Q4 con diferencia ≥20)...");
  getLiveBasketEvents();
}, 1 * 60 * 1000);












  










