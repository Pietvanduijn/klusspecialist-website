ge# De Klusspecialist van Duijn

Website van het klusbedrijf van Piet van Duijn in Noordwijk.

**Live:** https://www.klusspecialistvanduijn.nl

Node.js met Express. De teksten en foto's staan in een SQLite-database en zijn
aan te passen via een beheerscherm, zonder dat er code gewijzigd hoeft te worden.

## Opzet

```
server.js            Express-server, routes en het beheerscherm
lib/db.js            Database, standaardteksten, omzetting foto's naar WebP
views/index.ejs      De website als sjabloon
views/admin/         De schermen van het beheer
public/              styles.css en admin.css
uploads/             Startfoto's. MOET BLIJVEN STAAN — lib/db.js haalt ze hieruit
```

De pagina wordt door de server opgebouwd, niet door JavaScript in de browser.
Dat is bewust: zo leest Google de teksten gewoon mee.

## Beheerscherm

Op `/admin`. Inloggen met gebruikersnaam `piet` en het wachtwoord dat in Railway
onder `ADMIN_WACHTWOORD` staat. Het wachtwoord is daarna te wijzigen in het
scherm zelf.

Wat erin kan: portfoliofoto's toevoegen, bijschriften en volgorde aanpassen,
alle teksten van de site wijzigen, en de binnengekomen contactberichten lezen.

Geüploade foto's worden automatisch gedraaid, verkleind naar maximaal 1400
pixels en omgezet naar WebP. Een telefoonfoto van 2,7 MB wordt zo ongeveer
50 KB.

## Waar de gegevens staan

Railway wist bij elke nieuwe versie de hele schijf. De database en de geüploade
foto's staan daarom **niet** in de projectmap maar in `DATA_DIR`, dat in Railway
naar een volume wijst (een vaste schijf die een update overleeft). Lokaal is dat
de map `./data`.

Die map hoort niet in GitHub en staat in `.gitignore`.

## Instellingen

In Railway onder Variables, lokaal in een `.env`. Zie `.env.example`.

| Naam | Waarvoor |
|---|---|
| `DATA_DIR` | Waar de database en foto's staan. In Railway: `/data` |
| `ADMIN_WACHTWOORD` | Startwachtwoord. Alleen gebruikt als er nog geen beheerder is |
| `SESSION_SECRET` | Ondertekent het inlogcookie |
| `SITE_URL` | Volledig adres van de site, zonder schuine streep aan het eind |
| `NODE_ENV` | `production` zet het inlogcookie op alleen-https |
| `RESEND_API_KEY` | Voor het versturen van de contactformulieren |

## Lokaal draaien

```bash
npm install
npm run dev
```

Site op `http://localhost:8080`, beheer op `http://localhost:8080/admin`.

## Hosting

Railway, project `spirited-eagerness`, regio EU West (Amsterdam). Elke commit op
`main` gaat automatisch live.

Het domein staat bij TransIP. Alles komt uit op `https://www.` — het kale domein
stuurt door.

## Let op bij wijzigen

De standaardteksten in `lib/db.js` worden alleen gebruikt bij een **lege**
database. Bestaat de database al, dan blijven de bestaande waarden staan. Dat is
expres: anders zou elke update de wijzigingen van Piet wissen.

Wil je een standaardwaarde alsnog doorvoeren in een bestaande database, dan is
daar een aparte omzetting voor nodig — zie de twee `UPDATE`-regels in
`lib/db.js` die de startfoto's van JPEG naar WebP hebben gezet.
