#!/bin/bash

# Script para crear usuarios en Firebase Authentication
# Requiere: Node.js y dependencias instaladas

set -e  # Exit on error

echo "🚀 Creando usuarios en Firebase Authentication..."
echo ""

# Verificar que exista .env
if [ ! -f .env ]; then
    echo "❌ Error: No se encontró archivo .env"
    exit 1
fi

# Verificar que existan las dependencias
if [ ! -d node_modules ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Ejecutar script de TypeScript
echo "▶️  Ejecutando script..."
npx ts-node scripts/create-firebase-users.ts

echo ""
echo "✅ Script completado!"
