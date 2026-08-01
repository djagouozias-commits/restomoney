# Requirements Document

## Introduction

Option de couverts jetables par commande. Si un plat est marqué "compatible jetable" par l'admin, l'employé se voit poser la question au moment de commander. La réponse est enregistrée avec la ligne de commande.

## Glossary

- **Plat_Jetable** : Plat pour lequel l'option couverts jetables est disponible.
- **Option_Jetable** : Choix Oui/Non proposé à l'employé lors de la commande d'un Plat_Jetable.

## Requirements

### Requirement 1: Marquage admin des plats jetables

**User Story:** En tant qu'administrateur, je veux marquer un plat comme "compatible couverts jetables", afin que l'option soit proposée lors de la commande.

#### Acceptance Criteria

1. THE plats table SHALL have a boolean column `avec_jetable` (DEFAULT false) added via migration.
2. WHEN an admin edits a plat, THE admin interface SHALL show a toggle "Couverts jetables disponibles".
3. WHEN the toggle is saved, THE backend SHALL persist `avec_jetable = true/false` for the plat.

### Requirement 2: Proposition de couverts jetables à la commande

**User Story:** En tant qu'employé, je veux être invité à choisir si je veux des couverts jetables quand je commande un plat compatible, afin de personnaliser ma commande.

#### Acceptance Criteria

1. WHEN an employee adds a plat with `avec_jetable = true` to their order, THE ordering interface SHALL display a prompt: "Voulez-vous des couverts jetables ?" with Oui / Non buttons.
2. IF the employee selects Non OR the plat has `avec_jetable = false`, THEN THE ordering SHALL continue without any jetable flag.
3. IF the employee selects Oui, THEN THE ligne_commande SHALL be saved with `jetable = true`.
4. THE lignes_commande table SHALL have a boolean column `jetable` (DEFAULT false) added via migration.
