# ritomer

Base de projet organisee en deux applications autonomes :

- `backend` : API Node.js
- `frontend` : interface statique servie en local

Chaque dossier contient son propre `package.json` et se lance separement avec `pnpm`.

## Lancer le backend

```bash
cd backend
pnpm i
cp .env.example .env
pnpm dev
```

Le backend ecoute par defaut sur `http://localhost:3001`.
Avant `pnpm dev`, renseigne MongoDB Atlas dans `backend/.env`.
Le plus simple est de copier la connection string Atlas depuis `Connect` -> `Drivers`.

## Lancer le frontend

```bash
cd frontend
pnpm i
pnpm dev
```

Le frontend ecoute par defaut sur `http://localhost:3000`.

## Structure

```text
.
|-- backend/
|   |-- package.json
|   `-- src/server.js
|-- frontend/
|   |-- package.json
|   |-- public/
|   |   |-- app.js
|   |   |-- index.html
|   |   `-- styles.css
|   `-- server.js
|-- .editorconfig
|-- .gitattributes
|-- .gitignore
`-- CONTRIBUTING.md
```

## Endpoints backend

- `GET /api/health`
- `GET /api/message`

## MongoDB Atlas

Le backend lit la configuration MongoDB depuis `backend/.env`.

Variables supportees :

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- ou bien `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER_HOST`, `MONGODB_APP_NAME`

Important : le nom d'utilisateur et le mot de passe ne suffisent pas a eux seuls.
Il faut aussi le `cluster host` complet Atlas, visible dans la connection string fournie par MongoDB.

## Notes

- Les deux applications peuvent etre enrichies ensuite avec la stack de ton choix.
