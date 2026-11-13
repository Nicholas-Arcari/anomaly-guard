# T3 — Valutazione e incertezza

> **Bozza** del capitolo T3 della relazione finale (E-05). Autore: Nicholas Arcari.
>
> - **Origine dei numeri:** un'esecuzione di `npm run experiments` al commit `c4ef25c`, seed 1–20,
>   albero di lavoro pulito, 13/11/2026.
> - **Il punteggio statistico è ancora quello di base:** il solo segnale sulla lunghezza. Quando
>   arriveranno il chi-quadro e gli outlier (C-03, C-05, C-06), va rieseguito l'esperimento sul
>   commit finale e vanno aggiornate le tabelle.
>
> La versione inglese è [`t3-evaluation-and-uncertainty.en.md`](t3-evaluation-and-uncertainty.en.md).

## 1. La domanda

Il progetto chiede quanto la statistica riesca a individuare senza firme predefinite, e quanto
spesso sbagli. Questo capitolo misura gli errori e quanto possiamo fidarci di quelle misure.
Confronta tre rilevatori sulle stesse richieste:

- **regole** (`rules`): solo firme. Una richiesta viene segnalata quando un'espressione regolare
  corrisponde.
- **statistica** (`stats`): solo statistica. Una richiesta viene segnalata quando il suo punteggio
  di anomalia `s = −log10 p`, appreso dal traffico legittimo, raggiunge una soglia.
- **combinato** (`combined`): una richiesta viene segnalata se una regola corrisponde, oppure se
  il punteggio raggiunge la soglia.

## 2. Disegno sperimentale

Ogni **seed** estrae un dataset completo dal generatore di traffico (T4, ADR-006), diviso in tre
insiemi:

| Insieme               | Richieste | Contenuto                                           | Serve a                        |
| --------------------- | --------- | --------------------------------------------------- | ------------------------------ |
| addestramento (train) | 2.000     | solo legittime                                      | stimare il modello statistico  |
| calibrazione          | 10.000    | solo legittime                                      | scegliere la soglia            |
| test                  | 5.000     | 4.500 legittime (225 casi difficili) e 500 attacchi | misurare gli errori, una volta |

- **Le etichette non arrivano mai al modello né alla soglia.** Il modello è stimato solo su
  richieste legittime (ADR-004), e la soglia è scelta solo su richieste legittime (ADR-009). Le
  etichette degli attacchi servono una volta sola, per valutare l'insieme di test. Scegliere la
  soglia che sembra migliore sul test gonfierebbe ogni numero.
- **Gli attacchi** sono richieste legittime con un valore sostituito da un payload. Hanno tre
  varianti:
  - canonici: firme note;
  - offuscati: camuffati per eludere le firme;
  - nuovi (novel): famiglie per cui le regole non hanno alcuna firma.

  Cinque famiglie su nove sono nuove, quindi gli attacchi nuovi sono più della metà: 258–296 su
  500 per seed.

- **I casi difficili** sono richieste legittime dall'aspetto insolito: un apostrofo, un testo
  libero lungo, un testo non latino. Sono solo nell'insieme di test, quindi mostrano come si
  comporta il rilevatore con traffico che la calibrazione non ha mai visto.
- **20 seed** danno 20 repliche indipendenti dell'intera procedura: dati nuovi, modello nuovo,
  soglie nuove.

## 3. Metodi

### 3.1 Tassi d'errore, non accuratezza

Dalla matrice di confusione (TP, FN, FP, TN) il capitolo riporta:

- il tasso di veri positivi, `TPR = TP / (TP + FN)` (recall), e il suo complemento, il tasso di
  falsi negativi `FNR = 1 − TPR`;
- il tasso di falsi positivi, `FPR = FP / (FP + TN)`;
- la precisione, `TP / (TP + FP)`.

L'accuratezza non è riportata. Con il 90% di richieste legittime, un rilevatore che non segnala
mai nulla otterrebbe il 90%.

### 3.2 Una soglia per un tasso di falsi positivi obiettivo

Si prendono i punteggi di `n` richieste legittime di calibrazione e un obiettivo `α`. Al più
`k = ⌊α·n⌋` di esse possono raggiungere la soglia. La soglia `t` è il più piccolo numero
strettamente maggiore del `(k+1)`-esimo punteggio più alto: un quantile empirico dei punteggi
legittimi (`thresholdAtFpr`).

