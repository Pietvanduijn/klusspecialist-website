/**
 * Database en opslag.
 *
 * Alles wat Piet kan aanpassen staat hier: teksten, foto's en berichten.
 *
 * BELANGRIJK — waar de bestanden staan:
 * Railway wist bij elke nieuwe deploy de hele schijf. Daarom staan de database
 * en de geuploade foto's NIET in de projectmap, maar in DATA_DIR. In Railway
 * wijst die naar een volume (vaste schijf die deploys overleeft). Lokaal is het
 * gewoon de map ./data. Zet die map nooit in GitHub.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'klusspecialist.db');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ---------------------------------------------------------------- schema

db.exec(`
  CREATE TABLE IF NOT EXISTS inhoud (
    sleutel   TEXT PRIMARY KEY,
    waarde    TEXT NOT NULL DEFAULT '',
    label     TEXT NOT NULL,
    uitleg    TEXT,
    soort     TEXT NOT NULL DEFAULT 'regel',   -- regel | tekstvak | afbeelding
    groep     TEXT NOT NULL DEFAULT 'overig',
    volgorde  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS projecten (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    titel     TEXT NOT NULL DEFAULT '',
    bestand   TEXT NOT NULL,
    alt       TEXT NOT NULL DEFAULT '',
    volgorde  INTEGER NOT NULL DEFAULT 0,
    aangemaakt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS berichten (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    naam      TEXT NOT NULL,
    email     TEXT NOT NULL,
    bericht   TEXT NOT NULL,
    gelezen   INTEGER NOT NULL DEFAULT 0,
    aangemaakt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS beheerders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    gebruikersnaam TEXT NOT NULL UNIQUE,
    wachtwoord     TEXT NOT NULL
  );
`);

// ---------------------------------------------------------- standaardteksten
//
// Dit is exact wat er op 13 augustus 2026 op de site stond. Bij de eerste start
// wordt dit ingeladen, daarna nooit meer aangeraakt — Piets wijzigingen blijven
// dus staan. Nieuwe sleutels die er later bijkomen worden wel toegevoegd.

const STANDAARD = [
  // --- vindbaarheid in Google
  ['pagina_titel', 'Klusbedrijf Noordwijk | De Klusspecialist van Duijn', 'Paginatitel', 'Verschijnt als blauwe link in Google en in het tabblad van de browser. Houd het onder de 60 tekens.', 'regel', 'google', 10],
  ['meta_omschrijving', 'Klusbedrijf in Noordwijk met ruim 15 jaar ervaring. Badkamerrenovatie, tegelwerk, schilder- en stucwerk in Noordwijk en de Bollenstreek. Bel 06 24 26 24 13.', 'Omschrijving in Google', 'Het grijze tekstje onder de link in de zoekresultaten. Houd het onder de 155 tekens.', 'tekstvak', 'google', 20],
  ['werkgebied', 'Noordwijk, Noordwijkerhout, Katwijk, Lisse, Sassenheim, Voorhout, Hillegom, Leiden', 'Plaatsen waar u werkt', 'Plaatsnamen met een komma ertussen. Google gebruikt dit om te bepalen in welke plaatsen u getoond wordt.', 'tekstvak', 'google', 30],
  ['facebook_url', '', 'Link naar uw Facebook-pagina', 'Zo weet Google dat die pagina bij hetzelfde bedrijf hoort. Leeg laten mag.', 'regel', 'google', 40],
  ['werkspot_url', '', 'Link naar uw Werkspot-profiel', 'Daar staan uw reviews. Google koppelt die aan uw bedrijf. Leeg laten mag.', 'regel', 'google', 50],

  // --- bovenaan de pagina
  ['hero_label', 'Klusbedrijf · Noordwijk', 'Klein label bovenaan', 'Het gouden regeltje boven de grote kop.', 'regel', 'bovenaan', 10],
  ['hero_titel', 'Vakmanschap', 'Grote kop', 'Het eerste woord, in gewone letters.', 'regel', 'bovenaan', 20],
  ['hero_titel_cursief', 'van Duijn', 'Grote kop, tweede regel', 'Verschijnt schuingedrukt onder de eerste regel.', 'regel', 'bovenaan', 30],
  ['hero_tekst', 'Badkamers, toiletten en klussen in en rondom het huis — in Noordwijk en de hele Bollenstreek. Kwaliteit die u ziet en voelt.', 'Tekst onder de kop', null, 'tekstvak', 'bovenaan', 40],
  ['hero_knop1', 'Bekijk ons werk', 'Tekst op de eerste knop', null, 'regel', 'bovenaan', 50],
  ['hero_knop2', 'Neem contact op', 'Tekst op de tweede knop', null, 'regel', 'bovenaan', 60],
  ['hero_foto', '/uploads/foto2.webp', 'Achtergrondfoto bovenaan', 'De grote foto achter de kop. Kies een liggende foto, die staat het mooist.', 'afbeelding', 'bovenaan', 70],

  // --- diensten
  ['diensten_label', 'Wat we doen', 'Klein label boven Diensten', null, 'regel', 'diensten', 10],
  ['diensten_titel', 'Onze diensten', 'Kop boven Diensten', null, 'regel', 'diensten', 20],
  ['dienst1_titel', 'Badkamer & Toilet', 'Dienst 1 — titel', null, 'regel', 'diensten', 30],
  ['dienst1_tekst', 'Complete renovaties van A tot Z — tegelen, loodgieterswerk, sanitair. Strak en duurzaam uitgevoerd.', 'Dienst 1 — omschrijving', null, 'tekstvak', 'diensten', 31],
  ['dienst2_titel', 'Tegelen & Vloeren', 'Dienst 2 — titel', null, 'regel', 'diensten', 40],
  ['dienst2_tekst', 'Wand- en vloertegels, laminaat of PVC — nauwkeurig gelegd met oog voor detail en afwerking.', 'Dienst 2 — omschrijving', null, 'tekstvak', 'diensten', 41],
  ['dienst3_titel', 'Reparaties & Onderhoud', 'Dienst 3 — titel', null, 'regel', 'diensten', 50],
  ['dienst3_tekst', 'Van kleine reparaties tot groter onderhoud. Snel, betrouwbaar en netjes opgeleverd.', 'Dienst 3 — omschrijving', null, 'tekstvak', 'diensten', 51],
  ['dienst4_titel', 'Schilder- & Stucwerk', 'Dienst 4 — titel', null, 'regel', 'diensten', 60],
  ['dienst4_tekst', 'Muren en plafonds strak gepleisterd en geschilderd voor een frisse, nette uitstraling.', 'Dienst 4 — omschrijving', null, 'tekstvak', 'diensten', 61],

  // --- portfolio
  ['portfolio_label', 'Ons werk', 'Klein label boven Portfolio', null, 'regel', 'portfolio', 10],
  ['portfolio_titel', 'Recente projecten', 'Kop boven Portfolio', null, 'regel', 'portfolio', 20],

  // --- over ons
  ['over_label', 'Over ons', 'Klein label boven Over ons', null, 'regel', 'over', 10],
  ['over_titel', 'Piet van Duijn', 'Kop boven Over ons', null, 'regel', 'over', 20],
  ['over_tekst1', 'Met meer dan 15 jaar ervaring in de klussector weet ik wat kwaliteit betekent. Ik werk eerlijk, netjes en punctueel — en kom altijd mijn afspraken na.', 'Over ons — eerste alinea', null, 'tekstvak', 'over', 30],
  ['over_tekst2', 'Vanuit Noordwijk werk ik in de hele Bollenstreek: Noordwijkerhout, Katwijk, Lisse, Sassenheim, Voorhout, Hillegom en Leiden. Of het nu gaat om een kleine reparatie of een complete badkamerrenovatie, u kunt rekenen op vakmanschap en persoonlijke service.', 'Over ons — tweede alinea', 'Noem hier de plaatsen waar u werkt. Google gebruikt dit om u aan die plaatsen te koppelen.', 'tekstvak', 'over', 40],
  ['over_foto', '/uploads/foto13.webp', 'Foto bij Over ons', 'Een foto van uzelf of van uw werk. Staande foto werkt hier het best.', 'afbeelding', 'over', 50],
  ['feit1_getal', '15+', 'Cijfer 1', 'Bijvoorbeeld het aantal jaren ervaring.', 'regel', 'over', 60],
  ['feit1_label', 'Jaar ervaring', 'Cijfer 1 — omschrijving', null, 'regel', 'over', 61],
  ['feit2_getal', '100%', 'Cijfer 2', null, 'regel', 'over', 70],
  ['feit2_label', 'Klanttevredenheid', 'Cijfer 2 — omschrijving', null, 'regel', 'over', 71],

  // --- contactgegevens
  ['telefoon', '06 24 26 24 13', 'Telefoonnummer', 'Met spaties mag. Het nummer om op te bellen wordt hier automatisch van gemaakt.', 'regel', 'contact', 10],
  ['email', 'piet_vanduijn@msn.com', 'E-mailadres', 'Hier komen de berichten van het contactformulier binnen.', 'regel', 'contact', 20],
  ['adres_straat', 'De Mook 6', 'Straat en huisnummer', 'Moet exact hetzelfde zijn als in uw Google Bedrijfsprofiel.', 'regel', 'contact', 30],
  ['adres_postcode', '2203 ZD', 'Postcode', null, 'regel', 'contact', 31],
  ['adres_plaats', 'Noordwijk', 'Plaats', 'Belangrijk voor Google: hierop wordt u lokaal gevonden.', 'regel', 'contact', 32],
  ['contact_label', 'Offerte aanvragen', 'Klein label boven Contact', null, 'regel', 'contact', 40],
  ['contact_titel', 'Neem contact op', 'Kop boven Contact', null, 'regel', 'contact', 50],
  ['contact_tekst', 'Heeft u een klus of wilt u een vrijblijvende offerte? Stuur een bericht en ik neem zo snel mogelijk contact op.', 'Tekst bij het contactformulier', null, 'tekstvak', 'contact', 60],

  // --- algemeen
  ['bedrijfsnaam', 'De Klusspecialist van Duijn', 'Bedrijfsnaam', 'Staat bovenaan in de balk en onderaan in de voettekst.', 'regel', 'algemeen', 10],
  ['footer_tekst', '© 2026 · Klusbedrijf in Noordwijk, Zuid-Holland', 'Voettekst', 'Adres en telefoonnummer worden er automatisch achter gezet.', 'regel', 'algemeen', 20],
];

const invoegen = db.prepare(`
  INSERT INTO inhoud (sleutel, waarde, label, uitleg, soort, groep, volgorde)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(sleutel) DO UPDATE SET
    label = excluded.label, uitleg = excluded.uitleg, soort = excluded.soort,
    groep = excluded.groep, volgorde = excluded.volgorde
`);

// De waarde wordt bij een bestaande sleutel bewust NIET overschreven — anders
// zou een deploy Piets wijzigingen ongedaan maken.
db.transaction(() => STANDAARD.forEach(r => invoegen.run(...r)))();

// Eenmalige omzetting van de startfoto's van JPEG naar WebP.
//
// Bij een bestaande database worden waarden bewust niet overschreven, anders
// zou een deploy Piets wijzigingen wissen. Daardoor bleven de verwijzingen naar
// .jpg staan terwijl de WebP-bestanden er al wel waren. Deze twee regels zetten
// alleen de oorspronkelijke startfoto's om: 'foto' gevolgd door cijfers. Door
// Piet geuploade foto's heten 'foto-<tijdstempel>' en blijven dus ongemoeid.
db.prepare(`UPDATE inhoud SET waarde = replace(waarde, '.jpg', '.webp')
            WHERE waarde GLOB '/uploads/foto[0-9]*.jpg'`).run();
db.prepare(`UPDATE projecten SET bestand = replace(bestand, '.jpg', '.webp')
            WHERE bestand GLOB '/uploads/foto[0-9]*.jpg'`).run();

// Sleutels die we later hernoemd of geschrapt hebben opruimen, zodat er geen
// oude velden in het bewerkscherm blijven hangen.
db.prepare(
  `DELETE FROM inhoud WHERE sleutel NOT IN (${STANDAARD.map(() => '?').join(',')})`
).run(...STANDAARD.map(r => r[0]));

// -------------------------------------------------- foto's naar het volume
//
// De startfoto's zitten als JPEG in de repo onder ./uploads. Die staan niet op
// het volume. server.js zet ze bij het opstarten om naar WebP en schrijft ze
// naar UPLOADS_DIR — dat scheelt ruim 70% aan bestandsgrootte.

const BRON_UPLOADS = path.join(__dirname, '..', 'uploads');

// ------------------------------------------------------- startportfolio
//
// Alleen bij een lege database. Zodra Piet foto's beheert blijven die staan.

const STANDAARD_PROJECTEN = [
  ['Badkamerrenovatie', '/uploads/foto1.webp', 'Badkamerrenovatie door De Klusspecialist van Duijn in Noordwijk'],
  ['Tegelwerk', '/uploads/foto3.webp', 'Tegelwerk in een badkamer, uitgevoerd door klusbedrijf van Duijn'],
  ['Afwerking', '/uploads/foto4.webp', 'Strakke afwerking na een verbouwing'],
  ['Sanitair', '/uploads/foto5.webp', 'Geplaatst sanitair in een gerenoveerde badkamer'],
  ['Renovatie', '/uploads/foto6.webp', 'Renovatieproject in de Bollenstreek'],
  ['Interieur', '/uploads/foto7.webp', 'Afgewerkt interieur na een klus van Piet van Duijn'],
  ['Tegelwerk', '/uploads/foto8.webp', 'Wandtegels vakkundig gelegd'],
  ['Afwerking', '/uploads/foto9.webp', 'Detail van de afwerking van een badkamer'],
  ['Renovatie', '/uploads/foto11.webp', 'Complete renovatie van een woning in Noordwijk'],
];

if (db.prepare('SELECT COUNT(*) AS n FROM projecten').get().n === 0) {
  const p = db.prepare('INSERT INTO projecten (titel, bestand, alt, volgorde) VALUES (?, ?, ?, ?)');
  db.transaction(() => STANDAARD_PROJECTEN.forEach((r, i) => p.run(r[0], r[1], r[2], i * 10)))();
}

// ------------------------------------------------------------- hulpfuncties

const q = {
  alleInhoud: db.prepare('SELECT * FROM inhoud ORDER BY groep, volgorde'),
  zetInhoud: db.prepare('UPDATE inhoud SET waarde = ? WHERE sleutel = ?'),

  projecten: db.prepare('SELECT * FROM projecten ORDER BY volgorde, id'),
  project: db.prepare('SELECT * FROM projecten WHERE id = ?'),
  projectToevoegen: db.prepare('INSERT INTO projecten (titel, bestand, alt, volgorde) VALUES (?, ?, ?, ?)'),
  projectBijwerken: db.prepare('UPDATE projecten SET titel = ?, alt = ? WHERE id = ?'),
  projectVerwijderen: db.prepare('DELETE FROM projecten WHERE id = ?'),
  projectVolgorde: db.prepare('UPDATE projecten SET volgorde = ? WHERE id = ?'),
  maxVolgorde: db.prepare('SELECT COALESCE(MAX(volgorde), 0) AS n FROM projecten'),

  berichten: db.prepare('SELECT * FROM berichten ORDER BY aangemaakt DESC'),
  berichtToevoegen: db.prepare('INSERT INTO berichten (naam, email, bericht) VALUES (?, ?, ?)'),
  berichtGelezen: db.prepare('UPDATE berichten SET gelezen = 1 WHERE id = ?'),
  berichtVerwijderen: db.prepare('DELETE FROM berichten WHERE id = ?'),
  ongelezen: db.prepare('SELECT COUNT(*) AS n FROM berichten WHERE gelezen = 0'),

  beheerder: db.prepare('SELECT * FROM beheerders WHERE gebruikersnaam = ?'),
  beheerderToevoegen: db.prepare('INSERT INTO beheerders (gebruikersnaam, wachtwoord) VALUES (?, ?)'),
  wachtwoordWijzigen: db.prepare('UPDATE beheerders SET wachtwoord = ? WHERE id = ?'),
  aantalBeheerders: db.prepare('SELECT COUNT(*) AS n FROM beheerders'),
};

/** Alle teksten als een plat object: inhoud.hero_titel, inhoud.telefoon, enz. */
function inhoud() {
  const o = {};
  for (const r of q.alleInhoud.all()) o[r.sleutel] = r.waarde;
  return o;
}

/** Teksten gegroepeerd, voor het bewerkscherm. */
function inhoudPerGroep() {
  const groepen = new Map();
  for (const r of q.alleInhoud.all()) {
    if (!groepen.has(r.groep)) groepen.set(r.groep, []);
    groepen.get(r.groep).push(r);
  }
  return groepen;
}

module.exports = { db, q, inhoud, inhoudPerGroep, DATA_DIR, UPLOADS_DIR, DB_PATH, BRON_UPLOADS };
