/**
 * Lector de demos de Quake 3 (.dm_66/.dm_67/.dm_68/.dm_71): decodifica el primer mensaje (gamestate)
 * para saber de qué partida es una demo sin confiar en el nombre del archivo.
 *
 * Devuelve el mapa, el servidor (sv_hostname), el tipo de juego, los jugadores conectados y quién
 * la grabó (clientNum del gamestate -> configstring de ese jugador = POV).
 *
 * Port fiel de ioquake3 (code/qcommon/huffman.c + msg.c, GPLv2): los mensajes de red van comprimidos
 * con un Huffman adaptativo cuyo árbol se arma agregando msg_hData[i] referencias de cada byte.
 * El árbol resultante depende del algoritmo exacto, por eso se copia tal cual (incluidos los swaps).
 */

// ---------------------------------------------------------------- Huffman (huffman.c)
const NYT = 256;
const INTERNAL_NODE = 257;

interface Ref { node: HNode | null; nextFree: Ref | null }
interface HNode {
  left: HNode | null; right: HNode | null; parent: HNode | null;
  next: HNode | null; prev: HNode | null;
  head: Ref | null;
  weight: number; symbol: number;
}

const nuevoNodo = (): HNode => ({ left: null, right: null, parent: null, next: null, prev: null, head: null, weight: 0, symbol: 0 });

class Huff {
  tree: HNode;
  lhead: HNode;
  loc: (HNode | null)[] = new Array(257).fill(null);
  private freelist: Ref | null = null;

  constructor() {
    const nyt = nuevoNodo();
    nyt.symbol = NYT;
    this.tree = this.lhead = this.loc[NYT] = nyt;
  }

  private getPpnode(): Ref {
    if (!this.freelist) return { node: null, nextFree: null };
    const r = this.freelist;
    this.freelist = r.nextFree;
    r.nextFree = null;
    return r;
  }

  private freePpnode(r: Ref) {
    r.node = null;
    r.nextFree = this.freelist;
    this.freelist = r;
  }

  private swap(n1: HNode, n2: HNode) {
    const p1 = n1.parent, p2 = n2.parent;
    if (p1) { if (p1.left === n1) p1.left = n2; else p1.right = n2; } else this.tree = n2;
    if (p2) { if (p2.left === n2) p2.left = n1; else p2.right = n1; } else this.tree = n1;
    n1.parent = p2;
    n2.parent = p1;
  }

  private static swaplist(n1: HNode, n2: HNode) {
    let t = n1.next; n1.next = n2.next; n2.next = t;
    t = n1.prev; n1.prev = n2.prev; n2.prev = t;
    if (n1.next === n1) n1.next = n2;
    if (n2.next === n2) n2.next = n1;
    if (n1.next) n1.next.prev = n1;
    if (n2.next) n2.next.prev = n2;
    if (n1.prev) n1.prev.next = n1;
    if (n2.prev) n2.prev.next = n2;
  }

  private increment(node: HNode | null) {
    // iterativo en la subida, igual orden que la recursión original
    const pila: HNode[] = [];
    while (node) {
      if (node.next !== null && node.next.weight === node.weight) {
        const lnode = node.head!.node!;
        if (lnode !== node.parent) this.swap(lnode, node);
        Huff.swaplist(lnode, node);
      }
      if (node.prev && node.prev.weight === node.weight) {
        node.head!.node = node.prev;
      } else {
        node.head!.node = null;
        this.freePpnode(node.head!);
      }
      node.weight++;
      if (node.next && node.next.weight === node.weight) {
        node.head = node.next.head;
      } else {
        node.head = this.getPpnode();
        node.head.node = node;
      }
      if (!node.parent) break;
      pila.push(node);
      node = node.parent;
    }
    // lo que en C pasa "a la vuelta" de cada llamada recursiva
    while (pila.length) {
      const n = pila.pop()!;
      if (n.prev === n.parent) {
        Huff.swaplist(n, n.parent!);
        if (n.head!.node === n) n.head!.node = n.parent;
      }
    }
  }

