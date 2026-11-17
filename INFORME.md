# Informe técnico — Recolector de Evidencia

Programación sobre Redes — IFTS N°16

## 1. Entorno y método

| Dato | Valor |
|---|---|
| Sistema operativo | Windows 10 (terminal CMD) |
| Node.js | v24.15.0 |
| Workers | 4 (`Math.min(os.cpus().length, 4)`) |
| Puerto | 8090 |
| Cliente de pruebas | `pruebas/cliente.js` (modos `carga` y `reintentos`) |

El sistema se ejecutó con `node src/index.js` y se lo probó con `pruebas/cliente.js`, que dispara peticiones concurrentes `POST /escribir-evidencia` y clasifica cada resultado (código HTTP o error de red). Cada petición simula una persistencia de 3000 ms (`IO_DELAY_MS`), escribe una línea en `data/evidencias.log` y, con 50% de probabilidad (`FAIL_PROB`), ejecuta `process.exit(1)` antes de responder.

**Adaptaciones por usar Windows:**

- Windows no tiene la señal `SIGUSR2`. El Rolling Restart se dispara escribiendo `restart` + Enter en la terminal del master, que ejecuta la misma función `rollingRestart()` que ejecutaría la señal en Linux/macOS.
- Windows no tiene `kill -9`. Se usó `taskkill /PID <pid> /F`, que termina el proceso a la fuerza, sin darle oportunidad de ejecutar código propio.

Como la anomalía es aleatoria, los números cambian entre corridas; lo que se mantiene es el comportamiento.

## 2. Escenario A: caída del Worker en vuelo

**Prueba:** 20 peticiones, 6 simultáneas, 4 workers, anomalía del 50%.

| Resultado | Cantidad |
|---|---|
| HTTP 201 | 3 |
| `ECONNRESET` (`read ECONNRESET`) | 17 |
| **Total** | **20** |

- Registros nuevos en `data/evidencias.log`: **13**.
- Escritos en disco pero sin respuesta al cliente: **10**.
- Nunca escritos: **7** (20 − 13).
- El master registró **5 colapsos**, todos `code 1, signal null`, y creó un reemplazo en cada caso.

### ¿Qué error recibe el cliente HTTP?

Ningún código de estado HTTP. Cuando el worker ejecuta `process.exit(1)` todavía no se envió la línea de estado ni los headers, así que no existe una respuesta HTTP que interpretar. El sistema operativo cierra los sockets del proceso muerto y el cliente recibe un error de red: `ECONNRESET` (la conexión fue cerrada abruptamente por el otro extremo). En mis pruebas en Windows apareció como `read ECONNRESET`; en otros entornos Node lo muestra a veces como `socket hang up` (la conexión se cerró antes de recibir respuesta).

### ¿Qué pasó con los datos de la petición en curso?

El resultado depende del momento en que cayó el worker:

- **10 peticiones se escribieron en disco, pero el cliente vio un error.** El dato estaba persistido (`appendFile` ya había terminado) y el proceso murió antes de enviar la respuesta. La transacción **sí se completó** en el sistema de archivos, pero el cliente no lo sabe.
- **7 peticiones no se escribieron nunca.** Estaban en los 3 segundos de espera dentro de un worker que cayó por la anomalía de **otra** petición. Un `process.exit(1)` mata el proceso entero, así que arrastra a todas las peticiones en vuelo de ese worker (daño colateral). Por eso hubo 5 colapsos pero 17 clientes con error.

Aunque el master revive el proceso rápido, eso no recupera el trabajo perdido. El master detectó cada caída en unos 14 ms y el reemplazo tardó entre ~100 ms y ~850 ms en empezar a escuchar el puerto (por ejemplo, el worker 11148 tardó 103 ms y el 14936 tardó 845 ms). Pero el reemplazo es un proceso nuevo, sin memoria de lo que estaba haciendo el anterior.

## 3. Escenario B: SIGKILL frente a cierre elegante

Para que la única causa de fallo fuera la señal, se desactivó la anomalía (`FAIL_PROB=0`). Para tener tiempo de ejecutar el `taskkill` mientras había peticiones en curso, se aumentó la espera a 10 segundos (`IO_DELAY_MS=10000`). Prueba: 16 peticiones, 8 simultáneas, 4 workers.

