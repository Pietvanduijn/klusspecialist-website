require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const cookieSession = require('cookie-session');

const { q, inhoud, inhoudPerGroep, UPLOADS_DIR, DATA_DIR, BRON_UPLOADS } = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 8080;
const PRODUCTIE = process.env.NODE_ENV === 'production';
const SITE_URL = process.env.SITE_URL || 'https://www.klusspecialistvanduijn.nl';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Railway zit ervoor, anders klopt req.protocol niet

// --------------------------------------------------------------- middleware

// Redirect kaal domein naar www — moet vóór alles wat bestanden serveert
app.use((req, res, next) => {
  if (req.hostname === 'klusspecialistvanduijn.nl') {
    return res.redirect(301, 'https://www.klusspecialistvanduijn.nl' + req.url);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// index: false — anders zou een achtergebleven public/index.html de startpagina
// kapen voordat onze route aan de beurt is
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

app.use(cookieSession({
  name: 'kvd',
  keys: [process.env.SESSION_SECRET || 'onveilig-alleen-voor-lokaal-gebruik'],
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dagen ingelogd blijven
  httpOnly: true,
  sameSite: 'lax',
  secure: PRODUCTIE,
}));

// ------------------------------------------------------------ beheerder

// Bij de allereerste start een beheerder aanmaken.
if (q.aantalBeheerders.get().n === 0) {
  const start = process.env.ADMIN_WACHTWOORD;
  if (start) {
    q.beheerderToevoegen.run('piet', bcrypt.hashSync(start, 10));
    console.log('✅ Beheerder "piet" aangemaakt met het wachtwoord uit ADMIN_WACHTWOORD');
  } else {
    console.warn('⚠️  Geen beheerder en geen ADMIN_WACHTWOORD ingesteld — /admin is nog niet bruikbaar.');
  }
}

function ingelogd(req, res, next) {
  if (req.session && req.session.beheerder) return next();
  return res.redirect('/admin/inloggen');
}

// Simpele rem op wachtwoord-raden: vijf pogingen per kwartier per IP.
const pogingen = new Map();
function magProberen(ip) {
  const nu = Date.now();
  const p = (pogingen.get(ip) || []).filter(t => nu - t < 15 * 60 * 1000);
  pogingen.set(ip, p);
  return p.length < 5;
}
function noteerPoging(ip) {
  const p = pogingen.get(ip) || [];
  p.push(Date.now());
  pogingen.set(ip, p);
}

// -------------------------------------------------------- foto's uploaden

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Alleen afbeeldingen (jpg, png, webp) kunnen worden geüpload.'));
  },
});

/**
 * Verkleint en comprimeert de foto en slaat hem op. Telefoonfoto's zijn zo 5 MB;
 * ongewijzigd doorzetten maakt de site traag en kost Piet bezoekers.
 */
async function bewaarFoto(buffer) {
  const naam = `foto-${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
  await sharp(buffer)
    .rotate()                                   // respecteert de stand van de telefoon
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })                      // ruim 70% kleiner dan JPEG
    .toFile(path.join(UPLOADS_DIR, naam));
  return '/uploads/' + naam;
}

/**
 * Zet de JPEG-startfoto's uit de repo eenmalig om naar WebP op het volume.
 * Draait bij elke start, maar slaat over wat er al staat — dus alleen de eerste
 * keer kost het tijd. Zo hoeven er geen afbeeldingen in GitHub bijgehouden te
 * worden en is de site toch 70% lichter.
 */
async function startfotosKlaarzetten() {
  if (!fs.existsSync(BRON_UPLOADS)) return;
  let gemaakt = 0;
  for (const naam of fs.readdirSync(BRON_UPLOADS)) {
    if (!/\.jpe?g$/i.test(naam)) continue;
    const doel = path.join(UPLOADS_DIR, naam.replace(/\.jpe?g$/i, '.webp'));
    if (fs.existsSync(doel)) continue;
    try {
      await sharp(path.join(BRON_UPLOADS, naam))
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(doel);
      gemaakt++;
    } catch (err) {
      console.error('Omzetten mislukt voor', naam, err.message);
    }
  }
  if (gemaakt) console.log(`🖼️  ${gemaakt} startfoto's omgezet naar WebP`);
}

/** Verwijdert een bestand, maar alleen binnen de uploadmap. */
function verwijderBestand(webpad) {
  if (!webpad || !webpad.startsWith('/uploads/')) return;
  const bestand = path.join(UPLOADS_DIR, path.basename(webpad));
  if (path.dirname(bestand) !== path.resolve(UPLOADS_DIR)) return;
  fs.promises.unlink(bestand).catch(() => {});
}

// ------------------------------------------------------------- de website

