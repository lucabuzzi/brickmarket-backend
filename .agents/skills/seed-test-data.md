# Skill: Seed Test Data
**Agente**: Backend Agent
**Descrizione**: Generazione automatica di dati fittizi nel database per permettere il testing delle funzionalità.

## Istruzioni:
1. All'inizio di ogni nuovo sprint o quando richiesto dal QA Agent, verifica se nel database sono presenti:
   - Almeno 2 Aste attive (con scadenza futura).
   - Almeno 1 Asta scaduta (per testare i badge di chiusura).
   - Almeno 1 Annuncio "VENDUTO".
2. Se i dati mancano, esegui uno script di "seed" o inserisci manualmente i record via SQL/ORM.
3. Assicurati che i dati creati abbiano immagini valide (placeholder) e prezzi coerenti per testare i Toast di errore (es. un'asta con offerta minima di 100€).
4. Comunica al QA Agent quando il "campo da gioco" è pronto per i test.