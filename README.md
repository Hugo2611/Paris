# Paris Memories

Application Angular responsive pour consulter et gérer des souvenirs de Paris sur une carte interactive Leaflet avec galerie multimédia (photos et vidéos) connectée à Supabase.

---

## 🚀 Démarrer en local

```powershell
npm install
npm start
```

Ouvrez ensuite `http://localhost:4200`.

### Depuis un téléphone (réseau local)

Connectez le smartphone au même réseau Wi-Fi que l’ordinateur, lancez `npm start`, puis ouvrez `http://ADRESSE_IP_DE_VOTRE_PC:4200` dans le navigateur mobile. Les champs **Photo** et **Vidéo** du formulaire administrateur permettent d'importer directement depuis la photothèque ou l'appareil photo/caméra du mobile.

---

## 👥 Comptes Supabase & Droits

| Compte | Identifiant | Mot de passe | Droits |
| --- | --- | --- | --- |
| **Administrateur** | Compte Auth  | Mot de passe Supabase | Ajouter, modifier et supprimer des souvenirs & photos |
| **Lectrice** | Compte Auth | Mot de passe Supabase | Consultation de la carte et de la galerie |

> 🔒 **Sécurité Supabase** : Les autorisations sont vérifiées côté serveur via Row Level Security (RLS) et la fonction `public.is_admin()`. Hugo doit avoir `app_metadata.role = "admin"`. N’ajoutez jamais de clé `service_role` dans le frontend.

---

## 💾 Médias et données Supabase

- Données de départ : `src/app/data/souvenirs.data.ts`
- Base et fichiers : Supabase (table `memories` + bucket de stockage privé `media`).
- Exécutez [la migration SQL](supabase/migrations/20260911_create_paris_memories.sql) dans le **SQL Editor** de Supabase avant le premier lancement.

---

## 🌐 Déploiement en production

### Option 1 : Déployer sur VERCEL (Recommandé)

Le fichier de configuration [`vercel.json`](vercel.json) est déjà préconfiguré à la racine du projet avec les règles de réécriture SPA et le dossier de build.

#### Méthode A — Via GitHub (automatique et gratuit) :
1. Poussez votre code sur un dépôt **GitHub** (public ou privé).
2. Rendez-vous sur [vercel.com](https://vercel.com) et connectez-vous avec GitHub.
3. Cliquez sur **"Add New..."** > **"Project"**.
4. Importez votre dépôt `paris-souvenirs` (ou `PLK`).
5. Vercel détecte automatiquement les paramètres grâce au fichier `vercel.json` :
   - **Framework Preset** : Other (ou Angular)
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist/paris-souvenirs/browser`
6. Cliquez sur **"Deploy"**. En 1 à 2 minutes, votre application est en ligne avec un lien HTTPS gratuit (ex: `https://votre-projet.vercel.app`).

#### Méthode B — Via la CLI Vercel (direct depuis votre terminal) :
```powershell
npx -y vercel
```
Suivez les questions dans le terminal en acceptant les options par défaut.

---

### Option 2 : Déployer sur RENDER (Static Site)

Le fichier Blueprint [`render.yaml`](render.yaml) est également présent à la racine.

#### Déploiement via le Dashboard Render :
1. Poussez votre projet sur **GitHub**.
2. Allez sur [dashboard.render.com](https://dashboard.render.com).
3. Cliquez sur **"New +"** puis choisissez **"Static Site"**.
4. Connectez votre dépôt GitHub.
5. Renseignez la configuration :
   - **Name** : `paris-souvenirs`
   - **Branch** : `main` (ou votre branche courante)
   - **Build Command** : `npm run build`
   - **Publish Directory** : `dist/paris-souvenirs/browser`
6. Cliquez sur **"Advanced"** > **"Add Rewrite Rule"** :
   - **Source** : `/*`
   - **Destination** : `/index.html`
   *(Permet au router Angular d'accéder à `/connexion` et `/galerie` sans erreur 404).*
7. Cliquez sur **"Create Static Site"**.

---

### ⚠️ IMPORTANT : Autoriser l'URL sur Supabase Auth

Une fois votre site déployé sur Vercel ou Render (ex: `https://mon-site.vercel.app`) :
1. Allez sur le tableau de bord **Supabase** > **Authentication** > **URL Configuration**.
2. Dans **Site URL**, saisissez l'URL de votre application déployée : `https://mon-site.vercel.app`.
3. Dans **Redirect URLs**, ajoutez :
   - `https://mon-site.vercel.app/**`
   - `http://localhost:4200/**` (pour garder le développement local actif).
4. Cliquez sur **Save**.
