@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Lojamix Sync - Gerar EXE
cd /d "%~dp0"

echo.
echo ============================================================
echo              LOJAMIX SYNC - GERADOR DE EXE
echo ============================================================
echo.

where py >nul 2>&1
if %errorlevel%==0 (
    set "PY=py"
) else (
    where python >nul 2>&1
    if %errorlevel%==0 (
        set "PY=python"
    ) else (
        echo [ERRO] Python nao foi encontrado.
        echo Instale Python 3.11 ou superior e marque "Add Python to PATH".
        pause
        exit /b 1
    )
)

%PY% --version
echo.

if not exist ".venv-build\Scripts\python.exe" (
    echo [1/5] Criando ambiente virtual...
    %PY% -m venv .venv-build
    if errorlevel 1 goto :erro
) else (
    echo [1/5] Ambiente virtual ja existe.
)

set "VENV_PY=%CD%\.venv-build\Scripts\python.exe"

echo.
echo [2/5] Instalando dependencias...
"%VENV_PY%" -m pip install --upgrade pip
if errorlevel 1 goto :erro
if exist "requirements.txt" (
    "%VENV_PY%" -m pip install -r requirements.txt
    if errorlevel 1 goto :erro
)

echo.
echo [3/5] Instalando PyInstaller...
"%VENV_PY%" -m pip install --upgrade pyinstaller
if errorlevel 1 goto :erro

echo.
echo [4/5] Limpando compilacao anterior...
if exist "dist" rmdir /s /q "dist"
if exist "build\pyinstaller" rmdir /s /q "build\pyinstaller"
if exist "LojamixSync.spec" del /q "LojamixSync.spec"
if not exist "build" mkdir "build"

echo.
echo [5/5] Gerando LojamixSync.exe...
"%VENV_PY%" -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --onefile ^
  --windowed ^
  --collect-submodules app ^
  --collect-submodules gui ^
  --collect-all pystray ^
  --collect-all PIL ^
  --name LojamixSync ^
  --distpath "dist" ^
  --workpath "build\pyinstaller" ^
  launcher.py

if errorlevel 1 goto :erro
if exist "build\LojamixSync.exe" del /q "build\LojamixSync.exe"
copy /y "dist\LojamixSync.exe" "build\LojamixSync.exe" >nul
if errorlevel 1 goto :erro

echo.
echo ============================================================
echo                  COMPILACAO CONCLUIDA
echo ============================================================
echo.
echo %CD%\build\LojamixSync.exe
echo.
pause
exit /b 0

:erro
echo.
echo ============================================================
echo                    ERRO NA COMPILACAO
echo ============================================================
echo.
pause
exit /b 1
