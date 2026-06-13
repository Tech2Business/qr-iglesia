/**
 * Lógica de Negocio y Conexión API - qr-iglesia
 * 
 * Gestiona la carga de datos de Google Sheets, cruce de asistencia en memoria,
 * filtros, búsquedas y el envío de invitaciones por WhatsApp.
 */

// =================================================================
// ⚙️ CONFIGURACIÓN DEL SISTEMA
// =================================================================
// Pegar aquí la URL de la Aplicación Web de Google Apps Script despues del despliegue:
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKE4dV_kGmoWwwkUGcq7bwI39kCU4tGXHFrBRdUuCz79qZxh42hmdmP15ErkvEQ_0/exec";

// Cambiar a false una vez enlazado y configurado el Apps Script para producción
const DEVELOPMENT_MODE = false; 

// URL pública donde estará alojado el proyecto para que los pases QR sean accesibles por los invitados
// Ejemplo: "https://tu-usuario.github.io/qr-iglesia/frontend"
let BASE_PUBLIC_URL = window.location.href.substring(0, window.location.href.lastIndexOf('/'));

// Plantillas escalables de recordatorios de cobro por WhatsApp (Metodología del proyecto original)
const MENSAJES_PAGO = [
  "¡Hola [NOMBRE]! Bendiciones. 👋 Te escribimos de la Comunidad Cristiana. Notamos que tu inscripción al evento ya está registrada. Para asegurar tu espacio y enviarte tu Pase QR, ¿nos podrías ayudar reportando o enviando al teléfono *+504 3205-5587* tu comprobante de pago? ¡Muchas gracias!\n\n*Por favor, no usar este Whatsapp para reportar pago*",
  "¡Bendiciones [NOMBRE]! Te saludamos de la iglesia. 🌟 Te escribimos para recordarte completar el registro para el evento enviando una foto de tu comprobante de pago al teléfono *+504 3205-5587*. Si ya realizaste el pago, por favor comparte el comprobante para habilitar tu Pase de Entrada. ¡Gracias!\n\n*Por favor, no usar este Whatsapp para reportar pago*",
  "¡Hola [NOMBRE]! Espero que estés muy bien. Te escribimos para dar seguimiento a tu registro del evento. 💳 Aún tenemos pendiente el reporte de tu pago. Recuerda que con el comprobante te enviaremos de inmediato tu Pase Digital con código QR para el acceso. ¡Cualquier duda estamos a la orden!\n\n*Por favor, no usar este Whatsapp para reportar pago*",
  "¡Saludos herman@s! Esperamos que se encuentren muy bien. Nos estamos organizando para el evento y queremos asegurar que todos tengan su lugar reservado. [NOMBRE], notamos que aún no has reportado tu comprobante. Por favor ayúdanos enviándolo al teléfono *+504 3205-5587* para generar tu Pase de Entrada QR. ¡Muchas bendiciones!\n\n*Por favor, no usar este Whatsapp para reportar pago*",
  "¡Hola [NOMBRE]! Bendiciones. Nos encontramos en la fase final de confirmación de asistencia para el evento. ⏳ Para completar tu registro y enviarte tu pase de acceso con código QR, necesitamos verificar tu comprobante de pago, por favor ayúdanos enviándolo al teléfono *+504 3205-5587*. Si tienes algún inconveniente, háznoslo saber. ¡Te esperamos!\n\n*Por favor, no usar este Whatsapp para reportar pago*"
];

// =================================================================
// 📊 ESTADOS GLOBALES DE LA APLICACIÓN
// =================================================================
let inscritosRaw = [];
let asistenciasRaw = [];
let listaIntegrada = [];

// =================================================================
// 🧪 MOCK DATA PARA MODO DESARROLLO (Local)
// =================================================================
const MOCK_INSCRIPCIONES = [
  { fila: 2, nombre_completo: "Carlos Eduardo Mendoza", telefono: "99887766", correo: "carlos@iglesia.org", tipo_miembro: "Miembro Activo", grupo: "Jóvenes", doct__pago: "TRANS-99221" },
  { fila: 3, nombre_completo: "María Auxiliadora Santos", telefono: "88776655", correo: "maria@iglesia.org", tipo_miembro: "Líder de Célula", grupo: "Damas", doct__pago: "" },
  { fila: 4, nombre_completo: "Juan Francisco Ortíz", telefono: "77665544", correo: "juan@gmail.com", tipo_miembro: "Visita", grupo: "Caballeros", doct__pago: "TRANS-88112" },
  { fila: 5, nombre_completo: "Sofía Valentina Barahona", telefono: "99001122", correo: "sofia@hotmail.com", tipo_miembro: "Miembro Activo", grupo: "Jóvenes", doct__pago: "" },
  { fila: 6, nombre_completo: "Luis Alonso López Caceres", telefono: "33445566", correo: "luis.lopez@yahoo.com", tipo_miembro: "Pastor", grupo: "Ministerio", doct__pago: "TRANS-33221" },
  { fila: 7, nombre_completo: "Rebeca Abigail Martínez", telefono: "55667788", correo: "rebeca@outlook.com", tipo_miembro: "Miembro Activo", grupo: "Damas", doct__pago: "" },
  { fila: 8, nombre_completo: "Fernando José Rodríguez", telefono: "88990011", correo: "fernando@gmail.com", tipo_miembro: "Visita", grupo: "Caballeros", doct__pago: "" }
];

const MOCK_ASISTENCIAS = [
  { fecha: "2026-06-13T09:05:00.000Z", filaInscripcion: 2, nombre: "Carlos Eduardo Mendoza", estado: "ASISTENCIA" },
  { fecha: "2026-06-13T09:12:00.000Z", filaInscripcion: 4, nombre: "Juan Francisco Ortíz", estado: "ASISTENCIA" },
  { fecha: "2026-06-13T09:30:00.000Z", filaInscripcion: 6, nombre: "Luis Alonso López Caceres", estado: "ENVIO_QR" }
];

