'use strict'; // Activa el modo estricto de JavaScript

/**
 * Cliente de pruebas concurrente para /escribir-evidencia.
 * Permite probar muchas peticiones y observar las respuestas.
 */

const http = require('http'); // Permite enviar peticiones HTTP al servidor
const fs = require('fs'); // Permite leer el archivo de evidencias

function argumento(nombre, defecto) { // Busca una opción escrita al ejecutar el programa
  const encontrado = process.argv.find((a) => a.startsWith(`--${nombre}=`)); // Busca, por ejemplo, --total=30
  return encontrado ? encontrado.split('=')[1] : defecto; // Devuelve el valor encontrado o el valor por defecto
}

const modo = process.argv[2]; // Indica si se ejecuta la prueba de carga o la de reintentos
const PUERTO = Number(argumento('puerto', 8090)); // Puerto del servidor
const TOTAL = Number(argumento('total', 30)); // Cantidad de peticiones o IDs
const CONCURRENCIA = Number(argumento('concurrencia', 10)); // Cantidad máxima de tareas simultáneas
const INTENTOS = Number(argumento('intentos', 5)); // Máximo de intentos por petición
const ARCHIVO = argumento('archivo', 'data/evidencias.log'); // Archivo donde se guardan las evidencias
const TIMEOUT_MS = Number(argumento('timeout', 15000)); // Tiempo máximo de espera por petición

// Envía una petición y devuelve el resultado o el error.
function enviar(id) {
  return new Promise((resolve) => { // Devuelve una promesa con el resultado
    const inicio = Date.now(); // Guarda la hora de inicio
    const cuerpo = JSON.stringify({ id, evidencia: `evidencia-${id}` }); // Prepara los datos en JSON
    const req = http.request(
      {
        host: 'localhost', // Envía la petición a la propia computadora
        port: PUERTO, // Usa el puerto configurado
        path: '/escribir-evidencia', // Ruta que se va a probar
        method: 'POST', // Método para enviar datos
        agent: false, // Abre una conexión nueva por petición
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo) }, // Indica el formato y tamaño del cuerpo
      },
      (res) => { // Se ejecuta cuando llega una respuesta HTTP
        res.resume(); // Consume el contenido de la respuesta
        res.on('end', () => resolve({ status: res.statusCode, ms: Date.now() - inicio })); // Devuelve el código y el tiempo transcurrido
      }
    );
    req.setTimeout(TIMEOUT_MS, () => { // Controla el tiempo máximo de espera
      resolve({ error: `TIMEOUT (sin respuesta en ${TIMEOUT_MS} ms)`, ms: Date.now() - inicio }); // Informa que se agotó el tiempo
      req.destroy(); // Cierra la petición
    });
    req.on('error', (err) => resolve({ error: `${err.code || 'ERROR'} (${err.message})`, ms: Date.now() - inicio })); // Registra errores de conexión
    req.end(cuerpo); // Envía los datos
  });
}

// Ejecuta tareas sin superar el límite de concurrencia.
async function conConcurrencia(cantidad, limite, tarea) {
  let siguiente = 0; // Índice de la próxima tarea
  const trabajadores = Array.from({ length: limite }, async () => { // Crea la cantidad indicada de trabajadores
    while (siguiente < cantidad) { // Continúa mientras queden tareas
      const i = siguiente++; // Toma una tarea y avanza el índice
      await tarea(i); // Ejecuta y espera esa tarea
    }
  });
  await Promise.all(trabajadores); // Espera a que terminen todos los trabajadores
}

function leerRegistros() { // Lee las evidencias guardadas
  if (!fs.existsSync(ARCHIVO)) return []; // Si el archivo no existe, devuelve una lista vacía
  return fs.readFileSync(ARCHIVO, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); // Lee cada línea y la convierte desde JSON a un objeto
}

function resumen(resultados) { // Cuenta las respuestas obtenidas
  const conteo = {}; // Objeto para guardar los totales
  for (const r of resultados) { // Recorre cada resultado
    const clave = r.error ? `ERROR ${r.error}` : `HTTP ${r.status}`; // Clasifica el resultado como error o respuesta HTTP
    conteo[clave] = (conteo[clave] || 0) + 1; // Suma uno al contador correspondiente
  }
  return conteo; // Devuelve el resumen
}

