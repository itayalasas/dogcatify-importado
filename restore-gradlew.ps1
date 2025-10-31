# Script para Restaurar Gradle Wrapper
# Ejecuta este script en PowerShell desde la raíz del proyecto

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Restaurando Gradle Wrapper Files" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-Not (Test-Path "android")) {
    Write-Host "Error: No se encontró el directorio 'android'" -ForegroundColor Red
    Write-Host "Asegúrate de ejecutar este script desde la raíz del proyecto (C:\Proyectos\Pruebas\dogcatify)" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/4] Limpiando archivos antiguos de Gradle..." -ForegroundColor Yellow
if (Test-Path "android\.gradle") {
    Remove-Item -Path "android\.gradle" -Recurse -Force
}
if (Test-Path "android\build") {
    Remove-Item -Path "android\build" -Recurse -Force
}
Write-Host "   ✓ Limpieza completada" -ForegroundColor Green

Write-Host ""
Write-Host "[2/4] Regenerando Gradle Wrapper con Expo..." -ForegroundColor Yellow

# Opción 1: Usar expo prebuild
Write-Host "   Ejecutando: npx expo prebuild --clean --platform android" -ForegroundColor Gray
$prebuildOutput = npx expo prebuild --clean --platform android 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Gradle wrapper regenerado exitosamente" -ForegroundColor Green
} else {
    Write-Host "   ✗ Error al ejecutar expo prebuild" -ForegroundColor Red
    Write-Host "   Intentando método alternativo..." -ForegroundColor Yellow

    # Opción 2: Usar gradle wrapper directamente
    Set-Location android

    # Verificar si gradle está instalado
    $gradleInstalled = Get-Command gradle -ErrorAction SilentlyContinue

    if ($gradleInstalled) {
        Write-Host "   Ejecutando: gradle wrapper --gradle-version=8.10.2" -ForegroundColor Gray
        gradle wrapper --gradle-version=8.10.2 --distribution-type=all

        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✓ Gradle wrapper generado con gradle" -ForegroundColor Green
        } else {
            Write-Host "   ✗ Error al generar gradle wrapper" -ForegroundColor Red
            Set-Location ..
            exit 1
        }
    } else {
        Write-Host "   ✗ Gradle no está instalado en tu sistema" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Instala Gradle con:" -ForegroundColor Yellow
        Write-Host "   choco install gradle" -ForegroundColor Cyan
        Write-Host "   O descarga desde: https://gradle.org/install/" -ForegroundColor Cyan
        Set-Location ..
        exit 1
    }

    Set-Location ..
}

Write-Host ""
Write-Host "[3/4] Verificando archivos generados..." -ForegroundColor Yellow

$requiredFiles = @(
    "android\gradlew",
    "android\gradlew.bat",
    "android\gradle\wrapper\gradle-wrapper.jar",
    "android\gradle\wrapper\gradle-wrapper.properties"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file (FALTA)" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-Not $allFilesExist) {
    Write-Host ""
    Write-Host "Error: Algunos archivos no se generaron correctamente" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/4] Agregando archivos a Git..." -ForegroundColor Yellow

# Verificar si es un repositorio git
if (-Not (Test-Path ".git")) {
    Write-Host "   ⚠ No es un repositorio Git. Saltando este paso." -ForegroundColor Yellow
} else {
    git add android/gradlew
    git add android/gradlew.bat
    git add android/gradle/wrapper/gradle-wrapper.jar
    git add android/gradle/wrapper/gradle-wrapper.properties

    Write-Host "   ✓ Archivos agregados a Git" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Ahora ejecuta:" -ForegroundColor Yellow
    Write-Host "   git commit -m 'Add Gradle wrapper files'" -ForegroundColor Cyan
    Write-Host "   git push" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  ✓ Gradle Wrapper Restaurado Exitosamente" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. git commit -m 'Add Gradle wrapper files'" -ForegroundColor Cyan
Write-Host "2. git push" -ForegroundColor Cyan
Write-Host "3. eas build --profile production --platform android" -ForegroundColor Cyan
Write-Host ""
