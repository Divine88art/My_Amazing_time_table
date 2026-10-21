PWA Emploi du temps - version devoirs + photos + badges

Contenu : index.html, sw.js, manifest.webmanifest et icones.

Installation/test :
1. Extraire tout le ZIP dans un dossier.
2. Publier ce dossier sur un site de test Netlify distinct (ne remplacez pas le site de production).
3. Tester l'emploi du temps, les matières, le thème, l'impression, les devoirs, les photos, les badges et le mode hors ligne.

Stockage : edt-data (emploi du temps), edt-homework-v1 (devoirs), IndexedDB edt-homework-photos-v1 (photos compressées). Les photos et devoirs restent sur le navigateur/appareil local. Vider les données du navigateur peut les supprimer.

Les photos sont limitées à 8 Mo avant compression, redimensionnées à 1400 px maximum et converties en JPEG.

Cette version est un prototype. Les notifications système et la synchronisation entre appareils ne sont pas incluses.


RAPPELS LOCAUX DES DEVOIRS (version avec rappels)
- Dans « Mes devoirs », choisis « Activer les rappels » et autorise les notifications.
- Horaires fixes : la veille à 18 h et le jour de l’échéance à 7 h (heure locale de l’appareil).
- Les rappels sont vérifiés à l’ouverture, au retour dans l’application et périodiquement tant que l’application tourne. Une notification test permet de vérifier l’autorisation.
- Limite importante : il ne s’agit pas d’une alarme système programmée. Si l’application/le navigateur est fermé ou suspendu, l’appareil éteint, ou le navigateur ne réveille pas le service worker, une notification peut être retardée ou ne pas apparaître. Aucun rappel hors ligne à heure garantie n’est promis.
- Les réglages et identifiants de rappels sont stockés localement dans localStorage. Les données existantes de l’emploi du temps (edt-data), les devoirs (edt-homework-v1) et les photos IndexedDB ne sont pas migrés ni effacés.
- Déploiement : publier les fichiers de cette archive sur Netlify/HTTPS. Le cache du service worker passe à edt-v4 pour charger la nouvelle version.
