document.getElementById("scan-btn").addEventListener("click", () => {
    const scanner = document.getElementById("scanner");
   // scanner.style.display = "block";
  
   Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector("#scanner"),
      constraints: {
        facingMode: "environment", // För mobilkamera bak
        aspectRatio: { min: 1, max: 2 }
      }
    },
    locator: {
      patchSize: "medium",
      halfSample: true
    },
    decoder: {
      readers: ["ean_reader"]
    },
    locate: true
  }, function (err) {
    if (err) {
      console.log(err);
      return;
    }
    Quagga.start();
  });
  
  
    Quagga.onDetected(async data => {
      const code = data.codeResult.code;
      Quagga.stop();
      scanner.style.display = "none";
      document.getElementById("result").innerText = "Söker: " + code;
  
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const json = await res.json();
  
      if (json.status === 1) {
        const produkt = json.product;
        document.getElementById("result").innerHTML = `
          <h2>${produkt.product_name}</h2>
          <p><strong>Ingr:</strong> ${produkt.ingredients_text || "okänt"}</p>
          <p><strong>Aller:</strong> ${produkt.allergens_tags.join(", ") || "okänt"}</p>
        `;
      } else {
        document.getElementById("result").innerText = "Produkten hittades inte.";
      }
    });
  });
  