*Nota de método:* en dos intentos previos con 3 segundos, el `taskkill` se ejecutó antes de que arrancara el cliente. Dio 16 de 16 en 201 porque el worker ya estaba muerto y no tenía peticiones en vuelo. Por eso se repitió con 10 segundos y el orden correcto (primero el cliente, después el `taskkill`).

Comando ejecutado: taskkill /PID 7324 /F
Respuesta de Windows: Correcto: se terminó el proceso con PID 7324.

### Resultados

| | `taskkill /F` a un worker (≈ SIGKILL) | Rolling Restart (`restart`) |
|---|---|---|
| Peticiones | 16 | 16 |
| Respuestas 201 | 15 | **16** |
| Errores en el cliente | 1 `ECONNRESET` | **0** |
| Registros en disco | 15 | 16 |
| Log del master | `colapsó (code 1, signal null)` | `salió de forma planificada (code 0)` |
| ¿El worker registró su cierre? | **No** (ninguna línea) | Sí: "Shutdown recibido" y "Cierre limpio completado" |

### ¿Por qué el worker no puede ejecutar `server.close()` ni el manejo de `process.on('message')` bajo un SIGKILL?

La terminación forzada no la ejecuta el proceso: la ejecuta el sistema operativo directamente. El proceso no puede capturarla, bloquearla ni ignorarla, y no corre ninguna línea más de su código: ni los handlers de señales, ni el callback de `server.close()`, ni el listener de `process.on('message')`. Por eso el mensaje `shutdown` por IPC tampoco sirve: el proceso muere antes de procesarlo.

En el log se comprueba: para el worker 7324 no aparece ningún "Shutdown recibido". Los sockets los cierra el sistema operativo de golpe, y de ahí el `ECONNRESET` del cliente. La petición que atendía ese worker se perdió: no llegó a escribirse porque la escritura ocurre al final de la espera (0 registros escritos sin respuesta, 1 dato perdido).

**Dato propio de Windows:** el master registró `code 1, signal null`. Windows no maneja señales POSIX: `taskkill /F` termina el proceso con `TerminateProcess` y Node informa código 1 sin señal. En Linux, `kill -9` se vería como `code null, signal SIGKILL`. Como el código 1 es distinto de 0 y la salida no fue planificada, el master lo revivió (worker 12800, en unos 200 ms).

### Comparación con el cierre elegante (Graceful Shutdown)

En el Rolling Restart el master nunca mata a un worker por la fuerza. Por cada worker viejo: (1) crea uno nuevo y espera a que esté escuchando, (2) le manda `{ type: 'shutdown' }` por IPC al viejo, (3) el viejo ejecuta `server.close()`, que deja de aceptar conexiones nuevas pero **espera a las que están en curso**, y (4) sale con `process.exit(0)`.

Evidencia del log (restart a las 20:21:12):

- Los workers 7436 y 1956 no tenían peticiones pendientes: cerraron en milisegundos (`Cierre limpio completado`, code 0).
- El worker 12340 sí tenía peticiones en curso. Recibió `Shutdown` a las 20:21:13.316 y **esperó unos 9,6 segundos**: respondió sus 2 peticiones con 201 a las 20:21:22.9 y recién ahí cerró (20:21:22.955).
- El master reemplazó los 4 workers y registró `Rolling restart completado`.

**Resultado:** 16 de 16 en 201, 0 errores y 16 registros en disco. Con el `taskkill` se perdió 1 petición; con el cierre elegante, ninguna.

| | Terminación forzada (SIGKILL / `taskkill /F`) | Cierre elegante (shutdown por IPC) |
|---|---|---|
| ¿Se puede capturar? | No | Sí |
| Peticiones en vuelo | Se cortan | Se terminan |
| Sockets | Los cierra el SO de golpe | Se cierran ordenadamente |
| Código de salida | 1 en Windows (`null` + `SIGKILL` en Linux) | 0 |

**Protecciones:** el worker tiene un timeout de seguridad de 10 s (si quedan conexiones colgadas, fuerza `process.exit(1)`), y el master agrega otra red de seguridad: si el worker no cierra en 12 s, lo mata con SIGKILL, para que un worker colgado no bloquee el reinicio indefinidamente.

