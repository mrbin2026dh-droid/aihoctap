@echo off
cd /d "%~dp0"
title HE THONG AI AGENT SGK TIN HOC THCS - TRUNG TAM DIEU HANH
:MENU
cls
echo ==============================================================================
echo       HE THONG GIA SU AI SGK TIN HOC THCS - TRUNG TAM DIEU HANH 2.0
echo            (Google GenAI + Khan-Focus San Khau + SGK Data Studio)
echo ==============================================================================
echo.
echo   [1] Khoi chay Ung dung Web Tu hoc va Quan tri Giao vien (Cong 8000)
echo   [2] Khoi chay SGK Data Studio 2.0 (Phan mem Desktop boc tach SGK PDF)
echo   [3] Chay toan bo Test Suite Kiem thu Tu dong (Zero-Bug Verification)
echo   [4] Chay Benchmark Thuc nghiem Live voi Google Gemini AI
echo   [5] Thoat
echo.
echo ==============================================================================
set /p opt="-> Vui long nhap lua chon cua ban (1-5): "

if "%opt%"=="1" goto RUN_WEB
if "%opt%"=="2" goto RUN_STUDIO
if "%opt%"=="3" goto RUN_TESTS
if "%opt%"=="4" goto RUN_LIVE_EVAL
if "%opt%"=="5" exit /b 0

echo Lua chon khong hop le. Vui long thu lai.
timeout /t 2 > nul
goto MENU

:RUN_WEB
cls
call Chay_Ung_Dung_Web.bat
goto MENU

:RUN_STUDIO
cls
call Chay_SGK_Studio.bat
goto MENU

:RUN_TESTS
cls
echo Dang chay toan bo test suite voi Pytest...
echo.
python -m pytest tests/ -v
echo.
echo Nhan phim bat ky de quay lai Menu...
pause > nul
goto MENU

:RUN_LIVE_EVAL
cls
echo Dang chay Benchmark thuc te 16 ca tan cong doi khang voi Google Gemini...
echo.
python tests\run_live_gemini_eval.py
echo.
echo Nhan phim bat ky de quay lai Menu...
pause > nul
goto MENU