// =================================================================
// 🚀 INICIALIZACIÓN DE LA APLICACIÓN
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
  inicializarUI();
  cargarDatos();
});

function inicializarUI() {
  // Configurar campo de la URL Base del pase
  const baseInput = document.getElementById("basePublicUrlInput");
  if (baseInput) {
    baseInput.value = BASE_PUBLIC_URL;
    baseInput.addEventListener("change", (e) => {
      BASE_PUBLIC_URL = e.target.value.trim();
      renderizarTabla(filtrarDatos());
    });
  }

  // Escuchar eventos de búsqueda y filtros
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", aplicarFiltrosYRenderizar);

  const filterStatus = document.getElementById("filterStatus");
  
  // Referencias a tarjetas de estadísticas
  const cardTotal = document.getElementById("cardTotal");
  const cardPagados = document.getElementById("cardPagados");
  const cardPendientes = document.getElementById("cardPendientes");
  const cardPresentes = document.getElementById("cardPresentes");

  const actualizarTarjetasActivas = (valorFiltro) => {
    [cardTotal, cardPagados, cardPendientes, cardPresentes].forEach(c => {
      if (c) c.classList.remove("active-filter");
    });
    
    if (valorFiltro === "TODOS" && cardTotal) cardTotal.classList.add("active-filter");
    if (valorFiltro === "PAGADOS" && cardPagados) cardPagados.classList.add("active-filter");
    if (valorFiltro === "PENDIENTES" && cardPendientes) cardPendientes.classList.add("active-filter");
    if (valorFiltro === "PRESENTES" && cardPresentes) cardPresentes.classList.add("active-filter");
  };

  const seleccionarFiltroRapido = (tarjeta, valor) => {
    if (filterStatus) {
      filterStatus.value = valor;
    }
    actualizarTarjetasActivas(valor);
    aplicarFiltrosYRenderizar();
  };

  // Click en las tarjetas de estadísticas
  if (cardTotal) cardTotal.addEventListener("click", () => seleccionarFiltroRapido(cardTotal, "TODOS"));
  if (cardPagados) cardPagados.addEventListener("click", () => seleccionarFiltroRapido(cardPagados, "PAGADOS"));
  if (cardPendientes) cardPendientes.addEventListener("click", () => seleccionarFiltroRapido(cardPendientes, "PENDIENTES"));
  if (cardPresentes) cardPresentes.addEventListener("click", () => seleccionarFiltroRapido(cardPresentes, "PRESENTES"));

  // Cambio manual del SELECT
  if (filterStatus) {
    filterStatus.addEventListener("change", () => {
      actualizarTarjetasActivas(filterStatus.value);
      aplicarFiltrosYRenderizar();
    });
  }

  // Configurar colapso de Asistencia Leída
  const headerLeido = document.getElementById("headerLeido");
  const contentLeido = document.getElementById("contentLeido");
  const iconCollapseLeido = document.getElementById("iconCollapseLeido");
  
  if (headerLeido && contentLeido) {
    headerLeido.addEventListener("click", () => {
      const isCollapsed = contentLeido.classList.contains("collapsed") || 
                          contentLeido.style.maxHeight === "0px" || 
                          !contentLeido.style.maxHeight;
      
      if (isCollapsed) {
        // Expandir
        contentLeido.classList.remove("collapsed");
        contentLeido.style.maxHeight = contentLeido.scrollHeight + "px";
        if (iconCollapseLeido) {
          iconCollapseLeido.style.transform = "rotate(180deg)";
        }
        // Ajustar max-height a auto una vez termine la transición para que responda a cambios dinámicos
        setTimeout(() => {
          if (!contentLeido.classList.contains("collapsed")) {
            contentLeido.style.maxHeight = "none";
          }
        }, 300);
      } else {
        // Colapsar
        // Para colapsar suavemente, primero pasamos de 'none' al scrollHeight actual
        contentLeido.style.maxHeight = contentLeido.scrollHeight + "px";
        // Forzar reflow para que el navegador registre la altura explícita antes de animar a 0
        contentLeido.offsetHeight; 
        contentLeido.style.maxHeight = "0px";
        contentLeido.classList.add("collapsed");
        if (iconCollapseLeido) {
          iconCollapseLeido.style.transform = "rotate(0deg)";
        }
      }
    });
  }
  
  // Mostrar advertencia si está en modo desarrollo
  const devBanner = document.getElementById("devBanner");
  if (devBanner) {
    if (DEVELOPMENT_MODE) {
      devBanner.classList.remove("hidden");
    } else {
      devBanner.classList.add("hidden");
    }
  }
}

// =================================================================
// 📥 CARGA Y PROCESAMIENTO DE DATOS
// =================================================================
async function cargarDatos() {
  mostrarLoader(true, "Descargando base de datos...");
  
  if (DEVELOPMENT_MODE) {
    console.log("Cargando datos simulados (Modo Desarrollo)...");
    await new Promise(resolve => setTimeout(resolve, 800)); // Simular latencia de red
    inscritosRaw = MOCK_INSCRIPCIONES;
    asistenciasRaw = MOCK_ASISTENCIAS;
    integrarYMostrar();
    mostrarLoader(false);
    return;
  }

  if (SCRIPT_URL.includes("PEGAR_AQUI")) {
    mostrarLoader(false);
    alert("⚠️ Configuración requerida:\n\nPor favor pegue la URL de su Web App de Google Apps Script en la línea 9 de frontend/js/app.js y desactive el DEVELOPMENT_MODE.");
    return;
  }

  try {
    const cacheBuster = `&nocache=${new Date().getTime()}`;
    
    // 1. Descargar Inscripciones
    const responseInscritos = await fetch(`${SCRIPT_URL}?accion=listar_inscripciones${cacheBuster}`);
    const dataInscritos = await responseInscritos.json();
    
    if (dataInscritos.result !== "success") {
      throw new Error(dataInscritos.message || "Error al descargar inscripciones.");
    }
    inscritosRaw = dataInscritos.message;

    // 2. Descargar Asistencias/Registros de la hoja "qr"
    const responseAsistencias = await fetch(`${SCRIPT_URL}?accion=listar_asistencias${cacheBuster}`);
    const dataAsistencias = await responseAsistencias.json();
    
    if (dataAsistencias.result !== "success") {
      throw new Error(dataAsistencias.message || "Error al descargar asistencias.");
    }
    asistenciasRaw = dataAsistencias.message;

    integrarYMostrar();

  } catch (err) {
    console.error(err);
    alert("❌ Error de comunicación con el Google Sheet:\n" + err.message);
  } finally {
    mostrarLoader(false);
  }
}

