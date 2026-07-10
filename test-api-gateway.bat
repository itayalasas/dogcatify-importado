@echo off
chcp 65001 >nul
echo ========================================
echo Testing API Gateway Connection
echo ========================================
echo.

echo URL: https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/get-env
echo API Key: 3f74c928844b161da0fbb3d6a4bd19abc3b4e61024f2813a26ca66003dcd4fad
echo.
echo Sending request...
echo.

node --use-system-ca test-api-gateway.js

echo.
echo.
echo ========================================
echo Test Complete
echo ========================================
echo.
pause
