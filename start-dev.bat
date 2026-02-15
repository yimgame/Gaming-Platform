@echo off
echo ================================================
echo  YIM Gaming - Servidor de Desarrollo
echo ================================================
echo.
echo Iniciando servidor en modo desarrollo...
echo URL: http://localhost:5001
echo.
echo Para detener: Ctrl + C
echo ================================================
echo.

set NODE_ENV=development
set PORT=5001

if "%DB_PORT%"=="" (
	set DB_PORT=5433
)

if "%DATABASE_URL%"=="" (
	set DATABASE_URL=postgres://postgres:postgres@localhost:%DB_PORT%/app_db
)

echo DB: %DATABASE_URL%

npx tsx server/index-dev.ts

pause