/**
 * Cruza las inscripciones de "INSCRIPCIONES" con los registros de la hoja "qr".
 * Calcula si ya asistió, si tiene pases enviados y la fecha de la última acción.
 */
function integrarYMostrar() {
  listaIntegrada = [];

  inscritosRaw.forEach(persona => {
    const fila = persona.fila;
    
    // Encontrar nombres, teléfonos y pago analizando cabeceras dinámicamente
    const infoMapeada = mapearCamposDinamicos(persona);

    // Omitir filas vacías, de cabecera secundaria o de resumen sin nombres válidos
    if (!infoMapeada.nombre || infoMapeada.nombre === "Sin Nombre" || infoMapeada.nombre.trim() === "") {
      return;
    }

    // Helper para normalizar nombres para comparación
    const normalizar = (t) => t ? t.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").trim() : "";

    const esposoNombreNorm = normalizar(infoMapeada.esposoNombre);
    const esposaNombreNorm = normalizar(infoMapeada.esposaNombre);
    const nombreGenNorm = normalizar(infoMapeada.nombre);

    // Filtrar de asistenciasRaw los historiales correspondientes a esta persona/matrimonio (coincidencia por nombre o por fila como fallback)
    const historiales = asistenciasRaw.filter(reg => {
      // Caso 1: Coincide por número de fila
      if (reg.filaInscripcion === fila) return true;
      
      const regNombreNorm = normalizar(reg.nombre);
      if (!regNombreNorm) return false;
      
      // Caso 2: Coincide con cualquiera de los nombres del inscrito
      return (esposoNombreNorm && (regNombreNorm === esposoNombreNorm || regNombreNorm.includes(esposoNombreNorm) || esposoNombreNorm.includes(regNombreNorm))) ||
             (esposaNombreNorm && (regNombreNorm === esposaNombreNorm || regNombreNorm.includes(esposaNombreNorm) || esposaNombreNorm.includes(regNombreNorm))) ||
             (nombreGenNorm && (regNombreNorm === nombreGenNorm || regNombreNorm.includes(nombreGenNorm) || nombreGenNorm.includes(regNombreNorm)));
    });

    // Buscar registros de tipo "ASISTENCIA"
    const registroAsistencia = historiales.find(h => h.estado === "ASISTENCIA");

    // Filtrar historiales de envío y recordatorios por persona específica (según el nombre registrado en la hoja "qr")
    const enviosEsposo = historiales.filter(h => h.estado === "ENVIO_QR" && normalizar(h.nombre) === esposoNombreNorm);
    const enviosEsposa = historiales.filter(h => h.estado === "ENVIO_QR" && normalizar(h.nombre) === esposaNombreNorm);
    const enviosGen = historiales.filter(h => h.estado === "ENVIO_QR" && normalizar(h.nombre) === nombreGenNorm);

    const recsEsposo = historiales.filter(h => h.estado === "ENVIO_RECORDATORIO" && normalizar(h.nombre) === esposoNombreNorm);
    const recsEsposa = historiales.filter(h => h.estado === "ENVIO_RECORDATORIO" && normalizar(h.nombre) === esposaNombreNorm);
    const recsGen = historiales.filter(h => h.estado === "ENVIO_RECORDATORIO" && normalizar(h.nombre) === nombreGenNorm);

    const registroIntegrado = {
      fila: fila,
      datosOriginales: persona,
      nombre: infoMapeada.nombre,
      esposoNombre: infoMapeada.esposoNombre,
      esposoTelefono: infoMapeada.esposoTelefono,
      esposaNombre: infoMapeada.esposaNombre,
      esposaTelefono: infoMapeada.esposaTelefono,
      telefono: infoMapeada.esposoTelefono || infoMapeada.esposaTelefono || "",
      email: infoMapeada.email,
      pagado: infoMapeada.pagado,
      valorPago: infoMapeada.valorPago,
      detallesAdicionales: infoMapeada.detalles,
      
      asistio: !!registroAsistencia,
      fechaAsistencia: registroAsistencia ? registroAsistencia.fecha : null,
      
      esposoQRCount: enviosEsposo.length,
      esposoQRFecha: enviosEsposo.length > 0 ? enviosEsposo[enviosEsposo.length - 1].fecha : null,
      esposoRecCount: recsEsposo.length,
      esposoRecFecha: recsEsposo.length > 0 ? recsEsposo[recsEsposo.length - 1].fecha : null,

      esposaQRCount: enviosEsposa.length,
      esposaQRFecha: enviosEsposa.length > 0 ? enviosEsposa[enviosEsposa.length - 1].fecha : null,
      esposaRecCount: recsEsposa.length,
      esposaRecFecha: recsEsposa.length > 0 ? recsEsposa[recsEsposa.length - 1].fecha : null,

      genQRCount: enviosGen.length,
      genQRFecha: enviosGen.length > 0 ? enviosGen[enviosGen.length - 1].fecha : null,
      genRecCount: recsGen.length,
      genRecFecha: recsGen.length > 0 ? recsGen[recsGen.length - 1].fecha : null
    };

    listaIntegrada.push(registroIntegrado);
  });

  // Renderizar
  actualizarEstadisticas();
  aplicarFiltrosYRenderizar();
}