- **I pari merito** si muovono insieme, quindi l'FPR di calibrazione può scendere sotto `α`.
- **Dimensione:** il quantile si regge sui `k` punteggi più alti, e con meno di una decina di essi
  è rumoroso. Per questo l'insieme di calibrazione ha 10.000 richieste: `n ≥ 10/α` anche con
  `α = 0,1%`.
- **Un obiettivo irraggiungibile:** in modalità combinata una corrispondenza con una regola vale
  `+∞` ed è segnalata a qualsiasi soglia. Se più di `k` richieste legittime di calibrazione
  corrispondono a una regola, nessuna soglia rispetta l'obiettivo. La soglia allora si colloca
  sopra ogni punteggio finito di calibrazione, e sulla calibrazione scattano solo le regole.

Anche Kruegel e Vigna (2003) fissano le soglie su traffico privo di attacchi.

### 3.3 Curva ROC e AUC

La curva ROC fa scendere la soglia attraverso ogni punteggio distinto e traccia il TPR contro
l'FPR. L'area sotto la curva è la statistica di Mann–Whitney:

```
AUC = P(punteggio di un attacco a caso > punteggio di una richiesta legittima a caso), pari merito ½
```

0,5 è il caso, 1 la separazione perfetta. L'AUC usa solo l'ordinamento dei punteggi, quindi non
dipende da alcuna soglia. Le regole hanno un punteggio binario: la loro curva ha un solo punto
interno, e `AUC = (1 + TPR − FPR) / 2`.

### 3.4 Incertezza dentro una singola esecuzione

Ogni tasso è una proporzione `x/n` stimata su un insieme di test finito. Riceve un intervallo di
**Wilson** al 95%, con `p̂ = x/n` e `z = 1,96`:

```
centro      = (p̂ + z²/(2n)) / (1 + z²/n)
semiampiezza = z / (1 + z²/n) · √( p̂(1 − p̂)/n + z²/(4n²) )
```

L'intervallo di Wald dei manuali, `p̂ ± z·√(p̂(1 − p̂)/n)`, collassa in [0, 0] quando non ci sono
errori. Wilson no: 0 falsi positivi su 900 danno un FPR in [0; 0,43%], non "zero".

L'AUC non è una semplice proporzione, quindi riceve un **bootstrap percentile stratificato**:

1. si ricampionano separatamente, con reinserimento, gli attacchi e le richieste legittime, 1.000
   volte;
2. si calcola l'AUC di ogni ricampionamento;
3. si prendono il 2,5° e il 97,5° percentile.

I numeri casuali vengono da un generatore con seme pari al seed del dataset + 2³¹. Quella sequenza
non si sovrappone mai a quella del dataset, quindi gli intervalli sono riproducibili.

### 3.5 Incertezza tra un'esecuzione e l'altra

Gli intervalli del §3.4 descrivono un solo insieme di test. Da un seed all'altro cambia tutto
insieme: dati di addestramento, modello, soglia e insieme di test. Perciò ogni metrica è riassunta
con la media, la deviazione standard, l'intervallo di variazione e un intervallo t di Student al
95% per la media:

```
media ± t(0,975; 19) · DS / √20,     t(0,975; 19) = 2,093
```

L'unità indipendente è il seed. Le richieste di uno stesso seed condividono un modello e una
soglia, quindi non sono prove indipendenti. Un intervallo di Wilson sui conteggi sommati su tutti
i seed ignorerebbe quanto si sposta la soglia da un'esecuzione all'altra, e risulterebbe troppo
stretto.

A volte un valore è identico in ogni seed, per esempio il 100% degli attacchi di command injection
individuati dalle regole. L'intervallo allora ha ampiezza zero, e le tabelle riportano "in ogni
seed".

### 3.6 Confrontare due rilevatori sulle stesse richieste

I tre rilevatori valutano le stesse richieste, quindi i loro risultati sono appaiati. Il **test di
McNemar** usa solo le richieste su cui due rilevatori non sono d'accordo: `b` segnalate solo da A,
`c` segnalate solo da B. Se i due fossero ugualmente buoni, ogni disaccordo sarebbe un lancio di
moneta: `b ~ Binomiale(b + c, ½)`.

