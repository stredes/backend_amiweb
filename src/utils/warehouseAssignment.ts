import { collectionRef } from '../lib/firestore';
import { getFirebaseApp } from '../lib/firebase';
import { logger } from './logger';

/**
 * Carga de trabajo de un usuario de bodega
 */
interface WarehouseUserLoad {
  userId: string;
  userName: string;
  activeOrders: number;        // Pedidos activos asignados
  totalItems: number;          // Items totales en pedidos activos
  estimatedMinutes: number;    // Tiempo estimado total
  averageItemsPerOrder: number;
  loadScore: number;           // Puntaje de carga (menor = menos cargado)
}

/**
 * Resultado de asignación
 */
export interface AssignmentResult {
  assignedTo: string;
  assignedToName: string;
  reason: string;
  userLoad: WarehouseUserLoad;
}

/**
 * Obtiene todos los usuarios de bodega activos
 */
async function getWarehouseUsers(): Promise<Array<{ uid: string; displayName?: string; email?: string }>> {
  try {
    const app = getFirebaseApp();
    const usersSnapshot = await app.auth().listUsers();
    
    const warehouseUsers = usersSnapshot.users
      .filter((u: any) => u.customClaims?.role === 'bodega' && !u.disabled)
      .map((u: any) => ({
        uid: u.uid,
        displayName: u.displayName,
        email: u.email
      }));

    logger.debug('Usuarios de bodega encontrados', { count: warehouseUsers.length });
    return warehouseUsers;
  } catch (error) {
    logger.error('Error al obtener usuarios de bodega', { error });
    throw error;
  }
}

/**
 * Calcula la carga de trabajo actual de un usuario de bodega
 */
async function calculateUserLoad(userId: string, userName: string): Promise<WarehouseUserLoad> {
  try {
    // Obtener preparaciones activas asignadas a este usuario
    const preparationsSnapshot = await collectionRef('orderPreparations')
      .where('assignedTo', '==', userId)
      .where('status', 'in', ['pendiente', 'asignado', 'en_preparacion'])
      .get();

    let totalItems = 0;
    let estimatedMinutes = 0;

    preparationsSnapshot.docs.forEach((doc: any) => {
      const prep = doc.data();
      const itemCount = prep.items?.length || 0;
      totalItems += itemCount;
      
      // Estimar 2 minutos por item + 5 minutos base por orden
      estimatedMinutes += (itemCount * 2) + 5;
    });

    const activeOrders = preparationsSnapshot.size;
    const averageItemsPerOrder = activeOrders > 0 ? totalItems / activeOrders : 0;

    // Calcular score de carga (considera tanto pedidos como items)
    // Ponderación: 40% pedidos, 60% items
    const loadScore = (activeOrders * 0.4) + (totalItems * 0.6);

    return {
      userId,
      userName,
      activeOrders,
      totalItems,
      estimatedMinutes,
      averageItemsPerOrder,
      loadScore
    };
  } catch (error) {
    logger.error('Error al calcular carga de usuario', { userId, error });
    throw error;
  }
}

/**
 * Asigna una orden al usuario de bodega con menor carga
 * Algoritmo de distribución equitativa basado en:
 * - Cantidad de pedidos activos
 * - Cantidad total de items
 * - Tiempo estimado de preparación
 */
export async function assignOrderToWarehouse(
  orderItemCount: number
): Promise<AssignmentResult> {
  try {
    logger.info('Iniciando asignación equitativa de orden', { orderItemCount });

    // Obtener usuarios de bodega
    const warehouseUsers = await getWarehouseUsers();

    if (warehouseUsers.length === 0) {
      throw new Error('No hay usuarios de bodega disponibles');
    }

    // Calcular carga de cada usuario
    const userLoads: WarehouseUserLoad[] = [];
    
    for (const user of warehouseUsers) {
      const load = await calculateUserLoad(
        user.uid,
        user.displayName || user.email || 'Usuario de Bodega'
      );
      userLoads.push(load);
    }

    // Ordenar por carga (menor a mayor)
    userLoads.sort((a, b) => a.loadScore - b.loadScore);

    // Asignar al usuario con menor carga
    const selectedUser = userLoads[0];

    logger.info('Orden asignada', {
      assignedTo: selectedUser.userId,
      userName: selectedUser.userName,
      currentLoad: {
        activeOrders: selectedUser.activeOrders,
        totalItems: selectedUser.totalItems,
        estimatedMinutes: selectedUser.estimatedMinutes
      },
      allUsers: userLoads.map(u => ({
        name: u.userName,
        score: u.loadScore,
        orders: u.activeOrders,
        items: u.totalItems
      }))
    });

    return {
      assignedTo: selectedUser.userId,
      assignedToName: selectedUser.userName,
      reason: `Asignado automáticamente por carga equitativa. Usuario con ${selectedUser.activeOrders} pedidos activos y ${selectedUser.totalItems} items totales.`,
      userLoad: selectedUser
    };
  } catch (error) {
    logger.error('Error en asignación automática', { error });
    throw error;
  }
}

/**
 * Obtiene estadísticas de carga de todos los usuarios de bodega
 */
export async function getWarehouseLoadStats(): Promise<WarehouseUserLoad[]> {
  try {
    const warehouseUsers = await getWarehouseUsers();
    const userLoads: WarehouseUserLoad[] = [];

    for (const user of warehouseUsers) {
      const load = await calculateUserLoad(
        user.uid,
        user.displayName || user.email || 'Usuario de Bodega'
      );
      userLoads.push(load);
    }

    // Ordenar por carga
    userLoads.sort((a, b) => a.loadScore - b.loadScore);

    return userLoads;
  } catch (error) {
    logger.error('Error al obtener estadísticas de carga', { error });
    throw error;
  }
}

/**
 * Sugiere reasignación si hay desbalance significativo
 * Retorna órdenes que podrían reasignarse para equilibrar carga
 */
export async function suggestRebalancing(): Promise<{
  needsRebalancing: boolean;
  maxLoad: number;
  minLoad: number;
  difference: number;
  suggestion?: string;
}> {
  try {
    const loads = await getWarehouseLoadStats();

    if (loads.length < 2) {
      return {
        needsRebalancing: false,
        maxLoad: loads[0]?.loadScore || 0,
        minLoad: loads[0]?.loadScore || 0,
        difference: 0
      };
    }

    const maxLoad = loads[loads.length - 1].loadScore;
    const minLoad = loads[0].loadScore;
    const difference = maxLoad - minLoad;

    // Si la diferencia es mayor al 50%, sugerir rebalanceo
    const needsRebalancing = difference > (maxLoad * 0.5);

    return {
      needsRebalancing,
      maxLoad,
      minLoad,
      difference,
      suggestion: needsRebalancing
        ? `Se recomienda reasignar pedidos. Usuario más cargado: ${loads[loads.length - 1].userName} (${maxLoad.toFixed(1)} puntos), Usuario menos cargado: ${loads[0].userName} (${minLoad.toFixed(1)} puntos)`
        : 'La carga está balanceada'
    };
  } catch (error) {
    logger.error('Error al sugerir rebalanceo', { error });
    throw error;
  }
}
