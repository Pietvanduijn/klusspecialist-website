# De Klusspecialist van Duijn - Professionele Website

Dit is een volledige **full-stack website** met backend, database, en admin panel.

## Project Structuur

```
klusspecialist-website/
├── server.js              # Express backend server
├── package.json           # Node.js dependencies
├── klusspecialist.db      # SQLite database (wordt automatisch aangemaakt)
├── uploads/               # Mappen voor project foto's
├── client/
│   └── App.jsx           # React frontend component
└── public/               # Static files (index.html, etc)
```

## Setup (Lokale Development)

### 1. Node.js installeren
Download van https://nodejs.org (v16 of hoger)

### 2. Project Dependencies installeren
```bash
cd klusspecialist-website
npm install
```

### 3. Server starten
```bash
npm start
```

Je ziet dan:
```
✅ Server running at http://localhost:5000
💾 Database: ./klusspecialist.db
```

### 4. Frontend openen
Ga naar http://localhost:5000 in je browser

## Admin inloggen

- **URL**: http://localhost:5000 → Klik "Admin"
- **Wachtwoord**: `piet123`
- **Functies**:
  - Projecten toevoegen/verwijderen/foto's uploaden
  - Bedrijfsgegevens bewerken (naam, telefoon, email, etc.)
  - Berichten van contactformulier bekijken

## Database

De app gebruikt **SQLite** - een ingebouwde database die geen extra setup nodig heeft.

Database file: `klusspecialist.db` (automatisch aangemaakt)

### Database Tabellen:
- **company_info** - Bedrijfsgegevens
- **projects** - Portfolio projecten
- **messages** - Contact berichten

## API Endpoints

### Company Info
- `GET /api/company` - Bedrijfsgegevens ophalen
- `POST /api/company` - Bedrijfsgegevens bijwerken

### Projects
- `GET /api/projects` - Alle projecten
- `GET /api/projects/:id` - Specifiek project
- `POST /api/projects` - Nieuw project toevoegen (met foto)
- `PUT /api/projects/:id` - Project updaten
- `DELETE /api/projects/:id` - Project verwijderen

### Contact
- `POST /api/contact` - Contact formulier versturen
- `GET /api/messages` - Alle berichten (admin only)

## Foto's uploaden

In Admin Panel:
1. Ga naar "Projecten" tab
2. Vul "Titel", "Categorie" in
3. Klik "Kies bestand" om foto te selecteren
4. Klik "Project toevoegen"

Foto's worden opgeslagen in `/uploads` folder.

## Deployment naar Internet

### Optie 1: Railway (Aanbevolen - makkelijk)
1. Ga naar https://railway.app
2. Login met GitHub
3. Klik "New Project" → "Deploy from GitHub"
4. Selecteer dit project
5. Database en server draaien automatisch

### Optie 2: Render
1. Ga naar https://render.com
2. Klik "New +" → "Web Service"
3. Verbind je GitHub repo
4. Build command: `npm install`
5. Start command: `npm start`

### Optie 3: Heroku (Legacy)
```bash
heroku login
heroku create klusspecialist-vanduijn
git push heroku main
```

## Wachtwoord veranderen

Bewerk `server.js` en zoek:
```javascript
const ADMIN_PASSWORD = 'piet123';
```

Verander naar je eigen wachtwoord.

## Onderhoud

### Backups
Database file `klusspecialist.db` bevat alle data. Maak regelmatig backups.

### Logs
Server logs verschijnen in terminal wanneer je `npm start` draait.

## Support

Voor problemen:
1. Check of Node.js installeerd is: `node --version`
2. Check of port 5000 vrij is
3. Zorg dat alle dependencies installeren: `npm install`

## Volgende stappen

1. **Domein naam**: Koop een domein (bijv. klusspecialistvanduijn.nl)
2. **SSL/HTTPS**: Configure op je hosting (meestal automatisch)
3. **Backups**: Setup automatische backups
4. **Email notificaties**: Voeg SMTP toe voor contact berichten

Veel succes! 🚀
