import { openDB } from 'idb'

const DB_NAME = 'medtrack-offline'
const STORE_NAME = 'visites-pending'

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'local_id' })
      }
    }
  })
}

// Sauvegarder une visite localement
export async function saveVisiteLocally(visite) {
  const db = await getDB()
  const local_id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await db.put(STORE_NAME, { ...visite, local_id, synced: false })
  return local_id
}

// Récupérer toutes les visites en attente
export async function getPendingVisites() {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

// Supprimer une visite locale après sync
export async function deleteLocalVisite(local_id) {
  const db = await getDB()
  await db.delete(STORE_NAME, local_id)
}

// Compter les visites en attente
export async function countPendingVisites() {
  const db = await getDB()
  const all = await db.getAll(STORE_NAME)
  return all.filter(v => !v.synced).length
}

// Vérifier si on est en ligne
export function isOnline() {
  return navigator.onLine
}