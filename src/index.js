
// Es el punto de entrada: inicia el Master o un Worker según el proceso.
const cluster = require('cluster'); // Permite saber si este proceso es el principal o un Worker

if (cluster.isPrimary) { // Si es el proceso principal...
  require('./master/orquestador').iniciar(); // Inicia el Master, que crea y supervisa los Workers
} else { // Si no es el proceso principal...
  require('./worker/servidor').iniciar(); // Inicia el servidor que recibe las solicitudes
}


/*Lo importante:
- cluster.isPrimary: devuelve true si es el proceso principal.
- if / else: elige qué código ejecutar según el tipo de proceso.
- require(...): importa otro archivo.
- .iniciar(): ejecuta la función iniciar de ese archivo.
¿Cómo funciona todo junto?
1. Ejecutás index.js.
2. Si es el proceso principal, inicia el Master.
3. El Master crea los Workers.
4. Cada Worker ejecuta servidor.js y atiende las solicitudes.
Ojo: el Master y los Workers ejecutan el mismo index.js,
 pero cada uno toma un camino diferente según cluster.isPrimary.
 
 
 
 Punto de entrada. Si el proceso es el master, arranca el orquestador; 
 si es un worker, arranca el servidor.*/