/**
 * Lógica del Lector de Códigos QR - qr-iglesia
 * 
 * Gestiona el acceso a la cámara trasera mediante Html5Qrcode, descarga la 
 * base de datos para validación ultra-rápida sin latencia y registra
 * la asistencia en tiempo real en la hoja "qr".
 */

// =================================================================
// ⚙️ CONFIGURACIÓN DEL SISTEMA
// =================================================================
// Debe coincidir con la URL de app.js
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKE4dV_kGmoWwwkUGcq7bwI39kCU4tGXHFrBRdUuCz79qZxh42hmdmP15ErkvEQ_0/exec";
const DEVELOPMENT_MODE = false; 

// =================================================================
// 📊 ESTADOS GLOBALES DEL ESCÁNER
// =================================================================
let html5QrCode;
let listaInscritos = [];
let listaAsistencias = [];
let isScanning = true;

// MOCK DATA para pruebas locales (debe coincidir con la estructura de app.js)
const MOCK_INSCRIPCIONES = [
  { fila: 2, nombre_completo: "Carlos Eduardo Mendoza", telefono: "99887766", correo: "carlos@iglesia.org", tipo_miembro: "Miembro Activo", grupo: "Jóvenes" },
  { fila: 3, nombre_completo: "María Auxiliadora Santos", telefono: "88776655", correo: "maria@iglesia.org", tipo_miembro: "Líder de Célula", grupo: "Damas" },
  { fila: 4, nombre_completo: "Juan Francisco Ortíz", telefono: "77665544", correo: "juan@gmail.com", tipo_miembro: "Visita", grupo: "Caballeros" },
  { fila: 5, nombre_completo: "Sofía Valentina Barahona", telefono: "99001122", correo: "sofia@hotmail.com", tipo_miembro: "Miembro Activo", grupo: "Jóvenes" },
  { fila: 6, nombre_completo: "Luis Alonso López Caceres", telefono: "33445566", correo: "luis.lopez@yahoo.com", tipo_miembro: "Pastor", grupo: "Ministerio" },
  { fila: 7, nombre_completo: "Rebeca Abigail Martínez", telefono: "55667788", correo: "rebeca@outlook.com", tipo_miembro: "Miembro Activo", grupo: "Damas" },
  { fila: 8, nombre_completo: "Fernando José Rodríguez", telefono: "88990011", correo: "fernando@gmail.com", tipo_miembro: "Visita", grupo: "Caballeros" }
];

const MOCK_ASISTENCIAS = [
  { fecha: "2026-06-13T09:05:00.000Z", filaInscripcion: 2, nombre: "Carlos Eduardo Mendoza", estado: "ASISTENCIA" },
  { fecha: "2026-06-13T09:12:00.000Z", filaInscripcion: 4, nombre: "Juan Francisco Ortíz", estado: "ASISTENCIA" }
];

// =================================================================
// 📥 CARGA INICIAL DE DATOS
// =================================================================
window.onload = async function() {
  mostrarLoadingOverlay(true, "Descargando base de datos...");
  
  if (DEVELOPMENT_MODE) {
    console.log("[DevMode] Cargando datos mockeados para el escáner...");
    await new Promise(resolve => setTimeout(resolve, 600));
    listaInscritos = MOCK_INSCRIPCIONES;
    listaAsistencias = MOCK_ASISTENCIAS;
    mostrarLoadingOverlay(false);
    iniciarCamara();
    return;
  }

  if (SCRIPT_URL.includes("PEGAR_AQUI")) {
    mostrarLoadingOverlay(false);
    alert("⚠️ Configuración requerida:\n\nPor favor pegue la URL de su Web App de Google Apps Script en la línea 11 de frontend/js/scanner.js y desactive el DEVELOPMENT_MODE.");
    return;
  }

  try {
    const cacheBuster = `&nocache=${new Date().getTime()}`;
    
    // Descargar Inscritos
    const resInscritos = await fetch(`${SCRIPT_URL}?accion=listar_inscripciones${cacheBuster}`);
    const dataInscritos = await resInscritos.json();
    if (dataInscritos.result !== "success") throw new Error(dataInscritos.message);
    listaInscritos = dataInscritos.message;

    // Descargar Asistencias existentes en la hoja "qr"
    const resAsistencias = await fetch(`${SCRIPT_URL}?accion=listar_asistencias${cacheBuster}`);
    const dataAsistencias = await resAsistencias.json();
    if (dataAsistencias.result !== "success") throw new Error(dataAsistencias.message);
    listaAsistencias = dataAsistencias.message;

    mostrarLoadingOverlay(false);
    iniciarCamara();

  } catch(err) {
    console.error(err);
    alert("❌ Error al cargar bases de datos del servidor. Verifique su conexión de red.");
    mostrarLoadingOverlay(true, "Error de sincronización.");
  }
};

