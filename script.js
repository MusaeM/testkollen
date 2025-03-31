document.getElementById("scan-btn").addEventListener("click", () => {
    startScanner();
  });
  
  function startScanner() {
    const video = document.getElementById("scanner");
  
    // Använd getUserMedia direkt
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    }).then((stream) => {
      video.srcObject = stream;
      video.play();
  
      // Starta Quagga efter att streamen är igång
      Quagga.init({
        inputStream: {
          type: "LiveStream",
          target: video,
          constraints: {
            facingMode: "environment"
          }
        },
        decoder: {
          readers: ["ean_reader"]
        },
        locate: true
      }, function (err) {
        if (err) {
          console.error("Quagga init error:", err);
          return;
        }
        Quagga.start();
      });
  
      Quagga.onDetected(async function (data) {
        const code = data.codeResult.code;
        console.log("Scannad kod:", code);
        Quagga.stop();
  
        // Stoppa videoströmmen också
        stream.getTracks().forEach(track => track.stop());
  
        document.getElementById("result").innerText = "Söker efter: " + code;
  
        try {
          const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
          const json = await res.json();
  
          if (json.status === 1) {
            const produkt = json.product;
            document.getElementById("result").innerHTML = `
              <h2>${produkt.product_name}</h2>
              <p><strong>Ingredienser:</strong> ${produkt.ingredients_text || "okänt"}</p>
              <p><strong>Allergener:</strong> ${produkt.allergens_tags?.join(", ") || "okänt"}</p>
            `;
          } else {
            document.getElementById("result").innerText = "Produkten hittades inte.";
          }
        } catch (e) {
          console.error("API-fel:", e);
          document.getElementById("result").innerText = "Kunde inte hämta produktdata.";
        }
      });
    }).catch((err) => {
      console.error("Kameratillgång nekad:", err);
      alert("Kunde inte öppna kameran. Tillåt åtkomst i webbläsaren.");
    });
  }
  
  