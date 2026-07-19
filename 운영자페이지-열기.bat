@echo off
cd /d "%~dp0"
echo ROCK ATLAS Studio를 시작합니다.
echo 잠시 후 브라우저에서 운영자 페이지가 자동으로 열립니다.
echo 이 창을 닫으면 Studio 서버가 꺼집니다.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5173/?studio=1'"
npm run studio -- --port 5173 --strictPort
pause
