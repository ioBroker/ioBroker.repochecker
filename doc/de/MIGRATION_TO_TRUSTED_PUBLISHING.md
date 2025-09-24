# Migrationsleitfaden für NPM Trusted Publishing

Dieser Leitfaden hilft Ihnen dabei, Ihren ioBroker-Adapter von der Verwendung von NPM-Token auf Trusted Publishing für sichere und automatisierte Paket-Deployment zu migrieren.

## Überblick

**Ausgangssituation:**
- Sie verwenden den Standard ioBroker-Workflow `test-and-release.yml`
- NPM-Autorisierung ist als geheimer Token `NPM_TOKEN` in Ihren Repository-Einstellungen gespeichert
- Ihr Adapter-Repository folgt dem Muster wie `mcm4iob/ioBroker.hoymiles-ms`

**Zielsituation:**
- Weiterhin Verwendung des vorhandenen `test-and-release.yml` Workflows (minimale Änderungen nur bei Bedarf)
- Entfernung der NPM-Token-Abhängigkeiten
- Verwendung von NPM Trusted Publishing für sichere, automatisierte Deployments
- Zugang zu NPM vollständig über GitHub Actions via OIDC (OpenID Connect) kontrolliert

## Vorteile von Trusted Publishing

- **Verbesserte Sicherheit**: Keine sensiblen NPM-Token mehr in Repository-Secrets
- **Automatisierte Einrichtung**: GitHub Actions kann sich direkt bei NPM authentifizieren
- **Reduzierte Wartung**: Keine Token-Rotation oder Ablaufverwaltung erforderlich
- **Audit-Trail**: Bessere Nachverfolgung, wer was und wann veröffentlicht hat

## Voraussetzungen

Stellen Sie vor Beginn sicher, dass Sie haben:
- Administrator-Zugang zu Ihrem NPM-Paket
- Administrator-Zugang zu Ihrem GitHub-Repository
- Ihr Adapter ist bereits auf NPM veröffentlicht
- Sie verwenden einen Standard `test-and-release.yml` Workflow

## Schrittweise Anleitung für die Migration

### Schritt 1: Zugang zu Ihren NPM-Paket-Einstellungen

