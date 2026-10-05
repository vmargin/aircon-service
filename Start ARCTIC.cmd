@echo off
cd /d "%~dp0"
node scripts\local.cjs start --open
if errorlevel 1 pause
