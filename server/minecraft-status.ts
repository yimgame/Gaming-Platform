import net from 'net';

// Consulta en vivo de servers Minecraft Java Edition via el protocolo
// "Server List Ping" (SLP): handshake + status request por TCP, el server
// responde con un JSON (motd, versión, jugadores online/max).
// Referencia: https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping

export interface MinecraftServerStatus {
  online: boolean;
  motd?: string;
  version?: string;
  players?: number;
  maxPlayers?: number;
  playerSample?: string[];
  error?: string;
  lastUpdate?: Date;
}

export interface MinecraftServerEntry {
  label: string;
  port: number;
}

export interface MinecraftServerStatusEntry extends MinecraftServerStatus {
  label: string;
  port: number;
  host: string;
}

function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value;
  do {
    let temp = v & 0b01111111;
    v >>>= 7;
    if (v !== 0) temp |= 0b10000000;
    bytes.push(temp);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buf: Buffer, offset: number): { value: number; size: number } {
  let value = 0;
  let size = 0;
  let byte: number;
  do {
    byte = buf[offset + size];
    value |= (byte & 0b01111111) << (7 * size);
    size++;
    if (size > 5) throw new Error('VarInt demasiado largo');
  } while ((byte & 0b10000000) !== 0);
  return { value, size };
}

function buildPacket(packetId: number, payload: Buffer): Buffer {
  const idBuf = writeVarInt(packetId);
  const body = Buffer.concat([idBuf, payload]);
  const lengthBuf = writeVarInt(body.length);
  return Buffer.concat([lengthBuf, body]);
}

function stringField(value: string): Buffer {
  const strBuf = Buffer.from(value, 'utf8');
  return Buffer.concat([writeVarInt(strBuf.length), strBuf]);
}

function queryOne(host: string, port: number, timeoutMs = 3000): Promise<MinecraftServerStatus> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    let buffer = Buffer.alloc(0);

    const finish = (result: MinecraftServerStatus) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish({ online: false, error: 'Timeout - servidor no responde', lastUpdate: new Date() }));
    socket.on('error', (err) => finish({ online: false, error: err.message, lastUpdate: new Date() }));

    socket.connect(port, host, () => {
      // Handshake: protocolo (-1 = "no importa"), host, puerto, next_state=1 (status)
      const handshakePayload = Buffer.concat([
        writeVarInt(-1),
        stringField(host),
        (() => { const b = Buffer.alloc(2); b.writeUInt16BE(port, 0); return b; })(),
        writeVarInt(1),
      ]);
      const handshake = buildPacket(0x00, handshakePayload);
      const statusRequest = buildPacket(0x00, Buffer.alloc(0));
      socket.write(Buffer.concat([handshake, statusRequest]));
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const { value: packetLength, size: lenSize } = readVarInt(buffer, 0);
        if (buffer.length < lenSize + packetLength) return; // esperar mas datos

        let offset = lenSize;
        const { value: packetId, size: idSize } = readVarInt(buffer, offset);
        offset += idSize;
        if (packetId !== 0x00) {
          finish({ online: false, error: 'Respuesta inesperada del servidor', lastUpdate: new Date() });
          return;
        }

        const { value: jsonLength, size: jsonLenSize } = readVarInt(buffer, offset);
        offset += jsonLenSize;
        const jsonStr = buffer.toString('utf8', offset, offset + jsonLength);
        const parsed = JSON.parse(jsonStr);

        const description = parsed.description;
        const motd = typeof description === 'string'
          ? description
          : (description?.text || (Array.isArray(description?.extra) ? description.extra.map((e: any) => e.text).join('') : '')) || '';

        finish({
          online: true,
          motd,
          version: parsed.version?.name,
          players: parsed.players?.online ?? 0,
          maxPlayers: parsed.players?.max ?? 0,
          playerSample: (parsed.players?.sample || []).map((p: any) => p.name),
          lastUpdate: new Date(),
        });
      } catch (e) {
        // Puede que todavia no llegaron todos los bytes del JSON; seguimos esperando
        // salvo que ya se nos vaya la mano con el tamaño del buffer (server raro).
        if (buffer.length > 1_000_000) {
          finish({ online: false, error: 'Respuesta demasiado grande / inválida', lastUpdate: new Date() });
        }
      }
    });
  });
}

export async function getMinecraftServerStatuses(
  entries: MinecraftServerEntry[],
  host?: string,
): Promise<MinecraftServerStatusEntry[]> {
  const realHost = host || process.env.MINECRAFT_SERVER_HOST || 'localhost';
  const results = await Promise.all(
    entries.map(async (entry) => {
      const status = await queryOne(realHost, entry.port);
      return { ...status, label: entry.label, port: entry.port, host: realHost };
    }),
  );
  return results;
}