  addRef(ch: number) {
    if (this.loc[ch] === null) {
      const tnode = nuevoNodo(), tnode2 = nuevoNodo();
      tnode2.symbol = INTERNAL_NODE;
      tnode2.weight = 1;
      tnode2.next = this.lhead.next;
      if (this.lhead.next) {
        this.lhead.next.prev = tnode2;
        if (this.lhead.next.weight === 1) {
          tnode2.head = this.lhead.next.head;
        } else {
          tnode2.head = this.getPpnode();
          tnode2.head.node = tnode2;
        }
      } else {
        tnode2.head = this.getPpnode();
        tnode2.head.node = tnode2;
      }
      this.lhead.next = tnode2;
      tnode2.prev = this.lhead;

      tnode.symbol = ch;
      tnode.weight = 1;
      tnode.next = this.lhead.next;
      if (this.lhead.next) {
        this.lhead.next.prev = tnode;
        if (this.lhead.next.weight === 1) {
          tnode.head = this.lhead.next.head;
        } else {
          tnode.head = this.getPpnode();
          tnode.head.node = tnode2;
        }
      } else {
        tnode.head = this.getPpnode();
        tnode.head.node = tnode;
      }
      this.lhead.next = tnode;
      tnode.prev = this.lhead;
      tnode.left = tnode.right = null;

      if (this.lhead.parent) {
        if (this.lhead.parent.left === this.lhead) this.lhead.parent.left = tnode2;
        else this.lhead.parent.right = tnode2;
      } else {
        this.tree = tnode2;
      }
      tnode2.right = tnode;
      tnode2.left = this.lhead;
      tnode2.parent = this.lhead.parent;
      this.lhead.parent = tnode.parent = tnode2;
      this.loc[ch] = tnode;
      this.increment(tnode2.parent);
    } else {
      this.increment(this.loc[ch]);
    }
  }
}

// msg.c: msg_hData (frecuencias de cada byte en el tráfico de red de Quake 3)
const MSG_HDATA = [250315,41193,6292,7106,3730,3750,6110,23283,33317,6950,7838,9714,9257,17259,3949,1778,8288,1604,1590,1663,1100,1213,1238,1134,1749,1059,1246,1149,1273,
4486,2805,3472,21819,1159,1670,1066,1043,1012,1053,1070,1726,888,1180,850,960,780,1752,3296,10630,4514,5881,2685,4650,3837,2093,1867,2584,1949,1972,
940,1134,1788,1670,1206,5719,6128,7222,6654,3710,3795,1492,1524,2215,1140,1355,971,2180,1248,1328,1195,1770,1078,1264,1266,1168,965,1155,1186,1347,1228,
1529,1600,2617,2048,2546,3275,2410,3585,2504,2800,2675,6146,3663,2840,14253,3164,2221,1687,3208,2739,3512,4796,4091,3515,5288,4016,7937,6031,5360,3924,
4892,3743,4566,4807,5852,6400,6225,8291,23243,7838,7073,8935,5437,4483,3641,5256,5312,5328,5370,3492,2458,1694,1821,2121,1916,1149,1516,1367,1236,1029,
1258,1104,1245,1006,1149,1025,1241,952,1287,997,1713,1009,1187,879,1099,929,1078,951,1656,930,1153,1030,1262,1062,1214,1060,1621,930,1106,912,1034,
892,1158,990,1175,850,1121,903,1087,920,1144,1056,3462,2240,4397,12136,7758,1345,1307,3278,1950,886,1023,1112,1077,1042,1061,1071,1484,1001,1096,915,
1052,995,1070,876,1111,851,1059,805,1112,923,1103,817,1899,1872,976,841,1127,956,1159,950,7791,954,1289,933,1127,3207,1020,927,1355,768,1040,745,952,805,
1073,740,1013,805,1008,796,996,1057,11457,13504];

let arbol: HNode | null = null;
function arbolDecodificador(): HNode {
  if (!arbol) {
    const h = new Huff();
    for (let i = 0; i < 256; i++) for (let j = 0; j < MSG_HDATA[i]; j++) h.addRef(i);
    arbol = h.tree;
  }
  return arbol;
}

// ---------------------------------------------------------------- lectura de bits (msg.c, modo no-OOB)
class Msg {
  bit = 0;
  readcount = 0;
  constructor(private data: Uint8Array, private cursize: number, private tree: HNode) {}

