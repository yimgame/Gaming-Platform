@echo off
echo ================================================
echo  YIM Gaming - Servidor de Desarrollo
echo ================================================
echo.
echo Iniciando servidor en modo desarrollo...
echo URL: http://localhost:5001 u 80
echo.
echo Para detener: Ctrl + C
echo ================================================
echo.

set NODE_ENV=development
set PORT=80

if "%DB_PORT%"=="" (
	set DB_PORT=5433
)

if "%DATABASE_URL%"=="" (
	set DATABASE_URL=postgres://postgres:postgres@localhost:%DB_PORT%/app_db
)

echo DB: %DATABASE_URL%

echo.
echo Aplicando esquema de base de datos (db:push)...
set "DB_PUSH_LOG=%TEMP%\yim-db-push.log"
call npm run db:push >"%DB_PUSH_LOG%" 2>&1
if errorlevel 1 (
	echo [ERROR] No se pudo aplicar el esquema en la base de datos.
	echo Verifica que PostgreSQL este levantado y DATABASE_URL sea correcta.
	echo --- Detalle db:push ---
	type "%DB_PUSH_LOG%"
	pause
	exit /b 1
)
if exist "%DB_PUSH_LOG%" del "%DB_PUSH_LOG%" >nul 2>&1

echo [OK] Esquema actualizado.

npx tsx server/index-dev.ts

ngrok http --url=treva-segreant-grizzly.ngrok-free.dev 80

pause