app.get('/', (req, res) => {
  const i = inhoud();
  const adres = `${i.adres_straat}, ${i.adres_postcode} ${i.adres_plaats}`;
  const telLink = (i.telefoon || '').replace(/\D/g, '');

  const gegevens = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: i.bedrijfsnaam,
    description: i.meta_omschrijving,
    url: SITE_URL + '/',
    image: SITE_URL + i.hero_foto,
    telephone: '+31' + telLink.replace(/^0/, ''),
    email: i.email,
    founder: { '@type': 'Person', name: i.over_titel },
    address: {
      '@type': 'PostalAddress',
      streetAddress: i.adres_straat,
      postalCode: i.adres_postcode,
      addressLocality: i.adres_plaats,
      addressRegion: 'Zuid-Holland',
      addressCountry: 'NL',
    },
    areaServed: (i.werkgebied || '').split(',').map(s => s.trim()).filter(Boolean)
      .map(naam => ({ '@type': 'City', name: naam })),
    knowsAbout: [1, 2, 3, 4].map(n => i[`dienst${n}_titel`]).filter(Boolean),
  };

  // Koppelt de profielen elders aan dit bedrijf, zodat Google begrijpt dat het
  // om dezelfde onderneming gaat. Alleen meesturen als ze ingevuld zijn.
  const sameAs = [i.facebook_url, i.werkspot_url, i.instagram_url]
    .map(s => (s || '').trim()).filter(Boolean);
  if (sameAs.length) gegevens.sameAs = sameAs;

  res.render('index', {
    i,
    projecten: q.projecten.all(),
    siteUrl: SITE_URL,
    adres,
    telLink,
    // Losse < afvangen zodat een tekst nooit het script kan afbreken
    jsonld: JSON.stringify(gegevens, null, 2).replace(/</g, '\\u003c'),
  });
});

// Wegwijzers voor zoekmachines. Het beheerscherm blijft er bewust buiten.
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nDisallow: /admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const gewijzigd = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${gewijzigd}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`);
});

// Contactformulier
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Alle velden zijn verplicht' });
  }

  try {
    q.berichtToevoegen.run(String(name).slice(0, 200), String(email).slice(0, 200), String(message).slice(0, 5000));
  } catch (err) {
    console.error('Opslaan bericht mislukt:', err);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const veilig = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'website@klusspecialistvanduijn.nl',
          to: inhoud().email,
          reply_to: String(email),
          subject: `Nieuw bericht van ${veilig(name)} via de website`,
          html: `<h2>Nieuw contactbericht</h2>
            <p><strong>Naam:</strong> ${veilig(name)}</p>
            <p><strong>E-mail:</strong> ${veilig(email)}</p>
            <p><strong>Bericht:</strong></p>
            <p>${veilig(message).replace(/\n/g, '<br>')}</p>`,
        }),
      });
      if (!response.ok) console.error('Resend fout:', await response.text());
    } catch (err) {
      console.error('E-mail fout:', err);
    }
  }

  res.json({ success: true, message: 'Bericht ontvangen' });
});

// ------------------------------------------------------------ inloggen

app.get('/admin/inloggen', (req, res) => {
  if (req.session && req.session.beheerder) return res.redirect('/admin');
  res.render('admin/inloggen', { fout: null });
});

app.post('/admin/inloggen', (req, res) => {
  const ip = req.ip || 'onbekend';
  if (!magProberen(ip)) {
    return res.status(429).render('admin/inloggen', {
      fout: 'Te vaak geprobeerd. Wacht een kwartier en probeer het opnieuw.',
    });
  }

  const beheerder = q.beheerder.get('piet');
  const ok = beheerder && bcrypt.compareSync(String(req.body.wachtwoord || ''), beheerder.wachtwoord);

  if (!ok) {
    noteerPoging(ip);
    return res.status(401).render('admin/inloggen', { fout: 'Wachtwoord klopt niet.' });
  }

  pogingen.delete(ip);
  req.session.beheerder = beheerder.id;
  res.redirect('/admin');
});

app.post('/admin/uitloggen', (req, res) => {
  req.session = null;
  res.redirect('/admin/inloggen');
});

// --------------------------------------------------------------- foto's

app.get('/admin', ingelogd, (req, res) => {
  res.render('admin/fotos', {
    pagina: 'fotos',
    projecten: q.projecten.all(),
    ongelezen: q.ongelezen.get().n,
    melding: req.query.ok || null,
  });
});

app.post('/admin/fotos', ingelogd, upload.array('fotos', 20), async (req, res, next) => {
  try {
    let volgorde = q.maxVolgorde.get().n;
    for (const bestand of req.files || []) {
      volgorde += 10;
      const pad = await bewaarFoto(bestand.buffer);
      q.projectToevoegen.run('Nieuwe foto', pad, '', volgorde);
    }
    res.redirect('/admin?ok=' + encodeURIComponent(`${(req.files || []).length} foto('s) toegevoegd`));
  } catch (err) { next(err); }
});

app.post('/admin/fotos/:id', ingelogd, (req, res) => {
  q.projectBijwerken.run(
    String(req.body.titel || '').slice(0, 100),
    String(req.body.alt || '').slice(0, 300),
    req.params.id
  );
  res.redirect('/admin?ok=' + encodeURIComponent('Bijschrift opgeslagen'));
});

