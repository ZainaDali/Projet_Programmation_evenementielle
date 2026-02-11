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
2. **Se connecter** avec vos identifiants
3. **Créer ou rejoindre un salon**
4. **Créer des sondages et voter**

Note: Le premier utilisateur créé sera automatiquement admin.

## ✨ Fonctionnalités

### Authentification
- ✅ Inscription avec validation
- ✅ Connexion sécurisée
- ✅ Système de sessions avec tokens
- ✅ Gestion des rôles (admin/user)

### Salons (Tâche 1)
- ✅ Création/modification/suppression
- ✅ Types d'accès (public/privé/sélectionné)
- ✅ Présence temps réel
- ✅ Gestion déconnexion/reconnexion

### Chat (Tâche 2)
- 📝 À implémenter

### Sondages (Tâche 3)
- ✅ Création (admin only)
- ✅ Vote temps réel avec graphiques
- ✅ Fermeture (admin/moderator)
- ✅ Resync après reconnexion
- ✅ Rate limiting anti-abus
- ✅ Protection vote double

## 🔒 Sécurité

- Authentification par token
- Autorisation par rôle
- Rate limiting votes (10/minute)
- Rate limiting création sondages (3/minute)
- Validation payloads côté serveur
- Protection vote double
- Contrôle accès salons

## 🎨 Interface

- Design moderne avec Tailwind CSS 3
- Gradients et animations
- Responsive design
- Interface intuitive
- Feedback visuel en temps réel

## 📡 WebSockets

### Événements disponibles

**Sondages**:
- `poll:create` - Créer un sondage
- `poll:vote` - Voter
- `poll:close` - Fermer un sondage
- `poll:getState` - Récupérer l'état

**Salons**:
- `room:join` - Rejoindre avec resync
- `room:leave` - Quitter
- `room:userJoined` / `room:userLeft` - Notifications

**Présence**:
- `user:online` / `user:offline` - Statuts

## 🧪 Tests

Pour tester la démo:

1. **Créer le premier compte** (sera automatiquement admin 👑)
2. **Créer un second compte** (sera un utilisateur normal 👤)
3. Avec le compte admin: créer un salon
4. Les 2 utilisateurs rejoignent le salon
5. Admin crée un sondage
6. Les 2 utilisateurs votent
7. Observer résultats en temps réel
8. Tester reconnexion (refresh page)
9. Admin ferme le sondage

## ⚠️ Important

- Le premier utilisateur qui s'inscrit devient automatiquement **ADMIN**
- Les suivants sont des **USERS** normaux
- Seuls les admins peuvent créer des salons et des sondages
- Tous les utilisateurs peuvent voter

## 📁 Structure

```
.
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Composants
│   │   ├── context/        # Auth + Socket
│   │   ├── pages/          # Login, Register, Dashboard
│   │   └── config.js       # API config
│   └── package.json
│
└── server/                 # Backend Node.js
    ├── src/
    │   ├── config/         # Configuration
    │   ├── domain/         # Services + Policies
    │   ├── http/           # Routes HTTP
    │   ├── realtime/       # Socket.IO
    │   ├── scripts/        # Scripts utilitaires
    │   └── utils/          # Helpers
    └── package.json
```

## 📝 Notes

- Tailwind CSS 3 configuré avec PostCSS
- Hot reload activé (Vite + Nodemon)
- MongoDB requis (local ou Atlas)
- StrictMode désactivé pour Socket.IO
