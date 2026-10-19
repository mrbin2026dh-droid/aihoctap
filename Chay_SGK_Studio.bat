@echo off
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title SGK Data Studio 2.0 - Bo Cong Cu So Hoa Bai Hoc SGK
echo ================================================================
echo   SGK DATA STUDIO 2.0 - BO CONG CU SO HOA BAI HOC SGK
echo   Block Schema 2.0 - Gemini Multimodal Vision - Zero Leak
echo ================================================================
echo.
echo [1/2] Dang kiem tra moi truong Python va cac thu vien phu thuoc...

python -c "import pymupdf, google.genai, dotenv"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Thieu thu vien Python can thiet!
    echo Vui long chay lenh sau trong terminal de cai dat:
    echo     pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)
echo [OK] Thu vien PyMuPDF, Google GenAI, Dotenv da san sang.
echo.

echo [2/2] Dang khoi chay ung dung Desktop (UTF-8 Ho tro Tieng Viet 100%)...
python tools\sgk_studio_gui.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Co loi xay ra trong qua trinh chay ung dung.
    pause
)