// =================================================================
// 📷 INICIO Y CONTROL DE CÁMARA
// =================================================================
function iniciarCamara() {
  html5QrCode = new Html5Qrcode("reader");
  
  const config = { 
    fps: 10, 
    qrbox: function(width, height) {
      // Caja de escaneo dinámica adaptada al tamaño del visor móvil
      const minSize = Math.min(width, height);
      const boxSize = Math.floor(minSize * 0.65);
      return { width: boxSize, height: boxSize };
    },
    aspectRatio: 1.0
  };
  
  // Preferir la cámara trasera ("environment")
  html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .then(() => {
      console.log("Cámara iniciada correctamente.");
    })
    .catch(err => {
      console.error(err);
      alert("❌ Error: No se pudo acceder a la cámara. Asegúrese de otorgar permisos de cámara en su navegador.");
    });
}

function onScanSuccess(decodedText) {
  if (!isScanning) return;
  
  // 1. Pausar cámara inmediatamente para evitar lecturas repetitivas consecutivas
  html5QrCode.pause();
  isScanning = false;
  
  // 2. Procesar lectura del código
  validarQR(decodedText);
}

// =================================================================
// 🛡️ LÓGICA DE VALIDACIÓN Y COINCIDENCIA
// =================================================================
async function validarQR(textoQR) {
  const resultArea = document.getElementById("resultArea");
  const btnReset = document.getElementById("btnReset");
  
  resultArea.classList.remove("hidden");
  btnReset.classList.remove("hidden");

  // Normalización de texto para comparación segura (letras, números, minúsculas, sin acentos)
  const normalizar = (t) => t ? t.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").trim() : "";

  // 1. Analizar el formato esperado: "ASISTENCIA_QR: [Fila] | [Nombre]"
  let filaQR = null;
  let nombreQR = "";

  if (textoQR.startsWith("ASISTENCIA_QR:")) {
    try {
      const cuerpo = textoQR.replace("ASISTENCIA_QR:", "").trim();
      const partes = cuerpo.split("|");
      if (partes.length >= 2) {
        filaQR = parseInt(partes[0].trim(), 10);
        nombreQR = partes[1].trim();
      }
    } catch(e) {
      console.warn("Fallo al parsear QR estructurado: ", e);
    }
  }

  // Búsqueda del inscrito en la base de datos en memoria
  let encontrado = null;
  let nombreEncontradoMatch = "";

  if (filaQR && !isNaN(filaQR)) {
    // Si tiene la fila, buscamos estrictamente por el número de fila
    const candidato = listaInscritos.find(item => item.fila === filaQR);
    
    // Verificación de seguridad secundaria: ¿El nombre del QR coincide con alguno de los nombres en esa fila de la DB?
    if (candidato) {
      const nombreQRClean = normalizar(nombreQR);
      let coincideNombre = false;
      
      // Buscamos en cualquier columna que contenga "nombre", "completo", "esposo", "esposa"
      const regexNombreKey = /nombre|completo|esposo|esposa/i;
      Object.keys(candidato).forEach(key => {
        if (regexNombreKey.test(key) && !key.includes("tel") && !key.includes("contacto")) {
          const dbNombreClean = normalizar(candidato[key]);
          if (dbNombreClean && (dbNombreClean.includes(nombreQRClean) || nombreQRClean.includes(dbNombreClean))) {
            coincideNombre = true;
            nombreEncontradoMatch = candidato[key]; // Guardamos el nombre exacto de la DB que coincidió
          }
        }
      });

      if (coincideNombre) {
        encontrado = candidato;
      } else {
        console.warn(`Verificación fallida: Fila ${filaQR} en DB pertenece a otro nombre.`);
      }
    }
  } else {
    // Fallback: Si no tiene formato estructurado, buscamos coincidencia difusa del texto completo en la base de datos
    const textoQRNorm = normalizar(textoQR);
    
    // Buscamos coincidencia en cualquier columna que contenga nombre
    const regexNombreKey = /nombre|completo|esposo|esposa/i;
    for (let i = 0; i < listaInscritos.length; i++) {
      const item = listaInscritos[i];
      let coincide = false;
      let dbName = "";
      
      Object.keys(item).forEach(key => {
        if (regexNombreKey.test(key) && !key.includes("tel") && !key.includes("contacto")) {
          const dbNombreClean = normalizar(item[key]);
          if (dbNombreClean && (textoQRNorm.includes(dbNombreClean) || dbNombreClean.includes(textoQRNorm))) {
            coincide = true;
            dbName = item[key];
          }
        }
      });
      
      if (coincide) {
        encontrado = item;
        nombreEncontradoMatch = dbName;
        break;
      }
    }
  }

  // Establecer el nombre del asistente: priorizar el nombre unificado del QR o el mapeado
  if (encontrado) {
    const infoMapeada = mapearDetallesVisuales(encontrado);
    nombreEncontradoMatch = nombreQR || infoMapeada.nombre;
  }

  // 2. Determinar Estado y Mostrar Resultados
  if (encontrado) {
    // Buscar si ya marcó asistencia esta persona específica en la lista local de asistencias
    const yaAsistio = listaAsistencias.some(a => 
      a.filaInscripcion === encontrado.fila && 
      a.estado === "ASISTENCIA" && 
      normalizar(a.nombre) === normalizar(nombreEncontradoMatch)
    );
    
    // Obtener campos adicionales dinámicos para mostrar en la tarjeta de éxito
    const infoMapeada = mapearDetallesVisuales(encontrado);

    if (yaAsistio) {
      // ⚠️ ADVERTENCIA: YA INGRESÓ ANTERIORMENTE
      playAudio("audioFail");
      
      resultArea.innerHTML = `
        <div class="result-card warning">
          <div class="result-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <h2 class="result-title">Ya Ingresó</h2>
          
          <div class="result-data-box">
            <p class="result-detail-text">${nombreEncontradoMatch}</p>
            <p style="font-size: 0.8rem; opacity: 0.9; margin-top: 0.25rem;">${infoMapeada.contacto}</p>
          </div>
          
          <div class="result-meta-badges">
            <span class="result-meta-badge">Fila #${encontrado.fila}</span>
            <span class="result-meta-badge">${infoMapeada.grupo}</span>
          </div>
          
          <p style="margin-top: 1rem; font-size: 0.85rem; font-weight: bold;">
            Esta persona ya fue registrada anteriormente.
          </p>
        </div>
      `;
    } else {
      // ✅ ÉXITO: ACCESO PERMITIDO (MARCAR ASISTENCIA)
      playAudio("audioOk");
      
      resultArea.innerHTML = `
        <div class="result-card success">
          <div class="result-icon"><i class="fas fa-check-circle"></i></div>
          <h2 class="result-title">Acceso Permitido</h2>
          
          <div class="result-data-box">
            <p class="result-detail-text">${nombreEncontradoMatch}</p>
            <p style="font-size: 0.8rem; opacity: 0.9; margin-top: 0.25rem;">${infoMapeada.contacto}</p>
          </div>
          
          <div class="result-meta-badges">
            <span class="result-meta-badge">Fila #${encontrado.fila}</span>
            <span class="result-meta-badge">${infoMapeada.grupo}</span>
          </div>
          
          <p id="markingStatusText" style="margin-top: 1rem; font-size: 0.85rem; opacity: 0.9;">
            Registrando entrada en Google Sheets...
          </p>
        </div>
      `;
      
      // Lanzar marcado real de asistencia para la persona específica
      marcarAsistenciaEnServidor(encontrado, nombreEncontradoMatch);
    }
  } else {
    // ❌ ERROR: ACCESO DENEGADO (NO ENCONTRADO EN LA LISTA)
    playAudio("audioFail");
    
    resultArea.innerHTML = `
      <div class="result-card danger">
        <div class="result-icon"><i class="fas fa-times-circle"></i></div>
        <h2 class="result-title">Acceso Denegado</h2>
        
        <div class="result-data-box">
          <p class="result-detail-text" style="font-size: 1.1rem;">Invitado No Registrado</p>
          <p style="font-size: 0.75rem; opacity: 0.85; margin-top: 0.5rem; word-break: break-all; font-family: monospace;">
            Datos leídos: ${textoQR}
          </p>
        </div>
        
        <p style="margin-top: 1rem; font-size: 0.85rem;">
          El código QR no coincide con ningún inscrito en el sistema.
        </p>
      </div>
    `;
  }
}

