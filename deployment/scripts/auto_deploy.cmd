@echo off
REM Launcher: run auto_deploy.py with repo root as cwd (fixes wrong cwd / path issues).
cd /d "%~dp0..\.." || exit /b 1
py "%~dp0auto_deploy.py" %*
