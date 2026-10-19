@echo off
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title Gia Su AI SGK Tin Hoc THCS - Ung Dung Web
echo ================================================================
echo   GIA SU AI SGK TIN HOC THCS - KHOI CHAY HE THONG WEB
echo   FastAPI Backend + Khan-Focus San Khau Su Pham + Socrates AI
echo ================================================================
echo.

echo [1/3] Kiem tra trang thai may chu tren cong 8000...
python -c "import socket, sys; s = socket.socket(); s.settimeout(0.3); res = s.connect_ex(('127.0.0.1', 8000)); s.close(); sys.exit(0 if res == 0 else 1)"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================
    echo [THONG BAO] May chu Web DA DANG CHAY san tai http://127.0.0.1:8000!
    echo Dang mo 1 tab trinh duyet duy nhat den ung dung Web...
    echo ================================================================
    echo.
    start http://127.0.0.1:8000
    ping 127.0.0.1 -n 2 > nul
    exit /b 0
)
echo [OK] Cong 8000 san sang khoi dong may chu moi.
echo.

echo [2/3] Dang kiem tra moi truong Python va cac thu vien can thiet...
python -c "import fastapi, uvicorn, pydantic, dotenv"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Thieu thu vien Python can thiet!
    echo Vui long chay lenh sau de cai dat:
    echo     pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)
echo [OK] Thu vien FastAPI, Uvicorn, Pydantic, Dotenv da san sang.
echo.

echo [3/3] Dang khoi dong Web Server tai http://127.0.0.1:8000...
echo (He thong se tu dong mo dung 1 tab trinh duyet khi may chu san sang)
echo.

start "" cmd /c "ping 127.0.0.1 -n 3 > nul & start http://127.0.0.1:8000"
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Server bi dung bat thuong.
    pause
)
