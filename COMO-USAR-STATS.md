# 🎮 Cómo Usar el Sistema de Estadísticas

## ✅ Sistema Verificado y Funcionando

El parser de estadísticas está **completamente funcional** y lee todos los archivos XML de CPMA.

### 📊 Datos Actuales
- **823 partidas** parseadas
- **156 jugadores** únicos
- **49 mapas** diferentes
- **69,902 kills** totales
- **14,837,109** de daño total

## 🚀 Levantar el Servidor

### Opción 1: Modo Desarrollo (Recomendado para testing)

```powershell
# En Windows PowerShell
$env:NODE_ENV="development"
$env:PORT="5001"
npx tsx server/index-dev.ts
```

### Opción 2: Modo Producción

```powershell
# Primero compilar
npm run build

# Luego ejecutar
npm start
```

## 🔗 Endpoints Disponibles

Una vez que el servidor esté corriendo en `http://localhost:5001`:

### 1. Ver todas las partidas
```bash
GET http://localhost:5001/api/stats/matches
```

### 2. Ver partidas de un día específico
```bash
GET http://localhost:5001/api/stats/matches/2026/02/13
```

### 3. Ver ranking global
```bash
POST http://localhost:5001/api/stats/ranking/global
Content-Type: application/json

{
  "sortBy": "score",
  "minMatches": 5
}
```

### 4. Ver estadísticas del servidor
```bash
GET http://localhost:5001/api/stats/server
```

### 5. Ver top jugadores
```bash
GET http://localhost:5001/api/stats/top-players?limit=10
```

## 🌐 Acceder a las Páginas

Una vez el servidor esté corriendo:

1. **Página Principal**: `http://localhost:5001`
2. **Quake 3 Arena Stats**: `http://localhost:5001/games/quake-3-arena`
   - Pestaña "Rankings" - Ver el ranking global
   - Pestaña "Partidas" - Ver historial de partidas

## 🧪 Probar el Sistema

Ejecuta el script de test para verificar que todo funciona:

```powershell
npx tsx server/test-stats.ts
```

Este script probará:
- ✅ Lectura de archivos XML individuales
- ✅ Lectura de partidas por día
- ✅ Lectura de todas las partidas
- ✅ Cálculo de rankings
- ✅ Estadísticas del servidor

## 📝 Ejemplo de Respuesta de Ranking

```json
{
  "ranking": [
    {
      "rank": 1,
      "name": "ScottyFox",
      "totalScore": 3710,
      "totalKills": 1776,
      "totalDeaths": 1795,
      "totalMatches": 207,
      "kdRatio": 0.99,
      "avgScore": 17.92,
      "totalDamageGiven": 372500,
      "totalDamageTaken": 380200,
      "captures": 45,
      "defenses": 89
    },
    {
      "rank": 2,
      "name": "Yim",
      "totalScore": 3475,
      "totalKills": 2120,
      "totalDeaths": 700,
      "totalMatches": 166,
      "kdRatio": 3.03,
      "avgScore": 20.93,
      "totalDamageGiven": 425000,
      "totalDamageTaken": 150000,
      "captures": 67,
      "defenses": 102
    }
  ]
}
```

## 🎯 Top 5 Jugadores Actuales

1. **ScottyFox** - 3,710 pts | K/D: 0.99 | 207 partidas
2. **Yim** - 3,475 pts | K/D: 3.03 | 166 partidas
3. **Redbaron** - 3,405 pts | K/D: 1.35 | 127 partidas
4. **The** - 3,328 pts | K/D: 1.16 | 209 partidas
5. **Panzer** - 2,464 pts | K/D: 1.08 | 191 partidas

## 🗺️ Mapas Más Jugados

1. **simple-ctf2** - 121 partidas
2. **turboctf01** - 85 partidas  
3. **quadctf** - 78 partidas

## ⚙️ Configuración

La ruta de los stats se configura en `server/stats-parser.ts`:

```typescript
const STATS_BASE_PATH = 'G:\\Games\\Quake3\\cpma\\stats';
```

Para cambiarla, modifica esta constante.

## 🐛 Troubleshooting

### El servidor no inicia
```powershell
# Verificar si el puerto está en uso
Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue

# Si está en uso, matar el proceso
Get-Process -Id (Get-NetTCPConnection -LocalPort 5001).OwningProcess | Stop-Process -Force
```

### No se cargan las estadísticas
1. Verificar que la ruta `G:\Games\Quake3\cpma\stats` existe
2. Verificar que hay archivos .xml en las subcarpetas
3. Ejecutar el test: `npx tsx server/test-stats.ts`

### Errores de parsing
Los errores de parsing de archivos individuales se registran en la consola pero no detienen el proceso completo.

## 📱 Acceso desde otros dispositivos

Para acceder desde otros dispositivos en tu red:

1. El servidor escucha en `0.0.0.0`, así que está disponible en todas las interfaces
2. Encuentra tu IP local: `ipconfig` (busca IPv4)
3. Accede desde otro dispositivo: `http://TU_IP:5001`

Ejemplo: `http://192.168.1.100:5001`

## 🎨 Características de la UI

- **Rankings con medallas** para los top 3 jugadores
- **Historial expandible** de partidas
- **Filtros dinámicos** por fecha, mapa, tipo de juego
- **Estadísticas en tiempo real** del servidor
- **Diseño responsivo** para móviles y desktop
- **Tema oscuro** con estilo retro gaming

## 📦 Dependencias Clave

- `xml2js` - Parser de XML
- `zod` - Validación de schemas
- `react-query` - Caché y sincronización de datos
- `express` - Servidor HTTP

## 🔮 Próximas Mejoras

- [ ] Caché de rankings para mejor rendimiento
- [ ] WebSocket para stats en vivo
- [ ] Gráficos de progreso temporal
- [ ] Comparación head-to-head entre jugadores
- [ ] Sistema de achievements
- [ ] Integración con videos de partidas
