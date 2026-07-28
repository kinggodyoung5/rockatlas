@echo off
cd /d "%~dp0"
echo ROCK ATLAS 이전 검수함 복구 모드를 시작합니다.
echo 예전에 4174 주소에서 붙여넣은 Gemini 원문이 남아 있으면 검수함에 다시 표시됩니다.
echo 복구가 끝날 때까지 이 창을 닫지 마세요.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4174/?studio=1#intake'"
npm run studio -- --port 4174 --strictPort
pause
