/* ============================================
   SISTEMA DE PROGRESO DEL ESTUDIANTE
   Atlas Morfológico Interactivo · Hematología
   Universidad de Tarapacá
   ============================================ */

const ATLAS_MODULOS = [
  { id: 'mod1',  nombre: 'Serie roja',                orden: 1,  fichas: 6 },
  { id: 'mod2a', nombre: 'Serie granulocítica',        orden: 2,  fichas: 5 },
  { id: 'mod2b', nombre: 'Granulocitos maduros',       orden: 3,  fichas: 3 },
  { id: 'mod3a', nombre: 'Linfopoyesis general',       orden: 4,  fichas: 3 },
  { id: 'mod3b', nombre: 'Linfocitos maduros',         orden: 5,  fichas: 6 },
  { id: 'mod4',  nombre: 'Serie monocítica',           orden: 6,  fichas: 4 },
  { id: 'mod5',  nombre: 'Serie plaquetaria',          orden: 7,  fichas: 5 },
  { id: 'mod6',  nombre: 'Leucemias agudas',           orden: 8,  fichas: 8 },
  { id: 'mod7',  nombre: 'Leucemias crónicas',         orden: 9,  fichas: 6 },
  { id: 'mod8',  nombre: 'Síndromes mielodisplásicos', orden: 10, fichas: 5 },
  { id: 'mod9',  nombre: 'Linfomas',                   orden: 11, fichas: 4 },
  { id: 'mod10', nombre: 'Gammapatías monoclonales',   orden: 12, fichas: 5 },
  { id: 'mod11', nombre: 'Alteraciones plaquetarias',  orden: 13, fichas: 5 },
  { id: 'mod12', nombre: 'Casos clínicos integrados',  orden: 14, fichas: 6 }
];

const STORAGE_KEY = 'atlas_hematologia_progreso';
const STUDENT_KEY = 'atlas_hematologia_estudiante_id';

/* ---------- Identidad del estudiante (anónima, generada localmente) ---------- */
function obtenerIdEstudiante() {
  let id = localStorage.getItem(STUDENT_KEY);
  if (!id) {
    id = 'est_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(STUDENT_KEY, id);
  }
  return id;
}

/* ---------- Estado de progreso ---------- */
function obtenerProgreso() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fallthrough */ }
  }
  // Estado inicial: solo módulo 1 disponible
  const inicial = {
    estudianteId: obtenerIdEstudiante(),
    fechaInicio: new Date().toISOString(),
    modulos: {}
  };
  ATLAS_MODULOS.forEach((m, i) => {
    inicial.modulos[m.id] = {
      estado: i === 0 ? 'disponible' : 'bloqueado', // disponible | en_progreso | completado | bloqueado
      fichasConsultadas: [],
      fichasDescargadas: [],
      quizCompletado: false,
      quizIntentos: 0,
      quizResultados: [],
      tiempoTotalSegundos: 0,
      primerAcceso: null,
      ultimoAcceso: null
    };
  });
  guardarProgreso(inicial);
  return inicial;
}

