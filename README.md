# Progressie — Kracht & Voeding

Webapp (PWA) om pure strength-progressie en voeding bij te houden, met een stijgende of dalende trendlijn per metriek.

## Functies
- **Kracht**: sets loggen (oefening, gewicht, reps, datum) met automatische geschatte 1RM (Epley), grafiek met trendlijn per oefening, overzichtskaarten, geschiedenis met bewerken/verwijderen, en een paneel om eigen oefeningen toe te voegen, te hernoemen of te verwijderen.
- **Voeding**: daglog met kcal, eiwitten, koolhydraten, vetten en optioneel lichaamsgewicht; grafiek met trendlijn per metriek.
- **Doel** (snijden / onderhouden / bulken): de trendbadge beoordeelt of je lijn "op koers" is of afwijkt van je doel.
- Data staat in `localStorage`, met JSON export/import en "wis alles".
- Werkt offline als geïnstalleerde webapp (manifest + service worker).

## Lokaal draaien
Open `index.html` in een browser, of serveer de map: `python3 -m http.server 8000` → http://localhost:8000

## Online zetten met GitHub Pages
1. Ga in deze repo naar **Settings → Pages**.
2. Kies bij Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. De app is daarna bereikbaar op: https://mortuslordus.github.io/mortcoaching/

## Op iPhone 16 als webapp op het beginscherm
1. Open de Pages-URL in **Safari**.
2. Tik op de **deelknop** (vierkant met pijl omhoog).
3. Scroll omlaag en tik **"Zet op beginscherm"** → kies een naam → **"Voeg toe"**.
4. De app verschijnt als eigen icoon en opent fullscreen (ook offline).

## Bestanden
- `index.html` — pagina (tabbladen Kracht / Voeding)
- `styles.css` — styling
- `app.js` — logica (opslag, e1RM, trend/regressie, grafieken, doel, bewerken)
- `manifest.webmanifest`, `sw.js`, `icon.svg` — PWA (icoon + offline)