  private getBit(): number {
    const b = (this.data[this.bit >> 3] >> (this.bit & 7)) & 1;
    this.bit++;
    return b;
  }

  readBits(bitsIn: number): number {
    if (this.readcount > this.cursize) return 0;
    let bits = bitsIn, sgn = false, value = 0;
    if (bits < 0) { bits = -bits; sgn = true; }
    let nbits = 0;
    if (bits & 7) {
      nbits = bits & 7;
      if (this.bit + nbits > this.cursize << 3) { this.readcount = this.cursize + 1; return 0; }
      for (let i = 0; i < nbits; i++) value |= this.getBit() << i;
      bits -= nbits;
    }
    const max = this.cursize << 3;
    for (let i = 0; i < bits; i += 8) {
      let node: HNode | null = this.tree, get = 0;
      while (node && node.symbol === INTERNAL_NODE) {
        if (this.bit >= max) { node = null; this.bit = max + 1; break; }
        node = this.getBit() ? node.right : node.left;
      }
      if (node) get = node.symbol;
      value = (value | (get << (i + nbits))) >>> 0;
      if (this.bit > max) { this.readcount = this.cursize + 1; return 0; }
    }
    this.readcount = (this.bit >> 3) + 1;
    const total = bitsIn < 0 ? -bitsIn : bitsIn;
    if (sgn && total > 0 && total < 32 && value & (1 << (total - 1))) value |= -1 ^ ((1 << total) - 1);
    return total === 32 ? value | 0 : value;
  }

  readByte(): number {
    const c = this.readBits(8) & 0xff;
    return this.readcount > this.cursize ? -1 : c;
  }
  readShort(): number {
    const c = this.readBits(16);
    if (this.readcount > this.cursize) return -1;
    return (c << 16) >> 16;
  }
  readLong(): number {
    const c = this.readBits(32);
    return this.readcount > this.cursize ? -1 : c | 0;
  }
  readBigString(): string {
    let s = "";
    for (;;) {
      let c = this.readByte();
      if (c === -1 || c === 0) break;
      if (c === 37 /* % */ || c > 127) c = 46; /* . */
      if (s.length >= 8191) break;
      s += String.fromCharCode(c);
    }
    return s;
  }
}

// entityStateFields (msg.c): bits por campo, 0 = float
const ENTITY_FIELD_BITS = [32, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 8, 8, 8, 8, 10, 8, 19, 10, 8, 8, 0, 32, 8, 0, 0, 0, 24, 16, 8, 10,
  8, 8, 0, 0, 0, 8, 0, 32, 32, 32, 0, 0, 0, 0, 32, 0, 0, 0, 32, 16];
const GENTITYNUM_BITS = 10;
const FLOAT_INT_BITS = 13;

function saltearDeltaEntity(m: Msg) {
  if (m.readBits(1) === 1) return;          // remove
  if (m.readBits(1) === 0) return;          // sin cambios
  const lc = m.readByte();
  if (lc < 0 || lc > ENTITY_FIELD_BITS.length) throw new Error("campo de entidad inválido");
  for (let i = 0; i < lc; i++) {
    if (!m.readBits(1)) continue;
    const bits = ENTITY_FIELD_BITS[i];
    if (bits === 0) {
      if (m.readBits(1) === 0) continue;
      m.readBits(m.readBits(1) === 0 ? FLOAT_INT_BITS : 32);
    } else if (m.readBits(1) !== 0) {
      m.readBits(bits);
    }
  }
}

// ---------------------------------------------------------------- API
const SVC_NOP = 1, SVC_GAMESTATE = 2, SVC_CONFIGSTRING = 3, SVC_BASELINE = 4, SVC_EOF = 8;
const MAX_CONFIGSTRINGS = 1024;

export interface DemoJugador { slot: number; nombre: string; nombreLimpio: string; equipo: string | null }
export interface DemoInfo {
  mapa: string;
  servidor: string;
  servidorLimpio: string;
  gametype: string | null;
  juego: string | null;
  jugadores: DemoJugador[];
  grabadaPor: DemoJugador | null;
  clientNum: number;
}

