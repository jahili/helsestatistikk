# Redesign – FHI API Query Builder (designspråk A)

Referanser: `fhi-1-kilde.dc.html`, `fhi-2-tabell.dc.html`, `fhi-3-variabler.dc.html`, `fhi-4-sporring.dc.html` (statiske skisser, 1440×940). Bruk dem som visuell fasit, ikke som kode. Behold eksisterende React-logikk, API-kall og state, og bytt bare presentasjonslaget.

Samme designspråk som norge-administrative-grenser (redesign A). Del gjerne tokens og basiskomponenter mellom prosjektene.

## Layout (alle steg)
- Header 60 px, hvit, `border-bottom`: logo (krøllparenteser rundt søylediagram, strek `#0F6B63`), tittel «FHI API Query Builder», undertittel «Spørringer mot FHIs åpne statistikk-API · JSON, Power Query og CSV». Til høyre lenker (Om verktøyet, API-dokumentasjon, GitHub) og temaknapp 40×40.
- Under header: `display:flex; flex-wrap:wrap`, full høyde.
  - Sidekolonne: `flex: 1 1 340px; max-width: 360px`, hvit, `border-right`.
  - Innhold: `flex: 999 1 560px; min-width: 0; padding: 32px 40px 40px`.
- Fjern den sentrerte introteksten og steg-indikatoren øverst. Stegene flyttes til sidekolonnen.
- Footertekst («Data fra FHI Statistikk · Utarbeidet av Akershus analyse …») flyttes inn i sidekolonnens bunnfelt, eller under «Om verktøyet».

## Sidekolonne – «Din spørring»
- Overskrift i små versaler, 12 px 600, `#5B6764`, letter-spacing 0.04em.
- Ordnet liste (`<ol>`) med fire steg: Kilde, Tabell, Variabler, Spørring. Hvert steg er en rad med 12 px padding og radius 12:
  - **Aktivt:** bakgrunn `#E8F3F1`, nummer i fylt sirkel 26 px (`#0F6B63`, hvit mono-tekst `01`–`04`), tittel 15 px 600 og kort status under.
  - **Ferdig:** sirkel `#CFE7E2` med hake, tittel og valgt verdi under (f.eks. «Dødsårsaksregisteret `daar`», «Dødsfall totalt … `643`», «630 rader · JSON-stat2»), og lenken «Endre» til høyre som hopper tilbake til steget.
  - **Ikke nådd:** sirkel med 1 px kant `#CFD5CF`, tittel i `#5B6764`.
- Bunnfelt (`position: sticky; bottom: 0`, bg `#FAFBF9`, `border-top`) med stegets primærhandling, 48 px høy, radius 12:
  - Steg 1: deaktivert «Velg en kilde for å fortsette» (bg `#DDE2DD`, tekst `#5B6764`).
  - Steg 2: «Velg tabell {id} →».
  - Steg 3: svarformat, forventet antall rader og «Generer spørring →».
  - Steg 4: «Kopier JSON-spørring» (primær), «Last ned som CSV» (sekundær, hvit med kant) og lenken «Start ny spørring».

## Felles for innholdsflaten
- Steg-etikett i mono 12 px `#0F6B63` («01 · KILDE»), deretter H1 28 px 700, letter-spacing -0.02em, og eventuelt undertekst i `#5B6764`.
- Kort: hvit, 1 px `#E1E4DF`, radius 12, padding 16. Valgt kort får kant `#0F6B63` pluss `box-shadow: 0 0 0 3px #CFE7E2`.
- Koder og id-er (tableId, dimensjonskoder, kilde-id) vises alltid i JetBrains Mono, som «badge»: 11–12 px, bg `#EEF0EC`, radius 6, padding 2px 6px. Valgt versjon: bg `#0F6B63` med hvit tekst.

## Steg 1 – Kilde
- Søkefelt 52 px på tvers av alle kilder, med søkeikon og tastatursnarvei `/`. Søket skal gi treff på tabeller direkte, og et klikk på et treff hopper rett til steg 3.
- Filterchips for utgiver: «Alle kilder · {n}», «Folkehelseinstituttet», «Helsedirektoratet».
- Rutenett `repeat(3, minmax(0,1fr))`, gap 12. Kildekortene er `<a>` eller `<button>` med navn (15 px 600), kilde-id som badge til høyre, beskrivelse (13 px `#3D4845`) og utgiver nederst (12 px `#5B6764`). Hover/valgt: aksentkant og «Velg →».
- Bruk faktisk kilde-id fra API-et i badgen (f.eks. `daar`, `nokkel`), ikke en utledet forkortelse.
- Tipsboks i sidekolonnen under stegene: «Vet du hva tabellen heter? Søk på tvers av alle kilder og hopp rett til steg 03.»

## Steg 2 – Tabell
- Innholdet er delt i to: listen (`flex: 999 1 480px`) og detaljpanelet (`flex: 1 1 320px; max-width: 380px`).
- Verktøyrad: søk i tabeller/tableId (44 px) og segmentkontrollen «Etter tema» / «Sist oppdatert».
- Liste i ett hvitt kort: temaoverskrifter er sammenleggbare knapper (bg `#FAFBF9`, chevron, antall i mono til høyre). Tabellrader har innrykk 40 px, navn, dato i lesbar form («1. okt. 2026») og tableId-badge. Valgt rad: bg `#E8F3F1`, navn 600, fylt badge.
- Detaljpanel for valgt tabell: sti i mono (`daar / Table / 643`), tittel 18 px 700, sammendrag, «DIMENSJONER» med én rad per dimensjon (navn, kode i mono, antall kategorier høyrejustert), «Sist oppdatert» og lenke til FHI. Dimensjonene hentes fra `/dimension` når en rad velges, slik at brukeren ser strukturen før neste steg.

