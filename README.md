# Registre des Demandes Clientèle — WAFI CAPITAL (version auto-hébergée, React)

Cette version remplace le stockage propre à Claude.ai par un vrai serveur
web (Node.js / Express), une base de données SQLite locale, une
authentification par identifiant/mot de passe, et une interface **React**
(compilée avec Vite). Vous pouvez l'installer sur n'importe quel serveur
(VPS, serveur interne, hébergement Node.js).

## Contenu

```
wafi-crm-server/
├── server.js          → serveur Express : API de stockage, authentification
├── package.json        → dépendances du serveur
├── public/
│   └── login.html      → page de connexion (servie sans authentification)
├── public-app/          → build React généré par `npm run build` (à ne pas éditer à la main)
├── client/               → code source de l'interface React
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx      → le composant CRM (registre, dossiers, tableau de bord)
│       └── index.css
├── scripts/
│   └── manage-users.js  → gestion des comptes utilisateurs
└── data/
    └── wafi-crm.db      → base de données SQLite (créée automatiquement)
```

## Installation

Prérequis : Node.js 18 ou plus récent (https://nodejs.org).

### 1. Installer et compiler l'interface React

```bash
cd client
npm install
npm run build
cd ..
```

Cette étape génère le dossier `public-app/` — c'est ce que le serveur sert
une fois l'utilisateur connecté. Il faut relancer `npm run build` à chaque
modification du code React (dans `client/src/`).

### 2. Installer le serveur

```bash
npm install
```

### 3. Créer les comptes utilisateurs

Chaque utilisateur a son propre identifiant et mot de passe. Il n'y a pas
d'inscription libre : c'est vous (l'administrateur) qui créez les comptes
en ligne de commande.

```bash
node scripts/manage-users.js add alice "un-mot-de-passe-solide"
node scripts/manage-users.js add bakary "un-autre-mot-de-passe"
node scripts/manage-users.js list
node scripts/manage-users.js remove alice
```

Le mot de passe doit contenir au moins 8 caractères. Relancer `add` avec un
identifiant existant met simplement à jour son mot de passe.

### 4. Démarrer le serveur

```bash
npm start
```

L'outil est alors accessible à l'adresse `http://localhost:3000` — il
redirige automatiquement vers la page de connexion si vous n'êtes pas
identifié.

La base de données SQLite (`data/wafi-crm.db`) est créée automatiquement
au premier démarrage — elle contient à la fois les dossiers clients et les
comptes utilisateurs. C'est un simple fichier — pensez à l'inclure dans
vos sauvegardes régulières.

### Développement de l'interface React (optionnel)

Pour modifier l'interface avec rechargement instantané pendant le
développement, lancez le serveur (`npm start` à la racine) puis, dans un
second terminal :

```bash
cd client
npm run dev
```

Vite démarre alors sur `http://localhost:5173` et redirige automatiquement
les appels `/api/*` vers le serveur Express. Une fois vos changements
terminés, pensez à relancer `npm run build` pour générer la version de
production servie par le serveur.

### Variable d'environnement importante : SESSION_SECRET

Définissez une valeur secrète fixe pour garder tout le monde connecté
d'un redémarrage à l'autre du serveur :

```bash
SESSION_SECRET="une-longue-chaine-aleatoire-et-secrete" npm start
```

Sans cette variable, une valeur temporaire est générée à chaque
démarrage et tous les utilisateurs sont déconnectés à chaque redémarrage
du serveur.

## Déploiement sur un serveur (production)

1. Copiez le dossier `wafi-crm-server` sur votre serveur.
2. Installez les dépendances : `npm install --production`
3. Gardez le processus actif en permanence avec un gestionnaire de
   processus, par exemple [PM2](https://pm2.keymetrics.io/) :
   ```bash
   npm install -g pm2
   pm2 start server.js --name wafi-crm
   pm2 save
   pm2 startup
   ```
4. Placez un serveur web (Nginx, Apache) devant l'application en reverse
   proxy, avec un certificat HTTPS (par exemple via Let's Encrypt /
   Certbot). Exemple de configuration Nginx minimale :
   ```nginx
   server {
     listen 443 ssl;
     server_name crm.wafi-votre-domaine.com;

     ssl_certificate     /etc/letsencrypt/live/votre-domaine/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/votre-domaine/privkey.pem;

     location / {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

**Ne déployez pas ce serveur derrière HTTP simple sur Internet** : les
données clients (contacts, échanges, pièces jointes) transiteraient en
clair. Le HTTPS est indispensable dès que l'outil sort de votre réseau
local.

## Sécurité — accès à l'outil

Chaque utilisateur se connecte désormais avec son propre identifiant et
mot de passe (voir « Créer les comptes utilisateurs » ci-dessus). Les mots
de passe sont stockés chiffrés (bcrypt), jamais en clair.

Quelques recommandations complémentaires :

- **HTTPS obligatoire en production** (voir section précédente) : sans
  cela, les identifiants et mots de passe circuleraient en clair sur le
  réseau.
- **Un compte par personne**, pas de compte partagé — cela permet de
  savoir qui a créé ou modifié chaque dossier si besoin, et de retirer
  l'accès d'une seule personne sans toucher aux autres.
- **Session de 12 heures** : au-delà, l'utilisateur doit se reconnecter.
  Ce délai se règle dans `server.js` (`cookie.maxAge`).
- Cette version reste une authentification simple (pas de rôles
  différenciés, pas de réinitialisation de mot de passe en libre-service,
  pas de journal des connexions). Si vous avez besoin de l'un de ces
  éléments, revenez vers Claude pour les ajouter.

## Sauvegardes

Le fichier `data/wafi-crm.db` contient l'intégralité des données
(dossiers, échanges, pièces jointes PDF encodées). Sauvegardez-le
régulièrement (copie automatisée quotidienne recommandée).

## Mise à jour de l'outil

Pour modifier l'interface (`public/index.html`), vous pouvez revenir vers
Claude avec vos demandes de changement, comme pour la version Claude.ai —
il suffit ensuite de redéployer le fichier mis à jour sur le serveur.
