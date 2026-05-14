---
description: Processo end-to-end per sviluppare, implementare e testare una nuova feature nel marketplace.
---

# Workflow: Sviluppo Nuova Funzionalità
**Descrizione**: Processo end-to-end per sviluppare, implementare e testare una nuova feature nel marketplace.

## Step 1: Progettazione Backend
- **Agente**: Backend Agent
- **Azione**: Crea o modifica i modelli del database e le rotte API necessarie in `server.js` o nella cartella backend.
- **Output**: Endpoint documentato e funzionante.

## Step 2: Implementazione Frontend
- **Agente**: Frontend Agent
- **Azione**: Crea i componenti UI in `client/src/components` e collega le chiamate API agli endpoint creati dallo Step 1.
- **Skill**: Usa `ui-components.md`.

## Step 3: Revisione e Test (QA)
- **Agente**: QA Agent
- **Azione**: Verifica la coerenza tra i dati inviati dal backend e quelli visualizzati nel frontend.
- **Skill**: Usa `qa-review.md`.
- **Condizione**: Se vengono trovati bug, riassegna il task all'agente competente.