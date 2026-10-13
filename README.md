![GitHub release (latest by date)](https://img.shields.io/github/v/release/jahili/helsestatistikk?style=for-the-badge&color=007db9)
![License](https://img.shields.io/github/license/jahili/helsestatistikk?style=for-the-badge&color=007db9)


# Helsestatistikk

En interaktiv web-applikasjon som viser statistikk fra FHIs åpne statistikk-API som figur og tabell, og lager spørringer du kan bruke videre i API-kall og Power BI.

[Publisert versjon](https://jahili.github.io/helsestatistikk/)

## Hva er det?

Helsestatistikk er et visuelt verktøy som lar deg utforske og hente data fra [Folkehelseinstituttets statistikk-API](https://www.fhi.no/ta/statistikkalender_og_statistikk/apen-api-og-statistikk/) uten å måtte skrive API-kall manuelt. Du velger tabell og utvalg, og ser dataene som figur eller tabell. Du kan endre utvalget, bytte mellom figur og tabell, laste ned, dele en lenke til visningen, og hente JSON-spørringen eller Power Query-koden for å bruke dataene i egne applikasjoner.

## Brukstilfeller

- **Dataanalytikere og forskere** som ønsker å hente norsk folkehelsedata for analyser
- **Utviklere** som skal integrere FHI-data i sine applikasjoner
- **Organisasjoner** som skal lage egne dashboards og rapporter basert på folkehelsesdata
- **Lærere og studenter** som skal lære om norsk folkehelsestatistikk

## Hvordan bruker jeg den?

### Trinn-for-trinn guide

1. **Åpne applikasjonen** i en moderne nettleser

2. **Velg datakilde** - I første skjerm velger du hvilken statistikkkilde du ønsker data fra
   - Se kort beskrivelse av hver kilde
   - Kildene inneholder ulike typer folkehelseinformasjon

3. **Velg tabell** - Når du har valgt en kilde, velger du hvilken tabell du ønsker
   - Du kan søke i tabellene for å finne det du trenger
   - Listen viser hvilke geografiske nivåer tabellen har: N (hele landet), F (fylker), K (kommuner), B (bydeler), LKS (levekårssoner) og R (helseregioner)
   - Når du velger tabellen, kommer du til utvalget med et standardutvalg: de siste ti årene, hele landet og fylkene, og totalverdier for store dimensjoner. Dataene hentes i bakgrunnen, så «Vis data» går raskt

4. **Se dataene** - I steg 4 velger du visning:
   - **Figur**: linjediagram når tiden varierer, ellers liggende søyler. Dimensjoner som ikke får plass, låses til én verdi i nedtrekksmenyer, eller deles opp i små separate diagrammer med felles akse. Søylediagram langs geografi kan vise fylker, kommuner, bydeler eller levekårssoner. Figuren lastes ned som PNG eller SVG
   - **Tabell**: pivottabell med valgfri dimensjon i kolonnene (lastes ned som CSV), eller liste med de første radene
   - **API og Power BI**: JSON-spørringen, Power Query (M) og cURL, svarformat og endepunkter
   - «Last ned som CSV» gir alle dataene i utvalget, og «Kopier lenke til visningen» gir en lenke som åpner samme tabell, utvalg og visning

5. **Endre utvalg** - I steg 3 velger du hvilke verdier dataene skal vise, og trykker «Vis data»
   - **Filtertype**: Velg spesifikke verdier, alle verdier, mønster (wildcard), eller for tidsvariabler et antall år
   - **Geografi**: Velg fylker, kommuner, bydeler eller levekårssoner i et tre med søk
   - Klikk på «Om tabellen» for detaljer om hva tabellen inneholder

### Lenker

Valgene lagres i adressen, f.eks. `#kilde=nokkel&tabell=366&v.GEO=0,03,32&vis=tabell`. Lenken kan deles og bokmerkes. Hvis FHI har gitt tabellen ny id, eller noen av verdiene ikke finnes lenger, sier appen fra og viser det som fortsatt finnes.

### Eksempel

Hvis du vil hente dødsfall av demens (inkl. Alzheimers sykdom) fordelt på alder:

1. Velg "Dødsårsaksregisteret (DÅR)" som kilde
2. Velg tabellen "Dødsfall av demens (inkl. Alzheimers sykdom) etter alder" under kategorien "Demens"
3. Se figuren over de siste årene fordelt på alder, eller bytt til tabell
4. Trykk «Endre utvalg» for å ta med flere år, og last ned som CSV eller hent spørringen i fanen «API og Power BI»

## Om FHI Statistikk API

Denne appen bygger på [FHI Statistikk sin åpne API](https://statistikk-data.fhi.no) ([om API-et](https://www.fhi.no/ta/statistikkalender_og_statistikk/apen-api-og-statistikk/)), som tilbyr fritt tilgjengelig norsk folkehelsestatistikk.

### Ressurser

- **API-dokumentasjon**: [https://github.com/folkehelseinstituttet/Fhi.Statistikk.OpenAPI](https://github.com/folkehelseinstituttet/Fhi.Statistikk.OpenAPI)
- **Datatyper**: Statistikken inneholder data om blant annet nasjonale prøver, helsedata, skoledata og mer
- **Oppdateringsfrekvens**: Varierer etter datakilde, typisk årlig eller oftere
- **Dekningsområde**: Hele Norge, med detaljer på fylke-, kommune-, bydel- og levekårssonenivå

### API-endepunkter som brukes

Appen bruker disse FHI API-endepunktene:

- `/Common/source` - Henter liste over tilgjengelige kilder
- `/{sourceId}/Table` - Henter tabeller for en gitt kilde
- `/{sourceId}/Table/{tableId}/dimension` - Henter dimensjoner (variabler) for en tabell
- `/{sourceId}/Table/{tableId}/metadata` - Henter detaljert informasjon om en tabell
- `/{sourceId}/Table/{tableId}/data` - Henter faktiske data basert på spørring

**Merk:** Tabell-labels og geo-mapping-data hentes og lenkes same-origin fra repoet i stedet for via GitHub API, noe som gir bedre pålitelighet og ytelse.

## Teknisk informasjon

### Arkitektur

Appen er en single-page application (SPA) bygget med:

- **React** - For UI-komponentene
- **Vanilla JavaScript** - For logikk
- **HTML/CSS** - For grunnleggende struktur og styling

Alt kjører i nettleseren din - ingen backend-server er nødvendig.

### Filstruktur

- `index.html` — HTML-skall, laster `js/app.js` som ES-modul
- `js/app.js` — hovedkomponent: state, effekter og sammensetning av skjermbildene
- `js/lib/` — ren logikk (CSV-parsing, tabell-label-oppslag, geografi-gruppering, spørringsbygging, Power Query- og cURL-generering, forhåndsvisning/CSV-eksport, JSON-stat til lang tabell og figurvalg, standardutvalg, valg i URL-en, pivottabell, radtelling, formatering, sikker HTML-rendering, syntax-highlighting) — hver fil har en tilhørende `*.test.mjs`
- `js/components/` — `ui.mjs` (basiskomponenter: Button, Segment, Chip, Badge, Card m.fl.), `StepList.mjs`, `Layout.mjs` (header og sidekolonne) ett skjermbilde per steg (`DataStep.mjs` er steg 4 med fanene), `Chart.mjs` (figur), `TableView.mjs` (pivot og liste) `QueryResult.mjs` (fanen «API og Power BI») og `AboutPage.mjs` (siden «Om verktøyet», `#om`, med teksten i `om.html`)
- `styles/app.css` — tokens, komponenter, layout, responsivt og mørkt tema (designspråk A, se `design/fhi-redesign.md`)

### Kjøre lokalt

Appen bruker native ES-moduler og må serveres over http(s), ikke åpnes direkte som `file://`:

```bash
python -m http.server 8000
# eller: npx serve
```

Åpne deretter `http://localhost:8000`.

`python -m http.server` sier ikke noe om hurtigbuffer, så nettleseren kan blande gamle og nye moduler etter en endring. Får du «Appen kunne ikke starte», tøm hurtigbufferen eller slå den av i utviklerverktøyene.

### Publisering

Push til `main` publiserer på GitHub Pages. Før opplasting kjører workflowen `node scripts/version-assets.mjs`, som legger et import map i `index.html` der hver modul får et versjonsnummer ut fra innholdet (`selection.mjs?v=…`). Da henter nettleseren nye filer etter hver publisering i stedet for å blande dem med gamle. Resultatet skal ikke committes.

### Tabell-labels

`fhi_table_label_mapping.csv` gir tabellene lesbare navn og temaer. FHI gir ofte en tabell ny `tableId` når den får ny årgang, ny struktur eller nytt innhold, så filen må vedlikeholdes:

- Workflowen «Sjekk tabell-labels mot FHI-API-et» kjører hver mandag og oppretter en issue med tabeller som mangler i filen eller ikke finnes lenger. Issuen lukkes automatisk når filen er i synk.
- Sjekken kan også kjøres lokalt: `node scripts/check-labels.mjs`
- Tabeller som mangler i filen vises i appen under «Nye tabeller», med navn fra FHIs metadata-beskrivelse når API-tittelen bare er et internt navn.

`table_geo_levels.json` sier hvilke geografiske nivåer hver tabell har, så tabelloversikten kan vise dem uten å hente dimensjonene til alle tabellene. Kildene koder geografi ulikt (`GEO`, `FYLKE`, `BOSTED` m.fl.), og nivået tolkes fra kodeformat og navn (`geoLevelsOfDimensions` i `js/lib/geo.mjs`). Den ukentlige sjekken melder fra om tabeller som mangler i filen; oppdater den med `node scripts/update-geo-levels.mjs` (tar et par minutter fordi API-et begrenser antall kall). Detaljpanelet for valgt tabell regner nivåene ut fra tabellens egne dimensjoner.

### Kjøre tester

Ingen `npm install` nødvendig — testene bruker Node sin innebygde testrunner (krever Node 18+):

```bash
node --test js
```

### Hvilke formater støttes?

- **JSON-stat2** (anbefalt) - Strukturert JSON-format egnet for statistikk
- **CSV2** - CSV med labels (menneskelesbare navn)
- **CSV3** - CSV med koder (kort kodeversjoner)

### Data-struktur

Spørringer følger FHI APIets struktur:

```json
{
  "dimensions": [
    { "code": "AAR", "filter": "item", "values": ["2024"] },
    { "code": "GEO", "filter": "item", "values": ["03", "0301"] },
    { "code": "MEASURE_TYPE", "filter": "all", "values": ["*"] }
  ],
  "response": {
    "format": "json-stat2"
  }
}
```

### Geo-gruppering

For geografiske data (GEO-dimensjon) håndteres følgende nivåer:

- **2 sifre** - Fylker
- **4 sifre** - Kommuner
- **6 sifre** - Bydeler (Oslo, Bergen, Stavanger, Trondheim)
- **10 sifre** - Levekårssoner (LKS): SSBs inndeling av kommuner i soner av hele grunnkretser
  ([klassifikasjon 745](https://www.ssb.no/klass/klassifikasjoner/745)), f.eks. `3101000001` «Halden LKS 01».
  SSB deler inn kommunene puljevis, så foreløpig har 66 kommuner levekårssoner, og bare noen
  FHI-tabeller har dem. Sonene vises under kommunen sin, også i Bergen der FHI legger dem under bydelen

Appen lar deg enkelt velge "alle kommuner i fylke X", "alle bydeler i Oslo" eller "alle levekårssoner i Halden".
`geo_mapping.csv` har koder og navn for alle nivåene, også levekårssonene.

Kartgrenser for alle nivåene, også levekårssoner, finnes i
[norge-administrative-grenser](https://github.com/jahili/norge-administrative-grenser) med de samme kodene.

### Tidsserier

For år-dimensjonen (AAR) kan du velge:

- `filter: "item"` - Spesifikke år
- `filter: "all"` - Alle år (wildcard)
- `filter: "bottom"` - Siste X år (API-et sorterer årene stigende, så `"top"` gir de første årene)

### Maksimale antall rader

Du kan sette `maxRowCount` for å begrense antall rader i responsen. La feltet stå tomt for ubegrenset.

### Feilhåndtering

Hvis noe går galt:

- Sjekk at du har valgt alle påkrevde dimensjoner
- Noen kombinasjoner av data kan være skjult av personvernhensyn (færre enn 10 enheter)
- Se konsollen (F12) for detaljer

## Kompatibilitet

- Chrome/Edge (versjon 90+)
- Firefox (versjon 88+)
- Safari (versjon 14+)
- Fungerer på mobiltelefoner og nettbrett


## Lisens
Verktøyet ble opprinnelig utviklet i Akershus analyse, Akershus fylkeskommune, og er videreført som privat prosjekt.
Det deles som åpen kildekode
under [MIT-lisensen](./LICENSE). Dette innebærer at alle står fritt til å bruke, kopiere, endre og
distribuere programvaren, så lenge opphavsretten og lisensvilkårene beholdes.

Dataene fra FHI er tilgjengelig under [Norsk lisensfor offentlige data](https://data.norge.no/nlod/no/1.0).

## Versjon

Gjeldende versjon vises i badgen øverst i denne filen og på [GitHub Releases](https://github.com/jahili/helsestatistikk/releases). Appen er under aktiv utvikling - tilbakemeldinger og forbedringer er velkommen!
