@echo off
setlocal
set APPDIR=%ProgramFiles%\LojamixSync
if not exist "%APPDIR%" mkdir "%APPDIR%"
copy /Y LojamixSyncService.exe "%APPDIR%\LojamixSyncService.exe" >nul
"%APPDIR%\LojamixSyncService.exe" install
"%APPDIR%\LojamixSyncService.exe" --startup auto
"%APPDIR%\LojamixSyncService.exe" start
if errorlevel 1 echo Falha ao instalar/iniciar o serviço.
echo Serviço Lojamix Sync instalado.
pause
