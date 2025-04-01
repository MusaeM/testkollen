 document.getElementById("scan-btn").addEventListener("click", () => {
    startScanner();
  });

  function startScanner() {
    const video = document.getElementById("scanner");
    const resultDiv = document.getElementById("result");
    const scanBtn = document.getElementById("scan-btn");

    // Disable scan button
    scanBtn.disabled = true;
    resultDiv.innerHTML = "<p>Startar kamera...</p>";

    // Stop any previous camera
    video.srcObject?.getTracks()?.forEach(track => track.stop());

    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { exact: "environment" },
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 }
        },
      audio: false
    }).then((stream) => {
      video.srcObject = stream;
      video.play();

      let detectionHistory = [];

      Quagga.init({
        inputStream: {
          type: "LiveStream",
          target: video,
          constraints: {
            facingMode: "environment"
          }
        },
        decoder: {
          readers: ["ean_reader", "upc_reader"] // add more if needed
        },
        locate: true,
        frequency: 2
      }, function (err) {
        if (err) {
          console.error("Quagga init error:", err);
          resultDiv.innerHTML = "<p>Fel vid start av skanner.</p>";
          scanBtn.disabled = false;
          return;
        }
        Quagga.start();
        resultDiv.innerHTML = "<p>Skannar streckkod...</p>";
      });

      Quagga.onDetected(async function (data) {
        const code = data.codeResult.code;
        if (!code) return;

        // Optional: average error check
        const errors = data.codeResult.decodedCodes
          .filter(c => c.error !== undefined)
          .map(c => c.error);
        const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;

        if (avgError > 0.15) return; // too uncertain

        detectionHistory.push(code);
        if (detectionHistory.length > 5) detectionHistory.shift(); // keep last 5

        const matches = detectionHistory.filter(c => c === code).length;

        if (matches >= 3) {
          Quagga.stop();
          const tracks = video.srcObject?.getTracks();
          tracks?.forEach(track => track.stop());
          scanBtn.disabled = false;

          resultDiv.innerHTML = `<p><strong>Streckkod:</strong> ${code}</p>`;

          try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
            const json = await res.json();

            if (json.status === 1) {
              const produkt = json.product;
              resultDiv.innerHTML += `
                <h2>${produkt.product_name || "Okänd produkt"}</h2>
                <p><strong>Ingredienser:</strong> ${produkt.ingredients_text || "okänt"}</p>
                <p><strong>Allergener:</strong> ${produkt.allergens_tags?.join(", ") || "okänt"}</p>
              `;
            } else {
              resultDiv.innerHTML += "<p>Produkten hittades inte.</p>";
            }
          } catch (e) {
            console.error("API error:", e);
            resultDiv.innerHTML += "<p>Kunde inte hämta produktdata.</p>";
          }
        }
      });

    }).catch((err) => {
      console.error("Kamerafel:", err.name, err.message);
      alert("Kunde inte öppna kameran:\n" + err.message);
      scanBtn.disabled = false;
    });
  }