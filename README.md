# TP2 - Recolector de Evidencia

Programación sobre Redes — IFTS N°16

API HTTP con auto-recuperación de procesos (Self-Healing), reinicio sin cortes (Rolling Restart) y cierre controlado (Graceful Shutdown), usando solo módulos nativos de Node.js (`cluster`, `http`, `worker_threads`).

## Requisitos

- Node.js 18 o superior (probado con Node v24.15.0 en Windows 10).
- No hace falta `npm install`.

## Estructura

```
src/
├── index.js                       # decide si el proceso es master o worker
├── config.js                      # configuración centralizada (variables de entorno)
├── master/orquestador.js          # cluster: self-healing, rolling restart, cierre
├── worker/
│   ├── servidor.js                # servidor HTTP del worker
│   ├── routes.js                  # tabla de rutas y métodos permitidos
│   ├── shutdown.js                # graceful shutdown + timeout de seguridad (10 s)
│   ├── controllers/               # controladores (salud, escribir-evidencia)
│   ├── middlewares/requestLogger.js
│   ├── services/                  # lógica: persistencia simulada y hash
│   └── hilos/hashHilo.js          # hilo de worker_threads (cómputo pesado)
└── utils/                         # logger (consola + archivo), respuestas HTTP, lectura de body
pruebas/cliente.js                 # cliente de pruebas concurrente
data/evidencias.log                # evidencias persistidas
logs/app.log                       # registro de actividad (master y workers)
INFORME.md                         # informe técnico (escenarios A, B y C)
```

## Cómo ejecutarlo

```
node src/index.js
```

También funciona `npm start`. Con `npm start` en Windows, al hacer `Ctrl+C` la terminal pregunta `¿Desea terminar el trabajo por lotes (S/N)?`; respondé `S`.

### Variables de entorno opcionales

| Variable | Valor por defecto | Para qué sirve |
|---|---|---|
| `PORT` | 8090 | Puerto del servidor |
| `NUM_WORKERS` | hasta 4 (según CPUs) | Cantidad de workers |
| `FAIL_PROB` | 0.5 | Probabilidad de `process.exit(1)` tras escribir |
| `IO_DELAY_MS` | 3000 | Duración de la persistencia simulada |
| `HASH_ITERACIONES` | 200000 | Iteraciones del hash (hilo aparte) |
| `LOG_DIR` | `logs` | Carpeta de logs |
| `DATA_DIR` | `data` | Carpeta de evidencias |

Cómo definirlas según el sistema (ejemplo: desactivar la falla):

```
# Linux / macOS / WSL
FAIL_PROB=0 node src/index.js

# Windows (CMD) - sin espacio antes del &&
set FAIL_PROB=0&& node src/index.js
```

Para combinar varias en CMD:

```
set FAIL_PROB=0&& set IO_DELAY_MS=10000&& node src/index.js
```

## Rutas

| Método | Ruta | Descripción | Códigos |
|---|---|---|---|
| GET | `/salud` | Indica qué worker respondió | 200 |
| POST | `/escribir-evidencia` | Simula persistencia pesada (3000 ms). Cuerpo JSON opcional: `{"id": "...", "evidencia": "..."}` | 201, 400, 413, 500 |

Cualquier otra ruta responde 404 y un método no permitido responde 405 con el header `Allow`.

## Señales y control

| Acción | Linux / macOS / WSL | Windows |
|---|---|---|
| Rolling restart | `kill -USR2 <PID del master>` | escribir `restart` + Enter en la terminal del master |
| Cierre ordenado de todo | `Ctrl+C` (SIGINT) o `kill <PID>` (SIGTERM) | `Ctrl+C` |
| Matar un worker a la fuerza (SIGKILL) | `kill -9 <PID del worker>` | `taskkill /PID <PID del worker> /F` |

`SIGUSR2` no existe en Windows, por eso se agregó el comando `restart` como reemplazo: ejecuta la misma función de Rolling Restart.

## Logs

Cada línea tiene fecha y hora, nivel, rol (MASTER/WORKER) y PID. Se muestran en consola y se guardan en `logs/app.log`. Las evidencias persistidas quedan en `data/evidencias.log`.

## Pruebas

Con el servidor corriendo en una terminal, en otra terminal:

```
node pruebas/cliente.js carga      --total=20 --concurrencia=6
node pruebas/cliente.js reintentos --total=12 --concurrencia=6 --intentos=10
```

- `carga`: dispara peticiones concurrentes y compara las respuestas recibidas con los registros escritos (Escenario A).
- `reintentos`: reenvía cada petición con el mismo `id` hasta lograr un 201 y cuenta los duplicados (Escenario C).

Para aislar el efecto de una señal (Escenario B), conviene desactivar la anomalía con `FAIL_PROB=0` (ver arriba) y, si hace falta más tiempo para intervenir, aumentar `IO_DELAY_MS`.

Los resultados y el análisis están en `INFORME.md`.