@echo off
setlocal EnableExtensions

echo ================================================
echo  YIM Gaming - Setup Inicial
echo ================================================
echo.
echo Este asistente realiza:
echo   - Configurar DATABASE_URL (default local)
echo   - Crear .env desde .env.example (si falta)
echo   - Configurar ADMIN_TOKEN opcional
echo   - Instalar dependencias (npm install)
echo   - Inicializar esquema completo PostgreSQL + sync inicial de stats (init-db.bat)
echo.
echo Defaults recomendados para entorno local:
echo   host: localhost
echo   puerto: 5433
echo   base de datos: app_db
echo   usuario/password: postgres/postgres
echo.

if "%DB_PORT%"=="" (
	set DB_PORT=5433
)

set DEFAULT_DATABASE_URL=postgres://postgres:postgres@localhost:%DB_PORT%/app_db

if "%DATABASE_URL%"=="" (
	set DATABASE_URL=%DEFAULT_DATABASE_URL%
)

echo [1/6] Configuracion de DATABASE_URL
echo    Valor actual: %DATABASE_URL%
set /p DATABASE_URL_INPUT=Ingresa DATABASE_URL (Enter para usar default/local): 
if not "%DATABASE_URL_INPUT%"=="" (
	set DATABASE_URL=%DATABASE_URL_INPUT%
)
echo    DATABASE_URL final: %DATABASE_URL%

echo [2/6] Verificando .env...
if not exist ".env" (
	if exist ".env.example" (
		copy /Y ".env.example" ".env" >nul
		echo    .env creado desde .env.example
	) else (
		echo [ERROR] No existe .env.example
		pause
		exit /b 1
	)
) else (
	echo    .env ya existe
)

echo.
echo [3/6] Configuracion de ADMIN_TOKEN
set /p ADMIN_TOKEN_INPUT=Ingresa ADMIN_TOKEN (Enter para saltear y editar .env luego): 
if not "%ADMIN_TOKEN_INPUT%"=="" (
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$path='.env'; $token=$env:ADMIN_TOKEN_INPUT; $line='ADMIN_TOKEN=' + $token; if (Test-Path $path) { $content = Get-Content $path; if (($content | Select-String '^ADMIN_TOKEN=').Count -gt 0) { $content = $content -replace '^ADMIN_TOKEN=.*$', $line } else { $content += $line }; Set-Content -Path $path -Value $content -Encoding UTF8 }"
	echo    ADMIN_TOKEN actualizado en .env
) else (
	echo    Saltado. Puedes editar ADMIN_TOKEN manualmente en .env
)

echo.
echo [4/6] Instalando dependencias...
call npm install
if errorlevel 1 (
	echo [ERROR] Fallo npm install
	pause
	exit /b 1
)

echo.
echo [5/6] Inicializando base de datos completa...
echo    DATABASE_URL: %DATABASE_URL%
call init-db.bat
if errorlevel 1 (
	echo [ERROR] Fallo init-db.bat
	pause
	exit /b 1
)

echo.
echo [6/6] Setup finalizado
echo.
echo Siguiente paso recomendado:
echo   1) Verificar .env (ADMIN_TOKEN y otras variables)
echo   2) Ejecutar start-dev.bat para levantar app y API
echo   3) Abrir http://localhost:3000
echo.
set /p START_NOW=Quieres iniciar el servidor ahora? (S/N): 
if /I "%START_NOW%"=="S" (
	call start-dev.bat
	goto :eof
)
if /I "%START_NOW%"=="SI" (
	call start-dev.bat
	goto :eof
)

echo Listo. Ejecuta start-dev.bat cuando quieras.
pause
