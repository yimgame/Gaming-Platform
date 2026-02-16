@echo off
setlocal EnableExtensions

echo ================================================
echo  YIM Gaming - Inicializacion de Base de Datos
echo ================================================
echo.

if "%DB_PORT%"=="" (
	set DB_PORT=5433
)

if "%DATABASE_URL%"=="" (
	set DATABASE_URL=postgres://postgres:postgres@localhost:%DB_PORT%/app_db
)

set "ORIGINAL_DATABASE_URL=%DATABASE_URL%"
set "LOCAL_DATABASE_URL=postgres://postgres:postgres@localhost:%DB_PORT%/app_db"

echo DATABASE_URL: %DATABASE_URL%
echo.
echo Ejecutando drizzle push...
call npm run db:push

if errorlevel 1 (
	echo.
	echo [WARN] db:push fallo con DATABASE_URL actual.
	if /I "%DATABASE_URL%"=="%LOCAL_DATABASE_URL%" (
		echo Ya se estaba usando URL local. No hay fallback adicional.
	) else (
		echo Reintentando con fallback local: %LOCAL_DATABASE_URL%
		set "DATABASE_URL=%LOCAL_DATABASE_URL%"
		call npm run db:push
	)
)

if errorlevel 1 (
	echo.
	echo [ERROR] No se pudo inicializar la base de datos.
	echo URL original: %ORIGINAL_DATABASE_URL%
	echo URL usada en ultimo intento: %DATABASE_URL%
	echo Verifica que PostgreSQL este levantado y que DATABASE_URL sea correcta.
	pause
	exit /b 1
)

echo.
echo [OK] Tablas creadas/actualizadas correctamente.

echo.
echo Ejecutando sincronizacion inicial de stats (XML -> DB)...
call npm run stats:sync

if errorlevel 1 (
	echo.
	echo [WARN] stats:sync fallo con DATABASE_URL actual.
	if /I "%DATABASE_URL%"=="%LOCAL_DATABASE_URL%" (
		echo Ya se estaba usando URL local. No hay fallback adicional.
	) else (
		echo Reintentando stats:sync con fallback local: %LOCAL_DATABASE_URL%
		set "DATABASE_URL=%LOCAL_DATABASE_URL%"
		call npm run stats:sync
	)
)

if errorlevel 1 (
	echo.
	echo [WARN] No se pudo sincronizar stats en este paso.
	echo URL original: %ORIGINAL_DATABASE_URL%
	echo URL usada en ultimo intento: %DATABASE_URL%
	echo La app igual puede iniciar y sincronizara automaticamente en runtime.
	pause
	exit /b 0
)

echo.
echo [OK] Sincronizacion de stats completada.
pause
