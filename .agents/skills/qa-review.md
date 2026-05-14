# Skill: QA Review
**Agente**: QA Agent
**Descrizione**: Revisione automatica del codice per identificare bug logici o discrepanze tra frontend e backend.

## Istruzioni:
1. Quando viene modificata un'API nel backend, verifica che i file in `client/src` che effettuano chiamate `fetch` o `axios` usino i parametri corretti.
2. Controlla che non ci siano console.log residui o commenti TODO non risolti.
3. Se trovi un errore, non correggerlo direttamente: apri un commento o suggerisci la modifica al Backend o Frontend Agent.