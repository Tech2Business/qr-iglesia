async function testCheckin() {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKE4dV_kGmoWwwkUGcq7bwI39kCU4tGXHFrBRdUuCz79qZxh42hmdmP15ErkvEQ_0/exec";
  const uniqueId = new Date().getTime() + "_" + Math.random();
  const payload = {
    accion: "marcar_asistencia",
    fila: 4,
    nombre: "Esposo - prueba y Esposa - prueba",
    detalles: "Test Automatizado API"
  };
  
  console.log("Sending check-in request to SCRIPT_URL...");
  try {
    const res = await fetch(`${SCRIPT_URL}?uid=${uniqueId}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("Check-in API Response Status:", data.result);
    if (data.result === "success") {
      console.log("✅ Success! Check-in registered in Sheets 'qr':", data.message);
    } else {
      console.log("❌ Check-in failed:", data.message);
    }
  } catch (err) {
    console.error("❌ Network Error connecting to check-in endpoint:", err.message);
  }
}

testCheckin();