- Il p-value esatto bilaterale è `2·P(X ≤ min(b, c))`. Il χ² dei manuali con correzione di
  continuità, `(|b − c| − 1)² / (b + c)`, coincide con esso per conteggi grandi.
- Attacchi, attacchi nuovi e richieste legittime sono testati separatamente. Sugli attacchi
  segnalare di più è meglio; sulle richieste legittime significa più falsi allarmi. Un test unico
  su tutte le richieste confronterebbe l'accuratezza.
- Sui seed i conteggi si sommano: sotto l'ipotesi nulla il `b` di ogni seed è binomiale, e lo è
  anche la somma.
- I test sono 18 (3 coppie × 3 gruppi × 2 obiettivi). Con la correzione di Bonferroni, una
  differenza conta se p < 0,05/18 ≈ 0,0028.

## 4. Risultati

Ogni valore è la media sui 20 seed, con l'intervallo t al 95% della media tra parentesi quadre.

### 4.1 Senza soglia: AUC

**Tabella 1 — AUC sull'insieme di test.**

| Rilevatore | AUC                 | DS tra i seed | Intervallo di variazione | Ampiezza media dell'intervallo bootstrap di un seed |
| ---------- | ------------------- | ------------- | ------------------------ | --------------------------------------------------- |
| regole     | 0,700 [0,695–0,705] | 0,010         | 0,685–0,722              | 0,044                                               |
| statistica | 0,814 [0,801–0,827] | 0,028         | 0,763–0,856              | 0,051                                               |
| combinato  | 0,866 [0,858–0,875] | 0,018         | 0,827–0,893              | 0,043                                               |

Guardando solo all'ordinamento, il combinato separa meglio gli attacchi dalle richieste legittime,
e la statistica batte nettamente le regole.

### 4.2 Con un obiettivo dell'1% di falsi positivi

**Tabella 2 — Punto operativo con obiettivo 1%.**

| Rilevatore | Soglia              | FPR di calibrazione | FPR test, tipiche | FPR test, tutte le legittime | TPR               | Precisione        | Obiettivo rispettato |
| ---------- | ------------------- | ------------------- | ----------------- | ---------------------------- | ----------------- | ----------------- | -------------------- |
| regole     | — (una regola)      | 3,10% [3,03–3,17]   | 3,09% [2,96–3,22] | 2,93% [2,81–3,06]            | 42,9% [41,9–43,8] | 61,9% [60,7–63,2] | 0/20 seed            |
| statistica | 1,380 [1,325–1,435] | 0,95% [0,93–0,97]   | 0,92% [0,82–1,02] | 2,53% [2,22–2,85]            | 57,2% [55,1–59,3] | 71,8% [69,2–74,4] | 20/20                |
| combinato  | 2,304 [2,229–2,380] | 3,10% [3,03–3,17]   | 3,09% [2,96–3,23] | 2,94% [2,81–3,06]            | 66,2% [64,6–67,7] | 71,5% [70,4–72,5] | 0/20                 |

**Tabella 3 — Quota segnalata per variante con obiettivo 1%.** Per gli attacchi è il tasso di
rilevamento; per le richieste legittime, il tasso di falsi positivi.

| Variante              | Richieste per seed | regole            | statistica        | combinato         |
| --------------------- | ------------------ | ----------------- | ----------------- | ----------------- |
| attacco · canonico    | 163–197            | 95,7% [94,9–96,4] | 52,5% [50,3–54,6] | 96,5% [95,9–97,1] |
| attacco · offuscato   | 33–56              | 86,7% [83,8–89,6] | 63,7% [60,2–67,1] | 94,4% [92,6–96,1] |
| attacco · nuovo       | 258–296            | 1,8% [1,5–2,1]    | 59,2% [56,7–61,7] | 42,1% [39,5–44,7] |
| legittima · tipica    | 4.275              | 3,09% [2,96–3,22] | 0,92% [0,82–1,02] | 3,09% [2,96–3,23] |
| legittima · difficile | 225                | 0% (in ogni seed) | 33,1% [26,9–39,4] | 0% (in ogni seed) |

Per famiglia:

- **Le regole** individuano tutti gli attacchi di command injection e di path traversal (100% in
  ogni seed), e gran parte delle SQL injection (85,6%) e degli XSS (89,7%). Di ogni famiglia nuova
  ne individuano solo il 2% circa.
