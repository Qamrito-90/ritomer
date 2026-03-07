# ritomer

Base de projet organisee en deux applications autonomes :

- `backend` : API Node.js
- `frontend` : interface statique servie en local

Chaque dossier contient son propre `package.json` et se lance separement avec `pnpm`.

## Lancer le backend

```bash
cd backend
pnpm i
pnpm dev
```

Le backend ecoute par defaut sur `http://localhost:3001`.

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

## Notes

- La base actuelle n'impose aucune dependance externe.
- Les deux applications peuvent etre enrichies ensuite avec la stack de ton choix.
