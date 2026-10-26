-- Un schéma par service : aucun service ne lit le schéma d'un autre.
CREATE SCHEMA IF NOT EXISTS profile;
CREATE SCHEMA IF NOT EXISTS jobs;
CREATE SCHEMA IF NOT EXISTS documents;
CREATE SCHEMA IF NOT EXISTS applications;
CREATE SCHEMA IF NOT EXISTS mail;
CREATE SCHEMA IF NOT EXISTS calendar;
