# Comandos para la demo (CMD de Windows)

Abrir 3 terminales. En cada una:

```
cd /d "C:\Users\Windows 10\Desktop\tp2-recolector-evidencia"
```

Limpiar datos viejos:

```
del data\evidencias.log
del logs\app.log
```

## Paso 1: caída de workers (Escenario A)

**Terminal 1**
```
node src/index.js
```

**Terminal 2**
```
node pruebas/cliente.js carga --total=20 --concurrencia=6
```



## Paso 2: reintentos y duplicados (Escenario C)

**Terminal 2**
```
node pruebas/cliente.js reintentos --total=12 --concurrencia=6 --intentos=10
```

## Paso 3: matar un worker (Escenario B)

**Terminal 1**: `Ctrl+C` (si pregunta S/N, escribir `S`) y después:
```
set FAIL_PROB=0&& set IO_DELAY_MS=10000&& node src/index.js
```
Anotar el número de uno de los workers.

**Terminal 2** (sin apretar Enter)
```
node pruebas/cliente.js carga --total=16 --concurrencia=8
```

**Terminal 3** (sin apretar Enter; cambiar `7324` por el número anotado)
```
taskkill /PID 7324 /F
```

Disparar: Enter en la terminal 2 y enseguida Enter en la terminal 3.

## Paso 4: cierre elegante (Rolling Restart)

**Terminal 2** (sin apretar Enter)
```
node pruebas/cliente.js carga --total=16 --concurrencia=8
```

**Terminal 1** (sin apretar Enter)
```
restart
```

Disparar: Enter en la terminal 2 y enseguida Enter en la terminal 1.

## Terminar

**Terminal 1**: `Ctrl+C` (si pregunta S/N, escribir `S`).