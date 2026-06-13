# Sistema de Asistencia QR - Iglesia

Este proyecto es una aplicación web premium responsiva diseñada para controlar de forma eficiente y elegante la asistencia a eventos de la iglesia mediante la lectura de códigos QR.

El sistema se compone de un frontend estático (HTML, CSS y JS) y un backend en la nube basado en **Google Sheets** y **Google Apps Script**.

---

## 🛠️ Guía de Instalación y Despliegue

Siga estos pasos para poner el sistema en funcionamiento:

### Paso 1: Configurar el Google Sheet
1. Abra su archivo de Google Sheets en Google Drive.
2. Asegúrese de tener una hoja llamada **`INSCRIPCIONES`**.
   * *Nota:* El sistema leerá de forma **sólo lectura** esta hoja. Los nombres de las columnas se detectarán automáticamente. Se recomienda que existan columnas similares a: `Nombre Completo` (o `Nombre`), `Telefono` (o `Celular`) y `Correo` (o `Email`).
3. No necesita crear la hoja **`qr`** manualmente. El backend la creará automáticamente con la estructura correcta en el primer registro de asistencia.

### Paso 2: Instalar el Google Apps Script
1. En su Google Sheet, vaya al menú superior y seleccione **Extensiones > Apps Script**.
2. Borre cualquier código existente en el archivo `Código.gs` del editor.
3. Copie todo el código contenido en el archivo local de su proyecto:
   [backend/codigo.gs](file:///Users/dennismendoza/Documents/Proyectos/qr-iglesia/backend/codigo.gs)
4. Pegue el código en el editor de Apps Script.
5. Guarde el proyecto haciendo clic en el icono del disquete o presionando `Ctrl+S` (`Cmd+S` en Mac).

### Paso 3: Desplegar como Aplicación Web
1. En la parte superior derecha del editor de Apps Script, haga clic en **Nueva implementación** (o *Deploy > New Deployment*).
2. Haga clic en el engranaje de configuración y seleccione **Aplicación web**.
3. Complete los datos de la siguiente forma:
   * **Descripción:** API de Asistencia QR
   * **Ejecutar como:** Yo (*su cuenta de Google*)
   * **Quién tiene acceso:** Cualquiera (*Anyone*) - *Esto es sumamente importante para que la web móvil pueda comunicarse con el Sheet.*
4. Haga clic en **Implementar**.
5. Si es la primera vez, Google le solicitará que otorgue permisos. Haga clic en **Autorizar acceso**, seleccione su cuenta, haga clic en *Configuración Avanzada* (abajo en pequeño) y luego en *Ir a API Asistencia QR (no seguro)*. Conceda los permisos.
6. Copie la **URL de la aplicación web** que le proporciona Google (debe terminar en `/exec`).

### Paso 4: Enlazar el Frontend con el Backend
Debe pegar la URL obtenida en los archivos del frontend y desactivar el modo desarrollo:

1. Abra [frontend/js/app.js](file:///Users/dennismendoza/Documents/Proyectos/qr-iglesia/frontend/js/app.js):
   * Línea 10: Reemplace `"PEGAR_AQUI_TU_URL_DE_APPS_SCRIPT"` por la URL de Google.
   * Línea 13: Cambie `const DEVELOPMENT_MODE = true;` a `const DEVELOPMENT_MODE = false;`.
2. Abra [frontend/js/scanner.js](file:///Users/dennismendoza/Documents/Proyectos/qr-iglesia/frontend/js/scanner.js):
   * Línea 11: Reemplace `"PEGAR_AQUI_TU_URL_DE_APPS_SCRIPT"` por la URL de Google.
   * Línea 12: Cambie `const DEVELOPMENT_MODE = true;` a `const DEVELOPMENT_MODE = false;`.

---

## 🧪 Pruebas Locales (Modo Desarrollo)

Por defecto, la aplicación se entrega configurada con **`DEVELOPMENT_MODE = true`**.
Esto le permite abrir y probar la aplicación inmediatamente de forma local en su computadora sin necesidad de configurar Google Sheets todavía.

### Cómo probarlo localmente:
1. Abra el archivo [frontend/index.html](file:///Users/dennismendoza/Documents/Proyectos/qr-iglesia/frontend/index.html) en su navegador web.
2. Verá una lista de miembros de prueba ficticios cargados (Carlos, María, Sofía, etc.) y métricas estadísticas simuladas.
3. Al hacer clic en **"Ver Pase"** de cualquier persona, se abrirá su pase de entrada digital con su código QR.
4. Al hacer clic en **"Enviar Pase"**, se abrirá WhatsApp con el mensaje pre-cargado. Además, el panel simulará el registro y actualizará la interfaz en un segundo.
5. Si hace clic en **"Abrir Lector QR"** en una laptop con cámara web o en un celular, se abrirá la cámara.
   * Si apunta la cámara al QR del pase digital abierto en otro dispositivo (como el celular), el escáner lo reconocerá de inmediato.
   * Mostrará la alerta **"Acceso Permitido"** (en verde con sonido de éxito) y registrará la entrada.
   * Si escanea el mismo QR por segunda vez, mostrará **"Ya Ingresó"** (en amarillo con sonido de error).
   * Si escanea cualquier otro código QR externo no válido, mostrará **"Acceso Denegado"** (en rojo con sonido de error).

---

## 🚀 Publicar el Frontend en Internet

Para que el sistema de escaneo funcione en los celulares de los organizadores el día del evento, y para que los asistentes puedan ver su pase en su celular desde WhatsApp, el contenido de la carpeta `frontend/` debe publicarse en internet.

### Opciones recomendadas de hosting gratuito:
1. **GitHub Pages (Recomendado):**
   * Inicialice un repositorio de Git en su proyecto.
   * Suba el código a GitHub.
   * Vaya a la configuración del repositorio en GitHub, active *Pages* y apunte a la carpeta `frontend/` (o al root si reorganiza la estructura).
2. **Vercel / Netlify:**
   * Puede arrastrar y soltar la carpeta `frontend/` para desplegarla en segundos de forma gratuita.

Una vez publicado, configure la **URL Base Pública** en el panel de control web (`index.html` en la sección de configuración rápida de enlace) para que los enlaces que se envían por WhatsApp lleven la URL real de internet de su pase digital.