export function infoString(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const partes = s.split("\\");
  for (let i = s.startsWith("\\") ? 1 : 0; i + 1 < partes.length; i += 2) out[partes[i].toLowerCase()] = partes[i + 1];
  return out;
}

/** Saca los códigos de color de Quake 3 (^1, ^a...) y los de CPMA (^xRRGGBB). */
export function limpiarNombreQ3(nombre: string): string {
  return nombre.replace(/\^x[0-9a-fA-F]{6}/g, "").replace(/\^[^^]/g, "").replace(/\^/g, "").trim();
}

/** Decodifica el gamestate de una demo. Tira Error si el archivo no es una demo de Quake 3 válida. */
export function leerDemoQ3(buf: Uint8Array): DemoInfo {
  if (buf.length < 16) throw new Error("archivo demasiado chico para ser una demo");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 0, gamestate: Map<number, string> | null = null, clientNum = -1;
  // la demo arranca con el gamestate; a lo sumo miramos los primeros mensajes
  for (let intento = 0; intento < 4 && !gamestate; intento++) {
    if (pos + 8 > buf.length) break;
    /* const secuencia = */ dv.getInt32(pos, true);
    const largo = dv.getInt32(pos + 4, true);
    pos += 8;
    if (largo === -1) break;
    if (largo <= 0 || largo > 16384 * 2 || pos + largo > buf.length) throw new Error("mensaje de largo inválido: no es una demo de Quake 3");
    const m = new Msg(buf.subarray(pos, pos + largo), largo, arbolDecodificador());
    pos += largo;
    m.readLong();                                      // reliableAcknowledge
    for (;;) {
      const cmd = m.readByte();
      if (cmd === SVC_EOF || cmd === -1) break;
      if (cmd === SVC_NOP) continue;
      if (cmd !== SVC_GAMESTATE) break;                // otro tipo de mensaje: probamos el siguiente
      m.readLong();                                    // serverCommandSequence
      const cs = new Map<number, string>();
      for (;;) {
        const c = m.readByte();
        if (c === SVC_EOF) break;
        if (c === SVC_CONFIGSTRING) {
          const i = m.readShort();
          if (i < 0 || i >= MAX_CONFIGSTRINGS) throw new Error("configstring fuera de rango");
          cs.set(i, m.readBigString());
        } else if (c === SVC_BASELINE) {
          const num = m.readBits(GENTITYNUM_BITS);
          if (num < 0 || num >= 1 << GENTITYNUM_BITS) throw new Error("baseline inválido");
          saltearDeltaEntity(m);
        } else {
          throw new Error(`comando inesperado en el gamestate (${c})`);
        }
      }
      clientNum = m.readLong();
      gamestate = cs;
      break;
    }
  }
  if (!gamestate) throw new Error("no encontré el gamestate: no es una demo de Quake 3");

  const serverinfo = infoString(gamestate.get(0) || "");
  if (!serverinfo.mapname) throw new Error("la demo no tiene mapa: archivo dañado o no es una demo");

  // jugadores: configstrings tipo "n\Nombre\t\1\..." (CS_PLAYERS; el índice base varía según el mod)
  const candidatos = Array.from(gamestate.entries()).filter(([, v]) => /^n\\/.test(v)).map(([i]) => i);
  const base = candidatos.length ? Math.min(...candidatos.filter((i) => i >= 512), 544) : 544;
  const jugadores: DemoJugador[] = [];
  for (let slot = 0; slot < 64; slot++) {
    const v = gamestate.get(base + slot);
    if (!v) continue;
    const info = infoString(v);
    if (info.n === undefined) continue;
    jugadores.push({ slot, nombre: info.n, nombreLimpio: limpiarNombreQ3(info.n), equipo: info.t ?? null });
  }
  return {
    mapa: serverinfo.mapname,
    servidor: serverinfo.sv_hostname || "",
    servidorLimpio: limpiarNombreQ3(serverinfo.sv_hostname || ""),
    gametype: serverinfo.g_gametype ?? null,
    juego: serverinfo.gamename ?? null,
    jugadores,
    grabadaPor: jugadores.find((j) => j.slot === clientNum) || null,
    clientNum,
  };
}
