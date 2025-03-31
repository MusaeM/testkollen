document.getElementById("scan-btn").addEventListener("click", () => {
    startScanner();
  });
  
  function startScanner() {
    const video = document.getElementById("scanner");
  
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    }).then((stream) => {
      video.srcObject = stream;
      video.play();
  
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
  
        // Stoppa scanning och video
        Quagga.stop();
        stream.getTracks().forEach(track => track.stop());
  
        // Visa EAN-koden direkt
        document.getElementById("result").innerHTML = `<p><strong>Streckkod:</strong> ${code}</p>`;
  
        try {
          const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
          const json = await res.json();
  
          if (json.status === 1) {
            const produkt = json.product;
            document.getElementById("result").innerHTML = `
              <p><strong>Streckkod:</strong> ${code}</p>
              <h2>${produkt.product_name}</h2>
              <p><strong>Ingredienser:</strong> ${produkt.ingredients_text || "okänt"}</p>
              <p><strong>Allergener:</strong> ${produkt.allergens_tags?.join(", ") || "okänt"}</p>
            `;
          } else {
            document.getElementById("result").innerHTML += "<p>Produkten hittades inte.</p>";
          }
        } catch (e) {
          console.error("API-fel:", e);
          document.getElementById("result").innerHTML += "<p>Kunde inte hämta produktdata.</p>";
        }
      });
  
    }).catch((err) => {
      console.error("Kameratillgång nekad:", err);
      alert("Kunde inte öppna kameran. Tillåt åtkomst i webbläsaren.");
    });
  }
  