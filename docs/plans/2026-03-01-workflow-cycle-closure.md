# Workflow Cycle Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cerrar de punta a punta los workflows de compra/venta/inventario con inspección, validación, aprobación admin y checklist de correlación para detectar inconsistencias.

**Architecture:** Añadir un motor de reglas de transición y correlación en `src/utils`, exponer endpoints de validación y checklist para roles `admin/root`, y reforzar handlers de bodega/órdenes para exigir cierre secuencial. Mantener compatibilidad con datos existentes en Firestore.

**Tech Stack:** TypeScript, Vercel Functions, Firebase Admin/Firestore, Zod, ts-node tests.

---

### Task 1: Reglas de ciclo y checklist de correlación
- Create: `src/utils/workflowCycle.ts`
- Create: `tests/workflow-cycle.test.ts`

### Task 2: Endpoints de checklist global y vistas de usuarios
- Create: `api_handlers/workflows/checklist.ts`
- Create: `api_handlers/users/views/summary.ts`
- Modify: `api/index.ts`

### Task 3: Inspección + aprobación admin antes de despacho
- Modify: `api_handlers/warehouse/prepare/[orderId].ts`
- Create: `api_handlers/warehouse/approve-dispatch/[orderId].ts`
- Modify: `api_handlers/warehouse/dispatch/[orderId].ts`
- Modify: `src/models/orderPreparation.ts`

### Task 4: Cierre de inventario y consistencia en conversión quote->order
- Modify: `api_handlers/quotes/[id]/convert-to-order.ts`
- Create: `src/utils/inventoryMovements.ts`
- Modify: `api_handlers/warehouse/dispatch/[orderId].ts`

### Task 5: Verificación integral
- Run: `npx ts-node tests/workflow-cycle.test.ts`
- Run: `npm run type-check`
- Run: `npm run lint`
