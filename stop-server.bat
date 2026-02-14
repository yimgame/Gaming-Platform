@echo off
echo ================================================
echo  YIM Gaming - Detener Procesos de Node
echo ================================================
echo.
echo Buscando procesos de Node.js...
echo.

for /f "tokens=2" %%a in ('tasklist ^| findstr "node.exe"') do (
    echo Deteniendo proceso %%a...
    taskkill /PID %%a /F
)

echo.
echo ================================================
echo  Procesos detenidos
echo ================================================
echo.

pause