/**
 * Manda la petición al Google Sheets para escribir la asistencia en la hoja "qr"
 */
async function marcarAsistenciaEnServidor(inscrito, nombreParaMarcar) {
  const statusText = document.getElementById("markingStatusText");
  
  const registroAsistenciaLocal = {
    fecha: new Date().toISOString(),
    filaInscripcion: inscrito.fila,
    nombre: nombreParaMarcar,
    estado: "ASISTENCIA"
  };

  // Agregar a la lista local para evitar duplicación instantánea en la misma sesión
  listaAsistencias.push(registroAsistenciaLocal);

  if (DEVELOPMENT_MODE) {
    console.log(`[DevMode] Entrada guardada en memoria local para fila ${inscrito.fila}.`);
    if (statusText) statusText.innerText = "✅ Entrada marcada en base local (Modo Desarrollo).";
    return;
  }

  try {
    const uniqueId = new Date().getTime() + "_" + Math.random();
    const response = await fetch(`${SCRIPT_URL}?uid=${uniqueId}`, {
      method: "POST",
      body: JSON.stringify({
        accion: "marcar_asistencia",
        fila: inscrito.fila,
        nombre: nombreParaMarcar,
        detalles: "Registrado por Lector QR Cámara"
      })
    });

    const data = await response.json();
    if (data.result === "success") {
      if (statusText) statusText.innerText = "✅ Entrada guardada correctamente en Google Sheets.";
    } else {
      throw new Error(data.message);
    }
  } catch(err) {
    console.error("Error al registrar asistencia en el servidor: ", err);
    if (statusText) {
      statusText.innerHTML = "⚠️ Error al guardar en Sheets. Guardado en memoria temporal local.";
      statusText.style.color = "#fecdd3";
    }
  }
}

