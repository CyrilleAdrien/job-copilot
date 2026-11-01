# Contrôles des relations entre écrans

Scripts Playwright qui vérifient, sur la stack lancée en local, qu'une modification se retrouve sur tous les écrans liés (voir `docs/relations.md`). Chaque script remet les données de démonstration dans leur état de départ.

```bash
make up                      # avec JOBS_DEMO, MAIL_DEMO, CALENDAR_DEMO et LLM_PROVIDER=demo dans .env
npx playwright install chromium
node scripts/relations/relations-etape10.js
```

Variables :
- `WEB_URL` : l'interface (par défaut http://localhost:3000) ;
- `API_URL` : la gateway (par défaut http://localhost:8000) ;
- `SHOTS_DIR` : le dossier des captures (par défaut `relations-shots/`).

`relations-etape10.js` a besoin d'un serveur CalDAV local, Radicale sur 127.0.0.1:5232, avec l'utilisateur `cyrille` / `secret-app` et le calendrier `entretiens` :

```bash
printf 'cyrille:secret-app\n' > /tmp/radicale-users
uvx radicale --server-hosts 127.0.0.1:5232 --auth-type htpasswd \
  --auth-htpasswd-filename /tmp/radicale-users --auth-htpasswd-encryption plain \
  --storage-filesystem-folder /tmp/radicale-data
curl -u cyrille:secret-app -X MKCALENDAR http://127.0.0.1:5232/cyrille/entretiens/
```
