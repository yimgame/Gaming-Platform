import dgram from 'dgram';

// Consulta en vivo de servers Half-Life/CS 1.6 (motor GoldSrc) via el protocolo
// Source Engine Query (A2S_INFO). GoldSrc responde a la misma query que los
// juegos Source modernos, pero con un formato de respuesta un poco distinto
// (prefijo 'm' en vez de 'I').

export interface Cs16PlayerInfo {
  name: string;
  score: number;
  duration: number; // segundos conectado
}

export interface Cs16ServerStatus {
  online: boolean;
  hostname?: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  game?: string;
  error?: string;
  lastUpdate?: Date;
}

export interface Cs16ServerEntry {
  label: string;
  port: number;
}

export interface Cs16ServerStatusEntry extends Cs16ServerStatus {
  label: string;
  port: number;
  host: string;
}

function readCString(buf: Buffer, offset: number): { value: string; next: number } {
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  return { value: buf.toString('utf8', offset, end), next: end + 1 };
}

function parseA2sInfo(buf: Buffer): Cs16ServerStatus {
  // buf[0..3] = FF FF FF FF, buf[4] = 'I' (0x49, Source) o 'm' (0x6D, GoldSrc legado)
  let offset = 5;

  if (buf[4] === 0x6d) {
    // Formato GoldSrc legado: address\0hostname\0map\0folder\0game\0players\0maxplayers\0...
    const address = readCString(buf, offset); offset = address.next;
    const hostname = readCString(buf, offset); offset = hostname.next;
    const map = readCString(buf, offset); offset = map.next;
    const folder = readCString(buf, offset); offset = folder.next;
    const game = readCString(buf, offset); offset = game.next;
    const players = buf[offset]; offset += 1;
    const maxPlayers = buf[offset]; offset += 1;

    return {
      online: true,
      hostname: hostname.value,
      map: map.value,
      game: game.value,
      players,
      maxPlayers,
      lastUpdate: new Date(),
    };
  }

  // Formato Source moderno (por si el server respondiera así igual)
  offset += 1; // protocol version
  const name = readCString(buf, offset); offset = name.next;
  const map = readCString(buf, offset); offset = map.next;
  const folder = readCString(buf, offset); offset = folder.next;
  const game = readCString(buf, offset); offset = game.next;
  offset += 2; // steam appid
  const players = buf[offset]; offset += 1;
  const maxPlayers = buf[offset]; offset += 1;

  return {
    online: true,
    hostname: name.value,
    map: map.value,
    game: game.value,
    players,
    maxPlayers,
    lastUpdate: new Date(),
  };
}

function queryOne(host: string, port: number, timeoutMs = 2500): Promise<Cs16ServerStatus> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let done = false;

    const finish = (result: Cs16ServerStatus) => {
      if (done) return;
      done = true;
      try { socket.close(); } catch (e) { /* noop */ }
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ online: false, error: 'Timeout - servidor no responde', lastUpdate: new Date() }),
      timeoutMs,
    );

    socket.on('message', (msg) => {
      clearTimeout(timer);
      try {
        finish(parseA2sInfo(msg));
      } catch (e) {
        finish({ online: false, error: 'Respuesta inválida del servidor', lastUpdate: new Date() });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      finish({ online: false, error: err.message, lastUpdate: new Date() });
    });

    // A2S_INFO: FF FF FF FF 54 "Source Engine Query" 00
    const query = Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
      Buffer.from('Source Engine Query\0'),
    ]);
    socket.send(query, port, host);
  });
}

export async function getCs16ServerStatuses(
  entries: Cs16ServerEntry[],
  host?: string,
): Promise<Cs16ServerStatusEntry[]> {
  const realHost = host || process.env.CS16_SERVER_HOST || 'localhost';
  const results = await Promise.all(
    entries.map(async (entry) => {
      const status = await queryOne(realHost, entry.port);
      return { ...status, label: entry.label, port: entry.port, host: realHost };
    }),
  );
  return results;
}
