# How to create an object dump

This file describes how to create an dump of an adapters object structure. This json based dump can be used for analyses of correct object definitions and to verify type and roles used.

## Preparation

- Install the latest version of the adapter and configure it according to its description. 
- Start the adapetr and ensure that it is working as expected. Make sure that it is connected to a device (if used by this adapter) and that all typical data is retrieved.
- Verify at admin -> objectbrowser that all statey typiocally created by this adapter exist.

## Creating the dump

- Open admin interface
- Activate expert mode - the face symbol should be green
  ![image](https://github.com/user-attachments/assets/b1116330-cc44-4c45-97ad-81320401b1b0)
- open object browser and expand adapter you want to analyse
- select instance of adapter (typically 0)
  ![image](https://github.com/user-attachments/assets/f000a927-0ee8-46e4-9f1e-4bf5cbaf95f8)
- select download Button
  ![image](https://github.com/user-attachments/assets/26fec9b9-2f56-44ca-9d7d-5911a91b3310)
- keep defaults (as shown below) and click "Only selected"
  !![image](https://github.com/user-attachments/assets/5c447e3e-b4b9-4bb3-89e3-52b74e045d79)

You will see a fileselector to specify the filename for download. The defaul filename will be adapter.instance#.json. Feel free to keep the name or name the file as you prefer.

## Result

The resulting file should look like:

```
{
  "airquality.0.DEBY200": {
    "type": "folder",
    "common": {
      "name": {
        "en": "Measurements from station",
        "de": "Messungen von Station",
        "ru": "Измерения на станции",
        "pt": "Medições da estação",
        "nl": "Metingen vanaf het station",
        "fr": "Mesures de la station",
        "it": "Misure dalla stazione",
        "es": "Medidas desde la estación",
        "pl": "Pomiary ze stacji",
        "uk": "Вимірювання з станції",
        "zh-cn": "从车站测量"
      },
      "desc": "Passau> Angerstr.",
      "role": "info"
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "user": "system.user.admin",
    "ts": 1737404497711,
    "_id": "airquality.0.DEBY200",
    "acl": {
      "object": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    }
  },
  "airquality.0.DEBY200.CO": {
    "type": "state",
    "common": {
      "name": "Kohlenmonoxid",
      "type": "number",
      "role": "value",
      "unit": "mg/m³",
      "read": true,
      "write": false
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "user": "system.user.admin",
    "ts": 1737404498285,
    "_id": "airquality.0.DEBY200.CO",
    "acl": {
      "object": 1636,
      "state": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    },
    "val": 0.57,
    "ack": true
  },
  "airquality.0.DEBY200.NO2": {
    "type": "state",
    "common": {
      "name": "Stickstoffdioxid",
      "type": "number",
      "role": "value",
      "unit": "µg/m³",
      "read": true,
      "write": false
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "user": "system.user.admin",
    "ts": 1737404497720,
    "_id": "airquality.0.DEBY200.NO2",
    "acl": {
      "object": 1636,
      "state": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    },
    "val": 25,
    "ack": true
  },
  "airquality.0.DEBY200.Number_of_measurement_types": {
    "type": "state",
    "common": {
      "name": {
        "en": "Number of measurement types",
        "de": "Anzahl der Messarten",
        "ru": "Число типов измерений",
        "pt": "Número de tipos de medição",
        "nl": "Aantal meettypes",
        "fr": "Nombre de types de mesure",
        "it": "Numero di tipi di misura",
        "es": "Número de tipos de medición",
        "pl": "Liczba typów pomiarów",
        "uk": "Кількість типів вимірювання",
        "zh-cn": "计量类型数目"
      },
      "type": "number",
      "role": "value",
      "unit": "",
      "read": true,
      "write": false
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "user": "system.user.admin",
    "ts": 1737404497751,
    "_id": "airquality.0.DEBY200.Number_of_measurement_types",
    "acl": {
      "object": 1636,
      "state": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    },
    "val": 4,
    "ack": true
  },
  "airquality.0.DEBY200.PM10": {
    "type": "state",
    "common": {
      "name": "Feinstaub",
      "type": "number",
      "role": "value",
      "unit": "µg/m³",
      "read": true,
      "write": false
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "user": "system.user.admin",
    "ts": 1737404497728,
    "_id": "airquality.0.DEBY200.PM10",
    "acl": {
      "object": 1636,
      "state": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    },
    "val": 46,
    "ack": true
  },
  "airquality.0.DEBY200.PM2": {
    "type": "state",
    "common": {
      "name": "Feinstaub",
      "type": "number",
      "role": "value",
      "unit": "µg/m³",
      "read": true,
      "write": false
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "user": "system.user.admin",
    "ts": 1737404497735,
    "_id": "airquality.0.DEBY200.PM2",
    "acl": {
      "object": 1636,
      "state": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    },
    "val": 29,
    "ack": true
  },
  "airquality.0.DEBY200.Time_of_the_last_measurement": {
    "type": "state",
    "common": {
      "name": {
        "en": "Time of the last measurement",
        "de": "Zeit der letzten Messung",
        "ru": "Время последнего измерения",
        "pt": "Tempo da última medição",
        "nl": "Tijd van de laatste meting",
        "fr": "Durée de la dernière mesure",
        "it": "Tempo dell' ultima misura",
        "es": "Tiempo de la última medición",
        "pl": "Czas ostatniego pomiaru",
        "uk": "Час останнього вимірювання",
        "zh-cn": "上次测量的时间"
      },
      "type": "string",
      "role": "text",
      "unit": "",
      "read": true,
      "write": false
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "user": "system.user.admin",
    "ts": 1737404497742,
    "_id": "airquality.0.DEBY200.Time_of_the_last_measurement",
    "acl": {
      "object": 1636,
      "state": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    },
    "val": "22.01.2025 10:00",
    "ack": true
  },
  "airquality.0.info": {
    "_id": "airquality.0.info",
    "type": "channel",
    "common": {
      "name": {
        "en": "Information",
        "de": "Informationen",
        "ru": "Информация",
        "pt": "Informação",
        "nl": "Informatie",
        "fr": "Informations",
        "it": "Informazioni",
        "es": "Información",
        "pl": "Informacje",
        "uk": "Інформація",
        "zh-cn": "资料"
      }
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "ts": 1737547798507,
    "acl": {
      "object": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    },
    "user": "system.user.admin"
  },
  "airquality.0.info.lastUpdate": {
    "_id": "airquality.0.info.lastUpdate",
    "type": "state",
    "common": {
      "role": "date.end",
      "name": {
        "en": "Last update",
        "de": "Letzte Aktualisierung",
        "ru": "Последнее обновление",
        "pt": "Última atualização",
        "nl": "Laatste update",
        "fr": "Dernière mise à jour",
        "it": "Ultimo aggiornamento",
        "es": "Última actualización",
        "pl": "Ostatnia aktualizacja",
        "uk": "Останнє оновлення",
        "zh-cn": "上次更新"
      },
      "type": "number",
      "read": true,
      "write": false,
      "def": 0
    },
    "native": {},
    "from": "system.adapter.airquality.0",
    "ts": 1737547798509,
    "acl": {
      "object": 1636,
      "state": 1636,
      "owner": "system.user.admin",
      "ownerGroup": "system.group.administrator"
    },
    "user": "system.user.admin",
    "val": 1737541619871,
    "ack": true
  }
}
```

This file can be passed for verification i.e. as an attachment to a GitHub issue.

