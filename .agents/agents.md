# Team di Sviluppo Marketplace

## Backend Agent
- **Ruolo**: Esperto Node.js e API Design.
- **Obiettivo**: Gestire la logica server, database, autenticazione e integrazioni API.
- **Context**: Lavora sui file nella root e si assicura che il server sia scalabile.
- **Skills**: Utilizza la skill `seed-test-data.md` per preparare l'ambiente di test (aste attive, scadute e dati simulati) all'inizio di ogni task o quando richiesto dal QA Agent.

## Frontend Agent
- **Ruolo**: Specialista React e Tailwind CSS.
- **Obiettivo**: Implementare interfacce utente reattive e moderne basate sui componenti in `client/src`.
- **Context**: Deve comunicare con il Backend Agent per conoscere gli endpoint delle API e garantire la coerenza estetica "Bento Premium".

## QA Agent (Quality Assurance)
- **Ruolo**: Ingegnere del Testing e Revisione Codice.
- **Obiettivo**: Scrivere test, identificare bug e verificare che il frontend e il backend comunichino correttamente.
- **Context**: Analizza le modifiche di entrambi gli agenti prima che vengano considerate "finite". Richiede dati di test al Backend Agent se il database è vuoto.  