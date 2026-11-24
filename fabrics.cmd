@echo off
rem Windows launcher for the bash scripts in scripts\ (run from PowerShell, CMD or by double-click).
rem It calls Git Bash explicitly: a plain "bash" on Windows may be WSL, which can't see this project's Node.
rem
rem   fabrics                    same as "fabrics start"
rem   fabrics start [docker|check|stop]
rem   fabrics test  [unit|smoke] [--write]
rem   fabrics deploy [setup|status|logs|down|ssh]
setlocal EnableExtensions
chcp 65001 >nul

set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%GITBASH%" set "GITBASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not exist "%GITBASH%" set "GITBASH=%LocalAppData%\Programs\Git\bin\bash.exe"
if not exist "%GITBASH%" (
  echo Git Bash nao encontrado. Instale o Git para Windows: https://git-scm.com/download/win
  set "EXITCODE=1"
  goto done
)

set "SCRIPT=%~1"
set "NOARGS="
if "%SCRIPT%"=="" (
  set "SCRIPT=start"
  set "NOARGS=1"
)
if /i not "%SCRIPT%"=="start" if /i not "%SCRIPT%"=="test" if /i not "%SCRIPT%"=="deploy" (
  echo Uso: fabrics [start^|test^|deploy] [opcoes]
  set "EXITCODE=1"
  goto done
)

rem Everything after the first argument goes to the script.
set "ARGS="
:collect
shift
if "%~1"=="" goto run
set "ARGS=%ARGS% %1"
goto collect

:run
"%GITBASH%" "%~dp0scripts\%SCRIPT%.sh"%ARGS%
set "EXITCODE=%ERRORLEVEL%"

:done
rem Double-click (no arguments, own window) that failed: keep the window open so the error can be read.
if defined NOARGS if not "%EXITCODE%"=="0" echo %CMDCMDLINE% | find /i "/c" >nul && pause
exit /b %EXITCODE%
