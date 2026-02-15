# Multi Gaming Community

Portal multijuegos con frontend React, backend Node/Express y panel admin para gestionar catálogo de juegos.

Estado actual: Quake 3 (CPMA) funciona con stats, ranking, partidas recientes, capturas/demos correlacionadas y asociación manual protegida por token.

## 🖼️ Galeria

| Servidor Online | Ranking | Partidas Recientes | Galeria |
| --- | --- | --- | --- |
| ![Servidor online](q3a-online.jpg) | ![Ranking](q3a-ranking.jpg) | ![Partidas recientes](q3a-recent-match-detail.jpg) | ![Galeria](q3a-gallery.jpg) |


## Características clave

- Catálogo dinámico de juegos (alta, edición y baja desde `/admin`)
- Página por juego con imagen de tarjeta, fondo, descripción y estado
- Estado en tiempo real para Quake 3 cpma full funcional (`/api/server/status`)
- Stats CPMA desde XML (ranking global, partidas históricas, top jugadores)
- Correlación automática de capturas y demos por tipo/mapa/fecha
- Asociación manual de assets por partida (solo admin con token por url/admin)
- Deploy con Docker + Nginx + Certbot (HTTPS)

## Stack

- Frontend: React 18, TypeScript, Tailwind, shadcn/ui, TanStack Query, Wouter
- Backend: Node.js, Express, Drizzle ORM, PostgreSQL
- Infra: Vite, Docker Compose, Nginx, Let's Encrypt

## Configuración (`.env`)

Usa `.env.example` como base.

```env
NODE_ENV=production
PORT=5001
DOMAIN=tu-dominio-o-ip
DATABASE_URL=postgres://postgres:postgres@db:5432/app_db
CERTBOT_EMAIL=tu-email@gmail.com

# Seguridad admin
ADMIN_TOKEN=pon-un-token-largo-y-seguro

# Rutas base (multijuego)
# QUAKE1_BASE_PATH=G:\Games\Quake\id1
# QUAKE2_BASE_PATH=G:\Games\Quake2\baseq2
# QUAKE3_BASE_PATH=G:\Games\Quake3\baseq3
# QUAKE3_MOD_PATH=G:\Games\Quake3\cpma
# COUNTER16_BASE_PATH=G:\Games\Counter-Strike 1.6\cstrike
# CS2_BASE_PATH=G:\Games\cs2\cs2
# MINECRAFT_BASE_PATH=G:\Games\Minecraft

# Compatibilidad (si ya usas ruta única)
QUAKE_BASE_PATH=G:\Games\Quake3\cpma

# Overrides explícitos (opcionales)
# STATS_PATH=G:\Games\Quake3\cpma\stats
# SCREENSHOTS_PATH=G:\Games\Quake3\cpma\screenshots
# DEMOS_PATH=G:\Games\Quake3\cpma\demos
```

## Ejecución

### Desarrollo local (Windows)

```bash
npm install
start-dev.bat
```

También puedes usar:

```bash
npm run dev
```

Si usas `npm run dev`, define `DATABASE_URL` antes de arrancar.

### Producción (Docker)

```bash
docker-compose up -d --build
```

Requisitos mínimos para HTTPS público:

- Dominio apuntando a tu IP pública
- Puertos 80 y 443 abiertos/forwarded al host

## Admin y Token

- Panel: `/admin`
- El token se activa/desactiva en el panel y se guarda en `localStorage` como `adminToken`
- Header requerido en endpoints protegidos: `x-admin-token`
- Si no es válido: `403`

### Endpoints protegidos

- `GET /api/admin/status`
- `GET /api/admin/config`
- `GET /api/admin/games`
- `POST /api/admin/games`
- `PUT /api/admin/games/:id`
- `DELETE /api/admin/games/:id`
- `POST /api/match-assets`

## Stats y assets (Quake 3)

- Stats se leen de XML CPMA (no de PostgreSQL)
- PostgreSQL se usa para datos de app (por ejemplo asociaciones manuales)
- Correlación automática por ventana temporal ±4 min
- Script de backfill:

```bash
npm run assets:auto-associate
```

Endpoints principales:

- `GET /api/stats/matches`
- `POST /api/stats/ranking/global`
- `GET /api/stats/server`
- `GET /api/screenshots/match`
- `GET /api/demos/match`

## Troubleshooting rápido

- `5001` ocupado: libera el puerto antes de iniciar
- `DATABASE_URL must be set`: define `DATABASE_URL` o usa `start-dev.bat`
- No aparecen juegos en home: backend viejo; reinicia servidor actualizado
- Stats vacíos: revisa rutas CPMA (`cpma`, no `cmpa`) y `STATS_PATH`
- Certbot falla validación: verifica DNS + puertos 80/443
- Falla DB revisar puerto defaul 5432 para postgres

## 📁 Estructura del Proyecto

```
yim.servegame.com/
├── client/                 # React Frontend
├── server/                 # Node.js Backend
├── shared/                 # Tipos y schemas
├── docker-compose.yml
├── nginx.conf
└── README.md
```

## Autor

## ✨ Autor

Desarrollado con amor por GitHub Copilot (Claude Sonnet 4.5 / Chat-GPT 5.3)

🤖 AI-Powered Development for the Quake 3 Community

Just coding 4 fun !!!

