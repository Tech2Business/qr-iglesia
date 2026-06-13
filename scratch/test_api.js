async function testBackend() {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKE4dV_kGmoWwwkUGcq7bwI39kCU4tGXHFrBRdUuCz79qZxh42hmdmP15ErkvEQ_0/exec";
  const uniqueId = new Date().getTime() + "_" + Math.random();
  const url = `${SCRIPT_URL}?accion=listar_inscripciones&nocache=${uniqueId}`;
  
  console.log("Connecting to Google Sheets API:", url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("API Response Status:", data.result);
    if (data.result === "success") {
      console.log("✅ Success! Total registered entries found:", data.count);
      if (data.message && data.message.length > 0) {
        console.log("First entry name:", data.message[0].nombre_completo_del_esposo || data.message[0].nombre);
      }
    } else {
      console.log("❌ API returned error:", data.message);
    }
  } catch (err) {
    console.error("❌ Network Error connecting to Apps Script:", err.message);
  }
}

testBackend();
