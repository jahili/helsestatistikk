# Helsestatistikk

Statisk webapp som viser statistikk fra FHIs åpne statistikk-API (`https://statistikk-data.fhi.no/api/open/v1`) som figur og tabell, og lager spørringer til API-et og Power BI. Privat prosjekt, publisert på GitHub Pages. README.md beskriver funksjoner og filstruktur; her står det som ikke er åpenbart.

## Kjøre og teste

- Ingen byggesteg og ingen `npm install`. React 18 lastes som UMD fra unpkg, Observable Plot 0.6.17 fra jsDelivr (først når figuren vises). Kode skrives med `React.createElement` (`h`), ikke JSX.
- Tester: `node --test js`. Ny logikk skal ligge i `js/lib/` med en `*.test.mjs` ved siden av.
- Lokal server må serveres over http. `python -m http.server` sender ingen cache-instruks, og nettleseren (særlig Firefox) blander da gamle og nye moduler etter endringer → «Appen kunne ikke starte» med «does not provide an export named …». Bruk en server som sender `Cache-Control: no-store`, eller slå av hurtigbufferen i utviklerverktøyene.
- Sjekk endringer i en ekte nettleser (headless Edge via CDP fungerer på denne maskinen; headless Firefox klarer ikke skjermbilder).

## Arkitektur

- `js/app.js` eier all state og alle API-kall, og gir stegkomponentene et `ctx`-objekt. Stegene eksporterer `render*Step(ctx)` og `render*Actions(ctx)` (sidekolonnens knapper). Render-funksjoner kan ikke bruke hooks; det som trenger hooks er egne komponenter (`ChartView`, `TableView`, `AboutPage`).
- Flyt: 1 Kilde → 2 Tabell → 3 Utvalg (`defaults.mjs` gir standardutvalget; dataene hentes i bakgrunnen) → 4 Data (fanene Figur, Tabell, API og Power BI). Dataene hentes alltid som JSON-stat2 uansett valgt svarformat.
- Valgene ligger i URL-fragmentet (`urlState.mjs`, prefiks `v.` for dimensjoner og `f.` for figurvalg); `#om` er siden «Om verktøyet». Steg 4 skriver utvalget som ga dataene (`appliedSelection`), steg 3 utvalget under arbeid.
- Utseende: tokens øverst i `styles/app.css`. Mørkt tema må oppdateres to steder (`prefers-color-scheme` og `[data-theme="dark"]`). Eksterne lenker har pil og «(åpnes i ny fane)».

## FHI-API-et: fallgruver

- Filteret `top` gir de N *første* kategoriene (årene står eldst først). «Siste X år» sender derfor `bottom`.
- API-et svarer 429 ved mange kall på kort tid. Ikke hent dimensjoner/metadata for alle tabeller fra appen; bruk forhåndsgenererte filer (se under) og prøv igjen med pause i skript.
- Prikkede verdier kommer som tekst (`":"`, `".."`) i `value`, med forklaring i `extension.flags`. De skal vises som manglende med symbol, aldri som 0.
- Geografi kodes ulikt: `GEO` (0, 2/4/6/10 sifre), men også `FYLKE`, `BOSTED`, `Sted` (KPR: `0101 Halden (2008-2019)`), hele landet som `ZZ`, `Total`, `Landet` eller `9000`, og koder uten ledende null (`301`). Bruk hjelperne i `js/lib/geo.mjs` (`isGeographyDimension`, `geoKey`, `levelOfCategory`, `isExpiredGeoLabel`), ikke `code === 'GEO'`.
- FHI gir tabeller ny `tableId` ved ny årgang eller struktur. Lenker og label-filen må tåle at id-er forsvinner.

## Datafiler

- `fhi_table_label_mapping.csv`: navn og tema per tabell. CRLF, kolonner i anførselstegn, nøkkel er `tableId` (ikke kilde + id). En kilde kan ligge i flere blokker; `tableId` 393 er kjent duplikat.
- `table_geo_levels.json`: geografiske nivåer per tabell (N F K B LKS R). Lages av `node scripts/update-geo-levels.mjs` (1–2 min). Ukessjekken (`scripts/check-labels.mjs`, workflow hver mandag) melder fra om manglende tabeller i begge filene via en issue.
- `om.html`: teksten på «Om verktøyet», vanlig HTML med hviteliste. `geo_mapping.csv`: koder og navn for alle geonivåer.

## Publisering og git

- Push til `main` publiserer på Pages. Workflowen kjører `scripts/version-assets.mjs`, som legger et import map med `?v=<hash>` i `index.html`. Resultatet skal ikke committes.
- Endringer i `.github/workflows/` krever at `gh` har `workflow`-tilgang.
- Utvikling skjer på egen branch (f.eks. `datavisning`) som spoles inn i `main`. Push og flett bare når brukeren ber om det.
- Commit-identitet i dette repoet: `Jan Hiroshi Lintvedt <jhl@plotikon.com>` (lokal git-config). Commit-meldinger på norsk med konvensjonelle prefikser (`feat:`, `fix:`, `chore:` …).
- Grensesnitt, kommentarer og dokumentasjon skrives på norsk.

## Verktøyfallgruve

Ikke skriv JS med bakstreker gjennom shell (`node -e "…"`, usiterte heredocs, `sed`): `\d`, `\s`, `\n` forsvinner eller dobles, og testene fanger det ikke alltid. Bruk Edit/Write-verktøyet for kode med regulære uttrykk og escape-sekvenser. De fleste filene har CRLF-linjeskift.