/**
 * Mapeo inteligente y difuso de las columnas del Google Sheet
 * para extraer Nombre, Teléfono, Correo y Comprobante de Pago.
 */
function mapearCamposDinamicos(obj) {
  let esposoNombre = "";
  let esposoTelefono = "";
  let esposaNombre = "";
  let esposaTelefono = "";
  let email = "";
  let pagado = false;
  let valorPago = "";
  let detalles = [];
  let nombreEncontradoEnColumnas = false;

  // Expresiones regulares
  const regexEsposo = /esposo/i;
  const regexEsposa = /esposa/i;
  const regexNombreGen = /nombre|completo|asistente|persona|invitado/i;
  const regexEmail = /correo|email|mail|direccion/i;
  const regexPago = /doct|pago|comprobante/i;

  Object.keys(obj).forEach(key => {
    if (key === "fila") return;

    const valorStr = obj[key] ? obj[key].toString().trim() : "";

    if (regexNombreGen.test(key)) {
      nombreEncontradoEnColumnas = true;
    }

    // Mapeo específico por columna
    if (regexEsposo.test(key)) {
      if (key.includes("tel") || key.includes("contacto")) {
        esposoTelefono = valorStr.replace(/[^\d+]/g, "");
      } else {
        esposoNombre = valorStr;
      }
    } else if (regexEsposa.test(key)) {
      if (key.includes("tel") || key.includes("contacto")) {
        esposaTelefono = valorStr.replace(/[^\d+]/g, "");
      } else {
        esposaNombre = valorStr;
      }
    } else if (key === "tel_") {
      // En tu hoja, 'tel_' es la columna 4 que va justo después de esposo
      esposoTelefono = valorStr.replace(/[^\d+]/g, "");
    } else if (key === "tel__2") {
      // 'tel__2' es la columna 6 que va justo después de esposa
      esposaTelefono = valorStr.replace(/[^\d+]/g, "");
    } else if (regexEmail.test(key) && !email) {
      email = valorStr;
    } else if (regexPago.test(key)) {
      valorPago = valorStr;
      if (valorStr !== "") {
        pagado = true;
      }
    } else {
      if (valorStr) {
        const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        detalles.push(`<strong>${label}:</strong> ${valorStr}`);
      }
    }
  });

  // Si no se asignaron teléfonos pero hay columnas genéricas de teléfono, asociarlas
  if (!esposoTelefono) {
    esposoTelefono = (obj.tel_ || obj.telefono || obj.tel || "").toString().replace(/[^\d+]/g, "");
  }
  if (!esposaTelefono) {
    esposaTelefono = (obj.tel__2 || obj.telefono_2 || "").toString().replace(/[^\d+]/g, "");
  }

  // Nombre para mostrar combinado o individual
  let nombreMostrar = "";
  if (esposoNombre && esposaNombre) {
    nombreMostrar = `${esposoNombre} y ${esposaNombre}`;
  } else {
    nombreMostrar = esposoNombre || esposaNombre || "";
  }

  // Fallback si no encuentra coincidencia de columnas de nombre
  if (!nombreMostrar && !nombreEncontradoEnColumnas) {
    const fallbackVal = obj.nombre || obj.nombre_completo || obj.esposo || Object.values(obj)[1] || "Sin Nombre";
    nombreMostrar = fallbackVal ? fallbackVal.toString().trim() : "Sin Nombre";
  }

  // Si no contiene al menos una letra, no se considera un nombre válido
  const tieneLetras = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(nombreMostrar);
  if (!tieneLetras) {
    nombreMostrar = "";
  }

  return {
    nombre: nombreMostrar ? nombreMostrar.toString().trim() : "",
    esposoNombre: esposoNombre ? esposoNombre.toString().trim() : "",
    esposoTelefono: esposoTelefono ? esposoTelefono.toString().trim() : "",
    esposaNombre: esposaNombre ? esposaNombre.toString().trim() : "",
    esposaTelefono: esposaTelefono ? esposaTelefono.toString().trim() : "",
    email: email ? email.toString().trim() : "",
    pagado: pagado,
    valorPago: valorPago ? valorPago.toString().trim() : "",
    detalles: detalles.join(' | ')
  };
}

// =================================================================
// 🎨 RENDERIZADO Y CONTROL DE INTERFAZ
// =================================================================
function actualizarEstadisticas() {
  const total = listaIntegrada.length;
  const presentes = listaIntegrada.filter(item => item.asistio).length;
  const pagados = listaIntegrada.filter(item => item.pagado).length;
  const pendientes = total - pagados;

  document.getElementById("statTotal").innerText = total;
  document.getElementById("statPresentes").innerText = presentes;
  document.getElementById("statPagados").innerText = pagados;
  document.getElementById("statPendientes").innerText = pendientes;
}

