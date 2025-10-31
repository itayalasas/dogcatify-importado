#!/bin/bash

# Script para Restaurar Gradle Wrapper
# Ejecuta este script desde la raíz del proyecto

echo "================================================"
echo "  Restaurando Gradle Wrapper Files"
echo "================================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d "android" ]; then
    echo "❌ Error: No se encontró el directorio 'android'"
    echo "Asegúrate de ejecutar este script desde la raíz del proyecto"
    exit 1
fi

echo "[1/4] Limpiando archivos antiguos de Gradle..."
rm -rf android/.gradle android/build
echo "   ✓ Limpieza completada"

echo ""
echo "[2/4] Regenerando Gradle Wrapper con Expo..."
echo "   Ejecutando: npx expo prebuild --clean --platform android"

if npx expo prebuild --clean --platform android; then
    echo "   ✓ Gradle wrapper regenerado exitosamente"
else
    echo "   ✗ Error al ejecutar expo prebuild"
    echo "   Intentando método alternativo..."

    cd android

    # Verificar si gradle está instalado
    if command -v gradle &> /dev/null; then
        echo "   Ejecutando: gradle wrapper --gradle-version=8.10.2"
        gradle wrapper --gradle-version=8.10.2 --distribution-type=all

        if [ $? -eq 0 ]; then
            echo "   ✓ Gradle wrapper generado con gradle"
        else
            echo "   ✗ Error al generar gradle wrapper"
            cd ..
            exit 1
        fi
    else
        echo "   ✗ Gradle no está instalado en tu sistema"
        echo ""
        echo "   Instala Gradle:"
        echo "   - macOS: brew install gradle"
        echo "   - Linux: sudo apt install gradle"
        echo "   - Windows: choco install gradle"
        echo "   O descarga desde: https://gradle.org/install/"
        cd ..
        exit 1
    fi

    cd ..
fi

echo ""
echo "[3/4] Verificando archivos generados..."

REQUIRED_FILES=(
    "android/gradlew"
    "android/gradlew.bat"
    "android/gradle/wrapper/gradle-wrapper.jar"
    "android/gradle/wrapper/gradle-wrapper.properties"
)

ALL_FILES_EXIST=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ $file"
    else
        echo "   ✗ $file (FALTA)"
        ALL_FILES_EXIST=false
    fi
done

if [ "$ALL_FILES_EXIST" = false ]; then
    echo ""
    echo "❌ Error: Algunos archivos no se generaron correctamente"
    exit 1
fi

echo ""
echo "[3.5/4] Dando permisos de ejecución a gradlew..."
chmod +x android/gradlew
echo "   ✓ Permisos aplicados"

echo ""
echo "[4/4] Agregando archivos a Git..."

# Verificar si es un repositorio git
if [ ! -d ".git" ]; then
    echo "   ⚠ No es un repositorio Git. Saltando este paso."
else
    git add android/gradlew
    git add android/gradlew.bat
    git add android/gradle/wrapper/gradle-wrapper.jar
    git add android/gradle/wrapper/gradle-wrapper.properties

    echo "   ✓ Archivos agregados a Git"
    echo ""
    echo "   Ahora ejecuta:"
    echo "   git commit -m 'Add Gradle wrapper files'"
    echo "   git push"
fi

echo ""
echo "================================================"
echo "  ✓ Gradle Wrapper Restaurado Exitosamente"
echo "================================================"
echo ""
echo "Próximos pasos:"
echo "1. git commit -m 'Add Gradle wrapper files'"
echo "2. git push"
echo "3. eas build --profile production --platform android"
echo ""
