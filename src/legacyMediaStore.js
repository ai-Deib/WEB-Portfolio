const DATABASE_NAME = "frame-portfolio";
const PROJECTS_STORE = "projects";
const SOCIALS_STORE = "socials";
const GROUPS_STORE = "groups";

function openLegacyDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    let isNewDatabase = false;

    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        isNewDatabase = true;
        request.transaction.abort();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      if (isNewDatabase) resolve(null);
      else reject(request.error || new Error("Could not read the previous browser library."));
    };
  });
}

function readStore(database, storeName) {
  if (!database.objectStoreNames.contains(storeName)) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not read previous portfolio content."));
  });
}

export async function getLegacyPortfolioContent() {
  const database = await openLegacyDatabase();
  if (!database) return { groups: [], projects: [], socials: [] };

  try {
    const [groups, projects, socials] = await Promise.all([
      readStore(database, GROUPS_STORE),
      readStore(database, PROJECTS_STORE),
      readStore(database, SOCIALS_STORE),
    ]);
    return { groups, projects, socials };
  } finally {
    database.close();
  }
}
