const DB_NAME = 'medtrack_offline'
const DB_VERSION = 2

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('visites')) {
        db.createObjectStore('visites', { keyPath: 'local_id' })
      }
      if (!db.objectStoreNames.contains('agenda')) {
        db.createObjectStore('agenda', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('portfolio')) {
        db.createObjectStore('portfolio', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('produits')) {
        db.createObjectStore('produits', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('supports')) {
        db.createObjectStore('supports', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ===== VISITES =====
export const saveVisiteLocally = async (visite) => {
  const db = await openDB()
  const local_id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
  return new Promise((resolve, reject) => {
    const tx = db.transaction('visites', 'readwrite')
    tx.objectStore('visites').add({ ...visite, local_id, synced: false })
    tx.oncomplete = () => resolve(local_id)
    tx.onerror = () => reject(tx.error)
  })
}

export const getPendingVisites = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('visites', 'readonly')
    const req = tx.objectStore('visites').getAll()
    req.onsuccess = () => resolve(req.result.filter(v => !v.synced))
    req.onerror = () => reject(req.error)
  })
}

export const deleteLocalVisite = async (local_id) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('visites', 'readwrite')
    tx.objectStore('visites').delete(local_id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const countPendingVisites = async () => {
  const pending = await getPendingVisites()
  return pending.length
}

// ===== AGENDA =====
export const saveAgendaOffline = async (plans) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('agenda', 'readwrite')
    const store = tx.objectStore('agenda')
    store.clear()
    plans.forEach(p => store.add(p))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const getAgendaOffline = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('agenda', 'readonly')
    const req = tx.objectStore('agenda').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ===== PORTFOLIO =====
export const savePortfolioOffline = async (items) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('portfolio', 'readwrite')
    const store = tx.objectStore('portfolio')
    store.clear()
    items.forEach(p => store.add(p))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const getPortfolioOffline = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('portfolio', 'readonly')
    const req = tx.objectStore('portfolio').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ===== PRODUITS =====
export const saveProduitsOffline = async (items) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('produits', 'readwrite')
    const store = tx.objectStore('produits')
    store.clear()
    items.forEach(p => store.add(p))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const getProduitsOffline = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('produits', 'readonly')
    const req = tx.objectStore('produits').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ===== SUPPORTS E-DETAILING =====
export const saveSupportsOffline = async (items) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('supports', 'readwrite')
    const store = tx.objectStore('supports')
    store.clear()
    items.forEach(s => store.add(s))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const getSupportsOffline = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('supports', 'readonly')
    const req = tx.objectStore('supports').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ===== SYNC META =====
export const setLastSync = async (key) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_meta', 'readwrite')
    tx.objectStore('sync_meta').put({ key, value: new Date().toISOString() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const getLastSync = async (key) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_meta', 'readonly')
    const req = tx.objectStore('sync_meta').get(key)
    req.onsuccess = () => resolve(req.result?.value || null)
    req.onerror = () => reject(req.error)
  })
}

// ===== UTILITAIRES =====
export const isOnline = () => navigator.onLine

export const clearAllOfflineData = async () => {
  const db = await openDB()
  const stores = ['agenda', 'portfolio', 'produits', 'supports', 'sync_meta']
  for (const store of stores) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export const getOfflineStats = async () => {
  const [agenda, portfolio, produits, supports, pending] = await Promise.all([
    getAgendaOffline(),
    getPortfolioOffline(),
    getProduitsOffline(),
    getSupportsOffline(),
    getPendingVisites()
  ])
  return {
    agenda: agenda.length,
    portfolio: portfolio.length,
    produits: produits.length,
    supports: supports.length,
    pendingVisites: pending.length
  }
}