# Sistema de Estadísticas y Páginas de Juegos

## 📋 Descripción

Se ha implementado un sistema completo de estadísticas y páginas individuales para cada juego. El sistema parsea archivos XML de estadísticas de CPMA (Challenge ProMode Arena) y ofrece rankings, análisis de partidas y visualización de datos.

## ✨ Características Implementadas

### 1. Páginas Individuales por Juego
- ✅ Cada juego ahora tiene su propia página de detalle
- ✅ URL dinámica: `/games/{nombre-del-juego}`
- ✅ Sistema de pestañas con diferentes secciones:
  - **Información**: Descripción, características, estado del servidor
  - **Rankings**: Rankings globales con filtros (solo Quake 3)
  - **Partidas**: Historial completo de partidas (solo Quake 3)
  - **Media**: Imágenes y videos (próximamente)

### 2. Parser de Estadísticas CPMA
- ✅ Parser completo de archivos XML de CPMA
- ✅ Lee estadísticas desde `G:\Games\Quake3\cpma\stats`
- ✅ Organización por fecha (año/mes/día)
- ✅ Extrae datos completos:
  - Jugadores y equipos
  - Kills, deaths, damage
  - Armas utilizadas y precisión
  - Stats de CTF (capturas, defensas, retornos)
  - Items y powerups recogidos

### 3. Sistema de Rankings
- ✅ **Ranking Global**: Acumulado de todas las partidas
- ✅ **Ranking por Partida**: Resultados individuales
- ✅ Filtros disponibles:
  - Por rango de fechas
  - Por mapa
  - Por tipo de juego
  - Mínimo de partidas jugadas
  - Ordenar por: score, kills, K/D ratio, capturas, defensas

### 4. API Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/stats/matches` | GET | Obtiene todas las partidas |
| `/api/stats/matches/:year/:month/:day` | GET | Partidas de un día específico |
| `/api/stats/ranking/global` | POST | Ranking global con filtros |
| `/api/stats/server` | GET | Estadísticas generales del servidor |
| `/api/stats/top-players` | GET | Top jugadores por categoría |

### 5. Componentes de UI

#### `GlobalRanking`
- Muestra el ranking global de jugadores
- Top 20 por defecto
- Medallas para los primeros 3 lugares
- Métricas: Score, Kills, Deaths, K/D, Partidas, Promedio

#### `RecentMatches`
- Historial de las últimas 15 partidas
- Vista expandible con detalles de cada partida
- Información de equipos y jugadores
- Fecha, mapa, modo, duración

#### `ServerStatsOverview`
- Estadísticas generales del servidor
- Total de partidas, jugadores, kills
- Mapas y modos más jugados
- K/D ratio promedio

## 📁 Estructura de Archivos

```
shared/
  stats-schema.ts          # Schemas y tipos TypeScript con Zod

server/
  stats-parser.ts          # Parser de XML de CPMA
  stats-service.ts         # Lógica de negocio para rankings
  routes.ts                # Endpoints de la API

client/src/
  pages/
    GameDetail.tsx         # Página individual de cada juego
  components/
    GameCard.tsx           # Card de juego (actualizado con link)
    GlobalRanking.tsx      # Componente de ranking global
    RecentMatches.tsx      # Componente de partidas recientes
    ServerStatsOverview.tsx # Componente de stats del servidor
```

## 🎮 Formato de Archivos XML

Los archivos XML de CPMA siguen esta estructura:

```xml
<match id="0" datetime="2026/02/13 17:13:16" map="crewctf" type="CTFS" isTeamGame="true" duration="574">
  <team name="" score="5">
    <player name="Jugador1">
      <stat name="Score" value="8"/>
      <stat name="Kills" value="6"/>
      <stat name="Deaths" value="5"/>
      <!-- ... más stats ... -->
      <weapons>
        <weapon name="RL" hits="5" shots="46" kills="1"/>
      </weapons>
      <CTF>
        <stat name="Captures" value="0"/>
        <stat name="Defense" value="2"/>
      </CTF>
    </player>
  </team>
</match>
```

## 🚀 Uso

### Acceder a la página de un juego

Desde las tarjetas de juegos en la página principal, hacer click en el botón **"Info"**:

```
http://localhost:5000/games/quake-3-arena
http://localhost:5000/games/counter-strike-1-6
```

### Consultar rankings via API

```javascript
// Ranking global con filtros
const response = await fetch('/api/stats/ranking/global', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    map: 'crewctf',
    sortBy: 'kdRatio',
    minMatches: 5
  })
});

const { ranking } = await response.json();
```

## 🔧 Configuración

La ruta base de las estadísticas se configura en `server/stats-parser.ts`:

```typescript
const STATS_BASE_PATH = 'G:\\Games\\Quake3\\cpma\\stats';
```

Para usar una ruta diferente, modifica esta constante.

## 📊 Métricas Calculadas

### Por Jugador
- **Score Total**: Suma de puntos en todas las partidas
- **Kills/Deaths**: Total de bajas y muertes
- **K/D Ratio**: Kills dividido Deaths
- **Net**: Diferencia entre kills y deaths
- **Damage Given/Taken**: Daño infligido y recibido
- **Avg Score**: Promedio de score por partida
- **CTF Stats**: Capturas, asistencias, defensas, retornos

### Por Servidor
- Total de partidas jugadas
- Total de jugadores únicos
- Total de kills y deaths
- Daño total infligido
- Mapas más jugados
- Modos más jugados

## 🎯 Próximas Mejoras

- [ ] Caché de estadísticas para mejor rendimiento
- [ ] Gráficos de progreso temporal
- [ ] Comparación de jugadores head-to-head
- [ ] Sistema de achievements/insignias
- [ ] Integración con vídeos de partidas
- [ ] Heatmaps de mapas
- [ ] Estadísticas de armas favoritas
- [ ] Rankings por temporada/mes

## 🐛 Solución de Problemas

### Los rankings no se cargan
1. Verificar que la ruta `STATS_BASE_PATH` sea correcta
2. Verificar que existan archivos XML en la carpeta
3. Revisar los logs del servidor para errores de parsing

### Error "Failed to fetch matches"
1. Asegurarse de que el servidor esté corriendo
2. Verificar que los endpoints estén registrados correctamente
3. Revisar la consola del navegador para detalles del error

## 📝 Notas Técnicas

- El parser usa `xml2js` para procesar los archivos XML
- Todos los tipos están validados con Zod
- Las consultas se manejan con React Query para caching automático
- El sistema es totalmente asíncrono para no bloquear el servidor

## 🤝 Créditos

Inspirado por herramientas como:
- [q3stats](https://github.com/bboozzoo/q3stats)
- CPMA Statistics System
