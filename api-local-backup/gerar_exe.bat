@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo  Backup Impressao Digital - Gerar EXE
echo ==========================================
echo.

set "PYFILE="

for %%F in (backup_app_*.py) do (
    set "PYFILE=%%F"
    goto :found
)

:found
if not defined PYFILE (
    echo ERRO: Nenhum arquivo backup_app_*.py foi encontrado nesta pasta.
    echo.
    pause
    exit /b 1
)

echo Arquivo encontrado: %PYFILE%
echo.

py -m pip install --upgrade pyinstaller pystray pillow
if errorlevel 1 goto :erro

echo.
echo Gerando executavel...
echo.

py -m PyInstaller --noconfirm --clean --onefile --windowed --name BackupImpressaoDigital "%PYFILE%"
if errorlevel 1 goto :erro

echo.
echo ==========================================
echo  EXE criado com sucesso!
echo ==========================================
echo.
echo %cd%\dist\BackupImpressaoDigital.exe
echo.
pause
exit /b 0

:erro
echo.
echo ==========================================
echo  ERRO ao gerar o EXE.
echo ==========================================
echo.
pause
exit /b 1