## Steg 3 – Variabler
- Toppen: H1 = tabellnavn, undertekst «Alt er valgt som standard. Snevre inn bare det du trenger.», og knappen «Nullstill alle» til høyre.
- Rutenett `repeat(2, minmax(0,1fr))`, `align-items: start`. Dimensjoner med mange verdier (> ~20) eller i «Velg verdier»-modus går over hele bredden (`grid-column: 1 / -1`).
- Dimensjonskort:
  - Tittel med kode i mono, og teller `valgt / totalt` til høyre (aksentfarge når filtrert).
  - Segmentkontroll for filtertype: Alle / Velg verdier / Siste X år (bare for tidsdimensjoner) / Wildcard (avansert).
  - **Alle:** viser verdiene som grå chips hvis de er få (≤ 5), ellers ingenting.
  - **Siste X år:** stepper − [10] + (40 px høy, input i mono).
  - **Velg verdier:** valgte verdier som fylte chips med ×-knapp, søk i verdiene og en avkrysningsliste i to kolonner med `max-height` og scroll.
  - **Wildcard:** tekstfelt med hjelpetekst («Bruk * for å matche alle, f.eks. 03*»).
  - Dimensjon med én verdi: ingen kontroller, bare «Bare én verdi, tas alltid med.»
- Sidekolonnens bunnfelt:
  - Svarformat som segmentkontroll med tre valg: JSON-stat2 / CSV · navn / CSV · koder.
  - Forventet antall rader: produktet av valgte verdier per dimensjon, stort tall i mono og regnestykket under (`10 × 3 × 7 × 3 × 1`). Vis advarsel hvis tallet overstiger maks rader.
  - «Max antall rader» kan ligge bak en «Avansert»-lenke.

## Steg 4 – Spørring
- Kodeblokk (`flex: 999 1 460px`): bg `#15201E`, radius 12. Faner (`role="tablist"`): JSON / Power Query (M) / cURL (ny), med kopiknapp til høyre. `<pre>` i JetBrains Mono 13 px / 1.6. Enkel syntaksfarging: nøkler `#8FD1C4`, strenger `#F2C98A`, øvrig tekst `#E7ECEA`.
- Panel ved siden av (`flex: 1 1 300px`):
  - «Endepunkter»: én rad per URL (data POST, dimension GET) med metode-badge, forkortet URL (`…/open/v1/daar/Table/643/data`, full URL i `title`) og kopiknapp 32×32. Geo-mapping CSV som lenke.
  - «I Power BI»: kort instruksjon om hvor M-koden limes inn.
- Under: forhåndsvisning som stiplet kort med «Hent forhåndsvisning». Når data er hentet, erstattes kortet av en tabell med de første radene (horisontal scroll, mono på tall).
- Kopiering gir en kort bekreftelse (toast eller knappetekst «Kopiert ✓» i ~2 s).

## Tokens
| Token | Verdi |
|---|---|
| bakgrunn | `#F4F5F2` |
| flate | `#FFFFFF`, sekundær `#FAFBF9` |
| tekst | `#15201E`, dempet `#3D4845`, hjelpetekst `#5B6764` |
| linjer | `#E1E4DF`, input-kant `#CFD5CF`, segment/badge-bg `#EEF0EC`, radskille `#EEF0EC` |
| aksent | `#0F6B63`, hover `#0A4F49`, aktiv flate `#E8F3F1`, ferdig/fokusring `#CFE7E2` |
| deaktivert | bg `#DDE2DD`, tekst `#5B6764` |
| kode | bg `#15201E`, fanerad-linje `#2A3633`, nøkkel `#8FD1C4`, streng `#F2C98A` |
| radius | 6 (badge), 8 (fane/indre segment), 10 (input/segment), 12 (kort/knapp), 999 (chips) |
| font | Schibsted Grotesk 400/500/600/700, JetBrains Mono 400/500 |
| base | 14 px / 1.45 |

Mørkt tema: samme struktur, inverter flater og behold aksenten (lysne den for kontrast på mørk bakgrunn).

## Responsivt (< 768 px)
- Sidekolonnen blir en kompakt stegrad øverst (fire nummererte sirkler med aktivt steg uthevet), og primærhandlingen legges i en fast bunnlinje 52 px.
- Rutenettene i steg 1 og 3 går til én kolonne. Detaljpanelet i steg 2 havner under listen eller åpnes som bunnark.
- Kodeblokken scroller horisontalt i egen boks.

## Tilgjengelighet
- Ekte `<button>`, `<a>`, `<input>` og `<label>`. Kildekort og tabellrader er knapper eller lenker, ikke klikkbare div-er.
- Segmentkontroller med `aria-pressed` (eller radiogruppe), faner med `role="tab"` og `aria-selected`.
- `aria-label` på ikonknapper (kopier, fjern chip, tema, stepper).
- Berøringsflater minst 44 px. Unntak er kompakte chips (28–32 px), som må ha tilstrekkelig avstand.
- Behold «Gå til hovedinnhold»-lenken.

## Rekkefølge
1. Tokens og basiskomponenter (Button, Segment, Chip, Badge, Card, StepList).
2. Layout: header, sidekolonne med StepList og sticky handlingsfelt.
3. Steg 1 → 4.
4. Responsivt og mørkt tema.