- **La statistica** individua fra il 36% (command injection) e l'84% (valori sovradimensionati) di
  ogni famiglia.
- **Richieste legittime:** tutti i falsi allarmi delle regole sono sul form di login. Il 20,6%
  [20,0–21,3] delle richieste di login corrisponde a una regola, perché le password generate
  contengono `#` e `--`.

### 4.3 Con un obiettivo dello 0,1% di falsi positivi

Solo la statistica rispetta questo obiettivo:

- soglia 1,917 [1,853–1,982];
- FPR di calibrazione 0,08% [0,07–0,10], FPR di test 0,08% [0,05–0,10];
- TPR in calo al 48,2% [45,7–50,8], precisione in salita al 98,6% [98,3–99,0];
- il 47,2% [44,1–50,3] degli attacchi nuovi individuato, e nessun caso difficile segnalato.

Le regole e il combinato non possono scendere sotto il loro minimo del 3%, quindi le loro righe
restano quelle dell'1%.

### 4.4 Confronti appaiati

**Tabella 4 — McNemar con obiettivo 1%**, disaccordi sommati sui 20 seed.

| A contro B              | Richieste      | Segnalate solo da A | Segnalate solo da B | p esatto | Seed con p < 0,05                                      |
| ----------------------- | -------------- | ------------------- | ------------------- | -------- | ------------------------------------------------------ |
| statistica vs combinato | attacchi       | 1.008               | 1.902               | < 0,001  | combinato avanti in 19                                 |
| statistica vs combinato | attacchi nuovi | 975                 | 27                  | < 0,001  | statistica avanti in 20                                |
| statistica vs combinato | legittime      | 2.276               | 2.641               | < 0,001  | più allarmi del combinato in 11, della statistica in 2 |
| regole vs statistica    | attacchi       | 1.902               | 3.335               | < 0,001  | statistica avanti in 18                                |
| regole vs statistica    | attacchi nuovi | 27                  | 3.207               | < 0,001  | statistica avanti in 20                                |
| regole vs combinato     | legittime      | 0                   | 4                   | 0,125    | nessuno                                                |

I due rilevatori sbagliano su richieste diverse. La statistica da sola dà 2.280 falsi allarmi e il
combinato 2.645, ma solo 4 cadono sulle stesse richieste.

Con lo 0,1% il quadro è lo stesso:

- la statistica da sola individua 340 attacchi nuovi che il combinato perde, contro 60 nel verso
  opposto (p < 0,001);
- dà 65 falsi allarmi che il combinato non dà, contro 2.641 nel verso opposto.

### 4.5 Quanto si muovono i numeri?

- **Regole:** la DS dell'AUC tra i seed (0,010) coincide con l'errore standard dato dal bootstrap
  di un singolo seed (≈ 0,044 / 3,92 = 0,011). Le regole non imparano nulla dai dati, quindi
  l'unico rumore è l'insieme di test.
- **Statistica:** la DS tra i seed (0,028) è circa il doppio dell'errore standard del bootstrap
  (≈ 0,013). In termini di varianza, l'insieme di test ne spiega solo circa un quinto
  (0,013² / 0,028² ≈ 0,22). Il resto viene dai dati di addestramento, che l'intervallo di una
  singola esecuzione non può vedere.
- **L'FPR di test su tutte le richieste legittime** si muove molto: DS 0,68%, da 1,73% a 3,78%.
  Quante delle quattro fixture dei casi difficili superano la soglia cambia da un seed all'altro.

Per questo l'esperimento usa 20 seed e non uno.

## 5. Discussione

1. **La calibrazione funziona dove ha visto dati.** Sul traffico legittimo tipico, la statistica
   centra gli obiettivi fuori campione: 0,92% [0,82–1,02] contro l'1%, e 0,08% contro lo 0,1%.
2. **Non copre ciò che non ha visto.** Un caso difficile su tre (33%) dà un falso allarme con
   l'obiettivo dell'1%. Né l'insieme di calibrazione né quello di addestramento contengono
   richieste simili: un modello del "normale" è largo quanto il traffico normale che ha ricevuto.
3. **La statistica individua ciò che le firme non vedono.** All'1% individua il 59% degli attacchi
   nuovi, contro il 2% delle regole: è la risposta centrale alla domanda di ricerca. Però perde
   anche circa metà degli attacchi canonici che le regole individuano (52% contro 96%). Quindi
   affianca le regole, non le sostituisce.
