@echo off
chcp 65001 >nul
echo ========================================
echo Testing API Gateway Connection
echo ========================================
echo.

echo URL: https://api.flowbridge.site/functions/v1/api-gateway/a3db1463-6c83-4eb0-bc6e-9ad7db89ea8e
echo API Key: pub_4382560178cd0284e641e30eef20da87e3abde25937764c2d52e98b77a4d3f57
echo.
echo Sending request...
echo.

curl.exe -i -X GET "https://api.flowbridge.site/functions/v1/api-gateway/a3db1463-6c83-4eb0-bc6e-9ad7db89ea8e" -H "X-Integration-Key: pub_4382560178cd0284e641e30eef20da87e3abde25937764c2d52e98b77a4d3f57" -H "Content-Type: application/json" -H "Accept: application/json" --max-time 30

echo.
echo.
echo ========================================
echo Test Complete
echo ========================================
echo.
pause
