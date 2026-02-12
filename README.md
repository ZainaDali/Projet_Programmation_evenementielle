# Projet Programmation Événementielle - Chat App

Application de chat temps réel avec sondages, développée avec React + Node.js + Socket.IO + MongoDB.

## 🚀 Architecture

- **Frontend**: React 18 + Vite + Tailwind CSS 3 (port 5173)
- **Backend**: Node.js + Express + Socket.IO (port 3000)
- **Base de données**: MongoDB Atlas

## 📦 Installation

### Backend

```bash
cd server
npm install
```

Créer un fichier `.env` dans `server/`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=projet_po
PORT=3000
TOKEN_EXPIRY_HOURS=24
NODE_ENV=development
```

### Frontend

```bash
cd client
npm install
```

## 🎯 Lancement

### 1. Backend

```bash
cd server
npm run dev
```

Le serveur démarre sur http://localhost:3000

### 2. Frontend

```bash
cd client
npm run dev
```

L'application démarre sur http://localhost:5173

## 👥 Utilisation

1. **Créer un compte** sur http://localhost:5173/register 
2. **Se connecter** sur http://localhost:5173/login
3. **Créer un sondage** (admin uniquement) depuis le tableau de bord
4. **Voter**, **chatter** et observer les résultats en temps réel


Note: Le premier utilisateur créé sera automatiquement admin.

## ✨ Fonctionnalités

### Authentification
- ✅ Inscription avec validation
- ✅ Connexion sécurisée
- ✅ Système de sessions avec tokens
- ✅ Gestion des rôles (admin/user)

### Sondages (Polls)
- ✅ Création de sondages (admin uniquement, 2 à 6 options)
- ✅ Modification et suppression de sondages (admin ou créateur)
- ✅ Types d'accès : **public** / **privé** / **sélectionné** (avec sélection d'utilisateurs)
- ✅ Vote en temps réel avec barres de progression animées
- ✅ Changement de vote et annulation (toggle)
- ✅ Fermeture de sondage (admin / modérateur / créateur)
- ✅ Kick d'utilisateur d'un sondage (supprime ses votes)
- ✅ Suivi des participants (join/leave en temps réel)
- ✅ Resynchronisation après reconnexion
- ✅ Rate limiting : 10 votes/min, 3 créations/min

### Chat par sondage
- ✅ Chat intégré dans chaque sondage
- ✅ Envoi de messages en temps réel
- ✅ Historique des messages au chargement
- ✅ Suppression de messages (auteur / admin / modérateur)
- ✅ Limite de 500 caractères par message
- ✅ Purge automatique (50 messages max par sondage)
- ✅ Contrôle d'accès basé sur les permissions du sondage
- ✅ Rate limiting : 5 messages / 10 secondes

### Présence temps réel
- ✅ Suivi en ligne / hors ligne de tous les utilisateurs
- ✅ Notification broadcast à la connexion et déconnexion
- ✅ Sidebar avec liste des utilisateurs en ligne et hors ligne
- ✅ Timestamps « dernière connexion »

### Interface
- ✅ Dashboard 3 colonnes : sidebar utilisateurs, sondages centraux, journal d'activité
- ✅ Design moderne avec Tailwind CSS 3 (gradients, animations)
- ✅ Indicateur de connexion temps réel (vert/rouge)
- ✅ Badge de rôle sur l'avatar utilisateur
- ✅ Journal d'activité en temps réel (panel droit)

| Mesure | Statut |
|--------|:------:|
| Hachage des mots de passe (bcrypt, 10 salt rounds) | ✅ |
| Authentification par token (HTTP + Socket.IO) | ✅ |
| Expiration automatique des sessions (TTL MongoDB) | ✅ |
| Révocation de session (logout) | ✅ |
| Contrôle d'accès par rôle (RBAC) | ✅ |
| Validation des entrées (Zod côté HTTP, manuelle côté socket) | ✅ |
| Rate limiting (votes, sondages, chat) | ✅ |
| Limite de taille des messages (500 chars) | ✅ |
| Limite d'options par sondage (2-6) | ✅ |
| Protection contre le vote double | ✅ |
| Purge automatique des anciens messages | ✅ |
| CORS activé | ✅ |

## 👤 Rôles & Permissions

| Action | Admin | Modérateur | Créateur | Utilisateur |
|--------|:-----:|:----------:|:--------:|:-----------:|
| Créer un sondage | ✅ | ❌ | — | ❌ |
| Modifier un sondage | ✅ | ❌ | ✅ | ❌ |
| Supprimer un sondage | ✅ | ❌ | ✅ | ❌ |
| Fermer un sondage | ✅ | ✅ | ✅ | ❌ |
| Voter | ✅ | ✅ | ✅ | ✅ |
| Kick un utilisateur | ✅ | ❌ | ✅ | ❌ |
| Envoyer un message chat | ✅ | ✅ | ✅ | ✅ |
| Supprimer un message | ✅ | ✅ | ✅ (le sien) | ❌ |

## 📡 API & Événements

### Endpoints HTTP

| Méthode | Route | Auth | Description |
|---------|-------|:----:|-------------|
| `GET` | `/health` | ❌ | Health check |
| `POST` | `/auth/register` | ❌ | Inscription |
| `POST` | `/auth/login` | ❌ | Connexion |
| `POST` | `/auth/logout` | ✅ | Déconnexion |
| `GET` | `/auth/me` | ✅ | Infos utilisateur courant |
| `GET` | `/auth/validate` | ✅ | Validation du token |

### Événements WebSocket

#### Sondages

| Événement | Direction | Description |
|-----------|:---------:|-------------|
| `poll:create` | Client → Serveur | Créer un sondage |
| `poll:vote` | Client → Serveur | Voter / changer de vote / annuler |
| `poll:close` | Client → Serveur | Fermer un sondage |
| `poll:edit` | Client → Serveur | Modifier un sondage |
| `poll:delete` | Client → Serveur | Supprimer un sondage |
| `poll:kick` | Client → Serveur | Expulser un utilisateur |
| `poll:join` | Client → Serveur | Rejoindre en tant que participant |
| `poll:leave` | Client → Serveur | Quitter un sondage |
| `poll:getState` | Client → Serveur | Récupérer tous les sondages |
| `poll:created` | Serveur → Client | Notification de nouveau sondage |
| `poll:updated` | Serveur → Client | Résultats de vote mis à jour |
| `poll:closed` | Serveur → Client | Sondage fermé |
| `poll:edited` | Serveur → Client | Sondage modifié / utilisateur kické |
| `poll:deleted` | Serveur → Client | Sondage supprimé |
| `poll:kicked` | Serveur → Client | Notification d'expulsion (ciblée) |
| `poll:userJoined` | Serveur → Client | Un participant a rejoint |
| `poll:userLeft` | Serveur → Client | Un participant a quitté |

#### Chat

| Événement | Direction | Description |
|-----------|:---------:|-------------|
| `chat:send` | Client → Serveur | Envoyer un message |
| `chat:history` | Client → Serveur | Demander l'historique |
| `chat:delete` | Client → Serveur | Supprimer un message |
| `chat:joinPoll` | Client → Serveur | Rejoindre le chat d'un sondage |
| `chat:leavePoll` | Client → Serveur | Quitter le chat d'un sondage |
| `chat:new_message` | Serveur → Client | Nouveau message reçu |
| `chat:message_deleted` | Serveur → Client | Message supprimé |

#### Présence

| Événement | Direction | Description |
|-----------|:---------:|-------------|
| `user:online` | Serveur → Client | Un utilisateur s'est connecté |
| `user:offline` | Serveur → Client | Un utilisateur s'est déconnecté |
| `presence:onlineUsers` | Serveur → Client | Liste des utilisateurs en ligne |
| `presence:allUsers` | Serveur → Client | Liste complète (en ligne + hors ligne) |

## 🧪 Tests

1. **Créer le premier compte** → il devient automatiquement **admin** 👑
2. **Ouvrir un second navigateur** (ou navigation privée) et créer un second compte → **user** 👤
3. Avec le compte **admin** : créer un sondage (public ou sélectionné)
4. Les 2 utilisateurs voient le sondage apparaître en temps réel
5. Les 2 votent → observer les barres de progression se mettre à jour instantanément
6. Ouvrir le **chat** dans le sondage → envoyer des messages
7. **Rafraîchir la page** → vérifier la resynchronisation automatique (sondages + votes)
8. Tester le **kick** d'un utilisateur (admin)
9. **Fermer** le sondage → les votes sont gelés
10. Observer le **journal d'activité** (panel droit) pour tous les événements

## 📁 Structure du projet

```
.
├── client/                          # Frontend React 19
│   ├── src/
│   │   ├── main.jsx                 # Point d'entrée React
│   │   ├── App.jsx                  # Router (Login, Register, Dashboard)
│   │   ├── config.js                # URL API & Socket
│   │   ├── index.css                # Imports Tailwind
│   │   ├── context/
│   │   │   ├── AuthContext.jsx      # Provider auth (login, logout, token localStorage)
│   │   │   └── SocketContext.jsx    # Provider Socket.IO (auto-connect sur token)
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Page de connexion
│   │   │   ├── Register.jsx         # Page d'inscription
│   │   │   └── Dashboard.jsx        # Dashboard principal (3 colonnes)
│   │   └── components/
│   │       ├── Header.jsx           # Barre de navigation (logo, statut, logout)
│   │       ├── Sidebar.jsx          # Liste utilisateurs en ligne / hors ligne
│   │       ├── PollsView.jsx        # Vue principale des sondages + modales
│   │       ├── ChatView.jsx         # Chat intégré par sondage
│   │       ├── ActivityLog.jsx      # Journal d'activité temps réel
│   │       └── PrivateRoute.jsx     # Guard d'authentification
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── server/                          # Backend Node.js
│   ├── src/
│   │   ├── index.js                 # Point d'entrée (HTTP + Socket.IO)
│   │   ├── config/
│   │   │   ├── constants.js         # Rôles, collections, limites, statuts
│   │   │   ├── database.js          # Connexion MongoDB + index
│   │   │   └── env.js               # Variables d'environnement (dotenv)
│   │   ├── domain/
│   │   │   ├── policies/
│   │   │   │   └── permissions.js   # Vérifications de rôle
│   │   │   └── services/
│   │   │       ├── auth.service.js  # Register, login, logout, validateToken
│   │   │       ├── chat.service.js  # Messages : envoi, historique, suppression
│   │   │       ├── polls.service.js # Sondages : CRUD, vote, close, kick
│   │   │       └── presence.service.js # Suivi en ligne / hors ligne
│   │   ├── http/
│   │   │   ├── app.js               # Config Express (CORS, routes, error handler)
│   │   │   ├── middlewares/         # Auth HTTP + error handler
│   │   │   └── routes/
│   │   │       └── auth.routes.js   # Routes /auth/*
│   │   ├── realtime/
│   │   │   ├── io.js                # Init Socket.IO + gestion connexions
│   │   │   ├── handlers/
│   │   │   │   ├── polls.handler.js # Handlers sondages
│   │   │   │   └── chat.handler.js  # Handlers chat
│   │   │   └── middlewares/
│   │   │       └── auth.socket.js   # Auth Socket.IO (handshake)
│   │   └── utils/
│   │       ├── errors.js            # Classe AppError + erreurs prédéfinies
│   │       ├── ids.js               # Générateurs d'ID (nanoid)
│   │       └── logger.js            # Logger coloré en console
│   └── package.json
│
└── docs/                            # Documentation technique
    ├── protocol.md
    ├── errors.md
    └── security.md
```


## 📝 Notes

- Tailwind CSS 3 configuré avec PostCSS
- Hot reload activé (Vite + Nodemon)
- MongoDB requis (local ou Atlas)
- StrictMode désactivé pour Socket.IO