async function carga() { // Prueba el servidor con muchas peticiones
  console.log(`Carga: ${TOTAL} peticiones, ${CONCURRENCIA} en simultáneo, contra el puerto ${PUERTO}`); // Muestra la configuración
  const antes = leerRegistros().length; // Cuenta los registros antes de la prueba
  const resultados = []; // Guarda las respuestas recibidas
  await conConcurrencia(TOTAL, CONCURRENCIA, async (i) => { // Envía las peticiones respetando el límite
    resultados.push(await enviar(`carga-${Date.now()}-${i}`)); // Envía una petición con un ID único y guarda su resultado
  });

  console.log('\nRespuestas recibidas por el cliente:'); // Muestra el título del resumen
  console.table(resumen(resultados)); // Presenta las respuestas en una tabla

  const exitosas = resultados.filter((r) => r.status === 201).length; // Cuenta las respuestas HTTP 201
  const nuevas = leerRegistros().length - antes; // Cuenta cuántos registros nuevos aparecieron en el archivo
  console.log(`Peticiones con respuesta 201: ${exitosas}`); // Muestra las respuestas exitosas
  console.log(`Registros nuevos escritos en ${ARCHIVO}: ${nuevas}`); // Muestra los registros nuevos
  console.log(`Escritos en disco pero SIN respuesta al cliente: ${nuevas - exitosas}`); // Estima escrituras sin respuesta exitosa
}

async function reintentos() { // Prueba qué ocurre cuando se reenvían peticiones fallidas
  console.log(`Reintentos: ${TOTAL} ids, hasta ${INTENTOS} intentos cada uno, ${CONCURRENCIA} en simultáneo`); // Muestra la configuración
  const antes = leerRegistros().length; // Cuenta los registros antes de empezar
  const base = `retry-${Date.now()}`; // Crea una base para los IDs de esta prueba
  let totalIntentos = 0; // Cuenta los intentos realizados
  let sinExito = 0; // Cuenta las peticiones que nunca recibieron HTTP 201



  
  await conConcurrencia(TOTAL, CONCURRENCIA, async (i) => { // Ejecuta las pruebas en paralelo controlado
    const id = `${base}-${i}`; // Usa el mismo ID para todos los reintentos de una petición
    for (let intento = 1; intento <= INTENTOS; intento++) { // Repite hasta alcanzar el máximo de intentos
      totalIntentos++; // Suma un intento
      const r = await enviar(id); // Envía la petición y espera el resultado
      if (r.status === 201) return; // Si recibe HTTP 201, termina los reintentos de ese ID
      await new Promise((resolve) => setTimeout(resolve, 100)); // Espera 100 ms antes de reintentar
    }
    sinExito++; // Cuenta la petición si agotó todos los intentos sin HTTP 201
  });

  const registros = leerRegistros().slice(antes); // Obtiene los registros agregados durante la prueba
  const porId = {}; // Guarda cuántas veces aparece cada ID
  for (const r of registros) porId[r.id] = (porId[r.id] || 0) + 1; // Cuenta las apariciones de cada ID
  const duplicados = Object.entries(porId).filter(([, n]) => n > 1); // Selecciona los IDs guardados más de una vez

  console.log(`\nIntentos totales enviados: ${totalIntentos} (para ${TOTAL} peticiones lógicas)`); // Muestra el total de intentos
  console.log(`Peticiones que nunca lograron un 201: ${sinExito}`); // Muestra las peticiones sin respuesta exitosa
  console.log(`Registros escritos en ${ARCHIVO}: ${registros.length}`); // Muestra los registros nuevos
  console.log(`Ids distintos: ${Object.keys(porId).length}`); // Muestra cuántos IDs diferentes hay
  console.log(`Ids DUPLICADOS (escritos más de una vez): ${duplicados.length}`); // Muestra cuántos IDs están duplicados
  duplicados.slice(0, 5).forEach(([id, n]) => console.log(`  ${id} -> ${n} veces`)); // Muestra hasta cinco ejemplos de duplicados
}

if (modo === 'carga') carga(); // Ejecuta la prueba de carga si se eligió ese modo
else if (modo === 'reintentos') reintentos(); // Ejecuta la prueba de reintentos si se eligió ese modo
else {
  console.log('Uso:'); // Indica cómo ejecutar el programa
  console.log('  node pruebas/cliente.js carga      [--total=30] [--concurrencia=10]'); // Ejemplo de prueba de carga
  console.log('  node pruebas/cliente.js reintentos [--total=20] [--concurrencia=10] [--intentos=5]'); // Ejemplo de prueba de reintentos
  process.exit(1); // Termina indicando que faltó elegir un modo válido
}


/*Lo más importante de este archivo
Este archivo no es el servidor: es el programa que usamos para probarlo.
- carga: manda muchas peticiones y cuenta las respuestas y los registros guardados.
- reintentos: vuelve a enviar una petición cuando falla, usando el mismo ID para comprobar si aparecen duplicados.
- CONCURRENCIA: indica cuántas tareas se ejecutan a la vez.
- TIMEOUT: indica que el cliente esperó demasiado sin recibir respuesta.
- 201: significa que la evidencia se creó correctamente, según la respuesta del servidor.
Una cosa importante: esta prueba ayuda a demostrar que puede quedar una evidencia guardada aunque
 el cliente no reciba el 201, y que los reintentos pueden generar duplicados si el servidor
  no evita guardar dos veces el mismo ID.*/