function filtrarDatos() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const filterVal = document.getElementById("filterStatus").value;

  return listaIntegrada.filter(item => {
    // 1. Filtrar por término de búsqueda (buscando en nombres individuales, teléfonos y correos para ser robustos)
    const nombreMatch = item.nombre ? item.nombre.toLowerCase().includes(query) : false;
    const esposoNombreMatch = item.esposoNombre ? item.esposoNombre.toLowerCase().includes(query) : false;
    const esposaNombreMatch = item.esposaNombre ? item.esposaNombre.toLowerCase().includes(query) : false;
    
    const esposoTelMatch = item.esposoTelefono ? item.esposoTelefono.includes(query) : false;
    const esposaTelMatch = item.esposaTelefono ? item.esposaTelefono.includes(query) : false;
    const telMatch = item.telefono ? item.telefono.includes(query) : false;
    
    const emailMatch = item.email ? item.email.toLowerCase().includes(query) : false;
    const detallesMatch = item.detallesAdicionales ? item.detallesAdicionales.toLowerCase().includes(query) : false;

    const matchSearch = nombreMatch || esposoNombreMatch || esposaNombreMatch || 
                        esposoTelMatch || esposaTelMatch || telMatch || 
                        emailMatch || detallesMatch;
    
    // 2. Filtrar por estado de asistencia y pago
    let matchStatus = true;
    if (filterVal === "PRESENTES") matchStatus = item.asistio === true;
    if (filterVal === "AUSENTES") matchStatus = item.asistio === false;
    if (filterVal === "PAGADOS") matchStatus = item.pagado === true;
    if (filterVal === "PENDIENTES") matchStatus = item.pagado === false;

    return matchSearch && matchStatus;
  });
}

function aplicarFiltrosYRenderizar() {
  const filtrados = filtrarDatos();
  renderizarTabla(filtrados);
}

/**
 * Crea la fila HTML (tr) correspondiente para cada registro con su respectivo contenido
 */
