# Min Dag

Dansk Android-app til en fælles tablet med lokale personprofiler. Kræver Android 8.0 eller nyere. Huawei MediaPad M5 med Android 9 er den tiltænkte enhed.

## Kom i gang

1. Installér den signerede APK på tabletten, og åbn **Min Dag**. Giv filappen tilladelse til at installere APK'en, hvis Android beder om det.
2. Opret én profil pr. person. Du kan vælge en PIN-kode på 4–8 cifre og slå menstruationsloggen til på den enkelte profil.
3. Tilføj en Google-konto i Android, og slå kalendersynkronisering til. Giv Min Dag læseadgang, og vælg de fælles kalendere under **Indstillinger** på fællesoversigten.
4. Vælg en fælles vejrby i **Indstillinger**. Appen henter prognoser fra Open-Meteo.

Kropskortet har forside, bagside og nærbilleder af hoved, ryg, hænder og fødder. Smerter kan registreres flere gange om dagen med styrke, varighed, klokkeslæt i 24-timers format og note. Trivsel, søvn og menstruation kan registreres på tidligere datoer og redigeres i **Historik**. Efter en gemt registrering åbner den aktive profil igen. Efter to minutters inaktivitet åbner fællesoversigten med dagens vejr, aftaler og profilvalg. **Rapport** viser en valgt periode og gemmer den som PDF via Androids filvælger. Cyklus og noter tilvælges i rapporten.

Hver profil har separat historik. Registreringerne gemmes lokalt og krypteres med en nøgle i Android Keystore. APK-opdateringer skal signeres med den samme nøgle for at kunne installeres oven på en eksisterende version. Afinstallation sletter de lokale data. Kalenderen læser aftaler fra Androids synkroniserede kalendere, og vejr kræver internet.

## Byg på Windows

Brug en JDK, Android SDK Platform 34, Android Build Tools 34.0.0 og [R8 8.7.18](https://dl.google.com/dl/android/maven2/com/android/tools/r8/8.7.18/r8-8.7.18.jar). Kør fra projektmappen i PowerShell, og indsæt dine egne stier.

```powershell
.\build.ps1 -PlatformJar 'C:\Android\Sdk\platforms\android-34\android.jar' -BuildTools 'C:\Android\Sdk\build-tools\34.0.0' -R8Jar 'C:\Android\r8-8.7.18.jar'
```

APK'en ligger i `build/Min-Dag.apk`. Bevar den lokale signeringsnøgle i `build/min-dag-local.jks`, hvis du bygger opdateringer til samme installation. Hold signeringsnøglen privat.
