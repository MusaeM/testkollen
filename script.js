// Ladda tillgängliga kameror vid sidladdning
navigator.mediaDevices.enumerateDevices().then(devices => {
  const videoDevices = devices.filter(d => d.kind === "videoinput");
  const cameraSelect = document.getElementById("cameraSelect");

  videoDevices.forEach(device => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.text = device.label || `Kamera ${cameraSelect.length + 1}`;
    cameraSelect.appendChild(option);
  });
});

document.getElementById("scan-btn").addEventListener("click", () => {
  const selectedDeviceId = document.getElementById("cameraSelect").value;
  startScanner(selectedDeviceId);
});

function startScanner(deviceId) {
  const resultDiv = document.getElementById("result");
  const scanBtn = document.getElementById("scan-btn");
  const scannerContainer = document.getElementById("scanner");

  scanBtn.disabled = true;
  resultDiv.innerHTML = "<p>Startar kamera...</p>";

  let detectionHistory = [];

  Quagga.stop();

  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: scannerContainer,
      constraints: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 }
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

    const errors = data.codeResult.decodedCodes
      .filter(c => c.error !== undefined)
      .map(c => c.error);
    const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;

    if (avgError > 0.15) return;

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