function crearFilaHTML(item) {
  const tr = document.createElement("tr");
  
  // Columna 1: Datos de la Persona
  let innerDetails = "";
  if (item.email) innerDetails += `<span><i class="far fa-envelope"></i> ${item.email}</span>`;
  if (item.detallesAdicionales) innerDetails += `<span style="opacity: 0.85;"> | ${item.detallesAdicionales}</span>`;

  // Badge visual del Estado del Pago
  let badgePago = item.pagado 
    ? `<span class="badge badge-success" style="font-size: 0.65rem; padding: 0.15rem 0.5rem;"><i class="fas fa-check-double"></i> Pagado</span>`
    : `<span class="badge badge-danger" style="font-size: 0.65rem; padding: 0.15rem 0.5rem;"><i class="fas fa-exclamation-triangle"></i> Pendiente</span>`;

  let infoContacto = "";
  if (item.esposoNombre && item.esposoTelefono) {
    infoContacto += `<span><i class="fab fa-whatsapp text-success"></i> <strong>Esposo:</strong> ${item.esposoTelefono} (${item.esposoNombre})</span> `;
  }
  if (item.esposaNombre && item.esposaTelefono) {
    if (infoContacto) infoContacto += `<br/>`;
    infoContacto += `<span><i class="fab fa-whatsapp text-success"></i> <strong>Esposa:</strong> ${item.esposaTelefono} (${item.esposaNombre})</span>`;
  }
  if (!infoContacto) {
    infoContacto = `<span><i class="fab fa-whatsapp text-success"></i> ${item.telefono || 'Sin teléfono'}</span>`;
  }

  const tdPersona = `
    <td>
      <div class="person-info-cell">
        <div class="person-name" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          ${item.nombre} ${badgePago}
        </div>
        <div class="person-detail">
          ${infoContacto}
          ${innerDetails ? `<br/>${innerDetails}` : ""}
        </div>
      </div>
    </td>
  `;

  // Columna 2: Estado de Asistencia
  let badgeAsistencia = "";
  if (item.asistio) {
    const horaStr = formatearFechaHora(item.fechaAsistencia);
    badgeAsistencia = `
      <td style="text-align: center;">
        <span class="badge badge-success"><i class="fas fa-check-circle"></i> Presente</span>
        <span style="display: block; font-size: 0.65rem; color: var(--text-muted); margin-top: 0.25rem;">${horaStr}</span>
      </td>
    `;
  } else {
    badgeAsistencia = `
      <td style="text-align: center;">
        <span class="badge badge-danger"><i class="far fa-clock"></i> Ausente</span>
      </td>
    `;
  }

  // Columna 3: Control y Acciones de Envío
  let htmlBotonAccion = "";
  let linkVerPase = "";

  if (item.pagado) {
    // 🟢 PAGADO
    let botonesQR = [];
    const urlPase = `${BASE_PUBLIC_URL}/pase.html?nombre=${encodeURIComponent(item.nombre)}&fila=${item.fila}`;
    
    // Caso 1: Tiene Esposo
    if (item.esposoNombre && item.esposoTelefono) {
      const idBtnEsposo = `btn-act-m-${item.fila}`;
      const idDateEsposo = `date-act-m-${item.fila}`;
      let textBtn = item.esposoQRCount > 0 ? `<i class="fas fa-redo"></i> Pase Esposo` : `<i class="fab fa-whatsapp"></i> Pase Esposo`;
      let classBtn = item.esposoQRCount > 0 ? "btn-secondary" : "btn-primary";
      let dateLabel = item.esposoQRFecha ? `<span id="${idDateEsposo}" style="font-size: 8px; color: var(--text-muted); display: block; margin-top: 2px;">Enviado: ${formatearFechaHora(item.esposoQRFecha)}</span>` : `<span id="${idDateEsposo}" style="font-size: 8px; color: var(--color-danger); display: block; margin-top: 2px;">No enviado</span>`;
      
      botonesQR.push(`
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
          <button id="${idBtnEsposo}" onclick="enviarPaseWhatsApp(${item.fila}, '${item.esposoNombre}', '${item.esposoTelefono}', '${urlPase}', '${idBtnEsposo}', '${idDateEsposo}')" 
                  class="btn ${classBtn} btn-mini w-full">
            ${textBtn}
          </button>
          ${dateLabel}
        </div>
      `);
    }
    
    // Caso 2: Tiene Esposa
    if (item.esposaNombre && item.esposaTelefono) {
      const idBtnEsposa = `btn-act-f-${item.fila}`;
      const idDateEsposa = `date-act-f-${item.fila}`;
      let textBtn = item.esposaQRCount > 0 ? `<i class="fas fa-redo"></i> Pase Esposa` : `<i class="fab fa-whatsapp"></i> Pase Esposa`;
      let classBtn = item.esposaQRCount > 0 ? "btn-secondary" : "btn-primary";
      let dateLabel = item.esposaQRFecha ? `<span id="${idDateEsposa}" style="font-size: 8px; color: var(--text-muted); display: block; margin-top: 2px;">Enviado: ${formatearFechaHora(item.esposaQRFecha)}</span>` : `<span id="${idDateEsposa}" style="font-size: 8px; color: var(--color-danger); display: block; margin-top: 2px;">No enviado</span>`;
      
      botonesQR.push(`
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%; margin-top: 6px;">
          <button id="${idBtnEsposa}" onclick="enviarPaseWhatsApp(${item.fila}, '${item.esposaNombre}', '${item.esposaTelefono}', '${urlPase}', '${idBtnEsposa}', '${idDateEsposa}')" 
                  class="btn ${classBtn} btn-mini w-full">
            ${textBtn}
          </button>
          ${dateLabel}
        </div>
      `);
    }
    
    // Caso 3: Fallback (inscrito individual)
    if (botonesQR.length === 0) {
      const idBtnGen = `btn-act-${item.fila}`;
      const idDateGen = `date-act-${item.fila}`;
      let textBtn = item.genQRCount > 0 ? `<i class="fas fa-redo"></i> Reenviar Pase` : `<i class="fab fa-whatsapp"></i> Enviar Pase`;
      let classBtn = item.genQRCount > 0 ? "btn-secondary" : "btn-primary";
      let dateLabel = item.genQRFecha ? `<span id="${idDateGen}" style="font-size: 8px; color: var(--text-muted); display: block; margin-top: 2px;">Enviado: ${formatearFechaHora(item.genQRFecha)}</span>` : `<span id="${idDateGen}" style="font-size: 8px; color: var(--color-danger); display: block; margin-top: 2px;">No enviado</span>`;
      
      botonesQR.push(`
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
          <button id="${idBtnGen}" onclick="enviarPaseWhatsApp(${item.fila}, '${item.nombre}', '${item.telefono}', '${urlPase}', '${idBtnGen}', '${idDateGen}')" 
                  class="btn ${classBtn} btn-mini w-full">
            ${textBtn}
          </button>
          ${dateLabel}
        </div>
      `);
    }
    
    linkVerPase = `<a href="${urlPase}" target="_blank" class="btn btn-secondary btn-mini w-full" style="text-align: center;"><i class="far fa-eye"></i> Ver Acceso</a>`;
    
    htmlBotonAccion = `<div style="display: flex; flex-direction: column; width: 100%; max-width: 140px; margin: 0 auto; gap: 4px;">${botonesQR.join("")}</div>`;
    linkVerPase = `<div style="display: flex; flex-direction: column; width: 100%; max-width: 120px; gap: 4px;">${linkVerPase}</div>`;
    
  } else {
    // 🔴 PENDIENTE
    let botonesRec = [];
    
    // Caso 1: Recordatorio Esposo
    if (item.esposoNombre && item.esposoTelefono) {
      const idBtnEsposo = `btn-act-m-${item.fila}`;
      const idDateEsposo = `date-act-m-${item.fila}`;
      let intentos = item.esposoRecCount || 0;
      let textRecBtn = intentos > 0 ? `Reenviar Cobro` : `Recordar Pago`;
      let width = Math.min((intentos / 5) * 100, 100);
      let colorBarra = intentos >= 3 ? "var(--color-danger)" : "var(--color-warning)";
      let dateLabel = item.esposoRecFecha ? `<span id="${idDateEsposo}" style="font-size: 8px; color: var(--text-muted); display: block; margin-top: 2px;">Cobro: ${formatearFechaHora(item.esposoRecFecha)}</span>` : `<span id="${idDateEsposo}" style="font-size: 8px; color: var(--color-danger); display: block; margin-top: 2px;">No enviado</span>`;

      botonesRec.push(`
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%; margin-bottom: 8px;">
          <button id="${idBtnEsposo}" onclick="enviarRecordatorioWhatsApp(${item.fila}, '${item.esposoNombre}', '${item.esposoTelefono}', ${intentos}, '${idBtnEsposo}', '${idDateEsposo}')" 
                  class="btn btn-danger btn-mini w-full">
            <i class="fab fa-whatsapp"></i> ${textRecBtn} (Esposo)
          </button>
          <div style="display: flex; justify-content: space-between; width: 100%; font-size: 8px; color: var(--text-muted); font-weight: bold; margin-top: 2px;">
            <span>Msg ${intentos + 1}</span>
            <span>Nivel ${intentos}/5</span>
          </div>
          <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-top: 2px;">
            <div style="width: ${width}%; height: 100%; background: ${colorBarra}; border-radius: 2px;"></div>
          </div>
          ${dateLabel}
        </div>
      `);
    }
    
    // Caso 2: Recordatorio Esposa
    if (item.esposaNombre && item.esposaTelefono) {
      const idBtnEsposa = `btn-act-f-${item.fila}`;
      const idDateEsposa = `date-act-f-${item.fila}`;
      let intentos = item.esposaRecCount || 0;
      let textRecBtn = intentos > 0 ? `Reenviar Cobro` : `Recordar Pago`;
      let width = Math.min((intentos / 5) * 100, 100);
      let colorBarra = intentos >= 3 ? "var(--color-danger)" : "var(--color-warning)";
      let dateLabel = item.esposaRecFecha ? `<span id="${idDateEsposa}" style="font-size: 8px; color: var(--text-muted); display: block; margin-top: 2px;">Cobro: ${formatearFechaHora(item.esposaRecFecha)}</span>` : `<span id="${idDateEsposa}" style="font-size: 8px; color: var(--color-danger); display: block; margin-top: 2px;">No enviado</span>`;

      botonesRec.push(`
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
          <button id="${idBtnEsposa}" onclick="enviarRecordatorioWhatsApp(${item.fila}, '${item.esposaNombre}', '${item.esposaTelefono}', ${intentos}, '${idBtnEsposa}', '${idDateEsposa}')" 
                  class="btn btn-danger btn-mini w-full">
            <i class="fab fa-whatsapp"></i> ${textRecBtn} (Esposa)
          </button>
          <div style="display: flex; justify-content: space-between; width: 100%; font-size: 8px; color: var(--text-muted); font-weight: bold; margin-top: 2px;">
            <span>Msg ${intentos + 1}</span>
            <span>Nivel ${intentos}/5</span>
          </div>
          <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-top: 2px;">
            <div style="width: ${width}%; height: 100%; background: ${colorBarra}; border-radius: 2px;"></div>
          </div>
          ${dateLabel}
        </div>
      `);
    }
    
    // Caso 3: Fallback
    if (botonesRec.length === 0) {
      const idBtnGen = `btn-act-${item.fila}`;
      const idDateGen = `date-act-${item.fila}`;
      let intentos = item.genRecCount || 0;
      let textRecBtn = intentos > 0 ? `Reenviar Cobro` : `Recordar Pago`;
      let width = Math.min((intentos / 5) * 100, 100);
      let colorBarra = intentos >= 3 ? "var(--color-danger)" : "var(--color-warning)";
      let dateLabel = item.genRecFecha ? `<span id="${idDateGen}" style="font-size: 8px; color: var(--text-muted); display: block; margin-top: 2px;">Cobro: ${formatearFechaHora(item.genRecFecha)}</span>` : `<span id="${idDateGen}" style="font-size: 8px; color: var(--color-danger); display: block; margin-top: 2px;">No enviado</span>`;

      botonesRec.push(`
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
          <button id="${idBtnGen}" onclick="enviarRecordatorioWhatsApp(${item.fila}, '${item.nombre}', '${item.telefono}', ${intentos}, '${idBtnGen}', '${idDateGen}')" 
                  class="btn btn-danger btn-mini w-full">
            <i class="fab fa-whatsapp"></i> ${textRecBtn}
          </button>
          <div style="display: flex; justify-content: space-between; width: 100%; font-size: 8px; color: var(--text-muted); font-weight: bold; margin-top: 2px;">
            <span>Msg ${intentos + 1}</span>
            <span>Nivel ${intentos}/5</span>
          </div>
          <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-top: 2px;">
            <div style="width: ${width}%; height: 100%; background: ${colorBarra}; border-radius: 2px;"></div>
          </div>
          ${dateLabel}
        </div>
      `);
    }
    
    htmlBotonAccion = `
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 140px; margin: 0 auto; gap: 4px;">
        ${botonesRec.join("")}
      </div>
    `;
    
    linkVerPase = "";
  }

  const tdAcciones = `
    <td>
      <div class="action-group" style="display: flex; justify-content: center; align-items: center; gap: 8px;">
        ${linkVerPase}
        <div style="display: flex; flex-direction: column; align-items: center;">
          ${htmlBotonAccion}
        </div>
      </div>
    </td>
  `;

  tr.innerHTML = tdPersona + badgeAsistencia + tdAcciones;
  return tr;
}