function reiniciarScanner() {
  document.getElementById("resultArea").classList.add("hidden");
  document.getElementById("btnReset").classList.add("hidden");
  document.getElementById("resultArea").innerHTML = "";
  
  isScanning = true;
  if (html5QrCode) {
    html5QrCode.resume();
  }
}

// =================================================================
// 🛠️ UTILERÍAS / AUXILIARES
// =================================================================
function mostrarLoadingOverlay(show, text = "") {
  const overlay = document.getElementById("loadingOverlay");
  const overlayText = document.getElementById("loadingText");
  if (overlay) {
    if (show) {
      if (overlayText) overlayText.innerText = text;
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
  }
}

function mapearDetallesVisuales(obj) {
  let esposoNombre = "";
  let esposaNombre = "";
  let esposoTelefono = "";
  let esposaTelefono = "";

  Object.keys(obj).forEach(key => {
    const keyLower = key.toLowerCase();
    const valorStr = obj[key] ? obj[key].toString().trim() : "";
    if (valorStr) {
      if (keyLower.includes("esposo")) {
        if (keyLower.includes("tel") || keyLower.includes("contacto")) {
          esposoTelefono = valorStr;
        } else {
          esposoNombre = valorStr;
        }
      } else if (keyLower.includes("esposa")) {
        if (keyLower.includes("tel") || keyLower.includes("contacto")) {
          esposaTelefono = valorStr;
        } else {
          esposaNombre = valorStr;
        }
      }
    }
  });

  // Intentar obtener teléfonos de columnas genéricas
  if (!esposoTelefono) esposoTelefono = obj.tel_ || "";
  if (!esposaTelefono) esposaTelefono = obj.tel__2 || "";

  let nombre = "";
  if (esposoNombre && esposaNombre) {
    nombre = `${esposoNombre} y ${esposaNombre}`;
  } else {
    nombre = esposoNombre || esposaNombre || obj.nombre_completo || obj.nombre || "Sin Nombre";
  }

  let contacto = "";
  if (esposoTelefono && esposaTelefono) {
    contacto = `Tel: ${esposoTelefono} / ${esposaTelefono}`;
  } else {
    contacto = esposoTelefono || esposaTelefono || obj.telefono || obj.celular || obj.correo || "";
  }

  const grupo = obj.grupo || obj.tipo_miembro || "Pase General";

  return { nombre, contacto, grupo };
}

function playAudio(elementId) {
  try {
    const audio = document.getElementById(elementId);
    if (audio) {
      audio.currentTime = 0; // Reiniciar reproducción si ya estaba sonando
      audio.play();
    }
  } catch(e) {
    console.warn("Fallo al reproducir audio: ", e);
  }
}
