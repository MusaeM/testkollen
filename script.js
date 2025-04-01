document.getElementById("scan-btn").addEventListener("click", () => {
  startScanner();
});

function startScanner() {
  const resultDiv = document.getElementById("result");
  const scanBtn = document.getElementById("scan-btn");
  const scannerContainer = document.getElementById("scanner");

  scanBtn.disabled = true;
  resultDiv.innerHTML = "<p>Startar kamera...</p>";

  let detectionHistory = [];

  // Stoppa eventuellt tidigare kamera
  Quagga.stop();

  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: scannerContainer, // Viktigt: ett <div>
      constraints: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    decoder: {
      readers: ["ean_reader", "upc_reader"]
    },
    locate: true,
    frequency: 2
  }, function (err) {
    if (err) {
      console.error("Quagga init error:", err.message || err);
      resultDiv.innerHTML = `<p>Fel vid start av skanner:<br>${err.message}</p>`;
      scanBtn.disabled = false;
      return;
    }

    Quagga.start();
    resultDiv.innerHTML = "<p>Skannar streckkod...</p>";
  });

  Quagga.onDetected(async function (data) {
    const code = data.codeResult.code;
    if (!code) return;

    // Kvalitetskontroll på scanningen
    const errors = data.codeResult.decodedCodes
      .filter(c => c.error !== undefined)
      .map(c => c.error);
    const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;

    if (avgError > 0.15) return; // osäker scanning → ignorera

    detectionHistory.push(code);
    if (detectionHistory.length > 5) detectionHistory.shift();

    const matches = detectionHistory.filter(c => c === code).length;

    if (matches >= 3) {
      Quagga.stop();
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
}