/**
 * Renderiza los registros divididos en "Asistencia Pendiente" y "Asistencia Leída"
 */
function renderizarTabla(lista) {
  const tbodyPendiente = document.getElementById("tablaPendiente");
  const tbodyLeido = document.getElementById("tablaLeido");
  const emptyPendiente = document.getElementById("emptyPendiente");
  const emptyLeido = document.getElementById("emptyLeido");

  // Limpiar tablas
  tbodyPendiente.innerHTML = "";
  tbodyLeido.innerHTML = "";

  // Filtrar
  const listaPendiente = lista.filter(item => !item.asistio);
  const listaLeido = lista.filter(item => item.asistio);

  // Actualizar contadores visuales en los encabezados
  document.getElementById("countPendiente").innerText = listaPendiente.length;
  document.getElementById("countLeido").innerText = listaLeido.length;

  // Renderizar Pendientes
  if (listaPendiente.length === 0) {
    emptyPendiente.classList.remove("hidden");
  } else {
    emptyPendiente.classList.add("hidden");
    listaPendiente.forEach(item => {
      tbodyPendiente.appendChild(crearFilaHTML(item));
    });
  }

  // Renderizar Leídos
  if (listaLeido.length === 0) {
    emptyLeido.classList.remove("hidden");
  } else {
    emptyLeido.classList.add("hidden");
    listaLeido.forEach(item => {
      tbodyLeido.appendChild(crearFilaHTML(item));
    });
  }
}

// =================================================================
// 📲 COMUNICACIÓN Y ACCIONES DE ENVÍO POR WHATSAPP
// =================================================================

/**
 * Envía el Pase de Entrada digital con código QR
 */