4. **Combinare non è gratis.** Le regole da sole segnalano il 3,1% del traffico legittimo, quindi
   il combinato non può mai rispettare un obiettivo dell'1% o dello 0,1%.
   - Perché la statistica non aggiunga falsi allarmi propri, la soglia del combinato sale da 1,38 a
     2,30.
   - Di conseguenza individua meno attacchi nuovi della sola statistica: 42% contro 59% (McNemar
     p < 0,001, in tutti i 20 seed).
   - La sua AUC più alta (0,866) lo nasconde. L'AUC riassume tutte le soglie, inclusa una zona che
     il combinato non può raggiungere: sotto un FPR di circa il 3% non ha alcun punto operativo.

   Correggere le firme che scattano sulle password (`#`, `--`) è il task B-01 del tema T1.

5. **Il tasso di base cambia tutto** (capitolo T4). Con la prevalenza del 10% dell'insieme di test,
   circa il 72% degli allarmi della statistica sono attacchi. Con una prevalenza `π` dello 0,1%,
   Bayes dà:

   ```
   PPV = TPR·π / (TPR·π + FPR·(1 − π))
   ```

   - con l'obiettivo dell'1%: 2,2%, cioè 98 allarmi su 100 sono falsi;
   - con l'obiettivo dello 0,1%: 37,6%.

## 6. Limiti

- **Dati sintetici.** I numeri descrivono il generatore di T4, non traffico reale. Valgono le
  conclusioni comparative: regole contro statistica, il costo della combinazione, la calibrazione
  di fronte a richieste mai viste.
- **Un modello di base.** Il punteggio è ancora il solo segnale sulla lunghezza. Il chi-quadro e
  gli outlier (C-03, C-05, C-06) cambieranno ogni numero delle Tabelle 1–4.
- **Quattro casi difficili, ripetuti.** Il loro tasso di falsi positivi dice soprattutto quali dei
  quattro superano la soglia. Non è un tasso su una popolazione di richieste insolite.
- **L'intervallo t** presuppone valori per seed approssimativamente normali. Con 20 seed è
  ragionevole, ma non vicino allo 0% o al 100%, dove l'intervallo viene troncato.
- **Molti test.** Solo i risultati di McNemar con p < 0,0028 superano la correzione di Bonferroni.
  Nella Tabella 4 la superano tutte le righe tranne l'ultima.

## 7. Riprodurre i numeri

```bash
git checkout c4ef25c
npm ci
npm run experiments      # circa 1,5 minuti; scrive results/<data>-<commit>/report.md
```

Lo stesso seed dà sempre gli stessi dati, lo stesso modello, le stesse soglie e gli stessi
ricampionamenti bootstrap. `results.json` contiene ogni seed, con i propri intervalli di Wilson e
bootstrap. La pagina _Detection quality_ della dashboard mostra un seed dal vivo: ROC, matrice di
confusione, varianti, McNemar.

## 8. Contributo individuale

Nicholas Arcari (T3) ha scritto:

- la calibrazione della soglia (D-06);
- la curva ROC e l'AUC (D-03);
- gli intervalli di Wilson e bootstrap (D-05);
- l'esperimento su più seed e gli intervalli tra i seed (D-04);
- la calibrazione del server (B-02);
- la pagina _Detection quality_ della dashboard (E-06, e la ROC di E-02);
- il test di McNemar (D-07);
- questo capitolo.

Preparato con Claude Code (assistente AI), come chiede di dichiarare la guida del gruppo.

## Riferimenti

- C. Kruegel e G. Vigna, _Anomaly Detection of Web-based Attacks_, ACM CCS 2003.
- E. B. Wilson, _Probable inference, the law of succession, and statistical inference_, JASA 22,
  1927 (l'intervallo di Wilson).
- Q. McNemar, _Note on the sampling error of the difference between correlated proportions or
  percentages_, Psychometrika 12, 1947.
- J. A. Hanley e B. J. McNeil, _The meaning and use of the area under a receiver operating
  characteristic (ROC) curve_, Radiology 143, 1982 (l'AUC come statistica di Mann–Whitney).
- B. Efron e R. J. Tibshirani, _An Introduction to the Bootstrap_, Chapman & Hall, 1993.
