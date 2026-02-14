# 🎮 YIM Gaming - Guía de Desarrollo Dual (Docker + Local)

## 📋 Configuración Actual

El proyecto funciona en **DOS MODOS** simultáneamente:

### 🐳 **Docker (Producción)**
- **URL**: https://yim.servegame.com
- **Puerto**: 80 (HTTP) / 443 (HTTPS)
- **SSL**: Certificado Let's Encrypt
- **Base de datos**: PostgreSQL en contenedor
- **Stats**: Montado desde `G:\Games\Quake3\cpma\stats`

### 💻 **npm Local (Desarrollo)**
- **URL**: http://localhost:5001
- **Puerto**: 5001
- **Stats**: Lee directamente desde `G:\Games\Quake3\cpma\stats`
- **Hot Reload**: Cambios instantáneos con Vite

---

## 🚀 Comandos Principales

### **Desarrollo Local (Rápido)**
```powershell
# Iniciar servidor de desarrollo
npm run dev

# O manualmente:
$env:NODE_ENV="development"
npx tsx server/index-dev.ts
```

**Ventajas:**
- ✅ Hot reload instantáneo
- ✅ Ver errores en tiempo real
- ✅ Desarrollo más rápido
- ✅ No requiere rebuild

**Usar para:**
- Probar nuevas features
- Debuggear código
- Ver stats en tiempo real

---

### **Producción Docker (Estable)**
```powershell
# Ver contenedores activos
docker ps

# Ver logs del servidor
docker logs yim-gaming-app -f

# Reiniciar después de cambios
docker-compose down
docker-compose up -d --build

# Ver stats dentro del contenedor
docker exec -it yim-gaming-app ls -la /app/stats
```

**Ventajas:**
- ✅ Configuración de producción real
- ✅ SSL/HTTPS funcionando
- ✅ Nginx como proxy
- ✅ Base de datos persistente

**Usar para:**
- Deploy final
- Probar en producción
- Acceso público
- SSL/HTTPS

---

## 🔄 Workflow Recomendado

### **Durante Desarrollo:**
```powershell
# 1. Hacer cambios en el código
# 2. Probar localmente
npm run dev

# 3. Abrir navegador
http://localhost:5001/games/quake-3-arena

# 4. Ver stats en tiempo real
```

### **Para Deploy a Producción:**
```powershell
# 1. Detener Docker
docker-compose down

# 2. Reconstruir con cambios
docker-compose up -d --build

# 3. Verificar logs
docker logs yim-gaming-app -f

# 4. Acceder
https://yim.servegame.com
```

---

## 📊 Sistema de Stats

### **Variables de Entorno**

| Variable | Desarrollo Local | Producción Docker |
|----------|------------------|-------------------|
| `STATS_PATH` | No necesario | `/app/stats` |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `5001` | `5001` |

### **Rutas de Archivos**

**Local (Windows):**
```
G:\Games\Quake3\cpma\stats\
  └── 2026\
      └── 02\
          └── 13\
              ├── 17_13_16.xml
              ├── 17_03_27.xml
              └── ...
```

**Docker (Contenedor):**
```
/app/stats/
  └── 2026/
      └── 02/
          └── 13/
              ├── 17_13_16.xml
              ├── 17_03_27.xml
              └── ...
```

---

## 🛠️ Troubleshooting

### **Stats no cargan en Docker**
```powershell
# 1. Verificar que el volumen esté montado
docker exec -it yim-gaming-app ls -la /app/stats

# 2. Ver logs del parser
docker logs yim-gaming-app | grep "stats"

# 3. Verificar variable de entorno
docker exec -it yim-gaming-app env | grep STATS_PATH
```

### **Puerto 5001 ocupado localmente**
```powershell
# Detener procesos de Node
Get-Process | Where-Object { $_.ProcessName -eq 'node' } | Stop-Process -Force

# O cambiar puerto
$env:PORT="5002"
npm run dev
```

### **Docker no levanta**
```powershell
# Ver todos los contenedores
docker ps -a

# Ver logs de error
docker-compose logs

# Reiniciar todo
docker-compose down
docker-compose up -d --build
```

---

## 📦 Estructura de Contenedores

```
┌─────────────────────────────────────┐
│  yim-gaming-nginx (Puerto 80/443)   │
│  Proxy reverso + SSL                │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  yim-gaming-app (Puerto 5001)       │
│  Node.js + Express + Stats Parser   │
│  Stats: G:\...\cpma\stats → /app/stats
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  yim-gaming-db (Puerto 5432)        │
│  PostgreSQL 15                      │
└─────────────────────────────────────┘
```

---

## 🎯 Quick Commands

```powershell
# Desarrollo Local
npm run dev                          # Iniciar dev server
npx tsx server/test-stats.ts        # Probar stats parser

# Docker Producción
docker-compose up -d                 # Iniciar contenedores
docker-compose down                  # Detener contenedores
docker-compose up -d --build         # Rebuild + reiniciar
docker logs yim-gaming-app -f        # Ver logs en vivo

# Stats
curl http://localhost:5001/api/stats/server   # Stats del servidor
curl http://localhost:5001/api/stats/matches  # Todas las partidas
```

---

## 💡 Tips

### **Desarrollo Rápido:**
- Usa `npm run dev` para cambios frecuentes
- Hot reload detecta cambios automáticamente
- No necesitas reiniciar el servidor

### **Testing en Producción:**
- Usa Docker para probar como producción real
- Recuerda hacer rebuild después de cambios
- Los stats se actualizan automáticamente

### **Organización:**
- Commitea cambios cuando funcionan en local
- Haz deploy a Docker solo cuando esté probado
- Mantén `docker-compose.yml` versionado

---

## 📝 Checklist de Deploy

- [ ] Cambios funcionan en desarrollo local
- [ ] Tests pasan (`npx tsx server/test-stats.ts`)
- [ ] Código commiteado
- [ ] `docker-compose down`
- [ ] `docker-compose up -d --build`
- [ ] Verificar logs: `docker logs yim-gaming-app -f`
- [ ] Probar en navegador: https://yim.servegame.com
- [ ] Verificar stats funcionan
- [ ] Verificar SSL activo

---

## 🔒 Seguridad

- Los stats se montan como **solo lectura** (`:ro`) en Docker
- La base de datos tiene persistencia en volumen Docker
- SSL manejado automáticamente por Certbot
- Certificados se renuevan automáticamente

---

## 🎮 URLs Importantes

| Servicio | Desarrollo | Producción |
|----------|-----------|------------|
| **Web Principal** | http://localhost:5001 | https://yim.servegame.com |
| **Quake 3 Stats** | http://localhost:5001/games/quake-3-arena | https://yim.servegame.com/games/quake-3-arena |
| **API Stats** | http://localhost:5001/api/stats/server | https://yim.servegame.com/api/stats/server |
| **API Matches** | http://localhost:5001/api/stats/matches | https://yim.servegame.com/api/stats/matches |