app.post('/admin/fotos/:id/verwijderen', ingelogd, (req, res) => {
  const project = q.project.get(req.params.id);
  if (project) {
    q.projectVerwijderen.run(project.id);
    verwijderBestand(project.bestand);
  }
  res.redirect('/admin?ok=' + encodeURIComponent('Foto verwijderd'));
});

app.post('/admin/fotos/:id/verplaats', ingelogd, (req, res) => {
  const alle = q.projecten.all();
  const van = alle.findIndex(p => String(p.id) === String(req.params.id));
  const naar = req.body.richting === 'omhoog' ? van - 1 : van + 1;
  if (van !== -1 && naar >= 0 && naar < alle.length) {
    [alle[van], alle[naar]] = [alle[naar], alle[van]];
    alle.forEach((p, n) => q.projectVolgorde.run(n * 10, p.id));
  }
  res.redirect('/admin');
});

// --------------------------------------------------------------- teksten

app.get('/admin/teksten', ingelogd, (req, res) => {
  res.render('admin/teksten', {
    pagina: 'teksten',
    groepen: inhoudPerGroep(),
    ongelezen: q.ongelezen.get().n,
    melding: req.query.ok || null,
  });
});

app.post('/admin/teksten', ingelogd, upload.any(), async (req, res, next) => {
  try {
    // Tekstvelden
    for (const [sleutel, waarde] of Object.entries(req.body)) {
      q.zetInhoud.run(String(waarde).slice(0, 5000), sleutel);
    }
    // Vervangen afbeeldingen
    for (const bestand of req.files || []) {
      const oud = inhoud()[bestand.fieldname];
      const pad = await bewaarFoto(bestand.buffer);
      q.zetInhoud.run(pad, bestand.fieldname);
      // Startfoto's uit de repo laten staan, die kunnen elders nog gebruikt worden
      if (oud && /^\/uploads\/foto-\d/.test(oud)) verwijderBestand(oud);
    }
    res.redirect('/admin/teksten?ok=' + encodeURIComponent('Wijzigingen opgeslagen'));
  } catch (err) { next(err); }
});

// -------------------------------------------------------------- berichten

app.get('/admin/berichten', ingelogd, (req, res) => {
  res.render('admin/berichten', {
    pagina: 'berichten',
    berichten: q.berichten.all(),
    ongelezen: q.ongelezen.get().n,
    melding: req.query.ok || null,
  });
});

app.post('/admin/berichten/:id/gelezen', ingelogd, (req, res) => {
  q.berichtGelezen.run(req.params.id);
  res.redirect('/admin/berichten');
});

app.post('/admin/berichten/:id/verwijderen', ingelogd, (req, res) => {
  q.berichtVerwijderen.run(req.params.id);
  res.redirect('/admin/berichten?ok=' + encodeURIComponent('Bericht verwijderd'));
});

// ------------------------------------------------------------ wachtwoord

app.get('/admin/wachtwoord', ingelogd, (req, res) => {
  res.render('admin/wachtwoord', {
    pagina: 'wachtwoord',
    ongelezen: q.ongelezen.get().n,
    fout: null,
    melding: req.query.ok || null,
  });
});

app.post('/admin/wachtwoord', ingelogd, (req, res) => {
  const { huidig, nieuw, herhaal } = req.body;
  const beheerder = q.beheerder.get('piet');
  const toon = fout => res.render('admin/wachtwoord', {
    pagina: 'wachtwoord', ongelezen: q.ongelezen.get().n, fout, melding: null,
  });

  if (!bcrypt.compareSync(String(huidig || ''), beheerder.wachtwoord)) return toon('Het huidige wachtwoord klopt niet.');
  if (String(nieuw || '').length < 8) return toon('Kies een nieuw wachtwoord van minstens 8 tekens.');
  if (nieuw !== herhaal) return toon('De twee nieuwe wachtwoorden zijn niet gelijk.');

  q.wachtwoordWijzigen.run(bcrypt.hashSync(nieuw, 10), beheerder.id);
  res.redirect('/admin/wachtwoord?ok=' + encodeURIComponent('Wachtwoord gewijzigd'));
});

// ------------------------------------------------------------ afhandeling

app.use((req, res) => res.status(404).redirect('/'));

app.use((err, req, res, next) => {
  console.error('Fout:', err);
  const bericht = err.code === 'LIMIT_FILE_SIZE'
    ? 'Die foto is te groot (maximaal 15 MB).'
    : err.message || 'Er ging iets mis.';
  if (req.path.startsWith('/admin')) {
    return res.redirect('/admin?ok=' + encodeURIComponent(bericht));
  }
  res.status(err.status || err.statusCode || 500).json({ error: bericht });
});

// Eerst de startfoto's omzetten, dan pas bezoekers toelaten — anders zou de
// eerste bezoeker naar ontbrekende afbeeldingen kijken.
startfotosKlaarzetten()
  .catch(err => console.error('Startfoto\'s omzetten mislukt:', err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server draait op http://localhost:${PORT}`);
      console.log(`📁 Gegevens en foto's: ${DATA_DIR}`);
      console.log(`🔐 Beheer: http://localhost:${PORT}/admin`);
    });
  });
