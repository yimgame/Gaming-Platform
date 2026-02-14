@echo off
echo ================================================
echo  YIM Gaming - Compilar para Produccion
echo ================================================
echo.
echo Paso 1/3: Instalando dependencias...
call npm install

echo.
echo Paso 2/3: Compilando aplicacion...
call npm run build

echo.
echo Paso 3/3: Listo para iniciar!
echo.
echo ================================================
echo  Compilacion completada exitosamente
echo ================================================
echo.
echo Para iniciar el servidor ejecuta: start-prod.bat
echo.

pause
