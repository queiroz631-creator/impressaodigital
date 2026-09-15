@echo off
setlocal
set APPDIR=%ProgramFiles%\LojamixSync
if exist "%APPDIR%\LojamixSyncService.exe" "%APPDIR%\LojamixSyncService.exe" stop
if exist "%APPDIR%\LojamixSyncService.exe" "%APPDIR%\LojamixSyncService.exe" remove
echo Serviço Lojamix Sync removido.
pause
