#!/bin/bash

# Script para ver logs en tiempo real del servidor
# Uso: ./scripts/watch-logs.sh

echo "👀 Monitoreando logs del backend..."
echo "Servidor debe estar corriendo en http://localhost:3001"
echo "Presiona Ctrl+C para detener"
echo "---"
echo ""

# Monitorear el proceso de vercel
if pgrep -f "vercel dev" > /dev/null; then
    echo "✅ Servidor detectado corriendo"
    echo ""
    
    # Seguir los logs en tiempo real
    tail -f /tmp/vercel-dev.log 2>/dev/null || \
    journalctl -f _COMM=node 2>/dev/null || \
    echo "Los logs se muestran en la terminal donde ejecutaste 'npm start'"
else
    echo "❌ Servidor no está corriendo"
    echo "Ejecuta 'npm start' en otra terminal primero"
fi