## 4. Escenario C: At-Least-Once frente a At-Most-Once

**Prueba:** 12 peticiones lógicas, cada una con un `id` fijo que se reutiliza en cada reintento (hasta 10 intentos, 100 ms entre intentos), 6 simultáneas, anomalía del 50%.

| Métrica | Valor |
|---|---|
| Intentos enviados | 62 (para 12 peticiones lógicas) |
| Peticiones que nunca lograron un 201 | 1 |
| Registros en `data/evidencias.log` | 35 |
| Ids distintos | 12 |
| **Ids duplicados** | **11** |
| Escrituras de más (35 − 12) | 23 |

Ejemplos de duplicados: `retry-...-0` se escribió 4 veces, `retry-...-1` 4 veces, `retry-...-5` 4 veces, `retry-...-3` y `retry-...-4` 2 veces cada uno.

### ¿Qué problema se genera?

Si el worker colapsa **después de escribir y antes de responder 201**, el cliente no puede distinguir entre "mi petición no llegó" y "llegó y se guardó, pero no me pudieron responder". Si reintenta, la misma operación se escribe de nuevo y se **duplica**. En la prueba, 12 operaciones lógicas generaron 35 registros. Incluso la petición que agotó los 10 intentos sin recibir un 201 quedó registrada en disco (aparecen 12 ids distintos): el cliente creyó que falló algo que sí se guardó.

Es el dilema entre dos garantías de entrega:

- **At-Least-Once** (reintentar siempre): no se pierde ninguna operación, pero pueden aparecer duplicados. Es lo que se observó.
- **At-Most-Once** (no reintentar): nunca hay duplicados, pero se pueden perder operaciones, como las 7 peticiones del Escenario A que no llegaron a escribirse.

### ¿Cómo se soluciona en producción? Idempotencia

El cliente genera una clave única (por ejemplo un UUID) **una sola vez** por operación lógica y la envía en todos los reintentos (en este proyecto, el campo `id`). El servidor guarda las claves ya procesadas: si recibe una repetida, **no vuelve a escribir** y devuelve el resultado anterior. Así, repetir la operación produce el mismo efecto que hacerla una vez.

Para que sea confiable, verificar la clave y escribir deben ser una operación atómica; por ejemplo, una restricción `UNIQUE` sobre la clave en una base de datos, o crear el archivo con una bandera exclusiva. Con eso se combina "reintentar siempre" con "efecto de una sola vez". El cliente además debería usar timeout y esperas crecientes entre reintentos (*backoff*).

En este proyecto la deduplicación **no se implementó a propósito**, para poder observar el problema.

## 5. Conclusiones

1. **El Self-Healing mantiene el servicio, pero no protege el trabajo en vuelo.** El master detecta la caída en milisegundos y crea un reemplazo, pero `process.exit(1)` pierde todas las peticiones en curso de ese worker, no solo la que falló.
2. **El cierre elegante permite reiniciar sin perder peticiones.** Con IPC, `server.close()` y el timeout de seguridad, el Rolling Restart dio 16 de 16 respuestas sin errores.
3. **Una terminación forzada no admite defensas dentro del proceso.** La protección debe estar afuera: reintentos, idempotencia y persistencia atómica.
4. **Reintentar sin idempotencia duplica datos.** La prueba lo mostró: 11 de 12 ids duplicados.
5. **Una caída no es lo mismo que un error HTTP.** Cuando muere el proceso, el cliente no recibe un 500 sino un error de red (`ECONNRESET`), porque nadie llega a escribir la respuesta.

## 6. Limitaciones

- Las pruebas se hicieron en Windows 10; el comportamiento de las señales difiere de Linux (el `code` y `signal` informados, y la ausencia de `SIGUSR2` y `kill -9`).
- Las pruebas de los escenarios B y del Rolling Restart usaron `IO_DELAY_MS=10000` para tener tiempo de intervenir manualmente. Los escenarios A y C se hicieron con los 3000 ms originales.
- Como la anomalía es aleatoria, los números exactos cambian en cada corrida.