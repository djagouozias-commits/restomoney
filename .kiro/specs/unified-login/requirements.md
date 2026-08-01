# Requirements Document

## Introduction

Interface unifiée de connexion. Admin et employés accèdent à la même URL de login. Le système redirige automatiquement vers la section correspondante selon le rôle du JWT.

## Glossary

- **Login_Unifie** : Page de connexion unique accessible à `/login` pour tous les rôles.
- **Role_Redirect** : Redirection automatique post-login selon le rôle (admin → /admin, employe → /commander).

## Requirements

### Requirement 1: Page de connexion unique

**User Story:** En tant qu'utilisateur (admin ou employé), je veux me connecter sur une seule page, afin de ne pas avoir à connaître des URLs différentes.

#### Acceptance Criteria

1. THE application SHALL expose a single login page at `/login` accessible without authentication.
2. THE login page SHALL have a single form with fields: identifiant and mot de passe, plus a password visibility toggle (show/hide eye icon).
3. WHEN login succeeds with role `admin`, THE application SHALL redirect to `/admin`.
4. WHEN login succeeds with role `employe`, THE application SHALL redirect to `/commander`.
5. IF login fails, THE page SHALL display an error message without clearing the identifiant field.

### Requirement 2: Suppression des pages de login séparées

**User Story:** En tant qu'admin système, je veux une seule page de login, afin de simplifier la navigation et éviter la confusion.

#### Acceptance Criteria

1. THE existing `/admin/login` page SHALL redirect to `/login`.
2. THE existing employee login page SHALL redirect to `/login`.
3. THE navigation SHALL not expose separate admin/employee login links.
