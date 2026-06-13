/**
 * Google Apps Script - Backend para qr-iglesia
 * 
 * Este script se debe pegar en el editor de Apps Script de tu Google Sheet
 * (Extensiones > Apps Script) y desplegarse como Aplicación Web.
 * 
 * Permite:
 * 1. Leer dinámicamente la hoja "INSCRIPCIONES".
 * 2. Leer y escribir registros de asistencia únicamente en la hoja "qr".
 */

// Cabeceras CORS necesarias para responder a las llamadas web
function crearRespuesta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return procesarPeticion(e);
}

function doPost(e) {
  return procesarPeticion(e);
}

function procesarPeticion(e) {
  // Inicialización de parámetros
  var params = {};
  
  // Si es GET o POST con parámetros URL
  if (e && e.parameter) {
    for (var key in e.parameter) {
      params[key] = e.parameter[key];
    }
  }
  
  // Si es POST con JSON en el body
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (var key in body) {
        params[key] = body[key];
      }
    } catch(err) {
      // Ignorar si no es JSON válido
    }
  }
  
  var accion = params.accion;
  if (!accion) {
    return crearRespuesta({ result: "error", message: "Acción no especificada." });
  }
  
  var ss;
  try {
    var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSpreadsheet) {
      ss = SpreadsheetApp.openById(activeSpreadsheet.getId());
    } else {
      // Fallback a script independiente usando el ID de la hoja de cálculo
      ss = SpreadsheetApp.openById("1utWdlMWBR70CLNPyq_yKFvd3IfwwME8K6xHgmQsqxX4");
    }
  } catch(err) {
    try {
      // Re-intento forzando el ID directamente
      ss = SpreadsheetApp.openById("1utWdlMWBR70CLNPyq_yKFvd3IfwwME8K6xHgmQsqxX4");
    } catch(err2) {
      return crearRespuesta({ result: "error", message: "No se pudo abrir el archivo de Google Sheets. Detalles: " + err2.toString() });
    }
  }

  try {
    switch (accion) {
      case "listar_inscripciones":
        return listarInscripciones(ss);
        
      case "listar_asistencias":
        return listarAsistencias(ss);
        
      case "marcar_asistencia":
        return marcarAsistencia(ss, params.fila, params.nombre, params.detalles);
        
      case "registrar_envio":
        return registrarEnvio(ss, params.fila, params.nombre, params.tipoEnvio);
        
      case "debug":
        return debugSistemas(ss);
        
      default:
        return crearRespuesta({ result: "error", message: "Acción no reconocida: " + accion });
    }
  } catch(err) {
    return crearRespuesta({ result: "error", message: "Error interno: " + err.toString() });
  }
}

/**
 * Función de diagnóstico para listar todas las pestañas de la hoja de cálculo.
 */
