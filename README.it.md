# The Anomaly Guard

> Sistema di rilevamento intrusioni a scopo didattico — Progetto 5, corso magistrale
> (extra-credit). English: [`README.md`](README.md).

The Anomaly Guard osserva richieste web **simulate** e decide, per ognuna, se è normale o
sospetta. Combina un classico **motore a regole** (firme regex / parole chiave) con il
**rilevamento statistico di anomalie** (impara com'è fatto il traffico normale e segnala ciò che
se ne discosta), e poi misura — onestamente — quanto ciascun approccio azzecca e quanto sbaglia.

**Domanda di ricerca:** quanto riesce a scoprire la statistica _senza_ firme di attacco
predefinite, e a quale prezzo in falsi positivi e falsi negativi?

**Demo online:** <https://nicholas-arcari.github.io/anomaly-guard/> — gira tutta nel browser.

È un **esperimento**, non un IDS di produzione. Tutto il traffico è sintetico e locale: niente
viene catturato da una rete reale e nessun payload viene mai eseguito o inviato da nessuna parte.
I confini di perimetro sono in [`CLAUDE.md`](CLAUDE.md) §2.

## Cosa contiene

| Workspace                                    | Cosa fa                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`packages/core`](packages/core)             | Estrazione feature, motore a regole, modelli statistici, detector (JS puro, gira nel browser e in Node)                     |
| [`packages/traffic`](packages/traffic)       | Generatore con seed di richieste legittime + malevole, dataset etichettato                                                  |
| [`packages/evaluation`](packages/evaluation) | Matrice di confusione, precision/recall/F1, FPR/FNR, ROC/AUC, base-rate                                                     |
| [`packages/server`](packages/server)         | Monitor Express che riceve le richieste simulate                                                                            |
| [`packages/dashboard`](packages/dashboard)   | Console multi-pagina in stile SIEM (Vite) — eventi, regole, modelli, qualità del rilevamento; build statica su GitHub Pages |

## Avvio rapido

```bash
npm install          # dalla radice del repo — configura tutti i workspace
npm test             # esegue i test (node:test)
npm run dev          # avvia la dashboard (dev server Vite)
npm run dev:server   # avvia il monitor Express (altro terminale)
npm run build        # build statica della dashboard (per GitHub Pages)
```

Richiede **Node.js ≥ 22**.

## Documentazione

La documentazione tecnica di dettaglio è in inglese (lingua di default del progetto):

- [`CLAUDE.md`](CLAUDE.md) — manuale per chi contribuisce e per gli assistenti AI (inizia da qui)
- [`docs/project-brief.md`](docs/project-brief.md) — la consegna (definisce il perimetro)
- [`docs/development/`](docs/development/README.md) — standard, struttura, stack, ADR
- [`docs/statistics/methods.md`](docs/statistics/methods.md) — la matematica (entropia,
  chi-quadro, limiti sulle lunghezze, outlier, ROC/AUC, intervalli di confidenza sulle metriche,
  base-rate / Bayes)
- [`docs/planning/backlog.md`](docs/planning/backlog.md) — board dei task (chi fa cosa)
- [`docs/guides/team-guide.md`](docs/guides/team-guide.md) — guida per il gruppo, in inglese: accesso al repository, flusso di lavoro, demo nel proprio portfolio

## Divisione del lavoro

Il lavoro è diviso per **tema statistico**, non per pacchetto, perché l'esame è di statistica.
Ognuno segue un tema dall'inizio alla fine (funzioni, test, grafico nella dashboard, capitolo
della relazione), così il contributo individuale è documentabile:

| Tema                                    | Domanda                                                            | Task                    |
| --------------------------------------- | ------------------------------------------------------------------ | ----------------------- |
| **T1** Distribuzioni dei caratteri e χ² | La composizione dei caratteri di un valore è normale?              | C-03, C-08, B-01        |
| **T2** Lunghezze e outlier              | Un valore è troppo lungo, o strano insieme agli altri?             | C-04 – C-07             |
| **T3** Valutazione e incertezza         | Quanto sbaglia il sistema, e quanto sono affidabili quei numeri?   | D-03 – D-06, B-02, E-06 |
| **T4** Probabilità e simulazione        | Com'è fatto il traffico, e cosa succede se gli attacchi sono rari? | A-02 – A-05, E-03       |

Concetti statistici di ogni tema, ordine di lavoro e cosa è in comune (relazione, pubblicazione
su Pages): [`docs/planning/backlog.md`](docs/planning/backlog.md) §8.

## Riferimento

Kruegel & Vigna, _Anomaly Detection of Web-based Attacks_, ACM CCS 2003 — l'idea della
distribuzione dei caratteri / chi-quadro su cui si fonda il progetto.

## Licenza

MIT — vedi [`LICENSE`](LICENSE).
