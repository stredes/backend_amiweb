#!/usr/bin/env ts-node
/**
 * Script para crear usuarios en Firebase Authentication
 * Uso: npm run create-users
 */

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Intentar cargar service account desde archivo JSON
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  console.log('📄 Usando serviceAccountKey.json...');
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.log('📄 Usando variables de entorno (.env)...');
  // Fallback a variables de entorno
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
  
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.error('❌ Error: Faltan variables de entorno de Firebase en .env');
    console.error('   O crea un archivo serviceAccountKey.json en la raíz del proyecto');
    process.exit(1);
  }
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    })
  });
}

// Definir usuarios a crear
const users = [
  {
    email: 'root@amilab.com',
    password: 'root2026',
    displayName: 'Root User',
    role: 'root',
    disabled: false
  },
  {
    email: 'admin@amilab.com',
    password: 'admin123',
    displayName: 'Administrador',
    role: 'admin',
    disabled: false
  },
  {
    email: 'vendedor1@amilab.com',
    password: 'vende123',
    displayName: 'Vendedor 1',
    role: 'vendedor',
    disabled: false
  },
  {
    email: 'vendedor2@amilab.com',
    password: 'vende123',
    displayName: 'Vendedor 2',
    role: 'vendedor',
    disabled: false
  },
  {
    email: 'socio@amilab.com',
    password: 'demo123',
    displayName: 'Socio Demo',
    role: 'socio',
    disabled: false
  }
];

async function createUser(userData: typeof users[0]) {
  try {
    // Verificar si el usuario ya existe
    try {
      const existingUser = await admin.auth().getUserByEmail(userData.email);
      console.log(`⚠️  Usuario ${userData.email} ya existe (UID: ${existingUser.uid})`);
      
      // Actualizar contraseña si el usuario ya existe
      await admin.auth().updateUser(existingUser.uid, {
        password: userData.password,
        displayName: userData.displayName
      });
      
      // Establecer custom claims (rol)
      await admin.auth().setCustomUserClaims(existingUser.uid, { role: userData.role });
      
      console.log(`✅ Usuario ${userData.email} actualizado con rol: ${userData.role}`);
      return existingUser;
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Crear nuevo usuario
    const userRecord = await admin.auth().createUser({
      email: userData.email,
      password: userData.password,
      displayName: userData.displayName,
      disabled: userData.disabled,
      emailVerified: true // Auto-verificar email
    });

    // Establecer custom claims (rol)
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: userData.role });

    console.log(`✅ Usuario creado: ${userData.email} (UID: ${userRecord.uid}, Rol: ${userData.role})`);
    return userRecord;

  } catch (error: any) {
    console.error(`❌ Error creando usuario ${userData.email}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Iniciando creación de usuarios en Firebase...\n');
  console.log(`📋 Proyecto: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`📧 Total de usuarios a crear: ${users.length}\n`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const userData of users) {
    try {
      const result = await createUser(userData);
      if (result) {
        // Verificar si fue creado o actualizado
        try {
          const userExists = await admin.auth().getUserByEmail(userData.email);
          if (userExists) {
            updated++;
          }
        } catch {
          created++;
        }
      }
    } catch (error) {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN:');
  console.log(`✅ Creados: ${created}`);
  console.log(`🔄 Actualizados: ${updated}`);
  console.log(`❌ Fallidos: ${failed}`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n✅ Todos los usuarios fueron procesados exitosamente!');
    console.log('\n📝 CREDENCIALES DE ACCESO:');
    console.log('─'.repeat(50));
    users.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`Contraseña: ${user.password}`);
      console.log(`Rol: ${user.role}`);
      console.log('─'.repeat(50));
    });
  } else {
    console.log('\n⚠️  Algunos usuarios no pudieron ser procesados.');
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar script
main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