function debugSistemas(ss) {
  var sheets = ss.getSheets();
  var nombresHojas = sheets.map(function(s) {
    return {
      nombre: s.getName(),
      id: s.getSheetId(),
      filas: s.getLastRow(),
      columnas: s.getLastColumn()
    };
  });
  
  var infoInscripciones = {};
  var sheet = ss.getSheetByName("INSCRIPCIONES");
  if (sheet) {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var rowsToRead = Math.min(lastRow, 5);
    var data = [];
    if (rowsToRead > 0 && lastCol > 0) {
      data = sheet.getRange(1, 1, rowsToRead, lastCol).getValues();
    }
    
    // Buscar la fila de cabeceras usando coincidencia de palabras clave comunes
    var headerRowIndex = 0;
    var maxMatches = 0;
    var keywords = [/fecha/i, /nombre/i, /esposo/i, /esposa/i, /tel/i, /pago/i, /comprobante/i];
    
    var filasBuscar = Math.min(data.length, 15);
    for (var i = 0; i < filasBuscar; i++) {
      var matches = 0;
      for (var j = 0; j < data[i].length; j++) {
        var cellVal = data[i][j] ? data[i][j].toString().trim() : "";
        if (cellVal !== "") {
          for (var k = 0; k < keywords.length; k++) {
            if (keywords[k].test(cellVal)) {
              matches++;
              break;
            }
          }
        }
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        headerRowIndex = i;
      }
    }
    
    // Fallback si no se encuentran suficientes coincidencias
    if (maxMatches < 2) {
      for (var i = 0; i < data.length; i++) {
        var tieneContenido = data[i].some(function(cell) {
          return cell !== null && cell !== undefined && cell.toString().trim() !== "";
        });
        if (tieneContenido) {
          headerRowIndex = i;
          break;
        }
      }
    }
    
    var headersReal = [];
    if (data.length > headerRowIndex) {
      var seenKeysReal = {};
      headersReal = data[headerRowIndex].map(function(h, idx) {
        var key = h.toString().trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9_]/g, "_");
        if (!key) {
          key = "col_" + (idx + 1);
        }
        if (seenKeysReal[key]) {
          seenKeysReal[key]++;
          key = key + "_" + seenKeysReal[key];
        } else {
          seenKeysReal[key] = 1;
        }
        return key;
      });
    }

    // Generar cabeceras de prueba de la primera fila
    var headersTest = [];
    if (data.length > 0) {
      headersTest = data[0].map(function(h) {
        return h.toString().trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9_]/g, "_");
      });
    }
    
    infoInscripciones = {
      filasLeidas: data.length,
      headerRowIndexDetectado: headerRowIndex,
      coincidenciasPalabrasClave: maxMatches,
      cabecerasDetectadas: headersReal,
      cabecerasGeneradas: headersTest,
      primeraFila: data[0] || null,
      segundaFila: data[1] || null,
      terceraFila: data[2] || null,
      cuartaFila: data[3] || null
    };
  }
  
  return crearRespuesta({
    result: "success",
    documento: ss.getName(),
    pestanas: nombresHojas,
    debugInscripciones: infoInscripciones
  });
}

/**
 * Lee la hoja "INSCRIPCIONES" y devuelve los datos estructurados dinámicamente
 * basándose en los nombres de las columnas detectadas de forma inteligente.
 */
function listarInscripciones(ss) {
  var sheet = ss.getSheetByName("INSCRIPCIONES");
  if (!sheet) {
    return crearRespuesta({ result: "error", message: "La hoja 'INSCRIPCIONES' no existe en el documento." });
  }
  
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return crearRespuesta({ result: "success", message: [], count: 0 });
  }
  
  // Buscar la fila de cabeceras usando coincidencia de palabras clave comunes
  var headerRowIndex = 0;
  var maxMatches = 0;
  var keywords = [/fecha/i, /nombre/i, /esposo/i, /esposa/i, /tel/i, /pago/i, /comprobante/i];
  
  var filasBuscar = Math.min(data.length, 15);
  for (var i = 0; i < filasBuscar; i++) {
    var matches = 0;
    for (var j = 0; j < data[i].length; j++) {
      var cellVal = data[i][j] ? data[i][j].toString().trim() : "";
      if (cellVal !== "") {
        for (var k = 0; k < keywords.length; k++) {
          if (keywords[k].test(cellVal)) {
            matches++;
            break;
          }
        }
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      headerRowIndex = i;
    }
  }
  
  // Fallback si no se encuentran suficientes coincidencias (menos de 2 palabras clave)
  if (maxMatches < 2) {
    for (var i = 0; i < data.length; i++) {
      var tieneContenido = data[i].some(function(cell) {
        return cell !== null && cell !== undefined && cell.toString().trim() !== "";
      });
      if (tieneContenido) {
        headerRowIndex = i;
        break;
      }
    }
  }
  
  // Si no se encuentra ninguna fila con contenido, retornar vacío
  if (data.length <= headerRowIndex) {
    return crearRespuesta({ result: "success", message: [], count: 0 });
  }
  
  // Detectar cabeceras en la fila encontrada
  var headers = [];
  var seenKeys = {};
  if (data.length > headerRowIndex) {
    headers = data[headerRowIndex].map(function(h, idx) {
      var key = h.toString().trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[^a-z0-9_]/g, "_"); // Reemplazar especiales por guión bajo
      if (!key) {
        key = "col_" + (idx + 1);
      }
      if (seenKeys[key]) {
        seenKeys[key]++;
        key = key + "_" + seenKeys[key];
      } else {
        seenKeys[key] = 1;
      }
      return key;
    });
  }
  
  var registros = [];
  
  // Recorrer las filas de datos (de la fila siguiente a las cabeceras en adelante)
  for (var i = headerRowIndex + 1; i < data.length; i++) {
    var fila = data[i];
    var vacia = true;
    var registro = {
      fila: i + 1 // Número de fila real de Excel (1-indexed)
    };
    
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      if (key) {
        var valor = fila[j];
        registro[key] = valor;
        if (valor !== "" && valor !== null && valor !== undefined) {
          vacia = false;
        }
      }
    }
    
    // Si la fila tiene al menos un dato, la agregamos
    if (!vacia) {
      registros.push(registro);
    }
  }
  
  return crearRespuesta({
    result: "success",
    message: registros,
    count: registros.length
  });
}

