/* ============================================
   SISTEMA DE ESTADÍSTICAS PARA INVESTIGACIÓN
   Atlas Morfológico Interactivo · Hematología
   Universidad de Tarapacá · Tesis Doctoral
   ============================================

   Este archivo registra cada evento de interacción del estudiante
   con fines de investigación educativa (aprendizaje autorregulado,
   interacción con recursos, desempeño en evaluaciones).

   Los datos NUNCA salen del navegador del estudiante hasta que
   la investigadora los exporta manualmente desde el panel privado.
*/

const EVENTOS_KEY = 'atlas_hematologia_eventos';
const SESION_KEY = 'atlas_hematologia_sesion_actual';

/* ---------- Registrar evento genérico ---------- */
function registrarEventoEstadistica(tipo, detalle) {
  const eventos = obtenerEventos();
  const evento = {
    estudianteId: obtenerIdEstudiante(),
    sesionId: obtenerSesionActual(),
    tipo: tipo,
    detalle: detalle,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    pantalla: `${window.innerWidth}x${window.innerHeight}`
  };
  eventos.push(evento);
  localStorage.setItem(EVENTOS_KEY, JSON.stringify(eventos));
}

function obtenerEventos() {
  const raw = localStorage.getItem(EVENTOS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { return []; }
  }
  return [];
}

/* ---------- Gestión de sesión (cada vez que abre el atlas) ---------- */
function obtenerSesionActual() {
  let sesionId = sessionStorage.getItem(SESION_KEY);
  if (!sesionId) {
    sesionId = 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    sessionStorage.setItem(SESION_KEY, sesionId);
    registrarEventoEstadistica('inicio_sesion', { timestamp: new Date().toISOString() });
  }
  return sesionId;
}

/* ---------- Resumen estadístico por estudiante (para el panel) ---------- */
function generarResumenEstadistico() {
  const progreso = obtenerProgreso();
  const eventos = obtenerEventos();

  const resumen = {
    estudianteId: progreso.estudianteId,
    fechaInicio: progreso.fechaInicio,
    porcentajeAvanceGlobal: calcularPorcentajeGlobal(),
    totalEventos: eventos.length,
    totalSesiones: new Set(eventos.map(e => e.sesionId)).size,
    modulos: []
  };

  ATLAS_MODULOS.forEach(modDef => {
    const m = progreso.modulos[modDef.id];
    if (!m) return;
    resumen.modulos.push({
      moduloId: modDef.id,
      nombre: modDef.nombre,
      estado: m.estado,
      fichasConsultadas: m.fichasConsultadas.length,
      fichasTotal: modDef.fichas,
      porcentajeFichasConsultadas: Math.round((m.fichasConsultadas.length / modDef.fichas) * 100),
      fichasDescargadas: m.fichasDescargadas.length,
      quizIntentos: m.quizIntentos,
      quizCompletado: m.quizCompletado,
      mejorResultado: m.quizResultados.length > 0
        ? Math.max(...m.quizResultados.map(r => r.porcentaje))
        : null,
      tiempoTotalMinutos: Math.round(m.tiempoTotalSegundos / 60 * 10) / 10,
      primerAcceso: m.primerAcceso,
      ultimoAcceso: m.ultimoAcceso
    });
  });

  return resumen;
}

/* ---------- Exportar a JSON ---------- */
function exportarJSON() {
  const resumen = generarResumenEstadistico();
  const eventosCompletos = obtenerEventos();
  const exportData = {
    resumen: resumen,
    eventosDetallados: eventosCompletos,
    fechaExportacion: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  descargarBlob(blob, `atlas_datos_${resumen.estudianteId}_${fechaArchivo()}.json`);
}

/* ---------- Exportar a CSV (compatible SPSS/R/Jamovi) ---------- */
function exportarCSV() {
  const resumen = generarResumenEstadistico();
  let csv = 'estudiante_id,modulo_id,modulo_nombre,estado,fichas_consultadas,fichas_total,pct_fichas_consultadas,fichas_descargadas,quiz_intentos,quiz_completado,mejor_resultado_pct,tiempo_total_minutos,primer_acceso,ultimo_acceso\n';

  resumen.modulos.forEach(m => {
    csv += [
      resumen.estudianteId,
      m.moduloId,
      `"${m.nombre}"`,
      m.estado,
      m.fichasConsultadas,
      m.fichasTotal,
      m.porcentajeFichasConsultadas,
      m.fichasDescargadas,
      m.quizIntentos,
      m.quizCompletado,
      m.mejorResultado ?? '',
      m.tiempoTotalMinutos,
      m.primerAcceso ?? '',
      m.ultimoAcceso ?? ''
    ].join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  descargarBlob(blob, `atlas_datos_${resumen.estudianteId}_${fechaArchivo()}.csv`);
}

/* ---------- Exportar eventos detallados a CSV (para análisis de interacción fina) ---------- */
function exportarEventosCSV() {
  const eventos = obtenerEventos();
  let csv = 'estudiante_id,sesion_id,tipo_evento,detalle,timestamp\n';
  eventos.forEach(e => {
    csv += [
      e.estudianteId,
      e.sesionId,
      e.tipo,
      `"${JSON.stringify(e.detalle).replace(/"/g, "'")}"`,
      e.timestamp
    ].join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  descargarBlob(blob, `atlas_eventos_detallados_${fechaArchivo()}.csv`);
}

/* ---------- Utilidades ---------- */
function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fechaArchivo() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}
