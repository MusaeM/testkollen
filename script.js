document.getElementById("scan-btn").addEventListener("click", () => {
    startScanner();
  });
  
  function startScanner() {
    const video = document.getElementById("scanner");
    let recentCodes = [];
    let confirmedCode = null;
  
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
        locate: true,
        frequency: 2
      }, function (err) {
        if (err) {
          console.error("Quagga init error:", err);
          return;
        }
        Quagga.start();
      });
  
      Quagga.onDetected(async function (data) {
        const code = data.codeResult.code;
        const confidence = parseFloat(data.codeResult.decodedCodes[0]?.error || 1);
  
        if (confidence > 0.1 || !code) return; // ignorerar osäkra resultat
  
        recentCodes.push(code);
        if (recentCodes.length > 5) recentCodes.shift();
  
        // Kontroll: har vi sett samma kod 3+ gånger i rad?
        const mostCommon = findMostFrequent(recentCodes);
        if (mostCommon.count >= 3 && mostCommon.code !== confirmedCode) {
          confirmedCode = mostCommon.code;
          Quagga.stop();
          const tracks = video.srcObject?.getTracks();
          tracks?.forEach(track => track.stop());
  
          document.getElementById("result").innerHTML = `<p><strong>Streckkod:</strong> ${confirmedCode}</p>`;
  
          try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${confirmedCode}.json`);
            const json = await res.json();
  
            if (json.status === 1) {
              const produkt = json.product;
              document.getElementById("result").innerHTML += `
                <h2>${produkt.product_name}</h2>
                <p><strong>Ingredienser:</strong> ${produkt.ingredients_text || "okänt"}</p>
                <p><strong>Allergener:</strong> ${produkt.allergens_tags?.join(", ") || "okänt"}</p>
              `;
            } else {
              document.getElementById("result").innerHTML += "<p>Produkten hittades inte.</p>";
            }
          } catch (e) {
            console.error("API error:", e);
            document.getElementById("result").innerHTML += "<p>Kunde inte hämta produktdata.</p>";
          }
        }
      });
  
    }).catch((err) => {
      console.error("Camera access denied:", err);
      alert("Kunde inte öppna kameran. Tillåt kameratillgång i webbläsaren.");
    });
  }
  
  function findMostFrequent(arr) {
    const freq = {};
    arr.forEach(code => {
      freq[code] = (freq[code] || 0) + 1;
    });
  
    let maxCode = null;
    let maxCount = 0;
  
    for (const code in freq) {
      if (freq[code] > maxCount) {
        maxCode = code;
        maxCount = freq[code];
      }
    }
  
    return { code: maxCode, count: maxCount };
  }
  