/**
 * Obtiene o crea la hoja "qr" para registrar las asistencias.
 */
function obtenerHojaQR(ss) {
  var sheet = ss.getSheetByName("qr");
  if (!sheet) {
    sheet = ss.insertSheet("qr");
    // Crear cabeceras
    sheet.appendRow(["Fecha y Hora", "Fila Inscripción", "Nombre", "Acción/Estado", "Detalles"]);
    // Formatear cabeceras (negrita)
    sheet.getRange("A1:E1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Lee la hoja "qr" y devuelve el listado de asistencias.
 */
function listarAsistencias(ss) {
  var sheet = obtenerHojaQR(ss);
  var data = sheet.getDataRange().getValues();
  
  var asistencias = [];
  if (data.length > 1) {
    for (var i = 1; i < data.length; i++) {
      asistencias.push({
        fecha: data[i][0],
        filaInscripcion: data[i][1],
        nombre: data[i][2],
        estado: data[i][3],
        detalles: data[i][4]
      });
    }
  }
  
  return crearRespuesta({
    result: "success",
    message: asistencias,
    count: asistencias.length
  });
}

/**
 * Escribe una fila de asistencia en la hoja "qr".
 */
function marcarAsistencia(ss, filaInscripcion, nombre, detalles) {
  if (!filaInscripcion || !nombre) {
    return crearRespuesta({ result: "error", message: "Faltan parámetros requeridos: 'fila' y 'nombre'." });
  }
  
  var sheet = obtenerHojaQR(ss);
  var fechaHora = new Date();
  
  // Agregar registro
  sheet.appendRow([
    fechaHora,
    parseInt(filaInscripcion, 10),
    nombre,
    "ASISTENCIA",
    detalles || ""
  ]);
  
  return crearRespuesta({
    result: "success",
    message: "Asistencia registrada exitosamente.",
    registro: {
      fecha: fechaHora,
      filaInscripcion: filaInscripcion,
      nombre: nombre,
      estado: "ASISTENCIA"
    }
  });
}

/**
 * Registra el envío del QR o un recordatorio en la hoja "qr" con un estado específico.
 */
function registrarEnvio(ss, filaInscripcion, nombre, tipoEnvio) {
  if (!filaInscripcion || !nombre) {
    return crearRespuesta({ result: "error", message: "Faltan parámetros requeridos: 'fila' y 'nombre'." });
  }
  
  var sheet = obtenerHojaQR(ss);
  var fechaHora = new Date();
  var estado = tipoEnvio === "recordatorio" ? "ENVIO_RECORDATORIO" : "ENVIO_QR";
  
  sheet.appendRow([
    fechaHora,
    parseInt(filaInscripcion, 10),
    nombre,
    estado,
    "Envío registrado por panel web"
  ]);
  
  return crearRespuesta({
    result: "success",
    message: "Envío registrado exitosamente.",
    registro: {
      fecha: fechaHora,
      filaInscripcion: filaInscripcion,
      nombre: nombre,
      estado: estado
    }
  });
}