1. **Bei NPM einloggen**: Gehen Sie zu [npmjs.com](https://npmjs.com) und melden Sie sich in Ihrem Konto an
2. **Zu Ihrem Paket navigieren**: Gehen Sie zu Ihrem Adapter-Paket (z.B. `iobroker.hoymiles-ms`)
3. **Paket-Einstellungen aufrufen**: Klicken Sie auf Ihren Paketnamen, dann navigieren Sie zum "Settings"-Tab

![NPM Paket-Einstellungen - Zugang zu Ihrer Paket-Einstellungsseite](placeholder_npm_package_settings.png)

### Schritt 2: Trusted Publishing auf NPM konfigurieren

1. **Bereich "Publishing access" finden**: Scrollen Sie zum Abschnitt "Publishing access" in Ihren Paket-Einstellungen
2. **Auf "Trusted publishing" klicken**: Dies öffnet die Trusted Publishing-Konfiguration
3. **GitHub als vertrauenswürdigen Publisher hinzufügen**: Klicken Sie auf "Add trusted publisher"

![NPM Trusted Publishing Setup - GitHub als vertrauenswürdigen Publisher hinzufügen](placeholder_npm_trusted_publisher.png)

### Schritt 3: GitHub Repository-Einstellungen konfigurieren

Füllen Sie die folgenden Informationen exakt aus:

- **Repository**: `ihr-github-benutzername/ioBroker.ihr-adapter-name` (z.B. `mcm4iob/ioBroker.hoymiles-ms`)
- **Workflow**: `test-and-release.yml` (dies ist der Standard ioBroker-Workflow-Name)
- **Environment**: Leer lassen (oder `production` verwenden, wenn Sie umgebungsspezifische Deployments haben)

![GitHub Repository-Konfiguration - Repository-Details konfigurieren](placeholder_github_repo_config.png)

**Wichtige Hinweise:**
- Der Repository-Name muss exakt mit Ihrem GitHub-Repository übereinstimmen
- Der Workflow-Name muss mit dem tatsächlichen Workflow-Dateinamen in `.github/workflows/` übereinstimmen
- Wenn Sie einen anderen Branch als `master` für Releases verwenden, stellen Sie sicher, dass Ihr Workflow entsprechend konfiguriert ist

### Schritt 4: Workflow-Konfiguration überprüfen

Überprüfen Sie Ihre aktuelle `.github/workflows/test-and-release.yml` Datei. Der Deploy-Job sollte ähnlich aussehen:

```yaml
deploy:
  needs: [tests]
  if: |
    contains(github.event.head_commit.message, '[skip ci]') == false &&
    github.event_name == 'push' &&
    startsWith(github.ref, 'refs/tags/')
  runs-on: ubuntu-latest
  steps:
    - name: Checkout code
      uses: actions/checkout@v5
    - name: Use Node.js 18.x
      uses: actions/setup-node@v4
      with:
        node-version: 18.x
    - name: Install Dependencies
      run: npm install
    - name: Publish package to npm
      run: |
        npm config set //registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}
        npm whoami
        npm publish
```

### Schritt 5: Workflow für Trusted Publishing aktualisieren

**NUR BEI BEDARF**: Wenn Ihr Workflow Trusted Publishing noch nicht unterstützt, müssen Sie minimale Änderungen vornehmen.

#### Option A: Aktuellen Workflow beibehalten (Empfohlen)

Die meisten bestehenden ioBroker-Workflows unterstützen bereits Trusted Publishing. Die `@iobroker/testing` Action handhabt Trusted Publishing automatisch, wenn `NPM_TOKEN` nicht verfügbar ist.

#### Option B: Manuelles Workflow-Update (Nur wenn Option A nicht funktioniert)

Ersetzen Sie den npm publish-Schritt:

```yaml
- name: Publish package to npm
  run: |
    npm config set //registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}
    npm whoami
    npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Aktualisieren zu:**

```yaml
- name: Setup Node.js with NPM registry
  uses: actions/setup-node@v4
  with:
    node-version: 18.x
    registry-url: 'https://registry.npmjs.org'
- name: Publish package to npm
  run: npm publish --provenance
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Schritt 6: Konfiguration testen

1. **Test-Tag erstellen**: Machen Sie eine kleine Änderung an Ihrer package.json Version und erstellen Sie einen Git-Tag
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. **Workflow überwachen**: Gehen Sie zum "Actions"-Tab Ihres GitHub-Repositories und beobachten Sie den Deployment-Prozess

3. **Veröffentlichung überprüfen**: Prüfen Sie, dass Ihr Paket erfolgreich auf NPM veröffentlicht wurde

![GitHub Actions Erfolg - Erfolgreicher Workflow-Lauf mit Trusted Publishing](placeholder_github_actions_success.png)

### Schritt 7: NPM Token entfernen (Letzter Schritt)

**Nur nach erfolgreichem Testen:**

1. **Zu GitHub Repository-Einstellungen gehen**: Navigieren Sie zu Settings > Secrets and variables > Actions
2. **NPM_TOKEN entfernen**: Löschen Sie das `NPM_TOKEN` Secret aus Ihrem Repository
3. **Entfernung überprüfen**: Führen Sie ein weiteres Test-Deployment durch, um sicherzustellen, dass es ohne Token funktioniert

![NPM Token entfernen - NPM_TOKEN aus Repository-Secrets löschen](placeholder_remove_npm_token.png)

## Erforderliche Änderungen für @iobroker/testing Workflow

Wenn Sie die `@iobroker/testing` Action in Ihrem Workflow verwenden, müssen Sie diese möglicherweise auf die neueste Version aktualisieren, die Trusted Publishing unterstützt:

### Aktueller Standard-Workflow

Die meisten ioBroker-Adapter verwenden einen Workflow, der aufruft:

```yaml
- name: Test and Release
  uses: ioBroker/testing@v3
  with:
    node-version: '18.x'
```

### Aktualisierter Workflow für Trusted Publishing

Auf die neueste Version aktualisieren:

```yaml
- name: Test and Release  
  uses: ioBroker/testing@v4
  with:
    node-version: '18.x'
    npm-token: ${{ secrets.NPM_TOKEN }}  # Dies wird ignoriert, wenn Trusted Publishing verwendet wird
```

Die Testing-Action erkennt und verwendet automatisch Trusted Publishing, wenn verfügbar, und fällt bei Bedarf auf die Token-Methode zurück.

## Fehlerbehebung

### Häufige Probleme und Lösungen

1. **"Failed to authenticate with NPM" Fehler**
   - Überprüfen Sie, dass der Repository-Name exakt mit Ihrem GitHub-Repository übereinstimmt
   - Stellen Sie sicher, dass der Workflow-Name mit Ihrer tatsächlichen Workflow-Datei übereinstimmt
   - Prüfen Sie, dass der Paketname korrekt ist

2. **"Workflow not found" Fehler**
   - Bestätigen Sie, dass Ihre Workflow-Datei genau `test-and-release.yml` heißt
   - Stellen Sie sicher, dass der Workflow in Ihr Repository committed wurde
   - Überprüfen Sie, dass der Workflow den korrekten Deploy-Job enthält

3. **"Package not found" Fehler**
   - Stellen Sie sicher, dass Ihr Paket bereits auf NPM veröffentlicht ist
   - Überprüfen Sie, dass Sie Maintainer-Berechtigungen für das Paket haben
   - Prüfen Sie, dass der Paketname exakt übereinstimmt

4. **Berechtigungsverweigerte Fehler**
   - Bestätigen Sie, dass Sie Administrator des NPM-Pakets sind
   - Überprüfen Sie Ihre GitHub-Repository-Berechtigungen
   - Stellen Sie sicher, dass die Trusted Publisher-Konfiguration korrekt gespeichert wurde

### Ihre Konfiguration testen

Vor dem Go-Live können Sie die Trusted Publishing-Einrichtung testen:

1. Eine Pre-Release-Version erstellen (z.B. `v1.0.0-beta.1`)
2. Tag erstellen und pushen, um den Workflow auszulösen
3. GitHub Actions-Logs überwachen
4. Überprüfen, dass das Paket auf NPM erscheint
5. NPM-Token erst nach erfolgreichem Testen entfernen

## Sicherheitsüberlegungen

- **Repository-Zugang**: Stellen Sie sicher, dass nur vertrauenswürdige Maintainer Admin-Zugang zu Ihrem Repository haben
- **Workflow-Dateien**: Schützen Sie Ihr `.github/workflows/` Verzeichnis mit Branch-Protection-Regeln
- **Paket-Besitz**: Überprüfen Sie regelmäßig NPM-Paket-Collaboratoren und -Berechtigungen
- **Audit-Logs**: Überwachen Sie NPM- und GitHub-Audit-Logs auf unerwartete Aktivitäten

## Rollback-Plan

Falls Sie zur token-basierten Veröffentlichung zurückkehren müssen:

1. **NPM_TOKEN wieder hinzufügen**: Gehen Sie zu Repository Settings > Secrets und fügen Sie Ihren NPM-Token wieder hinzu
2. **Trusted Publisher entfernen**: Entfernen Sie den GitHub Trusted Publisher aus Ihren NPM-Paket-Einstellungen
3. **Workflow-Änderungen rückgängig machen**: Wenn Sie Ihren Workflow modifiziert haben, kehren Sie zur vorherigen Version zurück
4. **Deployment testen**: Erstellen Sie einen Test-Tag, um zu überprüfen, dass die token-basierte Veröffentlichung funktioniert

## Fazit

Trusted Publishing bietet einen sichereren und wartungsfreundlicheren Weg, Ihre ioBroker-Adapter-Pakete zu veröffentlichen. Der Migrationsprozess ist unkompliziert und bietet erhebliche Sicherheitsvorteile mit minimalen Änderungen an Ihrem bestehenden Workflow.

Falls Sie während der Migration auf Probleme stoßen, konsultieren Sie bitte den Fehlerbehebungsabschnitt oder wenden Sie sich an die ioBroker-Community für Unterstützung.

## Zusätzliche Ressourcen

- [NPM Trusted Publishing Dokumentation](https://docs.npmjs.com/trusted-publishers)
- [GitHub Actions OIDC Dokumentation](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [ioBroker Testing Action](https://github.com/ioBroker/testing)