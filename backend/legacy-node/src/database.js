import { MongoClient, ServerApiVersion } from "mongodb";

let client = null;
let database = null;

const databaseState = {
  databaseName: null,
  error: null,
  source: "none",
  status: "not_configured"
};

function getString(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function buildConnectionFromParts() {
  const username = getString("MONGODB_USERNAME");
  const password = getString("MONGODB_PASSWORD");
  const clusterHost = getString("MONGODB_CLUSTER_HOST");
  const databaseName = getString("MONGODB_DB_NAME") ?? "ritomer";
  const appName = getString("MONGODB_APP_NAME") ?? "Mereeto0";

  if (!username || !password || !clusterHost) {
    return null;
  }

  const connectionString =
    `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}` +
    `@${clusterHost}/${databaseName}?retryWrites=true&w=majority&appName=${encodeURIComponent(appName)}`;

  return {
    databaseName,
    source: "parts",
    uri: connectionString
  };
}

function getDatabaseNameFromUri(uri) {
  try {
    const normalizedUri = uri.startsWith("mongodb+srv://")
      ? uri.replace("mongodb+srv://", "https://")
      : uri.replace("mongodb://", "https://");
    const url = new URL(normalizedUri);
    const databaseName = url.pathname.replace(/^\//, "").trim();
    return databaseName !== "" ? databaseName : null;
  } catch {
    return null;
  }
}

function getMongoConfiguration() {
  const directUri = getString("MONGODB_URI");
  const configuredDatabaseName = getString("MONGODB_DB_NAME");

  if (directUri) {
    return {
      databaseName: configuredDatabaseName ?? getDatabaseNameFromUri(directUri) ?? "ritomer",
      source: "uri",
      uri: directUri
    };
  }

  return buildConnectionFromParts();
}

export function getDatabaseStatus() {
  return { ...databaseState };
}

export function getDatabase() {
  if (!database) {
    throw new Error("MongoDB is not connected.");
  }

  return database;
}

export async function initializeDatabase() {
  const configuration = getMongoConfiguration();

  if (!configuration) {
    databaseState.databaseName = getString("MONGODB_DB_NAME") ?? "ritomer";
    databaseState.error =
      "Missing MongoDB configuration. Set MONGODB_URI or provide MONGODB_USERNAME, MONGODB_PASSWORD and MONGODB_CLUSTER_HOST.";
    databaseState.source = "none";
    databaseState.status = "not_configured";
    return getDatabaseStatus();
  }

  client = new MongoClient(configuration.uri, {
    serverApi: {
      strict: true,
      version: ServerApiVersion.v1
    }
  });

  try {
    await client.connect();
    database = client.db(configuration.databaseName);
    await database.command({ ping: 1 });

    databaseState.databaseName = configuration.databaseName;
    databaseState.error = null;
    databaseState.source = configuration.source;
    databaseState.status = "connected";
  } catch (error) {
    databaseState.databaseName = configuration.databaseName;
    databaseState.error = error instanceof Error ? error.message : String(error);
    databaseState.source = configuration.source;
    databaseState.status = "error";

    await closeDatabaseConnection();
  }

  return getDatabaseStatus();
}

export async function closeDatabaseConnection() {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
  database = null;
}