function guardarProgreso(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ---------- Cálculo de porcentaje global ---------- */
function calcularPorcentajeGlobal() {
  const data = obtenerProgreso();
  const total = ATLAS_MODULOS.length;
  const completados = Object.values(data.modulos).filter(m => m.estado === 'completado').length;
  return Math.round((completados / total) * 100);
}

/* ---------- Marcar acceso a un módulo ---------- */
function registrarAccesoModulo(moduloId) {
  const data = obtenerProgreso();
  const mod = data.modulos[moduloId];
  if (!mod) return;

  const ahora = new Date().toISOString();
  if (!mod.primerAcceso) mod.primerAcceso = ahora;
  mod.ultimoAcceso = ahora;

  if (mod.estado === 'disponible') mod.estado = 'en_progreso';

  guardarProgreso(data);
  registrarEventoEstadistica('acceso_modulo', { moduloId, timestamp: ahora });
}

/* ---------- Registrar ficha consultada ---------- */
function registrarFichaConsultada(moduloId, fichaId) {
  const data = obtenerProgreso();
  const mod = data.modulos[moduloId];
  if (!mod) return;
  if (!mod.fichasConsultadas.includes(fichaId)) {
    mod.fichasConsultadas.push(fichaId);
  }
  guardarProgreso(data);
  registrarEventoEstadistica('ficha_consultada', { moduloId, fichaId });
}

/* ---------- Registrar descarga de ficha ---------- */
function registrarFichaDescargada(moduloId, fichaId) {
  const data = obtenerProgreso();
  const mod = data.modulos[moduloId];
  if (!mod) return;
  mod.fichasDescargadas.push({ fichaId, timestamp: new Date().toISOString() });
  guardarProgreso(data);
  registrarEventoEstadistica('ficha_descargada', { moduloId, fichaId });
}

/* ---------- Completar quiz y desbloquear siguiente módulo ---------- */
function completarQuiz(moduloId, resultado) {
  const data = obtenerProgreso();
  const mod = data.modulos[moduloId];
  if (!mod) return null;

  mod.quizIntentos += 1;
  mod.quizResultados.push({
    intento: mod.quizIntentos,
    puntaje: resultado.puntaje,
    total: resultado.total,
    porcentaje: Math.round((resultado.puntaje / resultado.total) * 100),
    timestamp: new Date().toISOString(),
    respuestas: resultado.respuestas || []
  });

  // Criterio de aprobación: 60% o más
  const porcentajeObtenido = (resultado.puntaje / resultado.total) * 100;
  if (porcentajeObtenido >= 60) {
    mod.quizCompletado = true;
    mod.estado = 'completado';
    desbloquearSiguienteModulo(data, moduloId);
  }

  guardarProgreso(data);
  registrarEventoEstadistica('quiz_completado', {
    moduloId,
    intento: mod.quizIntentos,
    porcentaje: porcentajeObtenido,
    aprobado: porcentajeObtenido >= 60
  });

  return { aprobado: porcentajeObtenido >= 60, porcentaje: porcentajeObtenido };
}

function desbloquearSiguienteModulo(data, moduloActualId) {
  const moduloActual = ATLAS_MODULOS.find(m => m.id === moduloActualId);
  if (!moduloActual) return;
  const siguiente = ATLAS_MODULOS.find(m => m.orden === moduloActual.orden + 1);
  if (siguiente && data.modulos[siguiente.id].estado === 'bloqueado') {
    data.modulos[siguiente.id].estado = 'disponible';
  }
}

/* ---------- Tiempo en módulo (llamar al entrar y al salir) ---------- */
let tiempoInicioModulo = null;
let moduloActivoId = null;

function iniciarConteoTiempo(moduloId) {
  tiempoInicioModulo = Date.now();
  moduloActivoId = moduloId;
}

function finalizarConteoTiempo() {
  if (!tiempoInicioModulo || !moduloActivoId) return;
  const segundos = Math.round((Date.now() - tiempoInicioModulo) / 1000);
  const data = obtenerProgreso();
  const mod = data.modulos[moduloActivoId];
  if (mod) {
    mod.tiempoTotalSegundos += segundos;
    guardarProgreso(data);
    registrarEventoEstadistica('tiempo_modulo', { moduloId: moduloActivoId, segundos });
  }
  tiempoInicioModulo = null;
  moduloActivoId = null;
}

// Guardar tiempo automáticamente al cerrar/cambiar de página
window.addEventListener('beforeunload', finalizarConteoTiempo);

/* ---------- Verificar si un módulo está bloqueado ---------- */
function moduloEstaBloqueado(moduloId) {
  const data = obtenerProgreso();
  return data.modulos[moduloId]?.estado === 'bloqueado';
}

function obtenerEstadoModulo(moduloId) {
  const data = obtenerProgreso();
  return data.modulos[moduloId]?.estado || 'bloqueado';
}

/* ---------- Reiniciar progreso (uso docente/testing) ---------- */
function reiniciarProgreso() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STUDENT_KEY);
  return obtenerProgreso();
}
