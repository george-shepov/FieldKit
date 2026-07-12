# Repository Review: FieldKit

_Last reviewed: 2026-07-12_

## Current role

FieldKit is the canonical repository for small, installable, offline-first web applications in the Shepov ecosystem.

It already provides:

- a shared launcher and navigation shell;
- per-app and full-suite installation;
- Progressive Web App behavior;
- offline-capable tools, games, trainers, legal utilities, and productivity apps;
- optional connected applications for features that require Wi-Fi or cellular service;
- shared infrastructure for consistent presentation and deployment.

## Consolidation decision

**Status: KEEP — canonical destination repository.**

Small standalone repositories should be reviewed against FieldKit. Unique functionality should be ported here when it can operate primarily in the browser or through an optional integration. The older source repository should only be archived after migration, testing, and documentation are complete.

FieldKit should not absorb unrelated production backends wholesale. Authentication, encrypted synchronization, notifications, account services, and other server-side capabilities should remain optional services exposed through clean integrations.

## Known overlap under review

### Shepov Enterprise Platform

Potential overlap includes its collection of standalone HTML applications. Server-side authentication, database, email, session, upload, and role-management code should be evaluated separately as optional platform services rather than copied into the offline application suite.

### Shepov Mega Universe Showcase

This is primarily a portfolio and catalog of applications. Its useful contribution is inventory, historical naming, categorization, and descriptions of applications that may need to be located and compared with FieldKit.

### Training applications

The following repositories and FieldKit modules should be consolidated around a shared study engine:

- developer-interview-prep;
- Vocabulary-Expander;
- Driver's License Study;
- JS Trainer;
- Linux Trainer;
- Math Trainer;
- Acronym List;
- Employee Skills;
- flashcard and digest functionality.

## Target architectural boundaries

### Belongs in FieldKit

- browser-based offline tools;
- installable PWAs;
- local-first storage;
- import and export;
- training decks and flashcards;
- lightweight service, inventory, legal-reference, media, and productivity tools;
- optional clients for connected services.

### Belongs outside FieldKit

- shared authentication servers;
- secret storage and key management;
- databases containing multi-user production data;
- email and SMS delivery infrastructure;
- VPS provisioning and deployment control planes;
- large domain-specific production systems with independent release cycles.

## Retirement policy

No repository should be deleted during consolidation.

The required sequence is:

1. inventory features and data formats;
2. identify duplicates and unique behavior;
3. port unique functionality;
4. add regression and migration tests;
5. verify deployed and offline behavior;
6. update the old repository README with its successor;
7. archive the old repository.

## Open review items

- Compare FieldKit application-by-application with the Enterprise Platform HTML app collection.
- Build a historical inventory from the Mega Universe catalog and validate each claimed application against an actual repository or file.
- Compare the training repositories and design one shared study-data schema.
- Identify standalone utility repositories that can become FieldKit modules.
