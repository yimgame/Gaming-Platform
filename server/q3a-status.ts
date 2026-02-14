import dgram from 'dgram';

export interface QuakePlayer {
  score: number;
  ping: number;
  name: string;
}

export interface QuakeServerStatus {
  online: boolean;
  hostname?: string;
  mapname?: string;
  gametype?: string;
  maxClients?: number;
  clients?: number;
  players?: QuakePlayer[];
  version?: string;
  protocol?: number;
  error?: string;
  lastUpdate?: Date;
}

// Cache del estado del servidor
let cachedStatus: QuakeServerStatus | null = null;
let lastQueryTime = 0;
const CACHE_DURATION = 30000; // 30 segundos

// Configuración RCON (para uso futuro)
const RCON_PASSWORD = process.env.Q3A_RCON_PASSWORD || 'Megcone';

/**
 * Consulta el estado del servidor Quake 3 via UDP
 */
export async function queryQuakeServer(
  host: string = 'localhost',
  port: number = 27960,
  timeout: number = 5000
): Promise<QuakeServerStatus> {
  // Retornar cache si está vigente
  const now = Date.now();
  if (cachedStatus && (now - lastQueryTime) < CACHE_DURATION) {
    return cachedStatus;
  }

  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    let resolved = false;

    // Timeout para la consulta
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.close();
        const offlineStatus: QuakeServerStatus = {
          online: false,
          error: 'Timeout - servidor no responde',
          lastUpdate: new Date(),
        };
        cachedStatus = offlineStatus;
        lastQueryTime = now;
        resolve(offlineStatus);
      }
    }, timeout);

    // Construir el comando getstatus
    // Protocolo Quake 3: 4 bytes 0xFF + comando
    const command = Buffer.concat([
      Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
      Buffer.from('getstatus\n'),
    ]);

    // Manejar respuesta
    client.on('message', (msg) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      client.close();

      try {
        const status = parseQuakeResponse(msg);
        cachedStatus = status;
        lastQueryTime = now;
        resolve(status);
      } catch (error) {
        const errorStatus: QuakeServerStatus = {
          online: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
          lastUpdate: new Date(),
        };
        cachedStatus = errorStatus;
        lastQueryTime = now;
        resolve(errorStatus);
      }
    });

    // Manejar errores
    client.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      client.close();
      const errorStatus: QuakeServerStatus = {
        online: false,
        error: err.message,
        lastUpdate: new Date(),
      };
      cachedStatus = errorStatus;
      lastQueryTime = now;
      resolve(errorStatus);
    });

    // Enviar query
    client.send(command, port, host, (err) => {
      if (err && !resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        client.close();
        const errorStatus: QuakeServerStatus = {
          online: false,
          error: err.message,
          lastUpdate: new Date(),
        };
        cachedStatus = errorStatus;
        lastQueryTime = now;
        resolve(errorStatus);
      }
    });
  });
}

/**
 * Parsea la respuesta del servidor Quake 3
 */
function parseQuakeResponse(buffer: Buffer): QuakeServerStatus {
  // Convertir a string (el protocolo usa texto plano después de los 4 bytes 0xFF)
  const response = buffer.toString('utf8');
  
  // Verificar que sea una respuesta válida
  if (!response.includes('statusResponse')) {
    throw new Error('Respuesta inválida del servidor');
  }

  // Dividir en líneas
  const lines = response.split('\n');
  
  // Primera línea: variables del servidor (key\value pairs)
  const varsLine = lines[1] || '';
  const vars = parseVariables(varsLine);

  // Resto de líneas: jugadores (score ping "name")
  const players: QuakePlayer[] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Formato: score ping "name"
    const match = line.match(/^(-?\d+)\s+(-?\d+)\s+"([^"]+)"$/);
    if (match) {
      players.push({
        score: parseInt(match[1]),
        ping: parseInt(match[2]),
        name: match[3],
      });
    }
  }

  return {
    online: true,
    hostname: vars.sv_hostname || vars.hostname || 'Unknown',
    mapname: vars.mapname || 'Unknown',
    gametype: vars.g_gametype || vars.gametype || 'Unknown',
    maxClients: parseInt(vars.sv_maxclients || '0'),
    clients: players.length,
    players,
    version: vars.version,
    protocol: parseInt(vars.protocol || '0'),
    lastUpdate: new Date(),
  };
}

/**
 * Parsea las variables del servidor (formato: \key\value\key\value...)
 */
function parseVariables(varsString: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const parts = varsString.split('\\').filter(Boolean);

  for (let i = 0; i < parts.length; i += 2) {
    if (i + 1 < parts.length) {
      vars[parts[i]] = parts[i + 1];
    }
  }

  return vars;
}

/**
 * Obtiene el estado del servidor (usa cache si está disponible)
 */
export async function getServerStatus(): Promise<QuakeServerStatus> {
  const host = process.env.QUAKE_SERVER_HOST || 'localhost';
  const port = parseInt(process.env.QUAKE_SERVER_PORT || '27960');
  
  return queryQuakeServer(host, port);
}

/**
 * Fuerza una actualización del estado del servidor (ignora cache)
 */
export async function refreshServerStatus(): Promise<QuakeServerStatus> {
  cachedStatus = null;
  lastQueryTime = 0;
  return getServerStatus();
}

/**
 * Envía un comando RCON al servidor (para uso futuro)
 * RCON permite ejecutar comandos de consola remotamente
 */
export async function sendRconCommand(
  command: string,
  host: string = 'localhost',
  port: number = 27960,
  password: string = RCON_PASSWORD,
  timeout: number = 5000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.close();
        reject(new Error('Timeout - servidor no responde'));
      }
    }, timeout);

    // Construir comando RCON
    // Formato: 0xFF 0xFF 0xFF 0xFF rcon "password" "command"
    const rconCommand = Buffer.concat([
      Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
      Buffer.from(`rcon "${password}" ${command}\n`),
    ]);

    client.on('message', (msg) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      client.close();

      // La respuesta viene con 4 bytes 0xFF al inicio
      const response = msg.toString('utf8').substring(4);
      resolve(response);
    });

    client.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      client.close();
      reject(err);
    });

    client.send(rconCommand, port, host, (err) => {
      if (err && !resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        client.close();
        reject(err);
      }
    });
  });
}
