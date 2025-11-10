#!/bin/bash

# ================================================================================================
# DOGCATIFY - SCRIPT DE DESPLIEGUE A PRODUCCIÓN
# ================================================================================================
#
# Este script automatiza el despliegue completo a producción
#
# USO:
#   chmod +x DEPLOY_TO_PRODUCTION.sh
#   ./DEPLOY_TO_PRODUCTION.sh <project-ref-produccion>
#
# ================================================================================================

set -e # Detener en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar que se proporcionó project-ref
if [ -z "$1" ]; then
    echo -e "${RED}Error: Debes proporcionar el project-ref de producción${NC}"
    echo "Uso: ./DEPLOY_TO_PRODUCTION.sh <project-ref-produccion>"
    exit 1
fi

PROJECT_REF=$1

echo -e "${BLUE}================================================================================================${NC}"
echo -e "${BLUE}DOGCATIFY - DESPLIEGUE A PRODUCCIÓN${NC}"
echo -e "${BLUE}================================================================================================${NC}"
echo ""
echo -e "${YELLOW}Project Ref: ${PROJECT_REF}${NC}"
echo ""

# ================================================================================================
# PASO 1: VERIFICAR DEPENDENCIAS
# ================================================================================================

echo -e "${BLUE}[1/5] Verificando dependencias...${NC}"

if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI no está instalado${NC}"
    echo "Instala con: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI instalado${NC}"

# ================================================================================================
# PASO 2: CONECTAR A PROYECTO DE PRODUCCIÓN
# ================================================================================================

echo ""
echo -e "${BLUE}[2/5] Conectando a proyecto de producción...${NC}"

supabase link --project-ref $PROJECT_REF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Conectado exitosamente${NC}"
else
    echo -e "${RED}Error: No se pudo conectar al proyecto${NC}"
    exit 1
fi

# ================================================================================================
# PASO 3: EXPORTAR Y APLICAR SCHEMA
# ================================================================================================

echo ""
echo -e "${BLUE}[3/5] Exportando schema de desarrollo...${NC}"

# Exportar schema completo
supabase db dump --file production_complete_schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Schema exportado a: production_complete_schema.sql${NC}"
else
    echo -e "${RED}Error: No se pudo exportar el schema${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}IMPORTANTE: Revisa el archivo production_complete_schema.sql antes de continuar${NC}"
echo -e "${YELLOW}Presiona ENTER para continuar o Ctrl+C para cancelar${NC}"
read

echo ""
echo -e "${BLUE}Aplicando migraciones a producción...${NC}"

supabase db push --project-ref $PROJECT_REF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migraciones aplicadas exitosamente${NC}"
else
    echo -e "${RED}Error: No se pudieron aplicar las migraciones${NC}"
    exit 1
fi

# ================================================================================================
# PASO 4: DESPLEGAR EDGE FUNCTIONS
# ================================================================================================

echo ""
echo -e "${BLUE}[4/5] Desplegando Edge Functions...${NC}"
echo ""

# Lista de todas las funciones
FUNCTIONS=(
    "create-user"
    "delete-user"
    "reset-password"
    "send-email"
    "send-invoice-email"
    "send-push-notification"
    "send-notification-fcm-v1"
    "send-scheduled-notifications"
    "send-medical-reminders"
    "medical-history"
    "medical-history-data"
    "save-medical-record"
    "medical-notifications"
    "extract-medical-card-info"
    "scan-vaccination-card"
    "generate-vaccine-recommendations"
    "generate-dewormer-recommendations"
    "generate-illness-recommendations"
    "generate-treatment-recommendations"
    "generate-allergy-recommendations"
    "generate-behavior-recommendations"
    "get-vaccine-info"
    "orders-api"
    "cancel-expired-orders"
    "mercadopago-webhook"
    "notify-order-webhook"
    "dogcatify-order-webhook"
    "send-booking-confirmations"
    "confirm-booking"
    "generate-promotion-invoice"
    "upload-image"
)

TOTAL_FUNCTIONS=${#FUNCTIONS[@]}
DEPLOYED=0
FAILED=0

for func in "${FUNCTIONS[@]}"; do
    echo -e "${YELLOW}Desplegando: ${func}...${NC}"

    if supabase functions deploy $func --project-ref $PROJECT_REF 2>/dev/null; then
        echo -e "${GREEN}✓ ${func} desplegada${NC}"
        ((DEPLOYED++))
    else
        echo -e "${RED}✗ ${func} falló${NC}"
        ((FAILED++))
    fi
done

echo ""
echo -e "${BLUE}Resumen de despliegue de funciones:${NC}"
echo -e "${GREEN}Desplegadas: ${DEPLOYED}/${TOTAL_FUNCTIONS}${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Fallidas: ${FAILED}/${TOTAL_FUNCTIONS}${NC}"
fi

# ================================================================================================
# PASO 5: VERIFICACIÓN POST-DESPLIEGUE
# ================================================================================================

echo ""
echo -e "${BLUE}[5/5] Verificando despliegue...${NC}"

# Listar funciones desplegadas
echo ""
echo -e "${YELLOW}Edge Functions activas:${NC}"
supabase functions list --project-ref $PROJECT_REF

# ================================================================================================
# RESUMEN FINAL
# ================================================================================================

echo ""
echo -e "${BLUE}================================================================================================${NC}"
echo -e "${BLUE}DESPLIEGUE COMPLETADO${NC}"
echo -e "${BLUE}================================================================================================${NC}"
echo ""
echo -e "${GREEN}✓ Schema migrado exitosamente${NC}"
echo -e "${GREEN}✓ ${DEPLOYED}/${TOTAL_FUNCTIONS} Edge Functions desplegadas${NC}"
echo ""
echo -e "${YELLOW}SIGUIENTE PASOS:${NC}"
echo ""
echo -e "1. Configurar secrets (variables de entorno):"
echo -e "   ${BLUE}supabase secrets set FIREBASE_SERVICE_ACCOUNT='<json>' --project-ref $PROJECT_REF${NC}"
echo -e "   ${BLUE}supabase secrets set OPENAI_API_KEY='<key>' --project-ref $PROJECT_REF${NC}"
echo -e "   ${BLUE}supabase secrets set RESEND_API_KEY='<key>' --project-ref $PROJECT_REF${NC}"
echo -e "   ${BLUE}supabase secrets set MERCADOPAGO_ACCESS_TOKEN='<token>' --project-ref $PROJECT_REF${NC}"
echo ""
echo -e "2. Configurar Cron Jobs en el Dashboard:"
echo -e "   - cancel-expired-orders (cada hora)"
echo -e "   - send-scheduled-notifications (cada 15 min)"
echo -e "   - send-booking-confirmations (cada hora)"
echo ""
echo -e "3. Verificar en Dashboard:"
echo -e "   ${BLUE}https://dashboard.supabase.com/project/$PROJECT_REF${NC}"
echo ""
echo -e "${YELLOW}Consulta PRODUCTION_MIGRATION_GUIDE.md para más detalles${NC}"
echo ""
echo -e "${BLUE}================================================================================================${NC}"