async function enviarPaseWhatsApp(fila, nombre, telefono, urlPase, idBtn, idDate) {
  if (!telefono || telefono.length < 5) {
    alert("⚠️ Este inscrito no tiene un número de teléfono válido para enviar WhatsApp.");
    return;
  }

  let msj = `¡Hola ${nombre}! Bendiciones. 👋\n\n`;
  msj += `Te compartimos tu Pase de Entrada con código QR para: *CONFERENCIA: VOLVIENDO AL DISEÑO ORIGINAL*. Por favor, preséntalo en la puerta al ingresar:\n\n`;
  msj += `*Descarga aquí tu invitación:*\n${urlPase}\n\n`;
  msj += `¡Te esperamos!`;

  let telLimpio = telefono.replace(/\D/g, '');
  if (telLimpio.length === 8) {
    telLimpio = '504' + telLimpio;
  }

  const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
  const urlBaseWA = esMovil ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send";
  const linkWhatsApp = `${urlBaseWA}?phone=${telLimpio}&text=${encodeURIComponent(msj)}`;

  window.open(linkWhatsApp, '_blank');

  const btn = document.getElementById(idBtn);
  const dateSpan = document.getElementById(idDate);
  if (btn) {
    btn.className = "btn btn-secondary btn-mini";
    btn.innerHTML = `<i class="fas fa-redo"></i> Reenviar Pase`;
  }
  if (dateSpan) {
    dateSpan.innerText = "Sincronizando...";
  }

  try {
    if (DEVELOPMENT_MODE) {
      const fechaActual = new Date().toISOString();
      asistenciasRaw.push({
        fecha: fechaActual,
        filaInscripcion: fila,
        nombre: nombre,
        estado: "ENVIO_QR"
      });
      console.log(`[DevMode] Envío de QR guardado localmente para fila ${fila}.`);
      setTimeout(() => {
        integrarYMostrar();
      }, 1000);
      return;
    }

    const uniqueId = new Date().getTime() + "_" + Math.random();
    const response = await fetch(`${SCRIPT_URL}?uid=${uniqueId}`, {
      method: "POST",
      body: JSON.stringify({
        accion: "registrar_envio",
        fila: fila,
        nombre: nombre,
        tipoEnvio: "qr"
      })
    });

    const data = await response.json();
    if (data.result === "success") {
      const responseAsistencias = await fetch(`${SCRIPT_URL}?accion=listar_asistencias&nocache=${new Date().getTime()}`);
      const dataAsistencias = await responseAsistencias.json();
      if (dataAsistencias.result === "success") {
        asistenciasRaw = dataAsistencias.message;
        integrarYMostrar();
      }
    }

  } catch(err) {
    console.error("Error post-envio QR: ", err);
    if (dateSpan) dateSpan.innerText = "⚠️ Error de registro";
  }
}

/**
 * Envía un mensaje de recordatorio de pago a través de WhatsApp (Mensajes escalonados)
 */
async function enviarRecordatorioWhatsApp(fila, nombre, telefono, intentos, idBtn, idDate) {
  if (!telefono || telefono.length < 5) {
    alert("⚠️ Este inscrito no tiene un número de teléfono válido para enviar WhatsApp.");
    return;
  }

  // Obtener plantilla según nivel de cobro (metodología original)
  const plantilla = MENSAJES_PAGO[Math.min(intentos, MENSAJES_PAGO.length - 1)];
  const msj = plantilla.replace("[NOMBRE]", nombre);

  let telLimpio = telefono.replace(/\D/g, '');
  if (telLimpio.length === 8) {
    telLimpio = '504' + telLimpio;
  }

  const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
  const urlBaseWA = esMovil ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send";
  const linkWhatsApp = `${urlBaseWA}?phone=${telLimpio}&text=${encodeURIComponent(msj)}`;

  window.open(linkWhatsApp, '_blank');

  const btn = document.getElementById(idBtn);
  const dateSpan = document.getElementById(idDate);
  if (btn) {
    btn.className = "btn btn-secondary btn-mini w-full";
    btn.innerHTML = `<i class="fas fa-redo"></i> Reenviar Cobro`;
  }
  if (dateSpan) {
    dateSpan.innerText = "Sincronizando...";
  }

  try {
    if (DEVELOPMENT_MODE) {
      const fechaActual = new Date().toISOString();
      asistenciasRaw.push({
        fecha: fechaActual,
        filaInscripcion: fila,
        nombre: nombre,
        estado: "ENVIO_RECORDATORIO"
      });
      console.log(`[DevMode] Envío de recordatorio guardado localmente para fila ${fila} (Intento #${intentos + 1}).`);
      setTimeout(() => {
        integrarYMostrar();
      }, 1000);
      return;
    }

    const uniqueId = new Date().getTime() + "_" + Math.random();
    const response = await fetch(`${SCRIPT_URL}?uid=${uniqueId}`, {
      method: "POST",
      body: JSON.stringify({
        accion: "registrar_envio",
        fila: fila,
        nombre: nombre,
        tipoEnvio: "recordatorio"
      })
    });

    const data = await response.json();
    if (data.result === "success") {
      const responseAsistencias = await fetch(`${SCRIPT_URL}?accion=listar_asistencias&nocache=${new Date().getTime()}`);
      const dataAsistencias = await responseAsistencias.json();
      if (dataAsistencias.result === "success") {
        asistenciasRaw = dataAsistencias.message;
        integrarYMostrar();
      }
    }

  } catch(err) {
    console.error("Error post-recordatorio: ", err);
    if (dateSpan) dateSpan.innerText = "⚠️ Error de registro";
  }
}

// =================================================================
// 🛠️ UTILERÍAS / AUXILIARES
// =================================================================
function mostrarLoader(show, text = "Cargando...") {
  const loader = document.getElementById("loaderOverlay");
  const loaderText = document.getElementById("loaderText");
  if (loader) {
    if (show) {
      if (loaderText) loaderText.innerText = text;
      loader.classList.remove("hidden");
    } else {
      loader.classList.add("hidden");
    }
  }
}

function forzarRecarga() {
  cargarDatos();
}

function formatearFechaHora(fechaInput) {
  if (!fechaInput) return "";
  try {
    const fecha = new Date(fechaInput);
    if (isNaN(fecha.getTime())) return "";
    
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const hora = String(fecha.getHours()).padStart(2, '0');
    const mins = String(fecha.getMinutes()).padStart(2, '0');
    
    return `${dia}/${mes} ${formatTimeNum(fecha.getHours())}:${formatTimeNum(fecha.getMinutes())}`;
  } catch(e) {
    return "";
  }
}

function formatTimeNum(num) {
  return String(num).padStart(2, '0');
}
